import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('guest', 'Guest'),
        ('caterer', 'Caterer'),
        ('caretaker', 'Caretaker'),
        ('manager', 'Manager'),
        ('superuser', 'Superuser'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='guest')
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.role})"

class MenuItem(models.Model):
    CATEGORY_CHOICES = (
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snacks', 'Snacks'),
        ('beverage', 'Beverage'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caterer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='menu_items', limit_choices_to={'role': 'caterer'})
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    customer_price = models.DecimalField(max_digits=10, decimal_places=2)
    caterer_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_available = models.BooleanField(default=True)
    notice_period_minutes = models.PositiveIntegerField(default=0)
    is_complimentary = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('prepared', 'Prepared'),
        ('delivered', 'Delivered'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='guest_orders', limit_choices_to={'role': 'guest'})
    caterer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caterer_orders', limit_choices_to={'role': 'caterer'})
    items = models.JSONField()  # [{menu_item_id, quantity, spicy_level}]
    allergy_notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.CharField(max_length=255, blank=True, null=True)
    rejection_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.id} - {self.guest.username}"

class Vendor(models.Model):
    TYPE_CHOICES = (
        ('regular', 'Regular Caterer'),
        ('ad-hoc', 'Ad-hoc'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    vendor_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='ad-hoc')
    order_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ExternalPurchase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='external_purchases')
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='guest_external_purchases')
    caretaker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caretaker_purchases')
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='purchases')
    item_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    is_paid_by_caretaker = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Bill(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('paid', 'Paid'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bills')
    orders = models.ManyToManyField(Order, related_name='bills')
    external_purchases = models.ManyToManyField(ExternalPurchase, related_name='bills')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    payment_screenshot = models.FileField(upload_to='payment_screenshots/', blank=True, null=True)
    pdf_url = models.URLField(blank=True, null=True)
    pdf_url_expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class CatererBill(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('paid', 'Paid'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caterer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caterer_bills')
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='caterer_bills')
    payment_screenshot = models.FileField(upload_to='caterer_payment_proofs/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
