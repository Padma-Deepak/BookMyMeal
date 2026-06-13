"""API smoke tests — run: python test_api.py"""
import json, sys
import urllib.request, urllib.error

BASE = "http://127.0.0.1:8000/api"
PASS = []
FAIL = []

def req(method, path, body=None, token=None, label=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    rq = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(rq) as r:
            resp = json.loads(r.read())
            tag = label or f"{method} {path}"
            print(f"  [PASS] {tag}")
            PASS.append(tag)
            return resp
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        tag = label or f"{method} {path}"
        print(f"  [FAIL] {tag} -> HTTP {e.code}: {body_text[:120]}")
        FAIL.append((tag, e.code, body_text[:120]))
        return None

def login(username, password):
    return req("POST", "/token/", {"username": username, "password": password},
               label=f"Login {username}")

# ── Auth ──────────────────────────────────────────────────────────────────────
print("\n--- Auth ---")
r = login("guest1", "guest123");      GUEST_TOK    = r["access"] if r else None
r = login("caterer1", "caterer123");  CATERER_TOK  = r["access"] if r else None
r = login("caretaker1","caretaker123"); CARETAKER_TOK = r["access"] if r else None
r = login("manager1", "manager123");  MANAGER_TOK  = r["access"] if r else None
r = login("padma", "admin123");       SUPER_TOK    = r["access"] if r else None

# ── /me/ ──────────────────────────────────────────────────────────────────────
print("\n--- /me/ ---")
me_guest    = req("GET", "/me/", token=GUEST_TOK,    label="/me/ as guest")
me_caterer  = req("GET", "/me/", token=CATERER_TOK,  label="/me/ as caterer")
me_manager  = req("GET", "/me/", token=MANAGER_TOK,  label="/me/ as manager")

# ── Menu items ────────────────────────────────────────────────────────────────
print("\n--- Menu items ---")
menu = req("GET", "/menu-items/", token=GUEST_TOK, label="GET /menu-items/ as guest")
if menu:
    print(f"         {len(menu)} available items returned")
    complimentary = [m for m in menu if m.get("is_complimentary")]
    print(f"         {len(complimentary)} complimentary item(s)")
    has_customer_price = all("customer_price" in m for m in menu)
    print(f"         customer_price present: {has_customer_price}")

caterer_menu = req("GET", "/menu-items/", token=CATERER_TOK, label="GET /menu-items/ as caterer")
if caterer_menu:
    has_no_customer_price = all("customer_price" not in m for m in caterer_menu)
    print(f"         customer_price hidden from caterer: {has_no_customer_price}")

# ── Orders ────────────────────────────────────────────────────────────────────
print("\n--- Orders ---")
guest_orders = req("GET", "/orders/", token=GUEST_TOK, label="GET /orders/ as guest")
if guest_orders:
    print(f"         guest sees {len(guest_orders)} orders")
    statuses = [o["status"] for o in guest_orders]
    print(f"         statuses: {statuses}")
    has_items_detail = all("items_detail" in o for o in guest_orders)
    print(f"         items_detail present: {has_items_detail}")

caterer_orders = req("GET", "/orders/?status=pending", token=CATERER_TOK, label="GET /orders/?status=pending as caterer")
if caterer_orders:
    print(f"         caterer sees {len(caterer_orders)} pending orders")

rejected_orders = req("GET", "/orders/?status=rejected", token=CARETAKER_TOK, label="GET /orders/?status=rejected as caretaker")
if rejected_orders:
    print(f"         caretaker sees {len(rejected_orders)} rejected orders")
    if rejected_orders:
        REJECTED_ORDER_ID = rejected_orders[0]["id"]
    else:
        REJECTED_ORDER_ID = None

all_orders = req("GET", "/orders/", token=MANAGER_TOK, label="GET /orders/ as manager")
if all_orders:
    print(f"         manager sees {len(all_orders)} total orders")

# Test placing a new order
if menu and GUEST_TOK:
    available = [m for m in menu if not m.get("is_complimentary")]
    if available:
        new_order = req("POST", "/orders/", {
            "items": [{"menu_item_id": available[0]["id"], "quantity": 1, "spicy_level": "Mild"}],
            "allergy_notes": "Test order from API test"
        }, token=GUEST_TOK, label="POST /orders/ (place new order)")
        if new_order:
            NEW_ORDER_ID = new_order["id"]
            print(f"         new order status: {new_order['status']}")
            print(f"         items_detail populated: {'items_detail' in new_order}")

# ── Caterer approves/rejects ───────────────────────────────────────────────────
print("\n--- Order status transitions ---")
if caterer_orders and caterer_orders:
    pending_id = caterer_orders[0]["id"]
    approved = req("PATCH", f"/orders/{pending_id}/",
                   {"status": "accepted"},
                   token=CATERER_TOK, label=f"PATCH order -> accepted (caterer)")
    if approved:
        print(f"         order status after patch: {approved['status']}")

# ── Users list ────────────────────────────────────────────────────────────────
print("\n--- Users ---")
guests = req("GET", "/users/?role=guest", token=MANAGER_TOK, label="GET /users/?role=guest as manager")
if guests:
    print(f"         {len(guests)} guest(s) found")
    GUEST_ID = guests[0]["id"] if guests else None
else:
    GUEST_ID = None

# ── External purchases ────────────────────────────────────────────────────────
print("\n--- External purchases ---")
if GUEST_ID:
    ep = req("POST", "/external-purchases/", {
        "guest": GUEST_ID,
        "vendor_name": "Test Vendor API",
        "item_name": "Samosa Plate",
        "quantity": 2,
        "cost": 50,
        "is_paid_by_caretaker": False,
    }, token=CARETAKER_TOK, label="POST /external-purchases/")
    if ep:
        print(f"         vendor auto-created: {ep.get('vendor_name')}")

# ── Vendors ───────────────────────────────────────────────────────────────────
print("\n--- Vendors ---")
vendors = req("GET", "/vendors/", token=SUPER_TOK, label="GET /vendors/ as superuser")
if vendors:
    print(f"         {len(vendors)} vendors: {[v['name'] for v in vendors]}")

# ── Bills ─────────────────────────────────────────────────────────────────────
print("\n--- Bills ---")
all_orders2 = req("GET", "/orders/", token=MANAGER_TOK, label="GET all orders for bill generation")
if all_orders2 and GUEST_ID:
    eligible = [o["id"] for o in all_orders2
                if o["status"] in ("accepted","prepared","delivered")
                and o.get("guest") == GUEST_ID]
    print(f"         {len(eligible)} orders eligible for billing")
    if eligible:
        bill = req("POST", "/bills/", {
            "guest_id": GUEST_ID,
            "order_ids": eligible[:2],
            "discount_amount": 20,
            "discount_percentage": 0,
        }, token=MANAGER_TOK, label="POST /bills/ (generate bill)")
        if bill:
            BILL_ID = bill["id"]
            print(f"         bill status: {bill['status']}")
            print(f"         orders in bill: {len(bill.get('orders_detail',[]))}")
            print(f"         external purchases: {len(bill.get('external_purchases_detail',[]))}")

            # Guest retrieves own bill
            req("GET", f"/bills/{BILL_ID}/", token=GUEST_TOK, label="GET /bills/<id>/ as guest (own bill)")

            # Notifications
            notifs = req("GET", "/notifications/", token=GUEST_TOK, label="GET /notifications/ as guest")
            if notifs is not None:
                print(f"         guest has {len(notifs)} notification(s)")

# ── Permission checks ─────────────────────────────────────────────────────────
print("\n--- Permission enforcement ---")
# Guest should NOT be able to see vendors
vendors_guest = None
try:
    rq = urllib.request.Request(BASE + "/vendors/",
         headers={"Authorization": f"Bearer {GUEST_TOK}", "Content-Type":"application/json"})
    with urllib.request.urlopen(rq) as r:
        vendors_guest = r.read()
        print("  [FAIL] Guest can access /vendors/ — should be 403")
        FAIL.append(("Guest /vendors/ should 403", 0, ""))
except urllib.error.HTTPError as e:
    if e.code == 403:
        print(f"  [PASS] Guest correctly blocked from /vendors/ (403)")
        PASS.append("Guest /vendors/ 403")
    else:
        print(f"  [FAIL] Guest /vendors/ returned {e.code}, expected 403")
        FAIL.append(("Guest /vendors/ should 403", e.code, ""))

# Unauthenticated request should get 401
try:
    rq = urllib.request.Request(BASE + "/orders/")
    with urllib.request.urlopen(rq) as r:
        print("  [FAIL] Unauthenticated /orders/ should return 401")
        FAIL.append(("Unauth /orders/ should 401", 0, ""))
except urllib.error.HTTPError as e:
    if e.code == 401:
        print(f"  [PASS] Unauthenticated request blocked (401)")
        PASS.append("Unauth 401")
    else:
        print(f"  [FAIL] Unauthenticated returned {e.code}, expected 401")
        FAIL.append(("Unauth /orders/ should 401", e.code, ""))

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
if FAIL:
    print("\nFailures:")
    for tag, code, msg in FAIL:
        print(f"  [{code}] {tag}: {msg}")
print('='*50)
sys.exit(1 if FAIL else 0)
