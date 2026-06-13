"""
Run with: python manage.py shell < seed.py
Creates one user per role + menu items + orders + external purchase.
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bookmymeal.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from core.models import MenuItem, Order, OrderItem, ExternalPurchase, Vendor, Bill

User = get_user_model()

print("=== Clearing old seed data ===")
Bill.objects.all().delete()
ExternalPurchase.objects.all().delete()
OrderItem.objects.all().delete()
Order.objects.all().delete()
MenuItem.objects.all().delete()
Vendor.objects.all().delete()
User.objects.all().delete()

print("=== Creating users ===")

superuser = User.objects.create_superuser(
    username='padma',
    password='admin123',
    email='padmadeepak2005@gmail.com',
    role='superuser',
    phone_number='+919999900000',
)
print(f"  superuser  : padma / admin123")

manager = User.objects.create_user(
    username='manager1',
    password='manager123',
    email='manager@bookmymeal.com',
    role='manager',
    phone_number='+919999911111',
)
print(f"  manager    : manager1 / manager123")

caterer = User.objects.create_user(
    username='caterer1',
    password='caterer123',
    email='caterer@bookmymeal.com',
    role='caterer',
    phone_number='+919999922222',
)
print(f"  caterer    : caterer1 / caterer123")

caretaker = User.objects.create_user(
    username='caretaker1',
    password='caretaker123',
    email='caretaker@bookmymeal.com',
    role='caretaker',
    phone_number='+919999933333',
)
print(f"  caretaker  : caretaker1 / caretaker123")

guest = User.objects.create_user(
    username='guest1',
    password='guest123',
    email='guest@bookmymeal.com',
    role='guest',
    phone_number='+919876543210',
)
print(f"  guest      : guest1 / guest123")

print("\n=== Creating menu items ===")

items = [
    dict(name='Masala Dosa',          category='breakfast', caterer_price=30,  customer_price=55,  notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Crispy dosa with spiced potato filling'),
    dict(name='Idli Sambar',           category='breakfast', caterer_price=20,  customer_price=40,  notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Steamed idlis with sambar and chutney'),
    dict(name='Morning Chai',          category='beverage',  caterer_price=8,   customer_price=0,   notice_period_minutes=0,   is_complimentary=True,  is_available=True,  description='Complimentary morning tea'),
    dict(name='Dal Makhani',           category='lunch',     caterer_price=80,  customer_price=140, notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Slow-cooked black lentil curry'),
    dict(name='Paneer Butter Masala',  category='lunch',     caterer_price=100, customer_price=170, notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Cottage cheese in creamy tomato gravy'),
    dict(name='Chicken Biryani',       category='dinner',    caterer_price=130, customer_price=210, notice_period_minutes=120, is_complimentary=False, is_available=True,  description='Aromatic basmati rice with chicken — 2hr advance notice'),
    dict(name='Veg Fried Rice',        category='dinner',    caterer_price=70,  customer_price=120, notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Stir-fried rice with vegetables'),
    dict(name='Samosa',                category='snacks',    caterer_price=15,  customer_price=30,  notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Crispy pastry with spiced filling'),
    dict(name='Mango Lassi',           category='beverage',  caterer_price=25,  customer_price=60,  notice_period_minutes=0,   is_complimentary=False, is_available=True,  description='Fresh mango yogurt drink'),
    dict(name='Fish Curry',            category='dinner',    caterer_price=150, customer_price=250, notice_period_minutes=180, is_complimentary=False, is_available=False, description='Currently unavailable — seasonal'),
]

menu_items = []
for data in items:
    mi = MenuItem.objects.create(caterer=caterer, **data)
    menu_items.append(mi)
    availability = "[OK]" if mi.is_available else "[--]"
    comp = " (complimentary)" if mi.is_complimentary else ""
    print(f"  {availability} {mi.name:<28} Rs.{mi.customer_price}{comp}")

# Quick references
dosa       = menu_items[0]
idli       = menu_items[1]
chai       = menu_items[2]
dal        = menu_items[3]
paneer     = menu_items[4]
biryani    = menu_items[5]
fried_rice = menu_items[6]
samosa     = menu_items[7]

print("\n=== Creating orders ===")

# Order 1: accepted (eligible for billing)
order1 = Order.objects.create(guest=guest, status='accepted', allergy_notes='No coconut chutney please')
OrderItem.objects.bulk_create([
    OrderItem(order=order1, menu_item=dosa,  quantity=2, spicy_level='Mild'),
    OrderItem(order=order1, menu_item=chai,  quantity=2, spicy_level='None'),
    OrderItem(order=order1, menu_item=idli,  quantity=1, spicy_level='None'),
])
print(f"  Order 1 (accepted)  : 2x Masala Dosa (Mild) + 2x Morning Chai + 1x Idli Sambar")

# Order 2: prepared (also eligible for billing)
order2 = Order.objects.create(guest=guest, status='prepared', allergy_notes='')
OrderItem.objects.bulk_create([
    OrderItem(order=order2, menu_item=dal,    quantity=1, spicy_level='Medium'),
    OrderItem(order=order2, menu_item=paneer, quantity=1, spicy_level='Mild'),
])
print(f"  Order 2 (prepared)  : 1x Dal Makhani (Medium) + 1x Paneer Butter Masala (Mild)")

# Order 3: pending (not yet approved)
order3 = Order.objects.create(guest=guest, status='pending', allergy_notes='Extra spicy')
OrderItem.objects.bulk_create([
    OrderItem(order=order3, menu_item=fried_rice, quantity=2, spicy_level='Hot'),
    OrderItem(order=order3, menu_item=samosa,     quantity=4, spicy_level='None'),
])
print(f"  Order 3 (pending)   : 2x Veg Fried Rice (Hot) + 4x Samosa")

# Order 4: rejected (caretaker needs to handle)
order4 = Order.objects.create(
    guest=guest, status='rejected',
    rejection_reason='ingredients_unavailable',
    rejection_notes='',
    allergy_notes='',
)
OrderItem.objects.bulk_create([
    OrderItem(order=order4, menu_item=biryani, quantity=1, spicy_level='Medium'),
])
print(f"  Order 4 (rejected)  : 1x Chicken Biryani — reason: ingredients_unavailable")

print("\n=== Creating vendor + external purchase ===")

vendor = Vendor.objects.create(name='Sharma Sweets', vendor_type='ad-hoc', order_count=1)
ep = ExternalPurchase.objects.create(
    guest=guest,
    caretaker=caretaker,
    vendor=vendor,
    vendor_name='Sharma Sweets',
    item_name='Gulab Jamun',
    quantity=4,
    cost=80.00,
    is_paid_by_caretaker=False,
    order=order4,
)
print("  ExternalPurchase    : 4x Gulab Jamun from Sharma Sweets - Rs.80 - added to guest bill")

print("\n=== Done! ===")
print()
print("Login credentials:")
print("  Role        Username     Password")
print("  ---------------------------------")
print("  superuser   padma        admin123")
print("  manager     manager1     manager123")
print("  caterer     caterer1     caterer123")
print("  caretaker   caretaker1   caretaker123")
print("  guest       guest1       guest123")
print()
print("Django admin: http://127.0.0.1:8000/admin/  (padma / admin123)")
print("Frontend    : http://localhost:5173/")
