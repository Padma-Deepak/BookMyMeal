from rest_framework import serializers
from .models import User, MenuItem, Order, ExternalPurchase, Vendor, Bill, CatererBill, Notification
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'role', 'email', 'phone_number')


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        return token


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    """Includes items_detail: items enriched with MenuItem name, price, category."""
    items_detail = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('created_at',)

    def get_items_detail(self, obj):
        enriched = []
        for item in (obj.items or []):
            try:
                mi = MenuItem.objects.get(id=item['menu_item_id'])
                enriched.append({
                    **item,
                    'name': mi.name,
                    'customer_price': float(mi.customer_price),
                    'category': mi.category,
                    'is_complimentary': mi.is_complimentary,
                })
            except (MenuItem.DoesNotExist, KeyError):
                enriched.append(item)
        return enriched


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ('created_at',)


class ExternalPurchaseSerializer(serializers.ModelSerializer):
    vendor_name = serializers.SerializerMethodField()

    class Meta:
        model = ExternalPurchase
        fields = '__all__'
        read_only_fields = ('created_at',)

    def get_vendor_name(self, obj):
        return obj.vendor.name if obj.vendor else None


class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = ('created_at',)


class BillDetailSerializer(serializers.ModelSerializer):
    """Nested bill serializer for guest bill view and manager detail view."""
    guest_detail = UserSerializer(source='guest', read_only=True)
    orders_detail = OrderSerializer(source='orders', many=True, read_only=True)
    external_purchases_detail = ExternalPurchaseSerializer(source='external_purchases', many=True, read_only=True)

    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = ('created_at',)


class CatererBillSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatererBill
        fields = '__all__'
        read_only_fields = ('created_at',)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('created_at',)
