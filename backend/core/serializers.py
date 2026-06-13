import uuid
from decimal import Decimal
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db import transaction
from django.conf import settings as django_settings

from .models import (
    User, MenuItem, Order, OrderItem, Vendor,
    ExternalPurchase, Bill, BillPayment, Notification,
)


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone_number', 'password']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# ─── Menu Items ───────────────────────────────────────────────────────────────

class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = [
            'id', 'caterer', 'name', 'description', 'category',
            'caterer_price', 'customer_price', 'is_available',
            'is_complimentary', 'notice_period_minutes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'caterer']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if role == 'caterer':
            data.pop('customer_price', None)
        elif role in ('guest', 'caretaker'):
            data.pop('caterer_price', None)
        return data

    def _apply_markup(self, validated_data):
        if 'caterer_price' in validated_data:
            markup = getattr(django_settings, 'PRICE_MARKUP_PERCENTAGE', 20)
            factor = Decimal('1') + Decimal(str(markup)) / Decimal('100')
            validated_data['customer_price'] = validated_data['caterer_price'] * factor

    def create(self, validated_data):
        self._apply_markup(validated_data)
        validated_data['caterer'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._apply_markup(validated_data)
        return super().update(instance, validated_data)


# ─── Orders ───────────────────────────────────────────────────────────────────

class OrderItemReadSerializer(serializers.ModelSerializer):
    menu_item_id = serializers.UUIDField(source='menu_item.id', read_only=True)
    name = serializers.CharField(source='menu_item.name', read_only=True)
    customer_price = serializers.DecimalField(
        source='menu_item.customer_price', max_digits=8, decimal_places=2, read_only=True
    )
    caterer_price = serializers.DecimalField(
        source='menu_item.caterer_price', max_digits=8, decimal_places=2, read_only=True
    )
    category = serializers.CharField(source='menu_item.category', read_only=True)
    is_complimentary = serializers.BooleanField(source='menu_item.is_complimentary', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'menu_item_id', 'name', 'customer_price', 'caterer_price',
            'category', 'is_complimentary', 'quantity', 'spicy_level',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if role == 'caterer':
            data.pop('customer_price', None)
        elif role in ('guest', 'caretaker'):
            data.pop('caterer_price', None)
        return data


class OrderItemWriteSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)
    spicy_level = serializers.ChoiceField(
        choices=['None', 'Mild', 'Medium', 'Hot'], default='None'
    )


class OrderSerializer(serializers.ModelSerializer):
    # Write field — accepts [{menu_item_id, quantity, spicy_level}]
    items = OrderItemWriteSerializer(many=True, write_only=True, min_length=1)
    # Read field — full item detail
    items_detail = OrderItemReadSerializer(source='items', many=True, read_only=True)
    # guest returns UUID; guest_detail returns full object
    guest = serializers.UUIDField(source='guest.id', read_only=True)
    guest_detail = UserSerializer(source='guest', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'guest', 'guest_detail', 'status',
            'items', 'items_detail',
            'allergy_notes', 'rejection_reason', 'rejection_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'guest', 'guest_detail']

    def _save_items(self, order, items_data):
        order.items.all().delete()
        menu_item_ids = [item['menu_item_id'] for item in items_data]
        menu_items = {str(m.id): m for m in MenuItem.objects.filter(id__in=menu_item_ids)}
        missing = [str(mid) for mid in menu_item_ids if str(mid) not in menu_items]
        if missing:
            raise serializers.ValidationError({'items': f'Menu item(s) not found: {missing}'})
        bulk = [
            OrderItem(
                order=order,
                menu_item=menu_items[str(item['menu_item_id'])],
                quantity=item['quantity'],
                spicy_level=item.get('spicy_level', 'None'),
            )
            for item in items_data
        ]
        OrderItem.objects.bulk_create(bulk)

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        validated_data['guest'] = self.context['request'].user
        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            self._save_items(order, items_data)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._save_items(instance, items_data)
        return instance


# ─── Vendors ──────────────────────────────────────────────────────────────────

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ['id', 'name', 'vendor_type', 'order_count', 'created_at']
        read_only_fields = ['id', 'vendor_type', 'order_count', 'created_at']


# ─── External Purchases ───────────────────────────────────────────────────────

class ExternalPurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalPurchase
        fields = [
            'id', 'guest', 'order', 'vendor_name', 'item_name',
            'quantity', 'cost', 'is_paid_by_caretaker',
            'is_reimbursed', 'reimbursement_proof', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        vendor_name = validated_data.get('vendor_name', '').strip()
        # Auto-register vendor if new (case-insensitive match); increment order_count either way
        try:
            vendor = Vendor.objects.get(name__iexact=vendor_name)
        except Vendor.DoesNotExist:
            vendor = Vendor.objects.create(name=vendor_name, vendor_type='ad-hoc')
        vendor.order_count += 1
        vendor.save(update_fields=['order_count'])
        validated_data['vendor'] = vendor
        validated_data['caretaker'] = self.context['request'].user
        return super().create(validated_data)


class ExternalPurchaseDetailSerializer(serializers.ModelSerializer):
    reimbursement_proof_url = serializers.SerializerMethodField()

    class Meta:
        model = ExternalPurchase
        fields = [
            'id', 'vendor_name', 'item_name', 'quantity', 'cost',
            'is_paid_by_caretaker', 'is_reimbursed', 'reimbursement_proof_url',
        ]

    def get_reimbursement_proof_url(self, obj):
        if not obj.reimbursement_proof:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.reimbursement_proof.url) if request else obj.reimbursement_proof.url


# ─── Bills ────────────────────────────────────────────────────────────────────

class BillSerializer(serializers.ModelSerializer):
    # Write-only inputs
    guest_id = serializers.UUIDField(write_only=True)
    order_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True)

    # Read-only nested output
    guest_detail = UserSerializer(source='guest', read_only=True)
    orders_detail = OrderSerializer(source='orders', many=True, read_only=True)
    external_purchases_detail = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id', 'guest_id', 'guest_detail',
            'order_ids', 'orders_detail',
            'external_purchases_detail',
            'status', 'discount_amount', 'discount_percentage',
            'payment_screenshot', 'pdf_url', 'grand_total', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_external_purchases_detail(self, obj):
        purchases = ExternalPurchase.objects.filter(guest=obj.guest, is_paid_by_caretaker=False)
        return ExternalPurchaseDetailSerializer(purchases, many=True, context=self.context).data

    def get_grand_total(self, obj):
        orders_sub = sum(
            Decimal(str(item.menu_item.customer_price)) * item.quantity
            for order in obj.orders.prefetch_related('items__menu_item').all()
            for item in order.items.all()
            if not item.menu_item.is_complimentary
        )
        ext_sub = sum(
            ep.cost
            for ep in ExternalPurchase.objects.filter(guest=obj.guest, is_paid_by_caretaker=False)
        )
        subtotal = orders_sub + ext_sub
        if obj.discount_amount and obj.discount_amount > 0:
            return float(subtotal - obj.discount_amount)
        if obj.discount_percentage and obj.discount_percentage > 0:
            return float(subtotal - subtotal * obj.discount_percentage / 100)
        return float(subtotal)

    def get_pdf_url(self, obj):
        request = self.context.get('request')
        path = f'/api/bills/{obj.id}/pdf/'
        return request.build_absolute_uri(path) if request else path

    def create(self, validated_data):
        guest_id = validated_data.pop('guest_id')
        order_ids = validated_data.pop('order_ids')
        try:
            guest = User.objects.get(id=guest_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({'guest_id': 'Guest not found.'})
        with transaction.atomic():
            bill = Bill.objects.create(
                guest=guest,
                created_by=self.context['request'].user,
                **validated_data,
            )
            orders = Order.objects.filter(id__in=order_ids, guest=guest)
            bill.orders.set(orders)
        return bill


# ─── Caterer Bill (uses caterer_price) ────────────────────────────────────────

class CatererOrderItemSerializer(serializers.ModelSerializer):
    menu_item_id = serializers.UUIDField(source='menu_item.id', read_only=True)
    name = serializers.CharField(source='menu_item.name', read_only=True)
    caterer_price = serializers.DecimalField(
        source='menu_item.caterer_price', max_digits=8, decimal_places=2, read_only=True
    )
    is_complimentary = serializers.BooleanField(source='menu_item.is_complimentary', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['menu_item_id', 'name', 'caterer_price', 'is_complimentary', 'quantity', 'spicy_level']


class CatererOrderSerializer(serializers.ModelSerializer):
    items_detail = CatererOrderItemSerializer(source='items', many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'status', 'items_detail', 'allergy_notes', 'created_at']


class CatererBillSerializer(serializers.ModelSerializer):
    bill_date = serializers.DateTimeField(source='created_at', read_only=True)
    is_paid = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    total_caterer_amount = serializers.SerializerMethodField()
    payment_proof_url = serializers.SerializerMethodField()
    stay_start = serializers.SerializerMethodField()
    stay_end = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id', 'bill_date', 'stay_start', 'stay_end',
            'items', 'total_caterer_amount', 'is_paid', 'payment_proof_url',
        ]

    def _caterer_filter(self, obj):
        """Return the caterer user if the requester is a caterer, else None (manager sees all)."""
        user = self.context.get('request').user if self.context.get('request') else None
        return user if user and user.role == 'caterer' else None

    def get_is_paid(self, obj):
        return obj.status == 'paid'

    def get_items(self, obj):
        caterer = self._caterer_filter(obj)
        result = []
        for order in obj.orders.prefetch_related('items__menu_item').all():
            for item in order.items.select_related('menu_item').all():
                if caterer and item.menu_item.caterer_id != caterer.id:
                    continue
                result.append({
                    'item_name': item.menu_item.name,
                    'quantity': item.quantity,
                    'caterer_price': float(item.menu_item.caterer_price),
                    'line_total': float(item.menu_item.caterer_price) * item.quantity,
                })
        return result

    def get_total_caterer_amount(self, obj):
        caterer = self._caterer_filter(obj)
        total = 0.0
        for order in obj.orders.prefetch_related('items__menu_item').all():
            for item in order.items.select_related('menu_item').all():
                if caterer and item.menu_item.caterer_id != caterer.id:
                    continue
                total += float(item.menu_item.caterer_price) * item.quantity
        return total

    def get_payment_proof_url(self, obj):
        payment = obj.caterer_payments.order_by('-created_at').first()
        if payment and payment.screenshot:
            request = self.context.get('request')
            return request.build_absolute_uri(payment.screenshot.url) if request else payment.screenshot.url
        return None

    def get_stay_start(self, obj):
        first_order = obj.orders.order_by('created_at').first()
        return first_order.created_at.isoformat() if first_order else None

    def get_stay_end(self, obj):
        last_order = obj.orders.order_by('-created_at').first()
        return last_order.created_at.isoformat() if last_order else None


# ─── Bill Payments ────────────────────────────────────────────────────────────

class BillPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillPayment
        fields = ['id', 'bill', 'screenshot', 'created_at']
        read_only_fields = ['id', 'created_at', 'uploaded_by']

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'message', 'created_at']
