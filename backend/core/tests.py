"""
Unit/API tests for the backend/data-integrity fixes:
  1. Server-side money calculation + price snapshotting
  2. Order status state machine
  3. Server-side business rule validation (notice period, mixed-caterer carts)
  4. Centralized DRF permissions
  5. OrderItem relational integrity
  6. Transaction-safe bill generation / double-billing prevention

Run with: python manage.py test core
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import MenuItem, Order, OrderItem, Bill
from core.state_machine import validate_transition, InvalidTransition, ALLOWED_TRANSITIONS

User = get_user_model()


def make_user(username, role, **extra):
    return User.objects.create_user(username=username, password='testpass123', role=role, **extra)


def make_menu_item(caterer, **overrides):
    # category='snacks' deliberately — snacks/beverage have no
    # CATEGORY_TIME_WINDOWS restriction, so these tests aren't flaky
    # depending on what time of day the suite runs.
    defaults = dict(
        name='Test Dosa', category='snacks',
        caterer_price=Decimal('30.00'), customer_price=Decimal('50.00'),
        is_available=True, is_complimentary=False, notice_period_minutes=0,
    )
    defaults.update(overrides)
    return MenuItem.objects.create(caterer=caterer, **defaults)


# ─── Issue 2: state machine (pure unit tests, no DB) ───────────────────────────

class StateMachineUnitTests(TestCase):
    """Tests core.state_machine directly — no HTTP, no DB — per the requirement
    that transition logic be independently testable."""

    def test_valid_transition_succeeds(self):
        validate_transition('pending', 'accepted')  # must not raise

    def test_invalid_transition_raises(self):
        with self.assertRaises(InvalidTransition):
            validate_transition('pending', 'delivered')

    def test_terminal_states_have_no_outgoing_transitions(self):
        self.assertEqual(ALLOWED_TRANSITIONS['delivered'], set())
        self.assertEqual(ALLOWED_TRANSITIONS['resolved'], set())
        with self.assertRaises(InvalidTransition):
            validate_transition('delivered', 'pending')
        with self.assertRaises(InvalidTransition):
            validate_transition('resolved', 'accepted')

    def test_same_status_is_a_noop_not_an_error(self):
        validate_transition('accepted', 'accepted')  # idempotent PATCH must not raise


# ─── Shared fixture base for API tests ─────────────────────────────────────────

class BookMyMealAPITestCase(APITestCase):
    def setUp(self):
        self.guest = make_user('guest_t', 'guest')
        self.caterer = make_user('caterer_t', 'caterer')
        self.other_caterer = make_user('caterer2_t', 'caterer')
        self.caretaker = make_user('caretaker_t', 'caretaker')
        self.manager = make_user('manager_t', 'manager')
        self.item = make_menu_item(self.caterer, name='Dosa', customer_price=Decimal('50.00'), caterer_price=Decimal('30.00'))

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def place_order(self, items=None):
        self.auth(self.guest)
        payload = {
            'items': items or [{'menu_item_id': str(self.item.id), 'quantity': 2, 'spicy_level': 'Mild'}],
            'allergy_notes': '',
        }
        return self.client.post('/api/orders/', payload, format='json')


# ─── Issue 1: money calculation + price snapshot ───────────────────────────────

class PriceSnapshotTests(BookMyMealAPITestCase):
    def test_order_creation_snapshots_price_as_decimal(self):
        res = self.place_order()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        order = Order.objects.get(id=res.data['id'])
        item = order.items.first()
        self.assertEqual(item.unit_price, Decimal('50.00'))
        self.assertEqual(item.caterer_unit_price, Decimal('30.00'))
        self.assertIsInstance(item.unit_price, Decimal)

    def test_menu_price_change_does_not_affect_existing_order(self):
        res = self.place_order()
        order = Order.objects.get(id=res.data['id'])

        # Caterer changes the live price after the order was placed.
        self.item.customer_price = Decimal('999.00')
        self.item.caterer_price = Decimal('500.00')
        self.item.save()

        item = order.items.first()
        item.refresh_from_db()
        self.assertEqual(item.unit_price, Decimal('50.00'))
        self.assertEqual(item.caterer_unit_price, Decimal('30.00'))

    def test_bill_grand_total_uses_snapshotted_price_not_live_price(self):
        res = self.place_order()
        order = Order.objects.get(id=res.data['id'])
        order.status = 'accepted'
        order.save()

        self.auth(self.manager)
        bill_res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id)],
        }, format='json')
        self.assertEqual(bill_res.status_code, status.HTTP_201_CREATED, bill_res.data)
        expected_total = 50.00 * 2  # unit_price * quantity at order time
        self.assertAlmostEqual(bill_res.data['grand_total'], expected_total)

        # Now the caterer changes the price. A PAID/existing bill must not move.
        self.item.customer_price = Decimal('9999.00')
        self.item.save()

        refetch = self.client.get(f"/api/bills/{bill_res.data['id']}/")
        self.assertAlmostEqual(refetch.data['grand_total'], expected_total)

    def test_frontend_cannot_supply_a_price_for_order_items(self):
        """The write serializer only accepts menu_item_id/quantity/spicy_level —
        confirm a client-supplied price field is silently ignored, not trusted."""
        self.auth(self.guest)
        payload = {
            'items': [{
                'menu_item_id': str(self.item.id), 'quantity': 1,
                'spicy_level': 'None', 'customer_price': '0.01', 'unit_price': '0.01',
            }],
        }
        res = self.client.post('/api/orders/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        item = OrderItem.objects.get(order_id=res.data['id'])
        self.assertEqual(item.unit_price, Decimal('50.00'))  # real MenuItem price, not 0.01


# ─── Issue 2: state machine wired into the API ─────────────────────────────────

class StateMachineAPITests(BookMyMealAPITestCase):
    def test_caterer_can_accept_pending_order(self):
        order = Order.objects.get(id=self.place_order().data['id'])
        self.auth(self.caterer)
        res = self.client.patch(f'/api/orders/{order.id}/', {'status': 'accepted'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_caterer_cannot_jump_pending_to_delivered(self):
        order = Order.objects.get(id=self.place_order().data['id'])
        self.auth(self.caterer)
        res = self.client.patch(f'/api/orders/{order.id}/', {'status': 'delivered'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delivered_is_terminal_even_for_manager(self):
        """Manager branch previously had NO transition validation at all —
        this is the gap the audit found and closed."""
        order = Order.objects.get(id=self.place_order().data['id'])
        order.status = 'delivered'
        order.save()
        self.auth(self.manager)
        res = self.client.patch(f'/api/orders/{order.id}/', {'status': 'pending'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, 'delivered')


# ─── Issue 3: server-side business rules ───────────────────────────────────────

class BusinessRuleValidationTests(BookMyMealAPITestCase):
    def test_high_notice_period_item_rejected_regardless_of_declared_client_time(self):
        """No matter what the caller claims about their local clock (there is
        no client-time field accepted at all), an item whose notice period
        exceeds the maximum possible minutes remaining in a day (1439) can
        never be ordered — proving the check runs against server time."""
        far_notice_item = make_menu_item(
            self.caterer, name='Advance Order Biryani', notice_period_minutes=100000
        )
        res = self.place_order(items=[
            {'menu_item_id': str(far_notice_item.id), 'quantity': 1, 'spicy_level': 'None'}
        ])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', res.data)

    def test_zero_notice_period_item_always_allowed(self):
        res = self.place_order()  # self.item has notice_period_minutes=0
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_mixed_caterer_cart_rejected(self):
        other_item = make_menu_item(self.other_caterer, name='Other Caterer Item')
        res = self.place_order(items=[
            {'menu_item_id': str(self.item.id), 'quantity': 1, 'spicy_level': 'None'},
            {'menu_item_id': str(other_item.id), 'quantity': 1, 'spicy_level': 'None'},
        ])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', res.data)

    def test_single_caterer_cart_still_allowed(self):
        second_item = make_menu_item(self.caterer, name='Second Item From Same Caterer')
        res = self.place_order(items=[
            {'menu_item_id': str(self.item.id), 'quantity': 1, 'spicy_level': 'None'},
            {'menu_item_id': str(second_item.id), 'quantity': 1, 'spicy_level': 'None'},
        ])
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)


# ─── Issue 4: permissions ───────────────────────────────────────────────────────

class PermissionTests(BookMyMealAPITestCase):
    def test_unauthenticated_request_rejected(self):
        res = self.client.post('/api/menu-items/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_guest_cannot_create_menu_item(self):
        self.auth(self.guest)
        res = self.client.post('/api/menu-items/', {
            'name': 'X', 'category': 'snacks', 'caterer_price': '10.00',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_caterer_can_create_menu_item(self):
        self.auth(self.caterer)
        res = self.client.post('/api/menu-items/', {
            'name': 'New Item', 'category': 'snacks', 'caterer_price': '10.00',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_caterer_cannot_edit_another_caterers_menu_item(self):
        """Object-level permission: has_object_permission on IsCatererOwnerOrSuperuser."""
        self.auth(self.other_caterer)
        res = self.client.patch(f'/api/menu-items/{self.item.id}/', {'name': 'Hijacked'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.item.refresh_from_db()
        self.assertEqual(self.item.name, 'Dosa')

    def test_caterer_can_edit_their_own_menu_item(self):
        self.auth(self.caterer)
        res = self.client.patch(f'/api/menu-items/{self.item.id}/', {'name': 'Renamed Dosa'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_any_authenticated_role_can_read_a_menu_item_detail(self):
        self.auth(self.other_caterer)
        res = self.client.get(f'/api/menu-items/{self.item.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_non_manager_cannot_generate_bill(self):
        order = Order.objects.get(id=self.place_order().data['id'])
        self.auth(self.caretaker)
        res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id)],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ─── Issue 5: OrderItem relational integrity ───────────────────────────────────

class OrderItemRelationalTests(BookMyMealAPITestCase):
    def test_order_creation_creates_real_orderitem_rows(self):
        res = self.place_order(items=[
            {'menu_item_id': str(self.item.id), 'quantity': 3, 'spicy_level': 'Hot'},
        ])
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.items.count(), 1)
        item = order.items.first()
        self.assertIsInstance(item, OrderItem)
        self.assertEqual(item.menu_item_id, self.item.id)
        self.assertEqual(item.order_id, order.id)
        self.assertEqual(item.quantity, 3)

    def test_listing_orders_does_not_scale_query_count_with_order_count(self):
        """N+1 guard: GET /api/orders/ as manager must issue the SAME number
        of queries whether there are 2 orders or 7 — i.e. select_related/
        prefetch_related are actually batching, not firing per row."""
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        second_item = make_menu_item(self.caterer, name='Second Item')

        def place_two_item_order():
            self.place_order(items=[
                {'menu_item_id': str(self.item.id), 'quantity': 1, 'spicy_level': 'None'},
                {'menu_item_id': str(second_item.id), 'quantity': 1, 'spicy_level': 'None'},
            ])

        for _ in range(2):
            place_two_item_order()
        self.auth(self.manager)
        with CaptureQueriesContext(connection) as small:
            res_small = self.client.get('/api/orders/')
        self.assertEqual(res_small.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_small.data), 2)

        for _ in range(5):
            place_two_item_order()
        self.auth(self.manager)
        with CaptureQueriesContext(connection) as large:
            res_large = self.client.get('/api/orders/')
        self.assertEqual(res_large.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_large.data), 7)

        self.assertEqual(
            len(small.captured_queries), len(large.captured_queries),
            f"query count grew with order count — N+1 regression.\n"
            f"2 orders: {len(small.captured_queries)} queries\n"
            f"7 orders: {len(large.captured_queries)} queries"
        )


# ─── Issue 6: transaction-safe billing ─────────────────────────────────────────

class BillingIntegrityTests(BookMyMealAPITestCase):
    def _accepted_order(self):
        order = Order.objects.get(id=self.place_order().data['id'])
        order.status = 'accepted'
        order.save()
        return order

    def test_bill_generation_creates_bill_with_orders_attached(self):
        order = self._accepted_order()
        self.auth(self.manager)
        res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id)],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        bill = Bill.objects.get(id=res.data['id'])
        self.assertIn(order, bill.orders.all())

    def test_order_already_on_a_bill_cannot_be_billed_again(self):
        order = self._accepted_order()
        self.auth(self.manager)
        first = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id)],
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        second = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id)],
        }, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('order_ids', second.data)
        # Still only on the first bill.
        self.assertEqual(order.bills.count(), 1)

    def test_bill_generation_is_atomic_on_missing_order(self):
        """If one order_id doesn't exist/belong to this guest, no bill or
        partial attachment should be created at all."""
        order = self._accepted_order()
        fake_id = '00000000-0000-0000-0000-000000000000'
        self.auth(self.manager)
        bills_before = Bill.objects.count()
        res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [str(order.id), fake_id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Bill.objects.count(), bills_before)
        self.assertEqual(order.bills.count(), 0)
