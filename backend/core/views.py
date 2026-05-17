from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

from .models import User, MenuItem, Order, ExternalPurchase, Vendor, Bill, CatererBill, Notification
from .serializers import (
    UserSerializer, MyTokenObtainPairSerializer, MenuItemSerializer,
    OrderSerializer, VendorSerializer, ExternalPurchaseSerializer,
    BillSerializer, BillDetailSerializer, CatererBillSerializer, NotificationSerializer,
)


# ─── Auth ─────────────────────────────────────────────────────────────────────

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─── Users ────────────────────────────────────────────────────────────────────

class UserListView(APIView):
    """Manager/Superuser: list users by role (e.g. ?role=guest for manager dashboard)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ('manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        role_filter = request.query_params.get('role')
        users = User.objects.all()
        if role_filter:
            users = users.filter(role=role_filter)
        return Response(UserSerializer(users, many=True).data)


# ─── Menu Items ───────────────────────────────────────────────────────────────

class MenuItemListCreateView(APIView):
    """
    GET  – Guest: available items only. Caterer: own items. Manager/Superuser: all.
    POST – Caterer or Superuser: add new item.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'guest':
            items = MenuItem.objects.filter(is_available=True)
        elif user.role == 'caterer':
            items = MenuItem.objects.filter(caterer=user)
        else:
            items = MenuItem.objects.all()

        data = MenuItemSerializer(items, many=True).data
        # Caterers must never see customer_price (PRD §4.2.1)
        if user.role == 'caterer':
            for item in data:
                item.pop('customer_price', None)
        return Response(data)

    def post(self, request):
        user = request.user
        if user.role not in ('caterer', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = MenuItemSerializer(data=request.data)
        if serializer.is_valid():
            if user.role == 'caterer':
                serializer.save(caterer=user)
            else:
                serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MenuItemDetailView(APIView):
    """
    PATCH  – Caterer: update own items (availability, notice_period, caterer_price only).
    DELETE – Caterer or Superuser: remove item permanently.
    """
    permission_classes = [IsAuthenticated]

    def _get_item(self, pk, user):
        item = get_object_or_404(MenuItem, pk=pk)
        if user.role == 'caterer' and item.caterer != user:
            return None
        return item

    def patch(self, request, pk):
        user = request.user
        if user.role not in ('caterer', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = self._get_item(pk, user)
        if item is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = request.data.copy()
        # Caterers cannot modify customer_price (PRD §4.2.1)
        if user.role == 'caterer':
            data.pop('customer_price', None)
        serializer = MenuItemSerializer(item, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = request.user
        if user.role not in ('caterer', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = self._get_item(pk, user)
        if item is None:
            return Response(status=status.HTTP_403_FORBIDDEN)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Orders ───────────────────────────────────────────────────────────────────

class OrderListCreateView(APIView):
    """
    GET  – Manager/Caterer/Caretaker: list orders with optional filters.
    POST – Guest: submit a new order.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ('guest', 'manager', 'caterer', 'caretaker', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.all()
        if user.role == 'guest':
            orders = orders.filter(guest=user)
        elif user.role == 'caterer':
            orders = orders.filter(caterer=user)
        elif user.role == 'caretaker':
            orders = orders.filter(status='rejected')

        caterer_id = request.query_params.get('caterer_id')
        guest_id = request.query_params.get('guest_id')
        order_status = request.query_params.get('status')
        if caterer_id:
            orders = orders.filter(caterer_id=caterer_id)
        if guest_id:
            orders = orders.filter(guest_id=guest_id)
        if order_status:
            orders = orders.filter(status=order_status)

        return Response(OrderSerializer(orders, many=True).data)

    def post(self, request):
        user = request.user
        if user.role != 'guest':
            return Response(status=status.HTTP_403_FORBIDDEN)

        items = request.data.get('items', [])
        if not items:
            return Response({'error': 'items is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Auto-resolve caterer from the first menu item (PRD §4.2.1)
        try:
            first_item = MenuItem.objects.get(id=items[0]['menu_item_id'])
            caterer = first_item.caterer
        except (MenuItem.DoesNotExist, KeyError):
            return Response({'error': 'Invalid menu_item_id'}, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency: block exact duplicate submission within 60 seconds (NFR §8.2)
        recent_cutoff = timezone.now() - timedelta(seconds=60)
        duplicate = Order.objects.filter(
            guest=user,
            caterer=caterer,
            created_at__gte=recent_cutoff,
        ).first()
        if duplicate and duplicate.items == items:
            return Response(OrderSerializer(duplicate).data, status=status.HTTP_200_OK)

        data = {
            'guest': user.id,
            'caterer': caterer.id,
            'items': items,
            'allergy_notes': request.data.get('allergy_notes', ''),
        }
        serializer = OrderSerializer(data=data)
        if serializer.is_valid():
            order = serializer.save()
            # Notify caterer of new order (PRD F-06)
            Notification.objects.create(
                recipient=caterer,
                message=f"New order #{order.id} received from {user.username}.",
            )
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderDetailView(APIView):
    """
    PATCH – Caterer: approve/reject with reason.
            Caretaker: modify items on rejected orders.
            Manager/Superuser: general updates.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        order = get_object_or_404(Order, pk=pk)

        if user.role == 'caterer':
            if order.caterer != user:
                return Response(status=status.HTTP_403_FORBIDDEN)
            new_status = request.data.get('status')
            if new_status == 'rejected':
                reason = request.data.get('rejection_reason')
                if not reason:
                    return Response({'error': 'rejection_reason is required'}, status=status.HTTP_400_BAD_REQUEST)
                if reason == 'other' and not request.data.get('rejection_notes'):
                    return Response(
                        {'error': 'rejection_notes is required when reason is other'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                order.status = 'rejected'
                order.rejection_reason = reason
                order.rejection_notes = request.data.get('rejection_notes', '')
                order.save()
                # Route to caretakers only — NOT to guest (PRD §4.2.2)
                for ct in User.objects.filter(role='caretaker'):
                    Notification.objects.create(
                        recipient=ct,
                        message=f"Order #{order.id} rejected by caterer. Reason: {reason}.",
                    )
            elif new_status in ('accepted', 'prepared', 'delivered'):
                order.status = new_status
                order.save()
            else:
                return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(OrderSerializer(order).data)

        elif user.role == 'caretaker':
            if order.status != 'rejected':
                return Response(
                    {'error': 'Only rejected orders can be modified'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            new_items = request.data.get('items')
            if new_items is not None:
                order.items = new_items
            new_status = request.data.get('status')
            if new_status:
                order.status = new_status
            order.save()
            # Notify guest of modification (PRD §4.3.1)
            Notification.objects.create(
                recipient=order.guest,
                message=f"Your order #{order.id} has been updated by the caretaker. Please review your updated order.",
            )
            return Response(OrderSerializer(order).data)

        elif user.role in ('manager', 'superuser'):
            serializer = OrderSerializer(order, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_403_FORBIDDEN)


# ─── External Purchases ───────────────────────────────────────────────────────

class ExternalPurchaseListCreateView(APIView):
    """
    GET  – Manager/Caretaker: list with optional filters.
    POST – Caretaker: log a purchase; auto-registers vendor if new.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ('manager', 'caretaker', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        purchases = ExternalPurchase.objects.all()
        if user.role == 'caretaker':
            purchases = purchases.filter(caretaker=user)
        guest_id = request.query_params.get('guest_id')
        vendor_id = request.query_params.get('vendor_id')
        date = request.query_params.get('date')
        if guest_id:
            purchases = purchases.filter(guest_id=guest_id)
        if vendor_id:
            purchases = purchases.filter(vendor_id=vendor_id)
        if date:
            purchases = purchases.filter(created_at__date=date)
        return Response(ExternalPurchaseSerializer(purchases, many=True).data)

    def post(self, request):
        user = request.user
        if user.role != 'caretaker':
            return Response(status=status.HTTP_403_FORBIDDEN)

        vendor_name = request.data.get('vendor_name', '').strip()
        if not vendor_name:
            return Response({'error': 'vendor_name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Auto-register vendor or increment order_count (PRD F-16)
        try:
            vendor = Vendor.objects.get(name__iexact=vendor_name)
            vendor.order_count += 1
            vendor.save()
        except Vendor.DoesNotExist:
            vendor = Vendor.objects.create(
                name=vendor_name,
                vendor_type='ad-hoc',
                order_count=1,
            )

        data = {
            'order': request.data.get('order'),
            'guest': request.data.get('guest'),
            'caretaker': user.id,
            'vendor': str(vendor.id),
            'item_name': request.data.get('item_name'),
            'quantity': request.data.get('quantity'),
            'cost': request.data.get('cost'),
            'is_paid_by_caretaker': request.data.get('is_paid_by_caretaker', False),
        }
        serializer = ExternalPurchaseSerializer(data=data)
        if serializer.is_valid():
            purchase = serializer.save()
            return Response(ExternalPurchaseSerializer(purchase).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── Vendors ──────────────────────────────────────────────────────────────────

class VendorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(VendorSerializer(Vendor.objects.all(), many=True).data)


class VendorDetailView(APIView):
    """Superuser: edit vendor details (merge duplicates, update, remove). PRD §4.3.2"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if request.user.role != 'superuser':
            return Response(status=status.HTTP_403_FORBIDDEN)
        vendor = get_object_or_404(Vendor, pk=pk)
        serializer = VendorSerializer(vendor, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if request.user.role != 'superuser':
            return Response(status=status.HTTP_403_FORBIDDEN)
        vendor = get_object_or_404(Vendor, pk=pk)
        vendor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Bills ────────────────────────────────────────────────────────────────────

class BillListCreateView(APIView):
    """POST – Manager: generate bill from selected orders + auto-include unpaid external purchases."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ('manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        guest_id = request.data.get('guest_id')
        order_ids = request.data.get('order_ids', [])
        discount_amount = request.data.get('discount_amount', 0)
        discount_percentage = request.data.get('discount_percentage', 0)

        if not guest_id or not order_ids:
            return Response({'error': 'guest_id and order_ids are required'}, status=status.HTTP_400_BAD_REQUEST)

        guest = get_object_or_404(User, pk=guest_id)
        orders = Order.objects.filter(id__in=order_ids, guest=guest)

        bill = Bill.objects.create(
            guest=guest,
            discount_amount=discount_amount,
            discount_percentage=discount_percentage,
        )
        bill.orders.set(orders)

        # Auto-include unpaid external purchases not yet on any bill (PRD F-15)
        already_billed_ids = ExternalPurchase.objects.filter(
            bills__isnull=False
        ).values_list('id', flat=True)
        unpaid = ExternalPurchase.objects.filter(
            guest=guest,
            is_paid_by_caretaker=False,
        ).exclude(id__in=already_billed_ids)
        bill.external_purchases.set(unpaid)
        bill.save()

        # Create one CatererBill per unique caterer in selected orders (PRD F-18)
        caterer_ids = set(orders.values_list('caterer_id', flat=True))
        for caterer_id in caterer_ids:
            CatererBill.objects.get_or_create(
                caterer=User.objects.get(pk=caterer_id),
                bill=bill,
            )

        return Response(BillSerializer(bill).data, status=status.HTTP_201_CREATED)


class BillDetailView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        bill = get_object_or_404(Bill, pk=pk)
        if user.role == 'guest' and bill.guest != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.role not in ('guest', 'manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(BillDetailSerializer(bill).data)

    def patch(self, request, pk):
        """Approve payment + upload proof screenshot (PRD §4.4.4)."""
        user = request.user
        if user.role not in ('manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        bill = get_object_or_404(Bill, pk=pk)
        if 'status' in request.data:
            bill.status = request.data['status']
        if 'payment_screenshot' in request.FILES:
            bill.payment_screenshot = request.FILES['payment_screenshot']
        bill.save()
        return Response(BillSerializer(bill).data)


class BillPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        bill = get_object_or_404(Bill, pk=pk)
        if user.role == 'guest' and bill.guest != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.role not in ('guest', 'manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        # TODO: PDF generation (pip install reportlab, then implement)
        return Response(
            {'detail': 'PDF generation not yet implemented.'},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


# ─── Bill Payments ────────────────────────────────────────────────────────────

class BillPaymentView(APIView):
    """Manager: upload guest payment screenshot. Caterer: upload caterer payment proof."""
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ('manager', 'caterer', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)

        bill_id = request.data.get('bill_id')
        bill = get_object_or_404(Bill, pk=bill_id)

        if user.role in ('manager', 'superuser'):
            if 'screenshot' in request.FILES:
                bill.payment_screenshot = request.FILES['screenshot']
                bill.save()
            return Response(BillSerializer(bill).data)

        # Caterer uploads proof they were paid (PRD §4.4.4)
        caterer_bill = get_object_or_404(CatererBill, bill=bill, caterer=user)
        if 'screenshot' in request.FILES:
            caterer_bill.payment_screenshot = request.FILES['screenshot']
        caterer_bill.status = 'paid'
        caterer_bill.save()
        return Response(CatererBillSerializer(caterer_bill).data)


# ─── Caterer Bills ────────────────────────────────────────────────────────────

class CatererBillDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        caterer_bill = get_object_or_404(CatererBill, pk=pk)
        if user.role == 'caterer' and caterer_bill.caterer != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.role not in ('caterer', 'manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(CatererBillSerializer(caterer_bill).data)


class CatererBillPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        caterer_bill = get_object_or_404(CatererBill, pk=pk)
        if user.role == 'caterer' and caterer_bill.caterer != user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.role not in ('caterer', 'manager', 'superuser'):
            return Response(status=status.HTTP_403_FORBIDDEN)
        # TODO: PDF generation (pip install reportlab, then implement)
        return Response(
            {'detail': 'PDF generation not yet implemented.'},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            recipient=request.user
        ).order_by('-created_at')
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)
