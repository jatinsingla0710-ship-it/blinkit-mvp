# GroAurum Pilot — Standard Operating Procedures (SOPs)

**Phase 4 · Pilot Readiness Kit**  
**Audience:** Ops, Sales leads, Warehouse, Delivery supervisors, Support  
**Rule:** Prefer SECURITY DEFINER RPCs / Admin ERP actions. Do not mutate trusted status fields via raw SQL unless Engineering on-call.

---

## SOP-1 · Customer onboarding

### Purpose
Activate a retailer shop and link a customer auth account.

### Actors
Salesman (field) · Customer (owner) · Admin (exception only)

### Preconditions
- Shop service area defined
- Salesman assigned or creating the shop
- Customer has phone/email for invite

### Happy path
1. Salesman opens Sales PWA → **Create retailer** (trade name, contact, address, PIN, area).
2. Confirm shop appears as **LEAD** (or configured lifecycle).
3. Salesman → **Create invitation** for shop mobile.
4. Share invite token / link securely (WhatsApp/SMS when live; verbal + token in pilot).
5. Customer signs into Customer App → **Accept invitation**.
6. Verify shop linked (`shop_auth_links`) and catalogue scoped to shop.
7. Customer places a smoke COD order (optional) to prove activation.

### Exceptions
| Condition | Action |
|-----------|--------|
| Invite expired | Salesman creates new invite; run expire job if stuck PENDING |
| Wrong mobile | Admin/Sales update contact; new invite |
| Customer already linked to other shop | Escalate Engineering — one link per auth user |
| Shop created by mistake | Soft-delete / deactivate via Admin; do not reuse invite |

### Exit criteria
- Customer can browse catalogue and place order
- Shop visible to assigned salesman and Admin

### Evidence
Screenshot of linked account + shop id in Admin

---

## SOP-2 · Order processing

### Purpose
Move orders from placement → stock reserved → ready for dispatch safely.

### Actors
Customer / Salesman (create) · Admin Ops (progress) · Warehouse

### Source paths
- **Self-serve:** Customer cart → `place_customer_order`
- **Assisted:** Salesman → `place_assisted_order`

### Happy path (COD pilot default)
1. Order lands in Admin **Orders** (status typically `STOCK_RESERVED` after place).
2. Ops validates lines, prices, shop credit policy (manual in pilot).
3. Advance status only via Admin UI (RPC `update_order_status_admin`):
   - `STOCK_RESERVED` → `PROCESSING` → `READY_FOR_DISPATCH`
4. Confirm `order_events` timeline updated.
5. Confirm inventory reserved quantities still coherent.
6. Hand off to **SOP-4 Delivery workflow** for route assignment.

### Online payment path (when Razorpay live)
1. Customer creates payment intent via edge `razorpay-create-order`.
2. Customer completes Razorpay checkout.
3. Webhook `razorpay-webhook` (HMAC required) → `apply_payment_webhook_event`.
4. Only proceed to dispatch when payment `PAID` (or COD path).

### Exceptions
| Condition | Action |
|-----------|--------|
| Illegal transition | Read error; use allowed graph only |
| Price dispute | Cancel order; recreate with corrected assisted order |
| Duplicate order | Cancel newer; keep reservation release |
| Stuck reservation | Wait TTL or run `job_expire_stock_reservations` after cancel |

### Exit criteria
- Order `READY_FOR_DISPATCH` or assigned to route
- Audit log contains admin status change

---

## SOP-3 · Inventory allocation

### Purpose
Keep physical stock, reserved stock, and sellable availability aligned.

### Actors
Warehouse · Admin · Cron (expiry)

### Definitions
- **On hand** ≈ available + reserved (per `inventory_balances`)
- **Reserved** = open `stock_reservations` for active orders
- **Sellable** = available quantity

### Happy path — receive stock
1. Admin Inventory → increase balance for SKU + location.
2. Verify customer catalogue availability rises.
3. Record physical put-away (paper/WMS note in pilot).

### Happy path — allocate to order
1. Placement RPCs create `RESERVED` reservations and bump `reserved_quantity`.
2. Do **not** manually edit reserved without Engineering.
3. On cancel / expire, reservations release and reserved decreases.

### Daily controls
1. Morning: low-stock dashboard card vs physical count for top SKUs.
2. After each pick wave: spot-check 3 SKUs.
3. Confirm cron `groaurum-expire-reservations` ran (`job_runs`).

### Exceptions
| Condition | Action |
|-----------|--------|
| Negative available | Stop selling SKU; open **Inventory mismatch** playbook |
| Reservation not released after cancel | Run expire job; if still stuck → Engineering |
| Wrong location | Correct via Admin adjustment + audit note |

### Exit criteria
- No SKU with available < 0
- Pilot SKUs counted ≥ 1×/day

---

## SOP-4 · Delivery workflow

### Purpose
Assign, execute, and close delivery routes with proof and COD.

### Actors
Admin (plan) · Delivery executive · Supervisor

### Happy path
1. Admin creates **delivery route**, assigns delivery profile, attaches order stops.
2. Orders move to `ASSIGNED_TO_ROUTE` / `OUT_FOR_DELIVERY` per RPC rules.
3. Driver opens Delivery PWA → sees only assigned routes.
4. Driver **Start route**.
5. Per stop: arrive → in progress → **Complete** (or **Fail** with note).
6. For COD: collect amount via `delivery_collect_cod` **before** complete when required.
7. Driver **Complete route** when all stops closed.
8. Supervisor verifies COD page totals vs cash (SOP-5).

### Exceptions
| Condition | Action |
|-----------|--------|
| Customer closed | Fail stop; reschedule new stop next day |
| Partial delivery | Pilot: fail + recreate corrected order (returns future) |
| App offline | Do not invent paper-only PAID; complete when online |
| Wrong driver | Reassign in Admin; old driver loses access |

### Exit criteria
- Route closed
- Delivered orders `DELIVERED` with `PAID` payment
- Customer timeline shows delivered

---

## SOP-5 · COD reconciliation

### Purpose
Match cash collected to system payments daily.

### Actors
Delivery supervisor · Finance (light) · Admin

### Daily close (T+0)
1. Export / list Delivery **COD** collections for the day.
2. Count physical cash + UPI screenshots (if any).
3. Compare to `payments` with method COD / pay-on-delivery and status `PAID` for today’s deliveries.
4. Variance ≤ ₹X pilot threshold (define locally, default ₹0 for pilot week 1).
5. Deposit slip / cash locker log signed by driver + supervisor.

### Exceptions
| Condition | Action |
|-----------|--------|
| Short cash | Hold driver settlement; investigate stop-level COD |
| Over cash | Park excess; do not silently adjust payment |
| Marked PAID without collect | Incident: payment integrity — Engineering |

### Exit criteria
- Signed daily COD sheet
- Zero unexplained variance or ticket opened

---

## SOP-6 · Returns handling (future-ready)

### Purpose
Document the pilot-safe process until a Returns module ships. **Do not invent DB tables in ops.**

### Current pilot policy
- Physical returns accepted only with Supervisor approval.
- System: **do not** reverse `DELIVERED` ad-hoc.
- Create a **manual credit memo** outside system (spreadsheet) linked to `order_id`.
- Inventory: Admin increases stock via inventory adjustment with note `RETURN_PILOT|<order_id>`.
- Finance: record refund/credit offline; no automatic Razorpay refund in pilot unless Engineering runs controlled refund.

### Future state (when built)
1. Customer/Sales request return → Admin approve → RMA id.
2. Restock or scrap decision.
3. Refund / credit note RPC updates payment + ledger.
4. Timeline event `RETURN_RECEIVED`.

### Exit criteria (pilot)
- Every physical return has spreadsheet row + inventory adjustment note
- Original order remains historically `DELIVERED`

---

## SOP quick reference

| SOP | Primary tool | Key RPC / job |
|-----|--------------|---------------|
| Onboarding | Sales + Customer | `salesman_create_retailer`, `salesman_create_invitation`, `accept_shop_invitation` |
| Orders | Admin + apps | `place_customer_order`, `place_assisted_order`, `update_order_status_admin` |
| Inventory | Admin + cron | `job_expire_stock_reservations` |
| Delivery | Admin + Delivery PWA | `delivery_start_route`, `delivery_complete_stop`, `delivery_fail_stop`, `delivery_collect_cod` |
| COD | Delivery + Finance sheet | payments PAID + cash count |
| Returns | Manual + inventory adjust | Future RMA module |

---

## Revision

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | Phase 4 | Ops + Eng | Initial pilot SOPs |
