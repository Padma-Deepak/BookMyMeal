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
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Bill,
    ExternalPurchase,
    MenuItem,
    Notification,
    Order,
    OrderItem,
    Vendor,
)
from core.state_machine import (
    ALLOWED_TRANSITIONS,
    InvalidTransition,
    validate_transition,
)

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
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

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
        # Still only on the first bill — Order.bill is a FK, so this is
        # structurally impossible to violate, not just app-checked.
        order.refresh_from_db()
        self.assertEqual(order.bill_id, Bill.objects.get(id=first.data['id']).id)

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
        order.refresh_from_db()
        self.assertIsNone(order.bill_id)


# ─── Permission matrix ──────────────────────────────────────────────────────
#
# Data-driven proof that every pure role-gated endpoint enforces exactly the
# roles it claims to, checked against ALL FIVE roles plus anonymous. This is
# deliberately separate from the more granular object-ownership tests above
# (e.g. "a caterer can't edit ANOTHER caterer's menu item") — this matrix
# tests the role gate itself: can this role even attempt the action at all.
#
# For an ALLOWED role we only assert the request wasn't rejected for
# authorization reasons (not 401/403); whether the request then succeeds or
# fails on data validation (400) is a business-logic concern covered
# elsewhere, not a permission concern.

class PermissionMatrixTests(BookMyMealAPITestCase):
    def setUp(self):
        super().setUp()
        self.superuser = make_user('super_t', 'superuser')
        self.vendor = Vendor.objects.create(name='Matrix Vendor', vendor_type='ad-hoc')
        self.actors = {
            'anonymous': None,
            'guest': self.guest,
            'caterer': self.caterer,
            'caretaker': self.caretaker,
            'manager': self.manager,
            'superuser': self.superuser,
        }

    def _matrix(self):
        """(method, path, body, allowed_roles). body=None for GET."""
        return [
            ('POST', '/api/menu-items/',
             {'name': 'Matrix Item', 'category': 'snacks', 'caterer_price': '10.00'},
             {'caterer', 'superuser'}),
            ('POST', '/api/users/',
             {'username': 'matrix_new_user', 'password': 'x', 'role': 'guest'},
             {'manager', 'superuser'}),
            ('POST', '/api/external-purchases/',
             {'guest': str(self.guest.id), 'vendor_name': 'V', 'item_name': 'I',
              'quantity': 1, 'cost': '10.00'},
             {'caretaker', 'superuser'}),
            ('POST', '/api/bills/',
             {'guest_id': str(self.guest.id), 'order_ids': []},
             {'manager', 'superuser'}),
            ('POST', '/api/bill-payments/',
             {'bill': '00000000-0000-0000-0000-000000000000', 'caterer': str(self.caterer.id)},
             {'manager', 'superuser'}),
            ('POST', '/api/orders/',
             {'items': [{'menu_item_id': str(self.item.id), 'quantity': 1, 'spicy_level': 'None'}]},
             {'guest', 'superuser'}),
            ('GET', '/api/vendors/', None, {'manager', 'superuser'}),
            ('GET', f'/api/vendors/{self.vendor.id}/', None, {'superuser'}),
            ('PATCH', f'/api/vendors/{self.vendor.id}/', {'name': 'Renamed'}, {'superuser'}),
            ('GET', '/api/caterer-bills/', None, {'caterer', 'manager', 'superuser'}),
            ('POST', f'/api/users/{self.guest.id}/set-password/',
             {'new_password': 'newpass123'}, {'superuser'}),
        ]

    def test_permission_matrix(self):
        method_fn = {
            'GET': self.client.get,
            'POST': self.client.post,
            'PATCH': self.client.patch,
        }
        for method, path, body, allowed_roles in self._matrix():
            for role_name, user in self.actors.items():
                with self.subTest(method=method, path=path, role=role_name):
                    self.client.force_authenticate(user=user)
                    kwargs = {'format': 'json'} if body is not None else {}
                    res = method_fn[method](path, body, **kwargs) if body is not None else method_fn[method](path)

                    if role_name == 'anonymous':
                        self.assertEqual(
                            res.status_code, status.HTTP_401_UNAUTHORIZED,
                            f"anonymous {method} {path} -> expected 401, got {res.status_code}"
                        )
                    elif role_name in allowed_roles:
                        self.assertNotIn(
                            res.status_code, (401, 403),
                            f"{role_name} should be ALLOWED to {method} {path} "
                            f"but got {res.status_code}: {res.data}"
                        )
                    else:
                        self.assertEqual(
                            res.status_code, status.HTTP_403_FORBIDDEN,
                            f"{role_name} should be FORBIDDEN from {method} {path} "
                            f"but got {res.status_code}: {getattr(res, 'data', None)}"
                        )


# ─── Full lifecycle flow tests ──────────────────────────────────────────────

class OrderLifecycleFlowTests(BookMyMealAPITestCase):
    """End-to-end journeys through multiple roles in sequence — proof the
    pieces fixed individually above actually compose into working flows."""

    def test_happy_path_order_to_paid_bill(self):
        # 1. Guest places an order.
        order_res = self.place_order(items=[
            {'menu_item_id': str(self.item.id), 'quantity': 2, 'spicy_level': 'Mild'},
        ])
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED, order_res.data)
        order_id = order_res.data['id']
        self.assertEqual(order_res.data['status'], 'pending')

        # 2. Caterer accepts, then marks prepared.
        self.auth(self.caterer)
        accept_res = self.client.patch(f'/api/orders/{order_id}/', {'status': 'accepted'}, format='json')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK, accept_res.data)
        prepared_res = self.client.patch(f'/api/orders/{order_id}/', {'status': 'prepared'}, format='json')
        self.assertEqual(prepared_res.status_code, status.HTTP_200_OK, prepared_res.data)

        # 3. Manager bills it.
        self.auth(self.manager)
        bill_res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [order_id],
        }, format='json')
        self.assertEqual(bill_res.status_code, status.HTTP_201_CREATED, bill_res.data)
        self.assertAlmostEqual(bill_res.data['grand_total'], 100.0)  # 50.00 * 2
        bill_id = bill_res.data['id']

        # 4. Manager marks it paid.
        pay_res = self.client.patch(f'/api/bills/{bill_id}/', {'status': 'paid'}, format='json')
        self.assertEqual(pay_res.status_code, status.HTTP_200_OK, pay_res.data)

        # 5. Guest sees their own paid bill.
        self.auth(self.guest)
        guest_view = self.client.get(f'/api/bills/{bill_id}/')
        self.assertEqual(guest_view.status_code, status.HTTP_200_OK)
        self.assertEqual(guest_view.data['status'], 'paid')

    def test_rejection_to_external_purchase_to_bill(self):
        # 1. Guest places an order.
        order_res = self.place_order()
        order_id = order_res.data['id']

        # 2. Caterer rejects it — routed to caretaker, not the guest, per PRD.
        self.auth(self.caterer)
        reject_res = self.client.patch(f'/api/orders/{order_id}/', {
            'status': 'rejected', 'rejection_reason': 'out_of_stock',
        }, format='json')
        self.assertEqual(reject_res.status_code, status.HTTP_200_OK, reject_res.data)
        self.assertEqual(reject_res.data['status'], 'rejected')

        # 3. Caretaker sources the item externally instead, logging a purchase
        #    against the same guest — this is what actually ends up billable.
        self.auth(self.caretaker)
        ep_res = self.client.post('/api/external-purchases/', {
            'guest': str(self.guest.id),
            'vendor_name': 'Corner Store',
            'item_name': 'Dosa (sourced externally)',
            'quantity': 1,
            'cost': '45.00',
            'is_paid_by_caretaker': False,
        }, format='json')
        self.assertEqual(ep_res.status_code, status.HTTP_201_CREATED, ep_res.data)

        # 4. Caretaker resolves the rejected order (handled externally).
        resolve_res = self.client.patch(f'/api/orders/{order_id}/', {
            'status': 'resolved',
        }, format='json')
        self.assertEqual(resolve_res.status_code, status.HTTP_200_OK, resolve_res.data)

        # 5. Manager bills the guest — the rejected order was never
        #    'accepted/prepared/delivered' so it wouldn't normally be selected
        #    for billing; only the external purchase is included here.
        self.auth(self.manager)
        bill_res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [],
        }, format='json')
        self.assertEqual(bill_res.status_code, status.HTTP_201_CREATED, bill_res.data)
        self.assertAlmostEqual(bill_res.data['grand_total'], 45.00)
        self.assertEqual(len(bill_res.data['external_purchases_detail']), 1)


# ─── Endpoints not otherwise covered above ─────────────────────────────────

class MiscEndpointTests(BookMyMealAPITestCase):
    def test_notification_created_on_order_accept_and_can_be_marked_read(self):
        order_res = self.place_order()
        order_id = order_res.data['id']
        self.auth(self.caterer)
        self.client.patch(f'/api/orders/{order_id}/', {'status': 'accepted'}, format='json')

        self.auth(self.guest)
        notif_res = self.client.get('/api/notifications/')
        self.assertEqual(notif_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(notif_res.data), 1)
        notif_id = notif_res.data[0]['id']
        self.assertFalse(notif_res.data[0]['is_read'])

        read_res = self.client.patch(f'/api/notifications/{notif_id}/read/', {}, format='json')
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertTrue(read_res.data['is_read'])

    def test_guest_cannot_read_another_guests_notifications(self):
        other_guest = make_user('other_guest_t', 'guest')
        Notification.objects.create(user=other_guest, message='Not yours')
        self.auth(self.guest)
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_superuser_can_reset_a_users_password(self):
        superuser = make_user('super_pw_t', 'superuser')
        self.auth(superuser)
        res = self.client.post(f'/api/users/{self.guest.id}/set-password/', {
            'new_password': 'brandnewpass123',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.guest.refresh_from_db()
        self.assertTrue(self.guest.check_password('brandnewpass123'))

    def test_vendor_rename_by_superuser(self):
        vendor = Vendor.objects.create(name='Old Name', vendor_type='ad-hoc')
        superuser = make_user('super_vendor_t', 'superuser')
        self.auth(superuser)
        res = self.client.patch(f'/api/vendors/{vendor.id}/', {'name': 'New Name'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        vendor.refresh_from_db()
        self.assertEqual(vendor.name, 'New Name')

    def test_change_own_password(self):
        self.auth(self.guest)
        res = self.client.post('/api/change-password/', {
            'current_password': 'testpass123', 'new_password': 'anothernewpass123',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.guest.refresh_from_db()
        self.assertTrue(self.guest.check_password('anothernewpass123'))

    def test_change_password_rejects_wrong_current_password(self):
        self.auth(self.guest)
        res = self.client.post('/api/change-password/', {
            'current_password': 'wrongpassword', 'new_password': 'anothernewpass123',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_rejects_too_short(self):
        self.auth(self.guest)
        res = self.client.post('/api/change-password/', {
            'current_password': 'testpass123', 'new_password': 'ab',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_menu_item_delete_blocked_when_it_has_orders(self):
        """PROTECT on OrderItem.menu_item — deleting a menu item that's been
        ordered must fail cleanly (400), not 500."""
        self.place_order()
        self.auth(self.caterer)
        res = self.client.delete(f'/api/menu-items/{self.item.id}/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(MenuItem.objects.filter(id=self.item.id).exists())

    def test_menu_item_delete_allowed_when_unordered(self):
        unordered = make_menu_item(self.caterer, name='Never Ordered')
        self.auth(self.caterer)
        res = self.client.delete(f'/api/menu-items/{unordered.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)


# ─── External purchase role branches ───────────────────────────────────────

class ExternalPurchaseDetailTests(BookMyMealAPITestCase):
    def _log_purchase(self, is_paid_by_caretaker=False):
        self.auth(self.caretaker)
        res = self.client.post('/api/external-purchases/', {
            'guest': str(self.guest.id), 'vendor_name': 'Test Vendor',
            'item_name': 'Snack', 'quantity': 1, 'cost': '25.00',
            'is_paid_by_caretaker': is_paid_by_caretaker,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data['id']

    def test_manager_can_mark_purchase_reimbursed(self):
        ep_id = self._log_purchase()
        self.auth(self.manager)
        res = self.client.patch(f'/api/external-purchases/{ep_id}/', {'is_reimbursed': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data['is_reimbursed'])

    def test_caterer_cannot_mark_purchase_reimbursed(self):
        ep_id = self._log_purchase()
        self.auth(self.caterer)
        res = self.client.patch(f'/api/external-purchases/{ep_id}/', {'is_reimbursed': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_caretaker_can_delete_own_purchase(self):
        ep_id = self._log_purchase()
        self.auth(self.caretaker)
        res = self.client.delete(f'/api/external-purchases/{ep_id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_caretaker_cannot_delete_another_caretakers_purchase(self):
        """get_queryset scopes a caretaker to only their own purchases, so a
        foreign purchase 404s (not found in their scope) rather than 403."""
        ep_id = self._log_purchase()
        other_caretaker = make_user('other_caretaker_t', 'caretaker')
        self.auth(other_caretaker)
        res = self.client.delete(f'/api/external-purchases/{ep_id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ExternalPurchase.objects.filter(id=ep_id).exists())

    def test_guest_can_view_own_external_purchases(self):
        self._log_purchase()
        self.auth(self.guest)
        res = self.client.get('/api/external-purchases/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)


# ─── Caterer bills + PDF generation ────────────────────────────────────────

class CatererBillAndPDFTests(BookMyMealAPITestCase):
    def _paid_scenario_bill(self):
        order_res = self.place_order(items=[
            {'menu_item_id': str(self.item.id), 'quantity': 1, 'spicy_level': 'None'},
        ])
        order_id = order_res.data['id']
        self.auth(self.caterer)
        self.client.patch(f'/api/orders/{order_id}/', {'status': 'accepted'}, format='json')
        self.auth(self.manager)
        bill_res = self.client.post('/api/bills/', {
            'guest_id': str(self.guest.id), 'order_ids': [order_id],
        }, format='json')
        return bill_res.data['id']

    def test_caterer_sees_own_payout_row_in_caterer_bills_list(self):
        self._paid_scenario_bill()
        self.auth(self.caterer)
        res = self.client.get('/api/caterer-bills/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['caterer_id'], str(self.caterer.id))
        self.assertAlmostEqual(res.data[0]['total_caterer_amount'], 30.0)  # caterer_price

    def test_manager_sees_per_caterer_breakdown_in_caterer_bill_detail(self):
        bill_id = self._paid_scenario_bill()
        self.auth(self.manager)
        res = self.client.get(f'/api/caterer-bills/{bill_id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('caterers', res.data)
        self.assertEqual(len(res.data['caterers']), 1)

    def test_guest_bill_pdf_downloads(self):
        bill_id = self._paid_scenario_bill()
        self.auth(self.guest)
        res = self.client.get(f'/api/bills/{bill_id}/pdf/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/pdf')

    def test_caterer_bill_pdf_downloads(self):
        bill_id = self._paid_scenario_bill()
        self.auth(self.caterer)
        res = self.client.get(f'/api/caterer-bills/{bill_id}/pdf/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/pdf')

    def test_guest_cannot_download_another_guests_bill_pdf(self):
        bill_id = self._paid_scenario_bill()
        other_guest = make_user('other_guest_pdf_t', 'guest')
        self.auth(other_guest)
        res = self.client.get(f'/api/bills/{bill_id}/pdf/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


# ─── Order list filters ────────────────────────────────────────────────────

class OrderListFilterTests(BookMyMealAPITestCase):
    def test_manager_filters_orders_by_status(self):
        self.place_order()
        order2 = Order.objects.get(id=self.place_order().data['id'])
        order2.status = 'accepted'
        order2.save()

        self.auth(self.manager)
        res = self.client.get('/api/orders/?status=accepted')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['status'], 'accepted')

    def test_caterer_id_filter_scopes_to_that_caterers_items(self):
        other_item = make_menu_item(self.other_caterer, name='Other Caterer Item')
        self.place_order()  # self.item -> self.caterer
        self.place_order(items=[{'menu_item_id': str(other_item.id), 'quantity': 1, 'spicy_level': 'None'}])

        self.auth(self.manager)
        res = self.client.get(f'/api/orders/?caterer_id={self.caterer.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_guest_can_cancel_own_pending_order(self):
        order_id = self.place_order().data['id']
        self.auth(self.guest)
        res = self.client.delete(f'/api/orders/{order_id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Order.objects.filter(id=order_id).exists())
