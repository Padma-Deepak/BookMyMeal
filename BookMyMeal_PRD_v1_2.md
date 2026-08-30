
# 1. Executive Summary
BookMyMeal is a web-based resort meal management platform that digitises the end-to-end food-ordering lifecycle for a single-property resort. It connects Guests, Managers, Caterers, Caretakers, and a Superuser through a single system, replacing manual order-taking and paper bills with a structured, auditable workflow.

Key outcomes the platform delivers:
- Guests can browse a live menu (honouring notice periods and item availability), place orders with dietary preferences, and view a transparent breakdown of their spending.
- Caterers receive instant order notifications, can manage their own offerings, and view their payout history — including itemised invoices and paid/pending status — without any visibility into guest-facing prices.
- Managers have full operational control: they manage menu items and pricing; generate and share bills; approve payments; and access complete billing history for both guests and caterers.
- Caretakers handle rejected orders by modifying the guest's order or sourcing items externally, log all vendor purchases for transparency, and maintain a history of all purchases they have logged.
- The Superuser has all Manager capabilities plus full account administration (create/delete any user type, reset passwords for any account) and vendor registry management (rename/merge/delete vendor records).

Note on the Superuser role: The Superuser is an active operational role responsible for account lifecycle management and vendor data hygiene. Day-to-day meal operations (billing, ordering, caterer management) are handled by the Manager without Superuser involvement.

# 2. Goals & Success Metrics
## 2.1 Business Goals
- Eliminate paper-based order-taking and billing at the resort property.
- Provide full auditability of orders, payments, and external purchases.
- Build a vendor intelligence layer by automatically tracking ad-hoc caterer names from external purchases.
- Improve guest satisfaction through transparent, real-time order status and spending visibility.
- Reduce unnecessary contact between personas — the app mediates information that would otherwise require phone calls or in-person follow-up.

## 2.2 Success Metrics
- **Order placement time:** Guest places an order in under 2 minutes from opening the menu.
- **Bill generation time:** Manager generates and shares a bill in under 3 minutes.
- **Rejection resolution rate:** 90% of rejected/timed-out orders are resolved by the Caretaker within 1 hour.
- **Billing accuracy:** Zero discrepancy between caterer payout totals and manager-uploaded payment proofs over a 30-day period.
- **System uptime:** 99% availability during resort operating hours (6 AM – 11 PM local time).
- **Adoption:** All meal orders placed through the platform within 2 weeks of go-live (zero paper orders).

# 3. User Personas & Roles

## 3.1 Guest
A resort guest staying at the property for one or more nights. Interacts with the platform primarily on a mobile browser.
- Browses the live menu filtered by availability and notice period.
- Places orders with quantity, spicy level, and allergy notes.
- Views their own running bill and spending breakdown by meal category.
- Cannot administer their own account or see other guests' data.
- Accesses the platform via username and password created by the Manager at check-in.

## 3.2 Caterer
A food vendor contracted by the resort to prepare specific meal items. May operate for breakfast, lunch, dinner, or snacks independently of other caterers.
- Manages their own menu items: availability, notice period, and caterer price.
- Receives in-app notifications when orders arrive for their items.
- Approves or rejects orders with a structured reason.
- Tracks items through preparation and marks orders complete.
- Views their own payout history (caterer prices only — guest-facing prices are never visible).

## 3.3 Caretaker
A staff member who acts as a human proxy for guests who need assistance, and who sources items externally when caterers cannot fulfil an order.
- Monitors the dashboard for rejected and timed-out orders.
- Modifies rejected orders (swap/remove items) and resubmits to the caterer.
- Resolves orders by logging external purchases from outside vendors.
- Maintains a personal history of all purchases they have logged, with the ability to delete erroneous entries.
- Does not have visibility into billing or caterer payout details.

## 3.4 Manager
The resort operations manager. Responsible for the full billing lifecycle and operational configuration.
- Creates and deactivates guest accounts at check-in/check-out from the dashboard.
- Manages the complete menu: adds items, sets customer-facing prices, assigns caterers, toggles complimentary status.
- Generates guest bills from selected orders with optional discounts.
- Shares bills via WhatsApp and downloads PDF copies.
- Approves guest payments by uploading payment proof screenshots.
- Uploads caterer payment proof to mark caterer payouts as settled.
- Views complete billing history for guests, filterable by name and status.

## 3.5 Superuser
A platform administrator with all Manager capabilities plus system-level account and data management.
- Creates, views, and deletes accounts of any role (guest, caretaker, caterer, manager, superuser).
- Resets passwords for any user account.
- Manages the vendor registry: renames vendors to merge duplicates, deletes erroneous entries.
- Can access all guest-facing and caterer-facing views for debugging purposes.

# 4. Functional Requirements
## 4.1 Guest Onboarding
Before a guest can place orders, the Manager creates a guest record at check-in.
- Manager creates a guest account with: username, password, first name, last name, phone number (used for WhatsApp bill sharing), and email. Role is set to `guest`.
- The guest logs in with the username and password provided by the Manager at check-in.
- Only one active guest exists at any time (single-occupancy Airbnb-style property). The Manager deactivates the current guest on checkout and creates a new one on the next check-in.
- Guest access is scoped to menu browsing, order placement, and bill viewing only. No administrative actions are available to guests.

## 4.2 Menu Display & Ordering (Guest)
### 4.2.1 Menu Screen
The guest-facing menu screen is the primary entry point for placing food orders. It must reflect real-time item availability and enforce caterer-defined notice periods.
- Display all menu items grouped by meal category (Breakfast, Lunch, Dinner, Snacks, Beverage).
- Show only items marked as available by the assigned caterer; unavailable items are hidden entirely.
- Each item displays the required notice period (e.g. 'Order at least 4 hours in advance') as set by the caterer.
- Items ordered within their notice period are blocked at the UI level with an explanatory message and cannot be submitted. Notice period is calculated against minutes remaining until midnight. This check is currently enforced client-side only; backend enforcement is a pending P1 item.
- Quantity input: numeric stepper per item.
- Spicy preference: dropdown per item — None / Mild / Medium / Hot / Extra Hot.
- Allergies & special preferences: one free-text input field per order (not per item).
- 'Add to Order' button adds selected items to a cart. 'View Order' navigates to the order summary.

### 4.2.2 Order Summary & Submission
- Display a tabular summary of all selected items: name, quantity, spicy level, unit price, line total.
- Show order-level notes (allergies/preferences field).
- Display total cost.
- 'Submit Order' calls POST /api/orders/. On success, show confirmation.
- 'View Bill' navigates to the guest bill view if a bill has been generated by the manager.

### 4.2.3 Guest Bill View & Spending Breakdown
- Display spending grouped by meal category: Breakfast spent X, Lunch spent Y, Dinner spent Z, etc.
- Show each order with item details, quantities, and cost per line.
- Complimentary items (e.g. included breakfast) are shown at ₹0 with a 'Complimentary' label.
- External purchases added by the caretaker where `is_paid_by_caretaker = false` appear in the bill automatically with a 'Caretaker Purchase' label.
- Bill is read-only for guests.

## 4.3 Caterer Menu & Availability Management
### 4.3.1 Menu Item Management (Caterer)
Each caterer owns and manages their specific subset of menu items. Default caterer assignment per dish is set by the Manager.
- Caterer can add new menu items: name, description, category, notice period, and their own caterer price.
- Caterer can remove items from their menu at any time; removed items are immediately hidden from the guest menu.
- Caterer can toggle item availability on/off without removing the item. Only available items appear on the guest menu.
- Caterer can set and edit the notice period per item (in minutes). This is displayed to guests on the menu screen.
- Caterer can set and edit their caterer price per item. Customer-facing prices are set and managed by the Manager only. Caterers have no visibility into what guests are charged.

### 4.3.2 Order Notifications & Approval
- When a guest submits an order containing a caterer's items, that caterer receives an instant in-app notification.
- Caterer Dashboard lists all incoming orders with item details, guest identifier, and order time.
- Pending timeout: if an order is not approved or rejected within 30 minutes, it automatically surfaces in the Caretaker dashboard for follow-up. This is calculated client-side: pending orders older than 30 minutes appear in a separate 'Timed Out' section.
- Caterer can Approve an order — status moves to `accepted`.
- Caterer can Reject an order — must select a reason: Out of stock / Ingredients unavailable / Preparation not possible today / Insufficient notice period / Other (free-text mandatory when Other is selected). Rejection reason is routed to the Caretaker only, not shown to the guest.

### 4.3.3 Order Preparation Flow
- Accepted orders appear in an 'In Preparation' queue.
- Caterer can mark individual items as prepared using checkboxes, with a live progress counter showing items completed vs total.
- 'Complete Order' button finalises the order status as `prepared`.

### 4.3.4 Caterer Payout History
Caterers can view their complete payout history, scoped to their own caterer prices only. Guest-facing prices are never shown.
- Payout history is organised by bill (one payout record per guest bill per caterer).
- Each payout record shows: bill date, items prepared, quantity, caterer price per item, total amount owed, and paid/pending status.
- Tapping a payout record opens the itemised breakdown for that bill.
- Guest name is not shown to caterers. Bills are identified by date only.
- Paid status is updated by the Manager when they upload caterer payment proof. The caterer sees this update in real time.

## 4.4 Caretaker Workflow
### 4.4.1 Rejected & Timed-Out Order Handling
The Caretaker is the resolver for all caterer rejections and timed-out pending orders.
- Caretaker Dashboard shows all orders with status `rejected` or timed-out (pending orders older than 30 minutes), displayed in two separate sections with the caterer-provided reason where available.
- Caretaker contacts the guest offline to discuss alternatives (the system does not mediate this conversation).
- **Modify flow:** On the 'Modify Order' screen, the caretaker adjusts quantities, changes spicy levels, or removes individual items before resubmitting to the caterer. The order resets to `pending` status.
- **Resolve flow:** On the 'Resolve Order' screen, the caretaker logs an external purchase to source the item externally. This sets the order to `resolved` status.
- Once the caretaker saves modifications, the guest receives an in-app notification prompting them to review the updated order summary.
- Caretaker receives an in-app notification when any order is rejected or times out.

### 4.4.2 External Purchase Logging
- Caretaker records: item name, vendor name (free-text with autocomplete from the vendor registry), quantity, cost, paid status (Yes/No), and optionally links to a specific order.
- If paid status is No (`is_paid_by_caretaker = false`), the cost is automatically added to the guest's bill.
- If paid status is Yes (`is_paid_by_caretaker = true`), it is logged for accounting but not charged to the guest.
- Vendor names auto-create a `Vendor` record (type = ad-hoc) if the vendor name is new. Previously used vendor names are shown via autocomplete.
- All external purchase records are visible to the Manager in the guest's bill and order history.
- The record also stores a FK to the logged-in caretaker and an optional FK to a related order.

### 4.4.3 External Purchase History
- Caretaker can view all external purchases they have personally logged via the Purchase History screen.
- Each record displays: item name, vendor, quantity, cost, paid status, and date.
- Caretaker can delete an erroneous purchase record from this screen (calls DELETE /api/external-purchases/<uuid>/).

## 4.5 Manager Workflow
### 4.5.1 Manager Dashboard
- Overview of all active guests with order counts and bill status.
- Inline 'Create Guest' form: username, password, first name, last name, phone number, email. Calls POST /api/users/ with `role: 'guest'`.
- Quick access to: generate bill, view all orders for a guest, view billing history.

### 4.5.2 Menu Management (Manager)
The Manager has full control over menu configuration:
- Set and edit customer-facing prices for all menu items. Caterers cannot see these prices.
- Toggle complimentary status per item (`is_complimentary`).
- Add, edit, or remove menu items directly (in addition to caterer self-management).
- Both `caterer_price` and `customer_price` are editable inline via PATCH /api/menu-items/<uuid>/.

### 4.5.3 Bill Generation
- Select orders by checkbox to include in the bill (allows partial billing, e.g. lunch orders only).
- Bill automatically includes any unpaid external purchases (`is_paid_by_caretaker = false`) for that guest.
- Optional discount input: flat rupee amount (`discount_amount`) or percentage (`discount_percentage`). Only one may be applied per bill.
- Real-time grand total preview updates as orders are selected and discount is entered.
- 'Generate Bill' calls POST /api/bills/ — creates a guest bill using customer-facing prices.
- A separate caterer payout record is generated per caterer using caterer prices. The caterer sees their payout status in their history view.

### 4.5.4 Bill Sharing via WhatsApp
- Manager taps 'Send via WhatsApp' on any generated bill.
- The system opens a wa.me deep-link pre-populated with the guest's registered phone number and the authenticated PDF bill URL.
- The link points to GET /api/bills/<id>/pdf/, protected by standard authentication.

### 4.5.5 Payment Approval & Proof Upload
- Manager clicks 'Approve Payment' to mark a guest bill as paid — calls PATCH /api/bills/<id>/ with `status: "paid"` and `payment_screenshot` as multipart/form-data. Stored in `payments/` under `MEDIA_ROOT`.
- For caterer payouts: Manager uploads a caterer payment screenshot via POST /api/bill-payments/ with `{bill_id, screenshot}`. This updates the paid/pending status visible to the caterer in their payout history.

### 4.5.6 Billing History
The Manager has a complete, searchable history of all billing activity:
- Lists all generated bills showing guest name, bill date, total amount, bill status (draft/paid), and a link to download the PDF.
- Filterable by guest name (search) and status.
- Grand total is computed from the `grand_total` field returned by the BillSerializer.

## 4.6 Account Management (Superuser)
The Superuser has a dedicated Accounts page for system-wide user management.
- View all users across all roles with role badges.
- Create new accounts for any role: username, password, role, email, phone number, first name, last name.
- Delete any user account.
- Reset the password for any user account via POST /api/users/<uuid>/set-password/ (superuser-only).

## 4.7 Password Management (All Roles)
- Any authenticated user can change their own password via the Change Password screen.
- Requires the current password and a new password (minimum 6 characters).
- Calls POST /api/change-password/.

# 5. API Endpoint Reference

All endpoints require `Authorization: Bearer <access_token>` except `/api/token/` and `/api/token/refresh/`.

## 5.1 Authentication & Users
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/token/` | POST | Any | Login — returns `{access, refresh}` + custom claims (role, username) |
| `/api/token/refresh/` | POST | Any | Exchange refresh token for new access token |
| `/api/me/` | GET/PATCH | Any authenticated | Returns/updates own profile: `{id, username, role, email, phone_number, first_name, last_name}` |
| `/api/users/` | GET | Any authenticated | List all users; filter with `?role=guest` |
| `/api/users/` | POST | Manager/Superuser | Create a new user account |
| `/api/users/<uuid>/set-password/` | POST | Superuser | Reset any user's password: `{new_password}` |
| `/api/change-password/` | POST | Any authenticated | Change own password: `{current_password, new_password}` |

## 5.2 Menu Items
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/menu-items/` | GET | All | Caterers see own items (all states); others see only `is_available=true` |
| `/api/menu-items/` | POST | Caterer/Superuser | Create new menu item |
| `/api/menu-items/<uuid>/` | GET | Any authenticated | Retrieve item detail |
| `/api/menu-items/<uuid>/` | PATCH | Caterer (own items)/Superuser | Update availability, prices, notice period, description |
| `/api/menu-items/<uuid>/` | DELETE | Caterer (own items)/Superuser | Remove item |

## 5.3 Orders
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/orders/` | GET | Role-filtered | Guest: own. Caterer: their items' orders. Manager/Superuser: all. Filters: `?status=`, `?guest_id=`, `?caterer_id=` |
| `/api/orders/` | POST | Guest | Place order: `{items: [{menu_item_id, quantity, spicy_level}], allergy_notes}` |
| `/api/orders/<uuid>/` | GET | Role-filtered | Order detail |
| `/api/orders/<uuid>/` | PATCH | Caterer/Caretaker | Update status (`accepted`/`rejected`/`prepared`/`resolved`) or modify items |

## 5.4 External Purchases
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/external-purchases/` | GET | Caretaker (own)/Manager/Superuser | List purchases |
| `/api/external-purchases/` | POST | Caretaker | Log purchase: `{guest, vendor_name, item_name, quantity, cost, is_paid_by_caretaker, order?}` |
| `/api/external-purchases/<uuid>/` | GET | Caretaker (own)/Manager/Superuser | Purchase detail |
| `/api/external-purchases/<uuid>/` | DELETE | Caretaker (own) | Delete erroneous purchase record |

## 5.5 Vendors
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/vendors/` | GET | Any authenticated | List all vendors with `vendor_type`, `order_count`, `created_at` |
| `/api/vendors/<uuid>/` | GET | Any authenticated | Vendor detail |
| `/api/vendors/<uuid>/` | PATCH | Superuser | Rename vendor (to merge duplicates) |
| `/api/vendors/<uuid>/` | DELETE | Superuser | Remove erroneous vendor |

## 5.6 Bills (Guest-Facing)
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/bills/` | GET | Manager/Guest/Superuser | List bills — manager/superuser see all; guest sees own |
| `/api/bills/` | POST | Manager/Superuser | Generate bill: `{guest_id, order_ids[], discount_amount, discount_percentage}` |
| `/api/bills/<uuid>/` | GET | Manager/Guest/Superuser | Full bill detail with nested orders, items, `external_purchases_detail`, `grand_total` |
| `/api/bills/<uuid>/` | PATCH | Manager/Superuser | Approve payment: `{status: "paid", payment_screenshot: <file>}` (multipart/form-data) |
| `/api/bills/<uuid>/pdf/` | GET | Manager/Guest/Superuser | Download bill PDF (requires `reportlab`; returns 501 otherwise) |
| `/api/bill-payments/` | POST | Manager/Superuser | Upload caterer payment proof: `{bill_id, screenshot: <file>}` (multipart/form-data) |

## 5.7 Caterer Bills
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/caterer-bills/` | GET | Caterer/Manager/Superuser | Caterer sees bills containing their items; manager/superuser see all |
| `/api/caterer-bills/<uuid>/` | GET | Caterer/Manager/Superuser | Caterer-side bill detail (uses `caterer_price`, not `customer_price`) |
| `/api/caterer-bills/<uuid>/pdf/` | GET | Caterer/Manager/Superuser | Download caterer bill PDF |

## 5.8 Notifications
| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/notifications/` | GET | Any authenticated | List current user's notifications |
| `/api/notifications/<uuid>/read/` | PATCH | Any authenticated | Mark a notification as read |

# 6. Feature Priority Matrix
P0 = Launch blocker. P1 = High value, first iteration post-launch. P2 = Next quarter.

| # | Feature | Priority | Status |
|---|---|---|---|
| 1 | Guest login (username/password) | P0 | Done |
| 2 | Menu display with notice period enforcement (client-side) | P0 | Done |
| 3 | Cart and order submission | P0 | Done |
| 4 | Caterer order approval/rejection with structured reasons | P0 | Done |
| 5 | Caterer preparation queue (item checkboxes + progress counter) | P0 | Done |
| 6 | Caretaker rejected/timed-out order view | P0 | Done |
| 7 | Caretaker modify order and resubmit | P0 | Done |
| 8 | Caretaker resolve order (external sourcing) | P0 | Done |
| 9 | Caretaker external purchase logging | P0 | Done |
| 10 | Caretaker purchase history with delete | P0 | Done |
| 11 | Manager guest bill generation with discounts | P0 | Done |
| 12 | Manager bill PDF download | P0 | Done |
| 13 | Manager WhatsApp bill sharing | P0 | Done |
| 14 | Manager payment approval (screenshot upload) | P0 | Done |
| 15 | Manager caterer payment proof upload | P0 | Done |
| 16 | Caterer payout history | P0 | Done |
| 17 | Manager billing history (guest bills) | P0 | Done |
| 18 | Vendor auto-creation on external purchase | P0 | Done |
| 19 | Superuser vendor registry management (rename/delete) | P0 | Done |
| 20 | Superuser account management (create/delete/reset password) | P0 | Done |
| 21 | Change password (all roles) | P0 | Done |
| 22 | In-app notifications for all order events | P0 | Done |
| 23 | Guest bill view with spending breakdown by category | P0 | Done |
| 24 | Backend notice period enforcement on POST /api/orders/ | P1 | Pending |
| 25 | Switch to PostgreSQL | P1 | Pending |
| 26 | Environment-based settings (SECRET_KEY, DEBUG, DATABASES) | P1 | Pending |
| 27 | Cloud media storage (S3/GCS) | P1 | Pending |
| 28 | Consolidate frontend directories | P1 | Pending |
| 29 | Real-time order updates via WebSockets | P2 | Pending |
| 30 | API versioning (`/api/v1/`) | P2 | Pending |
| 31 | Nginx + Gunicorn Docker Compose deployment | P2 | Pending |
| 32 | Time-limited WhatsApp PDF URLs | P2 | Pending |

# 7. Key Data Models
All primary keys are UUIDs. `AUTH_USER_MODEL = "core.User"`.

## 7.1 User
Custom user model extending Django's `AbstractUser`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `username` | string | Login credential; must be unique |
| `password` | string | Hashed by Django |
| `role` | enum | guest / caterer / caretaker / manager / superuser |
| `phone_number` | string (nullable) | Used for WhatsApp bill sharing |
| `email` | string (nullable) | Optional contact |
| `first_name` | string (nullable) | From AbstractUser |
| `last_name` | string (nullable) | From AbstractUser |

Role is embedded in the JWT payload so the frontend can read it immediately after login without an extra request.

## 7.2 MenuItem

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `caterer` | FK → User | Must have `role = caterer` |
| `name` | string | |
| `description` | text | Optional |
| `category` | enum | breakfast / lunch / dinner / snacks / beverage |
| `caterer_price` | decimal | What the facility pays the caterer |
| `customer_price` | decimal | What the guest pays; set by Manager |
| `is_available` | bool | Default true; toggled by caterer |
| `is_complimentary` | bool | Guest sees ₹0; caterer still billed `caterer_price` |
| `notice_period_minutes` | int | Minutes before midnight required to place the order; 0 = no restriction |
| `created_at` | datetime | Auto |

## 7.3 Order

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `guest` | FK → User | Must have `role = guest` |
| `status` | enum | pending / accepted / partially_accepted / rejected / prepared / delivered / resolved |
| `allergy_notes` | text | Order-level free text |
| `rejection_reason` | enum (nullable) | out_of_stock / ingredients_unavailable / preparation_not_possible / insufficient_notice / other |
| `rejection_notes` | text | Required when `rejection_reason = other` |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |

**Status transitions:**
```
pending → accepted           (caterer approves)
pending → rejected           (caterer rejects with reason)
accepted → prepared          (caterer marks food ready)
prepared → delivered         (on bill generation or manual update)
rejected → pending           (caretaker modifies and resubmits)
pending/rejected → resolved  (caretaker sources externally via Resolve flow)
```

Only orders in `accepted / prepared / delivered` are eligible for bill inclusion.

## 7.4 OrderItem

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `order` | FK → Order | CASCADE delete |
| `menu_item` | FK → MenuItem | PROTECT (prevents deletion of items with linked orders) |
| `quantity` | int | ≥ 1 |
| `spicy_level` | enum | None / Mild / Medium / Hot / Extra Hot |

## 7.5 Vendor

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | string | Display name |
| `vendor_type` | enum | regular (known caterer) / ad-hoc (auto-created from external purchase) |
| `order_count` | int | Incremented on each linked ExternalPurchase |
| `created_at` | datetime | Auto |

Auto-created with `vendor_type = ad-hoc` when an ExternalPurchase is submitted with an unknown vendor name. Superusers rename to merge duplicates.

## 7.6 ExternalPurchase

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `guest` | FK → User | Must have `role = guest` |
| `order` | FK → Order (nullable) | Optional link to a specific rejected/resolved order |
| `caretaker` | FK → User (nullable) | The caretaker who logged this purchase |
| `vendor` | FK → Vendor (nullable) | Resolved FK from `vendor_name` |
| `vendor_name` | string | Free text; used to create/match Vendor record |
| `item_name` | string | |
| `quantity` | int | |
| `cost` | decimal | Total cost for this purchase |
| `is_paid_by_caretaker` | bool | false → add to guest bill; true → internal record only |
| `is_reimbursed` | bool | Whether the caretaker has been reimbursed by the facility |
| `reimbursement_proof` | file (nullable) | Upload of reimbursement evidence |
| `created_at` | datetime | Auto |

## 7.7 Bill

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `guest` | FK → User | |
| `orders` | M2M → Order | Selected by manager at bill creation |
| `created_by` | FK → User (nullable) | Manager who generated the bill |
| `status` | enum | draft / paid |
| `discount_amount` | decimal | Flat ₹ discount; mutually exclusive with `discount_percentage` |
| `discount_percentage` | decimal | % applied to subtotal; mutually exclusive with `discount_amount` |
| `payment_screenshot` | file (nullable) | Guest payment proof uploaded by manager |
| `created_at` | datetime | Auto |

**Grand total formula:**
```
orders_subtotal   = Σ (customer_price × quantity) for non-complimentary OrderItems in selected orders
external_subtotal = Σ cost for ExternalPurchases where is_paid_by_caretaker = false
subtotal          = orders_subtotal + external_subtotal
discount          = discount_amount  OR  subtotal × (discount_percentage / 100)
grand_total       = subtotal − discount
```

## 7.8 BillPayment

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `bill` | FK → Bill | CASCADE delete |
| `screenshot` | file | Stored in `caterer_payments/` |
| `uploaded_by` | FK → User (nullable) | Manager who uploaded the proof |
| `created_at` | datetime | Auto |

## 7.9 Notification

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user` | FK → User | Recipient |
| `message` | text | Human-readable notification body |
| `is_read` | bool | Default false |
| `created_at` | datetime | Auto |

Notifications are created inline in views on every key event: order submitted (caterer notified), order accepted/rejected (guest notified), order prepared (manager notified), caretaker modifies order (guest notified), bill payment approved (guest notified).

# 8. Non-Functional Requirements
## 8.1 Performance
- Menu page must load in under 2 seconds on a standard 4G connection.
- Order submission must respond within 3 seconds under normal load.
- PDF bill generation must complete within 10 seconds for bills up to 50 line items.
## 8.2 Reliability
- Order submissions must be idempotent — duplicate submissions (e.g. from double-tap) must not create duplicate orders.
- Payment screenshot uploads must be stored in durable object storage with 99.9% durability SLA.
## 8.3 Security
- Each role has access only to their designated screens and API endpoints; cross-role access is rejected with HTTP 403.
- Caterer payout screens must never surface customer-facing prices. This is enforced at the API level, not just the UI.
- Payment screenshots are stored in private, access-controlled storage — not publicly accessible.
- WhatsApp bill links use the authenticated PDF endpoint. Time-limited URL expiry is deferred to v1.1.
- `SECRET_KEY` is currently hardcoded in `settings.py` — must be moved to an environment variable before any production deployment.
- `DEBUG = True` and `CORS_ALLOW_ALL_ORIGINS = True` are development-only settings not yet guarded by environment.
## 8.4 Accessibility & Usability
- All forms must work on mobile browsers without horizontal scrolling.
- Key actions (Submit Order, Approve, Reject) must have touch target sizes of at least 44x44px.
- Caterer rejection reason screen must surface the built-in options prominently before the free-text field.

# 9. Out of Scope (v1.0)
- In-app guest-to-staff messaging — caretaker conversations with guests remain offline.
- Direct online payment processing — payments are recorded, not processed, through the platform.
- Inventory management for caterers — item availability is manual, not stock-driven.
- Multi-property / multi-resort support — v1.0 targets a single resort deployment.
- Native iOS / Android apps — web-responsive UI only.
- Vendor frequency reporting / analytics dashboard — ad-hoc vendor records are created and managed but no analytics view exists. Deferred to v2.
- Time-limited WhatsApp PDF URLs — deferred to v1.1 as a security hardening step.
- Real-time WebSocket order updates — caterer/caretaker screens require manual refresh. Deferred to v2.
- Multi-caterer order auto-splitting on submission — all items from a single guest submission go into one Order record. Caterer-scoped views are achieved via filtered GET /api/orders/ queries.

# 10. Decisions Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Username/password login for guests instead of magic link | Magic link requires an SMS/email delivery integration. Username/password provided by the Manager at check-in is sufficient for a single-property deployment where the Manager is physically present. |
| 2 | Single Django `core` app | All models, views, and serializers in one app. Appropriate for current scope. Can be split by domain if the codebase grows significantly. |
| 3 | JWT over session auth | Enables a fully decoupled React SPA with no CSRF complexity. Tokens in `localStorage` are acceptable for a controlled-access internal tool. |
| 4 | UUID primary keys for all models | Avoids enumerable integer IDs in URLs. Must be set before the first migration — changing later is destructive. |
| 5 | Two-price model (`caterer_price` / `customer_price`) | The facility takes a margin on each item. These must never be consolidated into one field. Caterers must never see `customer_price`. |
| 6 | Full Vendor model in v1 (not just a text field) | Originally deferred to v2, but implemented during v1 development to support Superuser deduplication of vendor names via the vendor registry management page. |
| 7 | Separate Modify and Resolve flows for caretakers | Modifying an order resubmits it to the caterer (pending). Resolving logs an external purchase and closes the order (resolved). Keeping them as separate screens clarifies intent and prevents accidental resubmission. |
| 8 | `is_paid_by_caretaker` hard exclusion from guest bill | If `is_paid_by_caretaker = true`, the purchase must never appear on any guest bill. Enforced at the serializer level. |
| 9 | Midnight as the notice period deadline | `notice_period_minutes` is calculated against remaining minutes until midnight, not a fixed clock time. Reflects the real-world constraint that meal prep is scoped within a single calendar day. |
| 10 | Superuser as active operational role, not break-glass | The scope of account management and vendor data hygiene requires a regular operational role. The Superuser signs in regularly to manage accounts and clean vendor records. |

# 11. Assumptions
- This is a single-occupancy Airbnb-style property. Only one guest stays at a time. Multi-guest / multi-room support is out of scope for v1.0.
- Each menu item has exactly one assigned caterer at any given time. Split-caterer items are not supported.
- The Manager creates guest accounts at check-in directly from the dashboard. The Superuser handles staff account creation (caterer, caretaker, manager accounts) and vendor data hygiene.
- Caterer prices are always lower than customer prices (a margin exists on every item). The system enforces this separation at the API level.
- Payment screenshot retention defaults to 7 years pending formal legal review.
- Guests do not need real-time order status tracking in v1.0. They receive a notification if their order is modified and can view the final bill when generated.
- WhatsApp sharing uses the wa.me deep-link mechanism. No WhatsApp Business API integration is required in v1.0.
- Vendor tracking uses a full Vendor model with auto-creation on each new ExternalPurchase submission.
- All items from a single guest order submission go into one Order record. Per-caterer visibility is achieved via filtered API queries, not order splitting.

# 12. Document Revision History

| Version | Date | Summary |
|---|---|---|
| v1.0 | (initial) | Initial draft — core personas, ordering flow, billing workflow |
| v1.1 | (draft) | Added Superuser role detail, Vendor model decision, WhatsApp sharing spec |
| v1.2 | 2026-06-30 | Full sync with implemented codebase: filled all empty sections (§2.2, §3, §5, §6, §7, §10, §12); updated §4.1 (username/password replaces magic link); added §4.4.3 (purchase history), §4.6 (account management), §4.7 (change password); updated §9 (removed "vendor model deferred" — implemented in v1); corrected Superuser role description; documented `partially_accepted` and `resolved` order statuses; added `ExternalPurchase` fields (`caretaker`, `vendor FK`, `is_reimbursed`, `reimbursement_proof`); added `BillPayment.uploaded_by`; corrected §10 and §11 to reflect actual architectural decisions |
