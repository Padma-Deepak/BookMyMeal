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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {str(self.id)[:8]} by {self.guest.username} [{self.status}]"


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    spicy_level = models.CharField(max_length=10, choices=SPICY_CHOICES, default='None')

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
    orders = models.ManyToManyField(Order, related_name='bills', blank=True)
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='caterer_payments')
    screenshot = models.FileField(upload_to='caterer_payments/')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment proof for Bill {str(self.bill_id)[:8]}"


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
