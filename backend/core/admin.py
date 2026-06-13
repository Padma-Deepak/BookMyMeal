from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, MenuItem, Order, OrderItem, Vendor,
    ExternalPurchase, Bill, BillPayment, Notification,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'phone_number', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('BookMyMeal', {'fields': ('role', 'phone_number')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('BookMyMeal', {'fields': ('role', 'phone_number')}),
    )


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'caterer', 'category', 'caterer_price', 'customer_price',
                    'is_available', 'is_complimentary', 'notice_period_minutes')
    list_filter = ('category', 'is_available', 'is_complimentary', 'caterer')
    search_fields = ('name', 'caterer__username')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('menu_item', 'quantity', 'spicy_level')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id_short', 'guest', 'status', 'allergy_notes', 'created_at')
    list_filter = ('status',)
    search_fields = ('guest__username',)
    inlines = [OrderItemInline]
    readonly_fields = ('id', 'created_at', 'updated_at')

    def id_short(self, obj):
        return str(obj.id)[:8].upper()
    id_short.short_description = 'ID'


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor_type', 'created_at')
    list_filter = ('vendor_type',)
    search_fields = ('name',)


@admin.register(ExternalPurchase)
class ExternalPurchaseAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'guest', 'caretaker', 'vendor_name', 'cost',
                    'is_paid_by_caretaker', 'created_at')
    list_filter = ('is_paid_by_caretaker',)
    search_fields = ('guest__username', 'vendor_name', 'item_name')


class BillPaymentInline(admin.TabularInline):
    model = BillPayment
    extra = 0
    readonly_fields = ('uploaded_by', 'created_at')


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ('id_short', 'guest', 'status', 'discount_amount', 'discount_percentage', 'created_at')
    list_filter = ('status',)
    search_fields = ('guest__username',)
    filter_horizontal = ('orders',)
    inlines = [BillPaymentInline]
    readonly_fields = ('id', 'created_at')

    def id_short(self, obj):
        return str(obj.id)[:8].upper()
    id_short.short_description = 'ID'


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message_preview', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('user__username', 'message')

    def message_preview(self, obj):
        return obj.message[:60]
    message_preview.short_description = 'Message'
