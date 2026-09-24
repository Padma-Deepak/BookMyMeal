# BookMyMeal

[![CI](https://github.com/Padma-Deepak/BookMyMeal/actions/workflows/ci.yml/badge.svg)](https://github.com/Padma-Deepak/BookMyMeal/actions/workflows/ci.yml)

Institutional meal ordering and billing system — guests order, caterers prepare, caretakers step in when a guest can't order for themselves, and managers handle billing across multiple caterers. Built with Django REST Framework and React/TypeScript.

**Live demo:** _add your Railway URL here_ — the landing page lets you explore any role (guest, caterer, caretaker, manager, superuser) with one click, no login required.

---

## Engineering highlights

A few things in this codebase that are worth pointing at directly, each backed by a test in `backend/core/tests.py`:

**Money is never trusted from the client, and never drifts after the fact.**
`OrderItem` snapshots the price and complimentary status of a `MenuItem` at the moment an order is placed (`unit_price`, `caterer_unit_price`, `is_complimentary`). Every bill, PDF, and payout calculation reads from that snapshot — not the live `MenuItem` — so a caterer editing a price later can't retroactively change a historical or already-paid bill. All money arithmetic is done in `Decimal`, never `float`, until the final JSON response boundary.
→ `test_menu_price_change_does_not_affect_existing_order`, `test_bill_grand_total_uses_snapshotted_price_not_live_price`

**Order status changes go through one centralized state machine**, not ad hoc `if` checks scattered per role. `core/state_machine.py` is dependency-free and independently unit-tested; every HTTP code path (caterer, caretaker, manager) calls the same `validate_transition()`. This closed a real gap: the manager PATCH path previously had *no* transition validation at all.
→ `StateMachineUnitTests`, `test_delivered_is_terminal_even_for_manager`

**Bill generation is race-safe.** `Order.bill` is a `ForeignKey` (not a `ManyToMany`), so "at most one bill per order" is a schema-level guarantee, not just an application check. Bill creation locks candidate orders with `select_for_update()` inside a transaction and rejects orders already attached to another bill.
→ `test_order_already_on_a_bill_cannot_be_billed_again`, `test_bill_generation_is_atomic_on_missing_order`

**A real N+1 was found and fixed, and the fix is measured, not just claimed:**

| | 2 orders | 20 orders |
|---|---|---|
| Before (`Order.is_editable` ran a filtered query per order) | 5 queries | 23 queries |
| After (reads from the view's existing `prefetch_related`) | 3 queries | 3 queries |

Numbers measured with `django.test.utils.CaptureQueriesContext` against the actual endpoint (`GET /api/orders/`), not estimated. The regression guard lives in `test_listing_orders_does_not_scale_query_count_with_order_count`, which fails CI if this ever regresses.

**Every role is checked against every endpoint it can reach**, in one data-driven test (`PermissionMatrixTests.test_permission_matrix`) — 11 endpoints × 6 actors (5 roles + anonymous) = 66 authorization checks in a single readable table, separate from the more granular object-ownership tests (e.g. a caterer editing another caterer's menu item).

**Server-side business rules can't be bypassed by the client.** Notice-period cutoffs and meal-category time windows are enforced with `timezone.localtime()` server time — a client's manipulated clock has no lever, because there's no client-supplied time field in the first place.

---

## Testing

```
cd backend
pip install -r requirements-dev.txt
python manage.py test core
```

- **52 tests** — unit tests for the state machine, a full permission matrix, two complete cross-role lifecycle flows (order → accept → prepared → paid bill; order → reject → external purchase → bill), and targeted tests for every endpoint listed above.
- **83% line coverage** on the Django app (`core/`, excluding auto-generated migrations and the test file itself — measured with `coverage.py`, not estimated):

  ```
  cd backend
  coverage run --source=core --omit='core/migrations/*,core/tests.py' manage.py test core
  coverage report -m
  ```

- `test_api.py` / `test_e2e.py` are live-server smoke scripts kept for local manual sanity checks (`python manage.py runserver` in one terminal, then `python test_e2e.py` in another) — not run in CI, since some of their assertions depend on real wall-clock time (meal category ordering windows) and would make CI flaky depending on what time of day it runs.

## CI

Every push and PR runs (`.github/workflows/ci.yml`):
- **Backend**: `ruff check`, `manage.py check`, missing-migrations check, then the full test suite under `coverage`, gated at a 75% floor.
- **Frontend**: `tsc` type-check + Vite build, then ESLint.

## Tech stack

- **Backend**: Django 5.2, Django REST Framework, SimpleJWT, PostgreSQL (production) / SQLite (development)
- **Frontend**: React 19, TypeScript, Vite, React Router
- **Deploy**: Railway (Docker), Whitenoise for static files

## Getting started

```
# Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py shell < seed.py   # demo accounts + sample data
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Seeded demo accounts (see `backend/seed.py`): `padma`/`admin123` (superuser), `manager1`/`manager123`, `caterer1`/`caterer123`, `caretaker1`/`caretaker123`, `guest1`/`guest123`.
