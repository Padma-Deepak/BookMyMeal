# BookMyMeal — Project Context for AI-Assisted Development

## Project Overview

BookMyMeal is a full-stack institutional meal management system for hospitality or care facilities (hospitals, guest houses, care homes). It digitizes the end-to-end meal workflow: guests order from a menu, caterers prepare food, caretakers manage orders on behalf of guests, and managers generate and settle bills.

**Core problems solved:**
- Replace paper-based meal ordering and manual billing
- Enforce role-based access so each actor only sees what they need
- Track every order and rupee with full audit history
- Support both in-house caterer meals and external purchases in a single bill

---

## Tech Stack

### Backend
- **Django 6.x** — web framework
- **Django REST Framework (DRF)** — REST API layer, generic views, serializers
- **djangorestframework-simplejwt** — JWT authentication (access + refresh tokens)
- **django-cors-headers** — CORS middleware for decoupled frontend
- **SQLite** (development) — single file at `backend/db.sqlite3`
- **Python 3.13**

### Frontend
- **React 18 + TypeScript** — UI framework
- **Vite** — build tool and dev server
- **React Router v6** — SPA routing
- **React Context API** — global state (auth, cart)
- **Native `fetch` API** — HTTP calls, wrapped in `src/lib/api.ts`
- **lucide-react** — icon library

### Authentication
- JWT tokens: short-lived access token + long-lived refresh token
- Tokens stored in `localStorage`
- Automatic silent refresh on 401 responses via `apiFetch()` in `api.ts`

---

## User Roles

All roles are stored as a string enum on the `User` model (`role` field). The JWT payload includes the role so the frontend can read it without an extra request after `GET /api/me/`.

### Guest
- Browses the menu, places orders, views their own bill
- Cannot see other guests' data
- Can specify quantity, spicy level, and allergy notes per order
- Read-only bill view; cannot generate or modify their own bill

### Caretaker
- Acts on behalf of guests who cannot place orders themselves
- Sees rejected orders across guests
- Can modify rejected orders (change quantities, spicy levels, remove items) and resubmit
- Logs external purchases (items bought from outside vendors on a guest's behalf)
- Decides per-purchase whether to add cost to the guest's bill or absorb it personally

### Caterer
- Manages their own menu items: create, update availability, set caterer price, set notice period, delete
- Sees incoming orders for their items only
- Approves orders (`accepted`) or rejects them with a structured reason
- Marks accepted orders as `prepared`

### Manager (Resort Manager)
- Sees all guests and their complete order history
- Generates bills: selects which orders to include, applies optional discounts
- Views bill detail: orders, external purchases, totals
- Approves guest payment by uploading a payment screenshot → sets bill to `paid`
- Uploads caterer payment proof via `/api/bill-payments/`
- Can share bill via WhatsApp (uses guest's `phone_number`)
- Can download bill as PDF

### Superuser
- Has all manager permissions
- Additionally manages the vendor registry: rename vendors (to merge duplicates), delete erroneous entries
- Vendors are auto-created (ad-hoc) when caretakers log external purchases with new vendor names

---

## System Architecture

```
BookMyMeal/
├── backend/
│   ├── bookmymeal/          # Django project package (settings, root urls, wsgi, asgi)
│   │   ├── settings.py
│   │   ├── urls.py          # Root router: /admin/, /api/ → core.urls, media serving
│   │   ├── wsgi.py
│   │   └── asgi.py
│   └── core/                # Single Django app — all business logic lives here
│       ├── models.py        # NOT YET WRITTEN (see Current Project Status)
│       ├── views.py         # NOT YET WRITTEN
│       ├── serializers.py   # NOT YET WRITTEN
│       ├── urls.py          # Complete — all API routes defined, imports views
│       ├── admin.py         # Empty — no models registered yet
│       ├── apps.py          # Minimal CoreConfig
│       └── tests.py         # Empty
├── frontend/
│   ├── src/                 # ACTIVE frontend (newer version with CartContext)
│   │   ├── App.tsx          # Root component: all routes, RoleRedirect, providers
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── CartContext.tsx
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   └── pages/           # Organized by role: guest/, caterer/, caretaker/, manager/, superuser/
│   └── bookmymeal-frontend/ # OLDER Vite project (reference implementation, being superseded)
│       └── src/
│           ├── context/AuthContext.tsx
│           ├── lib/api.ts
│           └── pages/       # Same page structure, lacks CartContext/ProtectedRoute
└── AGENTS.md
```

**Key architectural decisions:**
- **Single Django app (`core`)** — All models, views, and serializers in one app. Appropriate for current scope; can be split by domain (orders, billing, users) if it grows.
- **Decoupled frontend** — React SPA communicates exclusively via the REST API. Django serves no HTML templates.
- **Two frontend directories** — `frontend/src/` is the active development version. `frontend/bookmymeal-frontend/` is an older Vite sub-project. New development should target `frontend/src/`.
- **All API routes prefixed `/api/`** — Enables clean reverse proxy split: `/api/*` → Django, `/*` → React.

---

## Database Overview

All primary keys are UUIDs. `AUTH_USER_MODEL = "core.User"`.

### User
Custom user model extending Django's `AbstractUser`.
- **Key fields:** `role` (enum: guest/caterer/caretaker/manager/superuser), `phone_number` (used for WhatsApp bill sharing), `email`
- **Relationships:** One-to-many with Order, Bill, ExternalPurchase, Notification
- **Significance:** Role is the central authorization axis. Must be set before first migration — changing `AUTH_USER_MODEL` after migrations is destructive.

### MenuItem
Items on the caterer's menu that guests can order.
- **Key fields:** `name`, `category` (breakfast/lunch/dinner/snacks/beverage), `caterer_price` (what facility pays caterer), `customer_price` (what guest pays), `is_available` (toggle), `is_complimentary` (guest price = ₹0), `notice_period_minutes` (advance notice required), `description`
- **Relationships:** FK to User (caterer who owns it)
- **Significance:** Two-price model supports a margin. Complimentary items are tracked for caterer billing but excluded from guest billing. `notice_period_minutes > 0` blocks ordering when insufficient time remains before midnight (business day boundary is midnight).

### Order
A single meal order placed by a guest.
- **Key fields:** `status` (pending/accepted/rejected/prepared/delivered), `allergy_notes`, `rejection_reason`, `rejection_notes`, `created_at`
- **Relationships:** FK to User (guest), contains OrderItems (either JSON field or separate related model)
- **Significance:** The central entity. Status transitions drive the entire workflow. Rejected orders can be modified and resubmitted by caretakers.

### OrderItem
Line items within an order.
- **Key fields:** `menu_item_id` (FK to MenuItem), `quantity`, `spicy_level`
- **Relationships:** Belongs to Order
- **Note:** May be implemented as a JSON array on Order or as a separate normalized model. The frontend sends and receives both structures (`items` array of `{menu_item_id, quantity, spicy_level}` and `items_detail` array with denormalized name/price fields).

### ExternalPurchase
An item bought from an outside vendor by a caretaker on a guest's behalf.
- **Key fields:** `vendor_name` (free text, triggers auto-vendor creation), `item_name`, `quantity`, `cost`, `is_paid_by_caretaker` (bool)
- **Relationships:** FK to User (guest), optional FK to Order
- **Significance:** When `is_paid_by_caretaker = false`, this purchase is automatically included in the guest's next bill. When `true`, it is recorded for accounting only and does NOT appear on the guest bill.

### Vendor
Registry of vendors who supply external purchases.
- **Key fields:** `name`, `vendor_type` (regular = known caterer, ad-hoc = auto-created from external purchase), `order_count`, `created_at`
- **Relationships:** Referenced by ExternalPurchase via `vendor_name` (free text match, not FK) or direct FK
- **Significance:** Ad-hoc vendors are created automatically. Superusers can rename entries to merge duplicates (e.g. "Sharma Sweets" and "sharma sweet").

### Bill
A consolidated invoice for a guest covering multiple orders and external purchases.
- **Key fields:** `status` (draft/paid), `discount_amount` (flat ₹), `discount_percentage`, `payment_screenshot` (file upload), `pdf_url`, `created_at`
- **Relationships:** FK to User (guest), M2M with Order, M2M or related with ExternalPurchase
- **Significance:** Only orders with status `accepted/prepared/delivered` are eligible. Both discount types can exist; only one should be applied (validate this). `payment_screenshot` is uploaded by the manager to mark bill as paid.

### BillPayment
Evidence that the facility has paid the caterer for a bill's food.
- **Key fields:** `screenshot` (file upload), `created_at`
- **Relationships:** FK to Bill
- **Significance:** Separate from guest payment proof. Tracks the facility's obligation to the caterer, not the guest's obligation to the facility.

### Notification
In-app notification for any user.
- **Key fields:** `message`, `is_read`, `created_at`
- **Relationships:** FK to User
- **Significance:** Used to inform caretakers when their modified order is processed. Likely also used to notify guests of order status changes.

---

## Core Business Rules

### Order Status Machine
```
pending → accepted  (caterer approves)
pending → rejected  (caterer rejects with reason)
accepted → prepared (caterer marks food ready)
prepared → delivered (implicit; set on bill generation or separately)
rejected → pending  (caretaker modifies and resubmits)
```
Only orders in `accepted/prepared/delivered` status are eligible for bill inclusion.

### Notice Period Enforcement
If `MenuItem.notice_period_minutes > 0`, the item cannot be ordered if the remaining minutes until midnight are fewer than `notice_period_minutes`. This is a frontend-side check in `MenuPage.tsx` (`isWithinNoticePeriod()`). The backend should also enforce this on `POST /api/orders/`.

### Complimentary Items
`MenuItem.is_complimentary = true` means the item shows as ₹0 on the guest bill but the caterer still receives `caterer_price` for it from the facility. Do not add complimentary items to the guest bill total.

### External Purchase Billing
- `is_paid_by_caretaker = false` → included in guest bill at actual `cost`
- `is_paid_by_caretaker = true` → NOT included in guest bill; recorded for internal accounting only
- Auto-creates a `Vendor` record (type = ad-hoc) if the vendor name is new

### Bill Total Formula
```
orders_subtotal   = Σ (customer_price × quantity) for non-complimentary OrderItems in selected orders
external_subtotal = Σ cost for ExternalPurchases where is_paid_by_caretaker = false
subtotal          = orders_subtotal + external_subtotal
discount          = discount_amount  OR  subtotal × (discount_percentage / 100)
grand_total       = subtotal − discount
```
Do not apply both discount types simultaneously. The frontend checks `discount_amount > 0` first, then `discount_percentage > 0`.

### Caterer Bill vs Guest Bill
Two separate financial flows:
1. **Guest Bill** — uses `customer_price`. Guest pays the facility.
2. **Caterer Bill** (`/api/caterer-bills/`) — uses `caterer_price`. Facility pays the caterer. This is a separate document accessed via `/api/caterer-bills/<uuid>/` and its PDF endpoint.

### Order Rejection
Caterers must provide a `rejection_reason` from a predefined enum (at minimum: `out_of_stock`, `other`). When `other` is selected, `rejection_notes` is required. The caretaker sees rejection details on `ModifyOrderPage` and can adjust items before resubmitting.

### Vendor Auto-Registration
On `POST /api/external-purchases/`, if `vendor_name` does not match an existing vendor, a new `Vendor` record is created automatically with `vendor_type = ad-hoc`. This prevents blocking the caretaker workflow with mandatory vendor registration steps.

---

## API Overview

All endpoints require `Authorization: Bearer <access_token>` except `/api/token/` and `/api/token/refresh/`.

### Authentication
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/token/` | POST | Any | Login — returns `{access, refresh}` + custom claims (role) |
| `/api/token/refresh/` | POST | Any | Exchange refresh token for new access token |
| `/api/me/` | GET | Any authenticated | Returns `{id, username, role, email, phone_number}` |
| `/api/users/` | GET | Manager/Superuser | List all users (for guest selection in billing) |

### Menu Items
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/menu-items/` | GET | All | List available items (guests see only `is_available=true`) |
| `/api/menu-items/` | POST | Caterer | Create new menu item |
| `/api/menu-items/<uuid>/` | PATCH | Caterer | Update availability, price, notice period |
| `/api/menu-items/<uuid>/` | DELETE | Caterer | Remove item |

### Orders
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/orders/` | GET | Role-filtered | Guest sees own orders; caterer sees their items' orders; manager sees all. Supports `?status=`, `?guest_id=` filters |
| `/api/orders/` | POST | Guest | Place order: `{items: [{menu_item_id, quantity, spicy_level}], allergy_notes}` |
| `/api/orders/<uuid>/` | PATCH | Caterer/Caretaker | Update status (`accepted/rejected/prepared`) or items (caretaker modification) |

### External Purchases
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/external-purchases/` | POST | Caretaker | Log purchase: `{guest, vendor_name, item_name, quantity, cost, is_paid_by_caretaker}`. Auto-creates vendor if new. |

### Vendors
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/vendors/` | GET | Superuser | List all vendors with `vendor_type`, `order_count`, `created_at` |
| `/api/vendors/<uuid>/` | PATCH | Superuser | Rename vendor (to merge duplicates) |
| `/api/vendors/<uuid>/` | DELETE | Superuser | Remove erroneous vendor |

### Bills
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/bills/` | POST | Manager | Generate bill: `{guest_id, order_ids[], discount_amount, discount_percentage}` |
| `/api/bills/<uuid>/` | GET | Manager | Full bill detail with nested orders, items, external purchases, totals |
| `/api/bills/<uuid>/` | PATCH | Manager | Approve guest payment: `{status: "paid", payment_screenshot: <file>}` (multipart/form-data) |
| `/api/bills/<uuid>/pdf/` | GET | Manager | Download bill PDF |
| `/api/bill-payments/` | POST | Manager | Upload caterer payment proof: `{bill_id, screenshot: <file>}` (multipart/form-data) |

### Caterer Bills
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/caterer-bills/<uuid>/` | GET | Caterer/Manager | Caterer-side view of a bill (uses `caterer_price`, not `customer_price`) |
| `/api/caterer-bills/<uuid>/pdf/` | GET | Caterer/Manager | Download caterer bill PDF |

### Notifications
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/notifications/` | GET | Any | List current user's notifications |
| `/api/notifications/<uuid>/read/` | PATCH | Any | Mark a notification as read |

---

## Order Lifecycle

```
[Guest]
  Browses MenuPage → items filtered by is_available, notice_period_minutes enforced client-side
  Adds items to CartContext (quantity, spicy_level per item)
  Reviews OrderSummaryPage → adds allergy_notes
  Submits → POST /api/orders/
                ↓
[Backend] Creates Order with status=pending, notifies caterer(s)
                ↓
[Caterer] Sees order in OrdersPage (GET /api/orders/?status=pending)
  ├─ Approves → PATCH status=accepted
  │               ↓
  │           Caterer marks food ready → PATCH status=prepared
  │               ↓
  │           Order eligible for billing
  │
  └─ Rejects → PATCH status=rejected, rejection_reason, rejection_notes
                    ↓
              [Caretaker] Sees in RejectedOrdersPage
              Opens ModifyOrderPage → adjusts items
              Saves → PATCH /api/orders/<id>/ with new items
                    ↓
              Order resets to status=pending (back to caterer)
                ↓
[Manager] Views guest's orders (GuestOrdersPage)
  Navigates to GenerateBillPage → selects orders, optional discount
  POST /api/bills/ → bill created (status=draft)
                ↓
  BillDetailPage shows full itemized bill
  Manager can:
    - Download PDF (GET /api/bills/<id>/pdf/)
    - Send via WhatsApp (opens wa.me/ with PDF link)
    - Approve payment (PATCH bill with screenshot → status=paid)
    - Upload caterer payment proof (POST /api/bill-payments/)
```

---

## Billing Workflow

### Guest Bill Generation
1. Manager selects a guest from the dashboard
2. Fetches all orders for that guest filtered to `accepted/prepared/delivered`
3. Manager selects which orders to include (checkbox per order)
4. Optionally enters `discount_amount` (flat ₹) or `discount_percentage`
5. Submits → `POST /api/bills/` → bill created
6. `ExternalPurchases` where `is_paid_by_caretaker = false` are automatically included

### Caterer Bill Generation
Separate from guest bills. Uses `caterer_price` per item, not `customer_price`. Accessed via `/api/caterer-bills/<uuid>/`. Details of generation trigger are not fully defined in the frontend code.

### Discounts
- Two types: flat rupee amount (`discount_amount`) or percentage (`discount_percentage`)
- Applied to subtotal (orders + external purchases)
- Both fields exist on the Bill model; only one should be non-zero per bill
- The frontend displays whichever is non-zero; backend should validate mutual exclusivity

### Complimentary Items
- Rendered as ₹0 on guest bill and in all totals
- Still tracked in the order and visible in billing UI with a "Complimentary" badge
- Caterer still receives `caterer_price` for these items from the facility

### Payment Approval
- Manager uploads a physical payment screenshot as proof
- `PATCH /api/bills/<uuid>/` with `status=paid` and `payment_screenshot` as multipart form data
- Screenshots stored in `MEDIA_ROOT` (local filesystem in dev; must use cloud storage in production)

---

## Authentication & Authorization

### Token Flow
```
POST /api/token/ → {access, refresh}  (stored in localStorage)
GET  /api/me/    → {id, username, role, email, phone_number}

Every request:
  Authorization: Bearer <access_token>

On 401:
  POST /api/token/refresh/ → {access}  (silent retry)

On refresh failure:
  clearTokens() → redirect to /login
```

### Frontend Authorization
- `AuthContext` holds the user object globally
- `ProtectedRoute` wraps every protected route; checks `user.role` against `allowedRoles[]`
- `RoleRedirect` at `/` reads `user.role` and navigates to the correct dashboard
- Frontend authorization is UX-only — backend must enforce all permissions independently

### Backend Authorization
- `settings.py` sets `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` globally
- Custom permission classes per view must enforce role checks (not yet implemented — `views.py` does not exist)
- Key permission rules to implement:
  - Guest: read/write own orders only
  - Caterer: read/write own menu items only; read/write orders for own menu items only
  - Caretaker: read/write rejected orders; create external purchases
  - Manager: read all orders/users; create/read bills; approve payments
  - Superuser: all of the above + vendor management

### JWT Customization
`MyTokenObtainPairView` (referenced in `core/urls.py`, not yet implemented) extends the default `TokenObtainPairView` to include `role` and likely `username` in the JWT payload so the frontend can read them from `AuthContext` immediately after login.

---

## Current Project Status

### Completed (Frontend)
- Full routing structure with role-based access control (`App.tsx`, `ProtectedRoute`)
- Authentication flow: login, logout, session restore, silent token refresh (`AuthContext`, `api.ts`)
- Cart management for guest ordering (`CartContext`)
- Guest: `MenuPage` (browse, add to cart, notice period enforcement), `OrderSummaryPage` (submit order, allergy notes), `BillPage` (view orders, spending by category)
- Caterer: `OrdersPage` (approve/reject with reasons), `PreparationPage`, `MenuManagementPage` (full CRUD on menu items)
- Caretaker: `RejectedOrdersPage`, `ModifyOrderPage` (modify rejected orders), `ExternalPurchasePage`
- Manager: `DashboardPage`, `GuestOrdersPage`, `GenerateBillPage`, `BillDetailPage` (with payment approval, WhatsApp sharing, PDF download, caterer proof upload)
- Superuser: `VendorsPage` (rename, delete vendors; distinguishes ad-hoc vs regular)

### Completed (Backend)
- Django project structure, `settings.py`, middleware configuration
- Root and app-level URL routing (`bookmymeal/urls.py`, `core/urls.py`) — all routes defined
- JWT auth configuration (SimpleJWT in `settings.py`)
- CORS configuration
- Media file serving (dev only)
- App configuration (`core/apps.py`)

### NOT YET IMPLEMENTED (Backend — Critical Gap)
- `core/models.py` — no models exist; no database tables
- `core/views.py` — no views exist; all API endpoints return 404/500
- `core/serializers.py` — no serializers
- Database migrations — none run
- `core/admin.py` — empty, no models registered
- `core/tests.py` — empty, no tests
- PDF generation logic (`/api/bills/<uuid>/pdf/`, `/api/caterer-bills/<uuid>/pdf/`)
- Notification creation logic (when to create notifications)
- Backend enforcement of `notice_period_minutes`
- Backend enforcement of role-based permissions per view

### Known Limitations
- `SECRET_KEY` is hardcoded in `settings.py` — must be moved to environment variable before any deployment
- `DEBUG = True` and `CORS_ALLOW_ALL_ORIGINS = True` — development-only settings not yet guarded by environment
- JWT tokens in `localStorage` — vulnerable to XSS; acceptable for development
- SQLite — single-writer; not suitable for concurrent production use
- Media files stored on local filesystem — breaks in multi-server deployments
- No API versioning — all routes are under `/api/` with no version prefix
- `DEFAULT_AUTO_FIELD` not set — Django will warn; UUID PKs likely override this but warning should be silenced
- No rate limiting on `/api/token/` — brute-force password attacks possible
- Frontend has two parallel directories (`frontend/src/` and `frontend/bookmymeal-frontend/`) — should be consolidated

### Technical Debt
- `core/urls.py` imports from `.views` which does not exist — project cannot start until `views.py` is created
- `admin.py` is empty — no models registered, admin panel is useless for debugging
- Zero test coverage
- Two frontend codebases in the same repo need consolidation

---

## Development Conventions

### Django Patterns
- **Generic class-based views** — Use DRF's `ListCreateAPIView` and `RetrieveUpdateDestroyAPIView` for standard CRUD. `MyTokenObtainPairView` extends `TokenObtainPairView` as the established customization pattern.
- **UUID primary keys** — All models use UUID PKs. Use `models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`.
- **`AUTH_USER_MODEL = "core.User"`** — Always use `get_user_model()` in code, never import `User` directly from `django.contrib.auth.models`.
- **Role checks** — Create a `IsRole` permission class pattern (e.g. `IsManager`, `IsCaterer`) using DRF's `BasePermission`.
- **Filtering** — Use DRF's `queryset.filter()` in `get_queryset()` based on `self.request.user.role` to scope data per role.

### API Conventions
- All endpoints under `/api/`
- UUIDs in URL paths: `<uuid:pk>`
- File uploads use `multipart/form-data` (detected automatically in `api.ts` via `instanceof FormData`)
- Responses use snake_case field names (Django/DRF default)
- Nested detail objects use `_detail` suffix (e.g. `items_detail`, `orders_detail`, `guest_detail`)
- List filtering via query params: `?status=pending`, `?guest_id=<uuid>`

### Frontend Conventions
- API calls exclusively through `api.ts` helper functions: `apiGet<T>`, `apiPost<T>`, `apiPatch<T>`, `apiDelete`
- `BASE_URL = '/api'` — relies on Vite proxy in development; Nginx proxy in production
- TypeScript types for all API responses defined in `src/types.ts` (file expected; import pattern: `import type { Order } from '../../types'`)
- Role-based page organization: `pages/guest/`, `pages/caterer/`, `pages/caretaker/`, `pages/manager/`, `pages/superuser/`
- Inline styles used throughout (no CSS modules or Tailwind as of current code)
- Primary brand color: `#f16524` (orange)

### Naming Conventions
- Backend: snake_case for fields, URLs, variables (Python standard)
- Frontend: PascalCase for components/types, camelCase for variables/functions
- URL names follow `resource_action` pattern: `order_list`, `menu_item_detail`, `bill_pdf`
- Page components named `<Feature>Page` (e.g. `MenuPage`, `GenerateBillPage`)

---

## Future Roadmap

Based on current architecture gaps and business logic:

1. **Implement `core/models.py`** — Highest priority. Nothing works without models and migrations.
2. **Implement `core/views.py` and `core/serializers.py`** — Full REST API implementation.
3. **PDF generation** — Implement `/api/bills/<uuid>/pdf/` using `reportlab` or `weasyprint`.
4. **Notification signals** — Wire Django signals in `core/apps.py` `ready()` to auto-create Notification records on order status changes.
5. **Backend notice period enforcement** — Validate `notice_period_minutes` on `POST /api/orders/` server-side.
6. **Switch to PostgreSQL** — Required before any production deployment.
7. **Environment-based settings** — Extract `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASES` into environment variables using `python-decouple` or `django-environ`.
8. **Cloud media storage** — Migrate from local `MEDIA_ROOT` to AWS S3 or GCS using `django-storages`.
9. **Consolidate frontend** — Merge `frontend/bookmymeal-frontend/` into `frontend/src/` and delete the subdirectory.
10. **Real-time order updates** — Add Django Channels + WebSocket support so caterer's screen updates without polling.
11. **API versioning** — Prefix routes with `/api/v1/` before external consumers lock to current URLs.
12. **Test suite** — Write permission tests first (highest risk area), then order lifecycle tests, then billing calculation tests.
13. **Nginx + Gunicorn deployment configuration** — Docker Compose setup for production.

---

## Important Context For Future AI Sessions

### Critical Assumptions
- The `core` app contains ALL models, views, and serializers. Do not create additional Django apps unless the scope significantly expands.
- `core/urls.py` is the source of truth for the API surface. It is complete and should not be changed without updating the frontend accordingly.
- The active frontend is `frontend/src/`. Do not modify `frontend/bookmymeal-frontend/` unless explicitly asked.
- All primary keys are UUIDs — never use auto-incrementing integers.
- `AUTH_USER_MODEL = "core.User"` is set. Never use Django's default User directly.

### Business Constraints
- **Two-price model is intentional.** `caterer_price` ≠ `customer_price`. Do not consolidate into one field. The difference represents facility margin.
- **Complimentary items must appear in orders and caterer bills.** They are ₹0 for guests but not free for the facility.
- **Caretaker role is the human proxy for guests** who cannot use the system themselves (hospital patients, elderly). The modify-and-resubmit workflow is a core feature, not an edge case.
- **External purchases auto-create vendors.** Do not require caretakers to pre-register vendors. Superusers clean up the registry post-hoc.
- **`is_paid_by_caretaker` billing exclusion is a hard rule.** If true, the purchase never appears on any guest bill.
- **Midnight is the order deadline.** `notice_period_minutes` is calculated against minutes remaining until midnight, not a fixed clock time.

### Design Decisions That Should Not Change Without Careful Consideration
- **Single `core` app** — Splitting into multiple apps requires careful migration management and URL refactoring.
- **JWT over sessions** — Changing to session auth requires significant frontend changes (CSRF handling, cookie configuration) and breaks the current `api.ts` design.
- **UUID PKs** — Changing to integer PKs after first migration requires data migration and all client UUIDs become invalid.
- **`/api/` prefix** — All frontend API calls hardcode this prefix. Changing it requires updating every page that uses `apiGet/apiPost/apiPatch/apiDelete`.
- **Dual bill types (guest bill vs caterer bill)** — These are separate financial documents. Do not merge. Guest sees `customer_price`; caterer sees `caterer_price`.
- **Role stored on User model** — Switching to Django Groups would require a data migration and changes to every permission check in views and frontend.
