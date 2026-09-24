import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('guest', 'Guest'),
        ('caterer', 'Caterer'),
        ('caretaker', 'Caretaker'),
        ('manager', 'Manager'),
        ('superuser', 'Superuser'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='guest')
    phone_number = models.CharField(max_length=20, null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


CATEGORY_CHOICES = [
    ('breakfast', 'Breakfast'),
    ('lunch', 'Lunch'),
    ('dinner', 'Dinner'),
    ('snacks', 'Snacks'),
    ('beverage', 'Beverage'),
]

# Meal categories can only be ordered within their time-of-day window
# (start_hour, end_hour), both in 24h clock, end exclusive. Categories not
# listed here (snacks, beverage) have no time restriction.
CATEGORY_TIME_WINDOWS = {
    'breakfast': (7, 10),    # 7:00 AM – 10:00 AM
    'lunch': (12, 15),       # 12:00 PM – 3:00 PM
    'dinner': (19, 22),      # 7:00 PM – 10:00 PM
}

SPICY_CHOICES = [
    ('None', 'None'),
    ('Mild', 'Mild'),
    ('Medium', 'Medium'),
    ('Hot', 'Hot'),
    ('Extra Hot', 'Extra Hot'),
]

REJECTION_REASON_CHOICES = [
    ('out_of_stock', 'Out of Stock'),
    ('ingredients_unavailable', 'Ingredients Unavailable'),
    ('preparation_not_possible', 'Preparation Not Possible Today'),
    ('insufficient_notice', 'Insufficient Notice Period'),
    ('other', 'Other'),
]

ORDER_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('accepted', 'Accepted'),
    ('partially_accepted', 'Partially Accepted'),  # Some items rejected; caterer prepares rest, caretaker sources missing
    ('rejected', 'Rejected'),
    ('prepared', 'Prepared'),
    ('delivered', 'Delivered'),
    ('resolved', 'Resolved'),  # Caretaker handled the order externally
]


class MenuItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caterer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='menu_items',
        limit_choices_to={'role': 'caterer'}
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    caterer_price = models.DecimalField(max_digits=8, decimal_places=2)
    customer_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    is_complimentary = models.BooleanField(default=False)
    notice_period_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.category})"


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guest = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='orders',
        limit_choices_to={'role': 'guest'}
    )
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    allergy_notes = models.TextField(blank=True)
    rejection_reason = models.CharField(
        max_length=50, choices=REJECTION_REASON_CHOICES, null=True, blank=True
    )
    rejection_notes = models.TextField(blank=True)
    bill = models.ForeignKey(
        'Bill', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {str(self.id)[:8]} by {self.guest.username} [{self.status}]"

    @property
    def is_editable(self):
        """Guest can still edit/cancel: status is still 'pending' AND no item's
        notice_period_minutes exceeds the minutes remaining until midnight.

        Deliberately iterates self.items.all() in Python rather than issuing a
        filtered .exists() query: when the caller has prefetch_related('items__
        menu_item') (as OrderListCreateView/OrderDetailView do), this reads
        from the prefetch cache instead of firing one extra query per order.
        """
        if self.status != 'pending':
            return False
        from django.utils import timezone
        now = timezone.localtime()
        minutes_until_midnight = (23 - now.hour) * 60 + (59 - now.minute)
        return not any(
            item.menu_item.notice_period_minutes > minutes_until_midnight
            for item in self.items.all()
        )


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    spicy_level = models.CharField(max_length=10, choices=SPICY_CHOICES, default='None')
    # Snapshot of MenuItem pricing/complimentary status AT ORDER CREATION TIME.
    # Billing must always read these, never the live MenuItem, so that a later
    # price change or complimentary toggle can't retroactively alter historical
    # orders/bills (including already-paid ones).
    unit_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    caterer_unit_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_complimentary = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.menu_item.name} x{self.quantity}"


class Vendor(models.Model):
    VENDOR_TYPE_CHOICES = [
        ('regular', 'Regular'),
        ('ad-hoc', 'Ad-hoc'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    vendor_type = models.CharField(max_length=10, choices=VENDOR_TYPE_CHOICES, default='ad-hoc')
    order_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ExternalPurchase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guest = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='external_purchases',
        limit_choices_to={'role': 'guest'}
    )
    order = models.ForeignKey(
        Order, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='external_purchases'
    )
    caretaker = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='logged_purchases'
    )
    bill = models.ForeignKey(
        'Bill', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchases'
    )
    vendor = models.ForeignKey(
        Vendor, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchases'
    )
    vendor_name = models.CharField(max_length=200)
    item_name = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    cost = models.DecimalField(max_digits=8, decimal_places=2)
    is_paid_by_caretaker = models.BooleanField(default=False)
    is_reimbursed = models.BooleanField(default=False)
    reimbursement_proof = models.FileField(upload_to='reimbursements/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.item_name} for {self.guest.username}"


class Bill(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('paid', 'Paid'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bills')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_bills'
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    discount_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    payment_screenshot = models.FileField(upload_to='payments/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bill {str(self.id)[:8]} for {self.guest.username} [{self.status}]"


class BillPayment(models.Model):
    """Proof that the facility paid ONE caterer for their share of a bill.
    A bill can include items from multiple caterers (e.g. breakfast from one,
    dinner from another) — each is paid and tracked independently."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='caterer_payments')
    caterer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='received_payments',
        limit_choices_to={'role': 'caterer'}, null=True,
    )
    screenshot = models.FileField(upload_to='caterer_payments/')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment proof for Bill {str(self.bill_id)[:8]} → {self.caterer.username}"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message[:50]}"
