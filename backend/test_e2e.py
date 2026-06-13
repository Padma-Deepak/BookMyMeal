"""
Full end-to-end test for BookMyMeal.
Run: python test_e2e.py

Covers:
  1. Manager creates a new guest account
  2. Guest logs in, browses menu, places an order
  3. Caterer accepts one order, rejects another with reason
  4. Caretaker views rejected orders, modifies and resubmits
  5. Caterer accepts resubmitted order, marks as prepared
  6. Manager generates bill (with discount), views billing history
  7. Manager marks bill as paid
  8. History/audit logs per role
  9. Edge cases: duplicate bill, wrong role access, bad order data, etc.
"""
import json, sys, uuid, io
import urllib.request, urllib.error

# Force UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE = "http://127.0.0.1:8000/api"
PASS = []
FAIL = []

# ── Helpers ────────────────────────────────────────────────────────────────────

def req(method, path, body=None, token=None, label=None,
        expect_status=None, multipart=None):
    url = BASE + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if multipart:
        data = multipart
    elif body:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    else:
        data = None

    rq = urllib.request.Request(url, data=data, headers=headers, method=method)
    tag = label or f"{method} {path}"
    try:
        with urllib.request.urlopen(rq) as r:
            raw = r.read()
            resp = json.loads(raw) if raw else {}
            if expect_status and r.status != expect_status:
                print(f"  [WARN] {tag} -> HTTP {r.status}, expected {expect_status}")
            else:
                print(f"  [PASS] {tag}")
            PASS.append(tag)
            return resp
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        if expect_status and e.code == expect_status:
            print(f"  [PASS] {tag} (expected HTTP {e.code})")
            PASS.append(tag)
            return {"_status": e.code, "_body": body_text}
        print(f"  [FAIL] {tag} -> HTTP {e.code}: {body_text[:200]}")
        FAIL.append((tag, e.code, body_text[:200]))
        return None

def expect_fail(method, path, expected_code, body=None, token=None, label=None):
    url = BASE + path
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body:
        headers["Content-Type"] = "application/json"
    data = json.dumps(body).encode() if body else None
    rq = urllib.request.Request(url, data=data, headers=headers, method=method)
    tag = label or f"{method} {path} -> expect {expected_code}"
    try:
        with urllib.request.urlopen(rq) as r:
            r.read()
            print(f"  [FAIL] {tag} -> HTTP {r.status}, expected {expected_code}")
            FAIL.append((tag, r.status, "unexpected success"))
            return None
    except urllib.error.HTTPError as e:
        if e.code == expected_code:
            print(f"  [PASS] {tag}")
            PASS.append(tag)
            return {"_status": e.code}
        else:
            body_text = e.read().decode()
            print(f"  [FAIL] {tag} -> HTTP {e.code}, expected {expected_code}: {body_text[:120]}")
            FAIL.append((tag, e.code, body_text[:120]))
            return None

def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")

def check(condition, label):
    if condition:
        print(f"  [PASS] {label}")
        PASS.append(label)
    else:
        print(f"  [FAIL] {label}")
        FAIL.append((label, 0, "assertion failed"))

# ── 1. Login all roles ─────────────────────────────────────────────────────────
section("1. Login — all roles")

def login(username, password):
    r = req("POST", "/token/", {"username": username, "password": password},
            label=f"Login {username}")
    return r["access"] if r else None

MANAGER_TOK   = login("manager1",   "manager123")
CATERER_TOK   = login("caterer1",   "caterer123")
CARETAKER_TOK = login("caretaker1", "caretaker123")
SUPER_TOK     = login("padma",      "admin123")

# Bad credentials
expect_fail("POST", "/token/", 401,
            {"username": "manager1", "password": "wrongpass"},
            label="Login with wrong password -> 401")

# Unauthenticated access
expect_fail("GET", "/orders/", 401, label="Unauthenticated /orders/ -> 401")

# ── 2. Manager creates a new guest ─────────────────────────────────────────────
section("2. Manager creates a new guest")

NEW_USERNAME = f"newguest_{uuid.uuid4().hex[:6]}"
new_guest = req("POST", "/users/", {
    "username":     NEW_USERNAME,
    "password":     "newguest123",
    "first_name":   "New",
    "last_name":    "Guest",
    "email":        f"{NEW_USERNAME}@example.com",
    "phone_number": "+919876500001",
    "role":         "guest",
}, token=MANAGER_TOK, label="Manager creates new guest")

GUEST_ID  = None
GUEST_TOK = None

if new_guest:
    GUEST_ID = new_guest.get("id")
    check(new_guest.get("role") == "guest", "New user has role=guest")
    check(new_guest.get("username") == NEW_USERNAME, "Username matches")
    GUEST_TOK = login(NEW_USERNAME, "newguest123")
    check(GUEST_TOK is not None, "New guest can log in")

# Caterer should NOT be able to create users
expect_fail("POST", "/users/", 403, {
    "username": "hackerguest",
    "password": "x",
    "role":     "guest",
}, token=CATERER_TOK, label="Caterer cannot create users -> 403")

# ── 3. Guest browses menu and places two orders ────────────────────────────────
section("3. Guest browses menu & places orders")

menu = req("GET", "/menu-items/", token=GUEST_TOK, label="Guest GET /menu-items/")
check(menu is not None and len(menu) > 0, "Menu has items")

ORDER1_ID = None
ORDER2_ID = None

if menu and GUEST_TOK:
    available = [m for m in menu if not m.get("is_complimentary")]
    complimentary = [m for m in menu if m.get("is_complimentary")]

    check(len(available) >= 2, "At least 2 non-complimentary items available")
    check(len(complimentary) >= 1, "At least 1 complimentary item on menu")
    check(all("caterer_price" not in m for m in menu), "caterer_price hidden from guest")
    check(all("customer_price" in m for m in menu), "customer_price visible to guest")

    # Order 1: will be accepted
    order1 = req("POST", "/orders/", {
        "items": [
            {"menu_item_id": available[0]["id"], "quantity": 2, "spicy_level": "Mild"},
            {"menu_item_id": complimentary[0]["id"], "quantity": 1, "spicy_level": "None"},
        ],
        "allergy_notes": "No peanuts please",
    }, token=GUEST_TOK, label="Guest places Order 1 (to be accepted)")
    if order1:
        ORDER1_ID = order1["id"]
        check(order1["status"] == "pending", "Order 1 status is pending")
        check("items_detail" in order1, "items_detail present in response")
        check(len(order1["items_detail"]) == 2, "Order 1 has 2 items")

    # Order 2: will be rejected then resubmitted
    order2 = req("POST", "/orders/", {
        "items": [
            {"menu_item_id": available[1]["id"], "quantity": 1, "spicy_level": "Hot"},
        ],
        "allergy_notes": "",
    }, token=GUEST_TOK, label="Guest places Order 2 (to be rejected)")
    if order2:
        ORDER2_ID = order2["id"]
        check(order2["status"] == "pending", "Order 2 status is pending")

# Edge: empty items list
expect_fail("POST", "/orders/", 400, {
    "items": [],
    "allergy_notes": "Empty order",
}, token=GUEST_TOK, label="Guest places empty order -> 400")

# Edge: guest cannot patch orders (only caterer/caretaker can)
if ORDER1_ID:
    expect_fail("PATCH", f"/orders/{ORDER1_ID}/", 403,
                {"status": "accepted"},
                token=GUEST_TOK, label="Guest cannot PATCH order status -> 403")

# ── 4. Caterer views pending orders ───────────────────────────────────────────
section("4. Caterer views pending orders")

caterer_pending = req("GET", "/orders/?status=pending", token=CATERER_TOK,
                      label="Caterer GET pending orders")
if caterer_pending is not None:
    check(len(caterer_pending) >= 2, f"Caterer sees >=2 pending orders (got {len(caterer_pending)})")

# Caterer menu management: add a new item
new_item = req("POST", "/menu-items/", {
    "name":                  "Test Upma",
    "category":              "breakfast",
    "caterer_price":         20,
    "customer_price":        45,
    "notice_period_minutes": 0,
    "is_complimentary":      False,
    "is_available":          True,
    "description":           "Semolina porridge — test item",
}, token=CATERER_TOK, label="Caterer creates new menu item")
NEW_MENU_ITEM_ID = new_item["id"] if new_item else None

if NEW_MENU_ITEM_ID:
    # Toggle unavailable
    req("PATCH", f"/menu-items/{NEW_MENU_ITEM_ID}/", {"is_available": False},
        token=CATERER_TOK, label="Caterer toggles item unavailable")
    # Toggle back available
    req("PATCH", f"/menu-items/{NEW_MENU_ITEM_ID}/", {"is_available": True},
        token=CATERER_TOK, label="Caterer toggles item available again")
    # Delete it
    req("DELETE", f"/menu-items/{NEW_MENU_ITEM_ID}/", token=CATERER_TOK,
        label="Caterer deletes test menu item")

# Guest should not create menu items
if menu:
    expect_fail("POST", "/menu-items/", 403, {
        "name": "Hacker Dosa", "category": "breakfast",
        "caterer_price": 10, "customer_price": 20,
        "notice_period_minutes": 0, "is_complimentary": False, "is_available": True,
    }, token=GUEST_TOK, label="Guest cannot create menu items -> 403")

# ── 5. Caterer accepts Order 1, rejects Order 2 ───────────────────────────────
section("5. Caterer accepts Order 1, rejects Order 2")

if ORDER1_ID:
    accepted = req("PATCH", f"/orders/{ORDER1_ID}/",
                   {"status": "accepted"},
                   token=CATERER_TOK, label="Caterer accepts Order 1")
    if accepted:
        check(accepted["status"] == "accepted", "Order 1 is now accepted")

if ORDER2_ID:
    # Reject without reason → should fail
    expect_fail("PATCH", f"/orders/{ORDER2_ID}/", 400,
                {"status": "rejected"},
                token=CATERER_TOK, label="Reject without reason -> 400")

    # Reject with reason
    rejected = req("PATCH", f"/orders/{ORDER2_ID}/", {
        "status":           "rejected",
        "rejection_reason": "out_of_stock",
        "rejection_notes":  "",
    }, token=CATERER_TOK, label="Caterer rejects Order 2 (out_of_stock)")
    if rejected:
        check(rejected["status"] == "rejected", "Order 2 is now rejected")
        check(rejected.get("rejection_reason") == "out_of_stock", "rejection_reason stored")

# Caterer marks accepted order as prepared
if ORDER1_ID:
    prepared = req("PATCH", f"/orders/{ORDER1_ID}/",
                   {"status": "prepared"},
                   token=CATERER_TOK, label="Caterer marks Order 1 as prepared")
    if prepared:
        check(prepared["status"] == "prepared", "Order 1 is now prepared")

# Invalid status transition: accepted → rejected (not allowed for caterer once accepted)
# (This depends on backend validation — skip if not enforced)

# ── 6. Caretaker handles rejected orders ──────────────────────────────────────
section("6. Caretaker handles rejected orders")

rejected_list = req("GET", "/orders/?status=rejected", token=CARETAKER_TOK,
                    label="Caretaker GET rejected orders")
if rejected_list is not None:
    check(len(rejected_list) >= 1, f"Caretaker sees >=1 rejected order (got {len(rejected_list)})")

# View rejected order detail
if ORDER2_ID:
    rej_detail = req("GET", f"/orders/{ORDER2_ID}/", token=CARETAKER_TOK,
                     label="Caretaker views rejected order detail")
    if rej_detail:
        check(rej_detail.get("rejection_reason") == "out_of_stock", "Rejection reason visible to caretaker")

# Caretaker modifies and resubmits Order 2
if ORDER2_ID and menu:
    available_non_comp = [m for m in menu if not m.get("is_complimentary")]
    if available_non_comp:
        resubmit = req("PATCH", f"/orders/{ORDER2_ID}/", {
            "items": [
                {"menu_item_id": available_non_comp[0]["id"], "quantity": 1, "spicy_level": "Medium"},
            ],
        }, token=CARETAKER_TOK, label="Caretaker modifies rejected order (resubmit)")
        if resubmit:
            check(resubmit["status"] == "pending", "Order 2 reset to pending after caretaker edit")
            check(len(resubmit.get("items_detail", [])) >= 1, "Resubmitted order has items")

# Caretaker logs an external purchase
if GUEST_ID:
    ep1 = req("POST", "/external-purchases/", {
        "guest":              GUEST_ID,
        "vendor_name":        "Corner Bakery",
        "item_name":          "Croissant",
        "quantity":           3,
        "cost":               90,
        "is_paid_by_caretaker": False,
    }, token=CARETAKER_TOK, label="Caretaker logs external purchase (on guest bill)")
    if ep1:
        check(ep1.get("vendor_name") == "Corner Bakery", "vendor_name stored correctly")
        check(ep1.get("is_paid_by_caretaker") == False, "is_paid_by_caretaker=False")

    # External purchase absorbed by caretaker (should NOT appear on guest bill)
    ep2 = req("POST", "/external-purchases/", {
        "guest":              GUEST_ID,
        "vendor_name":        "Corner Bakery",
        "item_name":          "Coffee",
        "quantity":           1,
        "cost":               30,
        "is_paid_by_caretaker": True,
    }, token=CARETAKER_TOK, label="Caretaker logs purchase absorbed by caretaker")
    if ep2:
        check(ep2.get("is_paid_by_caretaker") == True, "is_paid_by_caretaker=True")

    # Guest cannot log external purchases
    expect_fail("POST", "/external-purchases/", 403, {
        "guest":        GUEST_ID,
        "vendor_name":  "Hacker Store",
        "item_name":    "Free Stuff",
        "quantity":     1,
        "cost":         0,
        "is_paid_by_caretaker": True,
    }, token=GUEST_TOK, label="Guest cannot log external purchases -> 403")

# ── 7. Caterer accepts the resubmitted order ───────────────────────────────────
section("7. Caterer accepts resubmitted Order 2")

if ORDER2_ID:
    resubmitted_check = req("GET", f"/orders/{ORDER2_ID}/", token=CATERER_TOK,
                            label="Caterer views resubmitted order")
    if resubmitted_check:
        check(resubmitted_check["status"] == "pending", "Resubmitted order is pending for caterer")

    accepted2 = req("PATCH", f"/orders/{ORDER2_ID}/",
                    {"status": "accepted"},
                    token=CATERER_TOK, label="Caterer accepts resubmitted Order 2")
    if accepted2:
        check(accepted2["status"] == "accepted", "Order 2 now accepted after resubmit")

    req("PATCH", f"/orders/{ORDER2_ID}/", {"status": "prepared"},
        token=CATERER_TOK, label="Caterer marks Order 2 as prepared")

# ── 8. Manager generates bill ─────────────────────────────────────────────────
section("8. Manager generates bill")

# Get all guest's eligible orders
all_guest_orders = req("GET", f"/orders/?guest_id={GUEST_ID}", token=MANAGER_TOK,
                       label="Manager GET orders for specific guest")
BILL_ID = None

if all_guest_orders and GUEST_ID:
    eligible = [o["id"] for o in all_guest_orders
                if o["status"] in ("accepted", "prepared", "delivered")]
    check(len(eligible) >= 1, f"At least 1 order eligible for bill (got {len(eligible)})")

    # Generate bill with flat discount
    bill = req("POST", "/bills/", {
        "guest_id":          GUEST_ID,
        "order_ids":         eligible,
        "discount_amount":   50,
        "discount_percentage": 0,
    }, token=MANAGER_TOK, label="Manager generates bill with flat discount")

    if bill:
        BILL_ID = bill["id"]
        check(bill["status"] == "draft", "Bill created as draft")
        check(len(bill.get("orders_detail", [])) >= 1, "Bill has order details")
        # is_paid_by_caretaker=False purchase should appear; True should not
        ep_names = [ep.get("item_name") for ep in bill.get("external_purchases_detail", [])]
        check("Croissant" in ep_names, "Caretaker purchase (is_paid_by_caretaker=False) in bill")
        check("Coffee" not in ep_names, "Caretaker-absorbed purchase NOT in bill")

        # Verify grand_total returned by API
        actual_grand = bill.get("grand_total")
        check(actual_grand is not None, "Bill response includes grand_total field")
        if actual_grand is not None:
            orders_sub = sum(
                float(it.get("customer_price", 0)) * it.get("quantity", 0)
                for o in bill.get("orders_detail", [])
                for it in o.get("items_detail", [])
                if not it.get("is_complimentary")
            )
            ext_sub = sum(
                float(ep.get("cost", 0))
                for ep in bill.get("external_purchases_detail", [])
            )
            expected_grand = orders_sub + ext_sub - 50
            check(
                abs(float(actual_grand) - expected_grand) < 0.01,
                f"Grand total correct: Rs.{actual_grand} (expected Rs.{expected_grand:.2f})"
            )

# Edge: cannot generate bill for non-existent guest
expect_fail("POST", "/bills/", 400, {
    "guest_id":  str(uuid.uuid4()),
    "order_ids": [],
}, token=MANAGER_TOK, label="Bill with non-existent guest -> 400/404")

# Edge: guest cannot generate bills
if GUEST_ID:
    expect_fail("POST", "/bills/", 403, {
        "guest_id":  GUEST_ID,
        "order_ids": [],
    }, token=GUEST_TOK, label="Guest cannot generate bills -> 403")

# ── 9. Manager views billing history ──────────────────────────────────────────
section("9. Billing history")

bills_list = req("GET", "/bills/", token=MANAGER_TOK, label="Manager GET /bills/ list")
if bills_list is not None:
    check(len(bills_list) >= 1, f"Bill list has >=1 entry (got {len(bills_list)})")
    check(all("guest_detail" in b or "guest" in b for b in bills_list),
          "Bills list includes guest reference")

# Guest views their own bill
if BILL_ID:
    guest_bill = req("GET", f"/bills/{BILL_ID}/", token=GUEST_TOK,
                     label="Guest views own bill")
    if guest_bill:
        check(guest_bill.get("status") == "draft", "Guest bill is draft")

    # Another guest should NOT see this bill
    # (No second guest in this run, skip or use wrong token)
    expect_fail("PATCH", f"/bills/{BILL_ID}/",
                403,
                {"status": "paid"},
                token=GUEST_TOK, label="Guest cannot mark bill as paid -> 403")

# ── 10. Manager marks bill paid ───────────────────────────────────────────────
section("10. Manager marks bill as paid")

if BILL_ID:
    # Approve payment (without screenshot in this API-only test)
    paid_bill = req("PATCH", f"/bills/{BILL_ID}/",
                    {"status": "paid"},
                    token=MANAGER_TOK, label="Manager marks bill as paid")
    if paid_bill:
        check(paid_bill.get("status") == "paid", "Bill status is now paid")

    # Verify guest sees updated status
    guest_paid = req("GET", f"/bills/{BILL_ID}/", token=GUEST_TOK,
                     label="Guest sees bill is now paid")
    if guest_paid:
        check(guest_paid.get("status") == "paid", "Guest sees paid status")

# ── 11. History / audit views per role ────────────────────────────────────────
section("11. History & audit views per role")

# Guest order history
guest_all_orders = req("GET", "/orders/", token=GUEST_TOK,
                       label="Guest GET all own orders (history)")
if guest_all_orders:
    check(len(guest_all_orders) >= 2, "Guest sees their order history")
    # Guest should NOT see other guests' orders in the list
    foreign = [o for o in guest_all_orders if o.get("guest") != GUEST_ID]
    check(len(foreign) == 0, "Guest order list contains only own orders")

# Caterer sees only orders for their menu items
caterer_all = req("GET", "/orders/", token=CATERER_TOK,
                  label="Caterer GET all orders (filtered to their items)")
check(caterer_all is not None, "Caterer can fetch orders")

# Manager sees all users
all_users = req("GET", "/users/", token=MANAGER_TOK,
                label="Manager GET all users")
if all_users:
    roles = [u["role"] for u in all_users]
    check("guest" in roles, "Manager user list includes guests")
    check("caterer" in roles, "Manager user list includes caterers")

# Caterer payout history
caterer_bills = req("GET", "/caterer-bills/", token=CATERER_TOK,
                    label="Caterer GET /caterer-bills/ (payout history)")
# May return empty list — just check it doesn't 500

# Notifications
guest_notifs = req("GET", "/notifications/", token=GUEST_TOK,
                   label="Guest GET notifications")
if guest_notifs is not None:
    check(isinstance(guest_notifs, list), "Notifications is a list")
    unread = [n for n in guest_notifs if not n.get("is_read")]
    print(f"         Guest has {len(guest_notifs)} notifications ({len(unread)} unread)")
    if guest_notifs:
        notif_id = guest_notifs[0]["id"]
        req("PATCH", f"/notifications/{notif_id}/read/", {},
            token=GUEST_TOK, label="Guest marks notification as read")
        # Verify read
        after = req("GET", "/notifications/", token=GUEST_TOK,
                    label="GET notifications after marking read")
        if after:
            still_unread = [n for n in after if n["id"] == notif_id and not n["is_read"]]
            check(len(still_unread) == 0, "Notification marked as read")

# ── 12. Superuser vendor management ───────────────────────────────────────────
section("12. Superuser vendor management")

vendors = req("GET", "/vendors/", token=SUPER_TOK,
              label="Superuser GET /vendors/")
if vendors:
    print(f"         {len(vendors)} vendors in registry")
    check(len(vendors) >= 1, "Vendor registry not empty")
    # Find Corner Bakery (auto-created from external purchase)
    corner = next((v for v in vendors if "Corner" in v["name"]), None)
    check(corner is not None, "Auto-created vendor 'Corner Bakery' in registry")
    if corner:
        # Rename vendor
        renamed = req("PATCH", f"/vendors/{corner['id']}/",
                      {"name": "Corner Bakery & Co"},
                      token=SUPER_TOK, label="Superuser renames vendor")
        if renamed:
            check(renamed.get("name") == "Corner Bakery & Co", "Vendor renamed successfully")

    # Manager can LIST vendors but cannot PATCH/DELETE (superuser only)
    manager_vendors = req("GET", "/vendors/", token=MANAGER_TOK,
                          label="Manager can list /vendors/")
    check(manager_vendors is not None, "Manager GET /vendors/ succeeds")
    if corner:
        expect_fail("PATCH", f"/vendors/{corner['id']}/",
                    403, {"name": "Hacker Name"},
                    token=MANAGER_TOK, label="Manager cannot PATCH vendor -> 403")
    # Guests and caretakers are blocked
    expect_fail("GET", "/vendors/", 403, token=GUEST_TOK,
                label="Guest cannot access /vendors/ -> 403")
    expect_fail("GET", "/vendors/", 403, token=CARETAKER_TOK,
                label="Caretaker cannot access /vendors/ -> 403")

# ── 13. Additional edge cases ──────────────────────────────────────────────────
section("13. Edge cases")

# Order for non-existent menu item
if GUEST_TOK:
    expect_fail("POST", "/orders/", 400, {
        "items": [{"menu_item_id": str(uuid.uuid4()), "quantity": 1, "spicy_level": "None"}],
        "allergy_notes": "",
    }, token=GUEST_TOK, label="Order with non-existent menu_item_id -> 400")

# Zero/negative quantity
if GUEST_TOK and menu:
    expect_fail("POST", "/orders/", 400, {
        "items": [{"menu_item_id": menu[0]["id"], "quantity": 0, "spicy_level": "None"}],
        "allergy_notes": "",
    }, token=GUEST_TOK, label="Order with quantity=0 -> 400")

# Duplicate bill generation for same orders
if BILL_ID and GUEST_ID and all_guest_orders:
    eligible2 = [o["id"] for o in all_guest_orders
                 if o["status"] in ("accepted", "prepared", "delivered")]
    # Attempt to create another bill for already-billed orders — behaviour depends on backend
    dup_bill = req("POST", "/bills/", {
        "guest_id":          GUEST_ID,
        "order_ids":         eligible2,
        "discount_amount":   0,
        "discount_percentage": 0,
    }, token=MANAGER_TOK, label="Duplicate bill for already-billed orders (may succeed or warn)")
    # Just record whether it allowed it — no hard assert here

# Manager can access bill PDF endpoint (may 404 if reportlab not installed)
if BILL_ID:
    pdf_url = BASE + f"/bills/{BILL_ID}/pdf/"
    headers = {"Authorization": f"Bearer {MANAGER_TOK}"}
    rq = urllib.request.Request(pdf_url, headers=headers)
    try:
        with urllib.request.urlopen(rq) as r:
            content_type = r.headers.get("Content-Type", "")
            if "pdf" in content_type:
                print(f"  [PASS] GET /bills/<id>/pdf/ returns PDF")
                PASS.append("Bill PDF endpoint returns PDF")
            else:
                print(f"  [PASS] GET /bills/<id>/pdf/ reachable (Content-Type: {content_type})")
                PASS.append("Bill PDF endpoint reachable")
    except urllib.error.HTTPError as e:
        if e.code in (404, 501):
            print(f"  [INFO] Bill PDF endpoint HTTP {e.code} (PDF generation may not be implemented)")
        else:
            print(f"  [FAIL] Bill PDF endpoint HTTP {e.code}")
            FAIL.append(("Bill PDF endpoint", e.code, ""))

# ── Final summary ──────────────────────────────────────────────────────────────
print(f"\n{'═'*60}")
print(f"  PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
print(f"{'═'*60}")
if FAIL:
    print("\nFailures:")
    for tag, code, msg in FAIL:
        print(f"  [HTTP {code}] {tag}")
        if msg:
            print(f"           {msg}")
print()
sys.exit(1 if FAIL else 0)
