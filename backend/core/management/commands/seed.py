"""
Django management command: seed
Usage:
    python manage.py seed           # load demo data
    python manage.py seed --flush   # wipe demo data first, then reload
"""
import uuid
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password

DEMO_PASSWORD = make_password("Demo@1234")

UUID_ITEM_THALI   = uuid.UUID("aaaaaaaa-0001-0000-0000-000000000000")
UUID_ITEM_BIRYANI = uuid.UUID("aaaaaaaa-0002-0000-0000-000000000000")
UUID_ITEM_POHA    = uuid.UUID("aaaaaaaa-0003-0000-0000-000000000000")

UUID_ORDER_DEL    = uuid.UUID("bbbbbbbb-0001-0000-0000-000000000000")
UUID_ORDER_REJ    = uuid.UUID("bbbbbbbb-0002-0000-0000-000000000000")
UUID_ORDER_PEND   = uuid.UUID("bbbbbbbb-0003-0000-0000-000000000000")

UUID_VENDOR       = uuid.UUID("cccccccc-0001-0000-0000-000000000000")
UUID_EXT_PURCHASE = uuid.UUID("dddddddd-0001-0000-0000-000000000000")
UUID_BILL         = uuid.UUID("eeeeeeee-0001-0000-0000-000000000000")
UUID_CATERER_BILL = uuid.UUID("ffffffff-0001-0000-0000-000000000000")
UUID_NOTIF_1      = uuid.UUID("11111111-0001-0000-0000-000000000000")
UUID_NOTIF_2      = uuid.UUID("11111111-0002-0000-0000-000000000000")


class Command(BaseCommand):
    help = "Seed the database with BookMyMeal demo data"

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true", help="Delete existing demo records before seeding")

    def handle(self, *args, **options):
        from core.models import (
            User, MenuItem, Order, Vendor,
            ExternalPurchase, Bill, CatererBill, Notification,
        )

        if options["flush"]:
            self.stdout.write("Flushing existing demo data…")
            Notification.objects.filter(pk__in=[UUID_NOTIF_1, UUID_NOTIF_2]).delete()
            CatererBill.objects.filter(pk=UUID_CATERER_BILL).delete()
            Bill.objects.filter(pk=UUID_BILL).delete()
            ExternalPurchase.objects.filter(pk=UUID_EXT_PURCHASE).delete()
            Vendor.objects.filter(pk=UUID_VENDOR).delete()
            Order.objects.filter(pk__in=[UUID_ORDER_DEL, UUID_ORDER_REJ, UUID_ORDER_PEND]).delete()
            MenuItem.objects.filter(pk__in=[UUID_ITEM_THALI, UUID_ITEM_BIRYANI, UUID_ITEM_POHA]).delete()
            User.objects.filter(username__in=[
                "padma_superuser", "manager_arun", "caterer_vandana",
                "caretaker_ramesh", "guest_aditi",
            ]).delete()
            self.stdout.write(self.style.WARNING("Demo data flushed."))

        # ── Users ────────────────────────────────────────────────────────────
        superuser, c = User.objects.update_or_create(
            username="padma_superuser",
            defaults=dict(password=DEMO_PASSWORD, role="superuser", phone_number="+91 98765 43210", is_active=True, is_staff=True, is_superuser=True),
        )
        self._log(c, "User 'padma_superuser' (superuser)")

        manager, c = User.objects.update_or_create(
            username="manager_arun",
            defaults=dict(password=DEMO_PASSWORD, role="manager", phone_number="+91 98765 43211", is_active=True, is_staff=True, is_superuser=False),
        )
        self._log(c, "User 'manager_arun' (manager)")

        caterer, c = User.objects.update_or_create(
            username="caterer_vandana",
            defaults=dict(password=DEMO_PASSWORD, role="caterer", phone_number="+91 98765 43212", is_active=True, is_staff=False, is_superuser=False),
        )
        self._log(c, "User 'caterer_vandana' (caterer)")

        caretaker, c = User.objects.update_or_create(
            username="caretaker_ramesh",
            defaults=dict(password=DEMO_PASSWORD, role="caretaker", phone_number="+91 98765 43213", is_active=True, is_staff=False, is_superuser=False),
        )
        self._log(c, "User 'caretaker_ramesh' (caretaker)")

        guest, c = User.objects.update_or_create(
            username="guest_aditi",
            defaults=dict(password=DEMO_PASSWORD, role="guest", phone_number="+91 98765 43214", is_active=True, is_staff=False, is_superuser=False),
        )
        self._log(c, "User 'guest_aditi' (guest)")

        # ── Menu Items ───────────────────────────────────────────────────────
        thali, c = MenuItem.objects.update_or_create(
            pk=UUID_ITEM_THALI,
            defaults=dict(caterer=caterer, name="Home-style Veg Thali", category="lunch", customer_price="250.00", caterer_price="180.00", notice_period_minutes=120, is_available=True, is_complimentary=False),
        )
        self._log(c, f"MenuItem '{thali.name}'")

        biryani, c = MenuItem.objects.update_or_create(
            pk=UUID_ITEM_BIRYANI,
            defaults=dict(caterer=caterer, name="Chicken Dum Biryani", category="dinner", customer_price="450.00", caterer_price="320.00", notice_period_minutes=240, is_available=True, is_complimentary=False),
        )
        self._log(c, f"MenuItem '{biryani.name}'")

        poha, c = MenuItem.objects.update_or_create(
            pk=UUID_ITEM_POHA,
            defaults=dict(caterer=caterer, name="Poha & Chai Breakfast", category="breakfast", customer_price="120.00", caterer_price="80.00", notice_period_minutes=60, is_available=True, is_complimentary=True),
        )
        self._log(c, f"MenuItem '{poha.name}'")

        # ── Orders (items stored as JSONField) ───────────────────────────────
        order_del, c = Order.objects.update_or_create(
            pk=UUID_ORDER_DEL,
            defaults=dict(
                guest=guest, caterer=caterer, status="delivered",
                items=[{"menu_item_id": str(UUID_ITEM_POHA), "name": "Poha & Chai Breakfast", "quantity": 2, "spicy_level": "Medium", "customer_price": "120.00"}],
                allergy_notes=None, rejection_reason=None, rejection_notes=None,
            ),
        )
        self._log(c, f"Order delivered  ({order_del.pk})")

        order_rej, c = Order.objects.update_or_create(
            pk=UUID_ORDER_REJ,
            defaults=dict(
                guest=guest, caterer=caterer, status="rejected",
                items=[{"menu_item_id": str(UUID_ITEM_BIRYANI), "name": "Chicken Dum Biryani", "quantity": 1, "spicy_level": "Hot", "customer_price": "450.00"}],
                allergy_notes=None, rejection_reason="Out of stock", rejection_notes="Ran out of chicken for Biryani today.",
            ),
        )
        self._log(c, f"Order rejected   ({order_rej.pk})")

        order_pend, c = Order.objects.update_or_create(
            pk=UUID_ORDER_PEND,
            defaults=dict(
                guest=guest, caterer=caterer, status="pending",
                items=[{"menu_item_id": str(UUID_ITEM_THALI), "name": "Home-style Veg Thali", "quantity": 1, "spicy_level": "Mild", "customer_price": "250.00"}],
                allergy_notes=None, rejection_reason=None, rejection_notes=None,
            ),
        )
        self._log(c, f"Order pending    ({order_pend.pk})")

        # ── Vendor ───────────────────────────────────────────────────────────
        vendor, c = Vendor.objects.update_or_create(
            pk=UUID_VENDOR,
            defaults=dict(name="City Spice Restaurant", vendor_type="ad-hoc", order_count=5),
        )
        self._log(c, f"Vendor '{vendor.name}'")

        # ── External Purchase ────────────────────────────────────────────────
        ep, c = ExternalPurchase.objects.update_or_create(
            pk=UUID_EXT_PURCHASE,
            defaults=dict(
                order=order_rej, guest=guest, caretaker=caretaker, vendor=vendor,
                item_name="Mutton Biryani (Substitution)", quantity=1, cost="500.00", is_paid_by_caretaker=False,
            ),
        )
        self._log(c, f"ExternalPurchase '{ep.item_name}'")

        # ── Bill ─────────────────────────────────────────────────────────────
        bill, c = Bill.objects.update_or_create(
            pk=UUID_BILL,
            defaults=dict(guest=guest, status="draft", discount_amount="0.00", discount_percentage="0.00"),
        )
        bill.orders.add(order_del)
        bill.external_purchases.add(ep)
        self._log(c, f"Bill ({bill.pk})")

        # ── CatererBill ──────────────────────────────────────────────────────
        cb, c = CatererBill.objects.update_or_create(
            pk=UUID_CATERER_BILL,
            defaults=dict(caterer=caterer, bill=bill, status="pending"),
        )
        self._log(c, f"CatererBill ({cb.pk})")

        # ── Notifications ────────────────────────────────────────────────────
        n1, c = Notification.objects.update_or_create(
            pk=UUID_NOTIF_1,
            defaults=dict(recipient=guest, message="Your order for Chicken Dum Biryani was rejected by the caterer. Caretaker is sourcing an alternative.", is_read=True),
        )
        self._log(c, "Notification — guest (biryani rejected)")

        n2, c = Notification.objects.update_or_create(
            pk=UUID_NOTIF_2,
            defaults=dict(recipient=caterer, message="New order received for Veg Thali.", is_read=False),
        )
        self._log(c, "Notification — caterer (new order)")

        self.stdout.write(self.style.SUCCESS("\nDemo data seeded successfully!"))
        self.stdout.write(
            "\nAll demo accounts use password: Demo@1234\n"
            "  padma_superuser  (superuser)\n"
            "  manager_arun     (manager)\n"
            "  caterer_vandana  (caterer)\n"
            "  caretaker_ramesh (caretaker)\n"
            "  guest_aditi      (guest)\n"
        )

    def _log(self, created, label):
        self.stdout.write(f"  [{'CREATED' if created else 'UPDATED'}] {label}")
