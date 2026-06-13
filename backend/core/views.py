from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    User, MenuItem, Order, Vendor,
    ExternalPurchase, Bill, BillPayment, Notification,
)
from .serializers import (
    MyTokenObtainPairSerializer, UserSerializer,
    MenuItemSerializer, OrderSerializer,
    VendorSerializer, ExternalPurchaseSerializer,
    BillSerializer, CatererBillSerializer,
    BillPaymentSerializer, NotificationSerializer,
)
from .permissions import IsManagerOrAbove


# ─── Helpers ──────────────────────────────────────────────────────────────────

def notify(user, message):
    Notification.objects.create(user=user, message=message)


# ─── Auth ─────────────────────────────────────────────────────────────────────

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/me/ — the logged-in user's own profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListView(generics.ListCreateAPIView):
    """
    GET  /api/users/?role=guest — list users, filterable by role.
    POST /api/users/ — manager creates a new user (e.g. a guest account).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.all()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ('manager', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only managers can create users.")
        serializer.save()


# ─── Menu Items ───────────────────────────────────────────────────────────────

class MenuItemListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/menu-items/ — guests/caretakers/managers see available items;
                             caterers see only their own items (all availability states).
    POST /api/menu-items/ — caterer or superuser only.
    """
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'caterer':
            return MenuItem.objects.filter(caterer=user)
        return MenuItem.objects.filter(is_available=True)

    def perform_create(self, serializer):
        if self.request.user.role not in ('caterer', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only caterers can create menu items.")
        serializer.save()


class MenuItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/menu-items/<uuid>/ — any authenticated user.
    PATCH  /api/menu-items/<uuid>/ — caterer (own items) or superuser.
    DELETE /api/menu-items/<uuid>/ — caterer (own items) or superuser.
    """
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'caterer':
            return MenuItem.objects.filter(caterer=user)
        return MenuItem.objects.all()

    def update(self, request, *args, **kwargs):
        if request.user.role not in ('caterer', 'superuser'):
            return Response({'detail': 'Only caterers can update menu items.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('caterer', 'superuser'):
            return Response({'detail': 'Only caterers can delete menu items.'}, status=403)
        return super().destroy(request, *args, **kwargs)


# ─── Orders ───────────────────────────────────────────────────────────────────

class OrderListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/orders/ — role-scoped; supports ?status=, ?guest_id=, ?caterer_id=
    POST /api/orders/ — guest places a new order.
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.select_related('guest').prefetch_related('items__menu_item')

        if user.role == 'guest':
            qs = qs.filter(guest=user)
        elif user.role == 'caterer':
            qs = qs.filter(items__menu_item__caterer=user).distinct()
        elif user.role == 'caretaker':
            pass  # caretakers see all orders to manage rejections
        elif user.role in ('manager', 'superuser'):
            guest_id = self.request.query_params.get('guest_id')
            if guest_id:
                qs = qs.filter(guest__id=guest_id)

        # PRD §5: ?caterer_id= filter supported for Manager and Caterer
        caterer_id = self.request.query_params.get('caterer_id')
        if caterer_id:
            qs = qs.filter(items__menu_item__caterer__id=caterer_id).distinct()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ('guest', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only guests can place orders.")
        order = serializer.save()
        # Notify caterers whose items are in this order (PRD §4.2.2)
        caterer_ids = (
            order.items
            .values_list('menu_item__caterer_id', flat=True)
            .distinct()
        )
        for caterer in User.objects.filter(id__in=caterer_ids):
            notify(caterer, f"New order from {order.guest.username} — please review.")


class OrderDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/orders/<uuid>/ — retrieve single order.
    PATCH /api/orders/<uuid>/ — caterer updates status; caretaker modifies items.
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.select_related('guest').prefetch_related('items__menu_item')
        if user.role == 'guest':
            return qs.filter(guest=user)
        if user.role == 'caterer':
            return qs.filter(items__menu_item__caterer=user).distinct()
        return qs

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        user = request.user

        if user.role == 'caterer':
            if not order.items.filter(menu_item__caterer=user).exists():
                return Response({'detail': 'This order does not contain your items.'}, status=403)
            new_status = request.data.get('status', order.status)
            # Enforce status machine: caterer can only transition from valid states
            decision_statuses = {'accepted', 'rejected', 'partially_accepted'}
            prep_statuses = {'prepared', 'delivered'}
            if new_status in decision_statuses and order.status != 'pending':
                return Response(
                    {'detail': f'Cannot change status to {new_status}: order is already {order.status}.'},
                    status=400
                )
            if new_status in prep_statuses and order.status not in ('accepted', 'partially_accepted', 'prepared'):
                return Response(
                    {'detail': f'Cannot mark as {new_status}: order must be accepted or partially_accepted first.'},
                    status=400
                )
            allowed = {'status', 'rejection_reason', 'rejection_notes', 'items'}
            data = {k: v for k, v in request.data.items() if k in allowed}
            # rejection_reason is required when rejecting
            if data.get('status') == 'rejected' and not data.get('rejection_reason'):
                return Response(
                    {'detail': 'rejection_reason is required when rejecting an order.'},
                    status=400
                )
            serializer = self.get_serializer(order, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            new_status = data.get('status', order.status)
            if new_status == 'accepted':
                notify(order.guest, "Your order has been accepted by the caterer.")
            elif new_status == 'partially_accepted':
                notify(order.guest, "Your order was partially accepted. Some items are being sourced externally.")
                reason = data.get('rejection_reason', '')
                notes = data.get('rejection_notes', '')
                for caretaker in User.objects.filter(role='caretaker'):
                    notify(
                        caretaker,
                        f"Order for {order.guest.username} was partially rejected ({notes or reason}). Please source the missing items."
                    )
            elif new_status == 'prepared':
                notify(order.guest, "Your order is ready for collection.")
            elif new_status == 'rejected':
                reason = data.get('rejection_reason', '')
                # PRD §4.2.2: rejection is routed to Caretaker, NOT guest directly
                for caretaker in User.objects.filter(role='caretaker'):
                    notify(
                        caretaker,
                        f"Order for {order.guest.username} was rejected ({reason}). Please handle."
                    )
            return Response(serializer.data)

        elif user.role in ('caretaker', 'superuser'):
            if order.status not in ('rejected', 'pending', 'partially_accepted') and user.role != 'superuser':
                return Response({'detail': 'Only rejected or pending orders can be resolved.'}, status=400)
            data = dict(request.data)
            explicit_status = data.get('status')
            # If the caretaker is explicitly resolving: keep 'resolved'.
            # Otherwise (legacy modify flow): force 'pending' when items are changed.
            if 'items' in data and explicit_status != 'resolved':
                data['status'] = 'pending'
            serializer = self.get_serializer(order, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            # Notify guest per spec
            notify(order.guest, "Your order has been updated. Tap to review.")
            # Re-notify caterers only when the order goes back to pending (not resolved)
            if data.get('status') != 'resolved':
                caterer_ids = (
                    order.items
                    .values_list('menu_item__caterer_id', flat=True)
                    .distinct()
                )
                for caterer in User.objects.filter(id__in=caterer_ids):
                    notify(caterer, f"A modified order for {order.guest.username} is ready for review.")
            return Response(serializer.data)

        elif user.role == 'manager':
            serializer = self.get_serializer(order, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return Response({'detail': 'Permission denied.'}, status=403)


# ─── External Purchases ───────────────────────────────────────────────────────

class ExternalPurchaseListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/external-purchases/ — manager/caretaker scoped list.
    POST /api/external-purchases/ — caretaker logs a purchase; auto-registers vendor.
    """
    serializer_class = ExternalPurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ExternalPurchase.objects.select_related('guest', 'vendor')
        if user.role in ('manager', 'superuser'):
            guest_id = self.request.query_params.get('guest_id')
            if guest_id:
                qs = qs.filter(guest__id=guest_id)
            return qs
        if user.role == 'caretaker':
            return qs.filter(caretaker=user)
        return qs.filter(guest=user)

    def perform_create(self, serializer):
        if self.request.user.role not in ('caretaker', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only caretakers can log external purchases.")
        ep = serializer.save()
        # PRD §4.3.2: if unpaid by caretaker, it goes on the guest bill
        if not ep.is_paid_by_caretaker:
            notify(ep.guest, f"A purchase of '{ep.item_name}' (₹{ep.cost}) has been added to your bill.")


class ExternalPurchaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/external-purchases/<uuid>/ — manager or the logging caretaker.
    PATCH  /api/external-purchases/<uuid>/ — manager marks reimbursed + uploads proof.
    DELETE /api/external-purchases/<uuid>/ — caretaker deletes their own purchase record.
    """
    serializer_class = ExternalPurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('manager', 'superuser'):
            return ExternalPurchase.objects.select_related('guest', 'vendor').all()
        if user.role == 'caretaker':
            return ExternalPurchase.objects.select_related('guest', 'vendor').filter(caretaker=user)
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Access denied.")

    def partial_update(self, request, *args, **kwargs):
        if request.user.role not in ('manager', 'superuser'):
            return Response({'detail': 'Only managers can update external purchases.'}, status=403)
        ep = self.get_object()
        data = {}
        if 'is_reimbursed' in request.data:
            data['is_reimbursed'] = request.data['is_reimbursed']
        if 'reimbursement_proof' in request.FILES:
            data['reimbursement_proof'] = request.FILES['reimbursement_proof']
        serializer = self.get_serializer(ep, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if user.role not in ('caretaker', 'manager', 'superuser'):
            return Response({'detail': 'Access denied.'}, status=403)
        ep = self.get_object()
        if user.role == 'caretaker' and ep.caretaker != user:
            return Response({'detail': 'You can only delete your own purchases.'}, status=403)
        ep.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Vendors ──────────────────────────────────────────────────────────────────

class VendorListView(generics.ListAPIView):
    """GET /api/vendors/ — manager or superuser."""
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role not in ('manager', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only managers and superusers can view vendors.")
        return Vendor.objects.all()


class VendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH/DELETE /api/vendors/<uuid>/ — superuser only."""
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != 'superuser':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only superusers can edit or delete vendors.")
        return Vendor.objects.all()


# ─── Bills ────────────────────────────────────────────────────────────────────

class BillListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/bills/ — manager/superuser sees all bills; guest sees own.
    POST /api/bills/ — manager generates a new bill.
    """
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Bill.objects.select_related('guest').prefetch_related('orders__items__menu_item')
        if user.role == 'guest':
            return qs.filter(guest=user)
        if user.role in ('manager', 'superuser'):
            return qs
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Access denied.")

    def perform_create(self, serializer):
        if self.request.user.role not in ('manager', 'superuser'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only managers can generate bills.")
        serializer.save()


class BillDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/bills/<uuid>/ — manager or the guest whose bill it is (PRD §5).
    PATCH /api/bills/<uuid>/ — manager approves payment (multipart: status=paid + screenshot).
    """
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Bill.objects.select_related('guest').prefetch_related('orders__items__menu_item')
        if user.role == 'guest':
            return qs.filter(guest=user)
        if user.role in ('manager', 'superuser'):
            return qs
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Access denied.")

    def partial_update(self, request, *args, **kwargs):
        if request.user.role not in ('manager', 'superuser'):
            return Response({'detail': 'Only managers can update bills.'}, status=403)
        bill = self.get_object()
        serializer = self.get_serializer(bill, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if request.data.get('status') == 'paid':
            notify(bill.guest, "Your bill has been marked as paid. Thank you!")
        return Response(serializer.data)


class BillPDFView(APIView):
    """GET /api/bills/<uuid>/pdf/ — guest or manager downloads the guest-facing PDF."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        if user.role == 'guest':
            bill = get_object_or_404(
                Bill.objects.prefetch_related('orders__items__menu_item'),
                pk=pk, guest=user
            )
        elif user.role in ('manager', 'superuser'):
            bill = get_object_or_404(
                Bill.objects.prefetch_related('orders__items__menu_item'),
                pk=pk
            )
        else:
            return Response({'detail': 'Permission denied.'}, status=403)
        return generate_bill_pdf(bill, mode='guest')


class BillPaymentView(generics.CreateAPIView):
    """POST /api/bill-payments/ — manager uploads caterer payment proof."""
    serializer_class = BillPaymentSerializer
    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def get_queryset(self):
        return BillPayment.objects.all()


# ─── Caterer Bills ────────────────────────────────────────────────────────────

class CatererBillListView(generics.ListAPIView):
    """GET /api/caterer-bills/ — list of bills relevant to the caterer (payout history)."""
    serializer_class = CatererBillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('manager', 'superuser'):
            return Bill.objects.all()
        if user.role == 'caterer':
            return Bill.objects.filter(orders__items__menu_item__caterer=user).distinct()
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Access denied.")


class CatererBillDetailView(generics.RetrieveAPIView):
    """GET /api/caterer-bills/<uuid>/ — caterer-side view (uses caterer_price)."""
    serializer_class = CatererBillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('manager', 'superuser'):
            return Bill.objects.all()
        if user.role == 'caterer':
            return Bill.objects.filter(orders__items__menu_item__caterer=user).distinct()
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Access denied.")


class CatererBillPDFView(APIView):
    """GET /api/caterer-bills/<uuid>/pdf/ — caterer-facing bill PDF."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        if user.role not in ('caterer', 'manager', 'superuser'):
            return Response({'detail': 'Permission denied.'}, status=403)
        if user.role == 'caterer':
            bill = get_object_or_404(
                Bill.objects.filter(orders__items__menu_item__caterer=user).distinct()
                    .prefetch_related('orders__items__menu_item'),
                pk=pk
            )
        else:
            bill = get_object_or_404(
                Bill.objects.prefetch_related('orders__items__menu_item'),
                pk=pk
            )
        return generate_bill_pdf(bill, mode='caterer')


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    """GET /api/notifications/ — current user's notifications."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(generics.UpdateAPIView):
    """PATCH /api/notifications/<uuid>/read/ — mark a notification as read."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)


# ─── PDF Generation ───────────────────────────────────────────────────────────

def generate_bill_pdf(bill, mode='guest'):
    """
    Render a bill to PDF using reportlab.
    mode='guest'   → customer_price, includes external purchases
    mode='caterer' → caterer_price, no external purchases
    Falls back to plain text if reportlab is not installed.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
        import io

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 2 * cm

        # Header
        p.setFont("Helvetica-Bold", 18)
        p.drawString(2 * cm, y, "BookMyMeal")
        y -= 0.6 * cm
        p.setFont("Helvetica", 10)
        p.setFillColor(colors.grey)
        label = "Guest Bill" if mode == 'guest' else "Caterer Bill"
        p.drawString(2 * cm, y, f"{label}  |  Bill #{str(bill.id)[:8].upper()}")
        y -= 0.5 * cm
        p.drawString(2 * cm, y, f"Generated: {bill.created_at.strftime('%d %b %Y %H:%M')}")
        y -= 0.5 * cm
        p.setFillColor(colors.black)
        p.drawString(2 * cm, y, f"Guest: {bill.guest.username}")
        if bill.guest.phone_number:
            p.drawString(10 * cm, y, f"Phone: {bill.guest.phone_number}")
        y -= 0.8 * cm

        # Order line items
        subtotal = 0
        for order in bill.orders.all():
            p.setFont("Helvetica-Bold", 10)
            p.drawString(
                2 * cm, y,
                f"Order #{str(order.id)[:8].upper()}  —  {order.created_at.strftime('%d %b %Y %H:%M')}"
            )
            y -= 0.5 * cm
            p.setFont("Helvetica", 9)
            for item in order.items.select_related('menu_item').all():
                if item.menu_item.is_complimentary:
                    line_total = 0
                    price_str = "₹0 (Complimentary)"
                else:
                    price = item.menu_item.caterer_price if mode == 'caterer' else item.menu_item.customer_price
                    line_total = float(price) * item.quantity
                    price_str = f"₹{float(price):.2f} × {item.quantity} = ₹{line_total:.2f}"
                subtotal += line_total
                p.drawString(2.5 * cm, y, item.menu_item.name)
                p.drawRightString(width - 2 * cm, y, price_str)
                y -= 0.45 * cm
                if y < 3 * cm:
                    p.showPage()
                    y = height - 2 * cm
            y -= 0.3 * cm

        # External purchases — guest bill only (PRD §4.4.2)
        if mode == 'guest':
            ext_purchases = bill.guest.external_purchases.filter(is_paid_by_caretaker=False)
            if ext_purchases.exists():
                p.setFont("Helvetica-Bold", 10)
                p.drawString(2 * cm, y, "Caretaker Purchases")
                y -= 0.5 * cm
                p.setFont("Helvetica", 9)
                for ep in ext_purchases:
                    line_total = float(ep.cost)
                    subtotal += line_total
                    p.drawString(2.5 * cm, y, f"{ep.item_name}  ({ep.vendor_name})")
                    p.drawRightString(width - 2 * cm, y, f"₹{line_total:.2f} × {ep.quantity}")
                    y -= 0.45 * cm

        # Totals
        y -= 0.3 * cm
        p.setStrokeColor(colors.grey)
        p.line(2 * cm, y, width - 2 * cm, y)
        y -= 0.5 * cm

        grand_total = subtotal
        if bill.discount_amount and float(bill.discount_amount) > 0:
            discount = float(bill.discount_amount)
            p.setFont("Helvetica", 10)
            p.drawString(2 * cm, y, "Discount")
            p.drawRightString(width - 2 * cm, y, f"-₹{discount:.2f}")
            grand_total -= discount
            y -= 0.45 * cm
        elif bill.discount_percentage and float(bill.discount_percentage) > 0:
            discount = subtotal * float(bill.discount_percentage) / 100
            p.setFont("Helvetica", 10)
            p.drawString(2 * cm, y, f"Discount ({float(bill.discount_percentage):.1f}%)")
            p.drawRightString(width - 2 * cm, y, f"-₹{discount:.2f}")
            grand_total -= discount
            y -= 0.45 * cm

        p.setFont("Helvetica-Bold", 12)
        p.drawString(2 * cm, y, "Total")
        p.drawRightString(width - 2 * cm, y, f"₹{grand_total:.2f}")
        y -= 0.6 * cm

        p.setFillColor(colors.green if bill.status == 'paid' else colors.orange)
        p.setFont("Helvetica-Bold", 14)
        p.drawString(2 * cm, y, "PAID" if bill.status == 'paid' else "UNPAID")

        p.showPage()
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="bill_{str(bill.id)[:8]}.pdf"'
        return response

    except ImportError:
        return HttpResponse(
            "PDF generation requires reportlab. Run: pip install reportlab",
            status=501,
            content_type='text/plain',
        )
