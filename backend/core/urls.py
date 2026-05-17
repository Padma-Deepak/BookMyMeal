from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    MyTokenObtainPairView, UserDetailView, UserListView,
    MenuItemListCreateView, MenuItemDetailView,
    OrderListCreateView, OrderDetailView,
    ExternalPurchaseListCreateView,
    VendorListView, VendorDetailView,
    BillListCreateView, BillDetailView, BillPDFView,
    BillPaymentView,
    CatererBillDetailView, CatererBillPDFView,
    NotificationListView, NotificationMarkReadView,
)

urlpatterns = [
    # Auth
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserDetailView.as_view(), name='user_detail'),
    path('users/', UserListView.as_view(), name='user_list'),

    # Menu Items
    path('menu-items/', MenuItemListCreateView.as_view(), name='menu_item_list'),
    path('menu-items/<uuid:pk>/', MenuItemDetailView.as_view(), name='menu_item_detail'),

    # Orders
    path('orders/', OrderListCreateView.as_view(), name='order_list'),
    path('orders/<uuid:pk>/', OrderDetailView.as_view(), name='order_detail'),

    # External Purchases
    path('external-purchases/', ExternalPurchaseListCreateView.as_view(), name='external_purchase_list'),

    # Vendors
    path('vendors/', VendorListView.as_view(), name='vendor_list'),
    path('vendors/<uuid:pk>/', VendorDetailView.as_view(), name='vendor_detail'),

    # Bills
    path('bills/', BillListCreateView.as_view(), name='bill_list'),
    path('bills/<uuid:pk>/', BillDetailView.as_view(), name='bill_detail'),
    path('bills/<uuid:pk>/pdf/', BillPDFView.as_view(), name='bill_pdf'),

    # Bill Payments
    path('bill-payments/', BillPaymentView.as_view(), name='bill_payment'),

    # Caterer Bills
    path('caterer-bills/<uuid:pk>/', CatererBillDetailView.as_view(), name='caterer_bill_detail'),
    path('caterer-bills/<uuid:pk>/pdf/', CatererBillPDFView.as_view(), name='caterer_bill_pdf'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notification_list'),
    path('notifications/<uuid:pk>/read/', NotificationMarkReadView.as_view(), name='notification_read'),
]
