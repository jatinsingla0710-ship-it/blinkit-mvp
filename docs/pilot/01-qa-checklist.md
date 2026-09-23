# GroAurum Pilot — QA Checklist

**Phase 4 · Pilot Readiness Kit**  
**Scope:** Customer App · Admin ERP · Salesman PWA · Delivery PWA  
**Pass criteria:** Expected result observed; no blocking error in UI or `application_logs`  
**Roles:** QA | Ops | Product  
**Environment:** Staging (prefer) or local with seeded accounts

| Field | Value |
|-------|-------|
| Build / commit | _______________ |
| Tester | _______________ |
| Date | _______________ |
| Environment URL | _______________ |

**Legend:** P = Pass · F = Fail · B = Blocked · N/A = Not applicable · Sev: S1–S4

---

## A. Customer App (C-001 … C-035)

| ID | Area | Steps | Expected | Sev | Result | Notes |
|----|------|-------|----------|-----|--------|-------|
| C-001 | Auth | Open app unauthenticated | Login / gate shown; no catalogue leak | S1 | | |
| C-002 | Auth | Sign in `customer@…` / password | Session established; home loads | S1 | | |
| C-003 | Auth | Wrong password | Clear error; no session | S2 | | |
| C-004 | Auth | Sign out | Session cleared; queries removed | S1 | | |
| C-005 | Auth | Kill app / refresh while signed in | Session restored or re-login gate | S2 | | |
| C-006 | Onboarding | Accept invitation with valid token | Shop linked; can browse | S1 | | |
| C-007 | Onboarding | Invalid / expired invitation | Error; no link | S2 | | |
| C-008 | Catalogue | Open home | Categories + bestsellers load | S1 | | |
| C-009 | Catalogue | Open category | Products for category only | S2 | | |
| C-010 | Catalogue | Open product detail | Price, MOQ, unit visible | S1 | | |
| C-011 | Catalogue | Search / browse deep | No crash; empty state OK | S3 | | |
| C-012 | Cart | Add SKU respecting MOQ | Cart updates qty | S1 | | |
| C-013 | Cart | Add below MOQ | Blocked or corrected to MOQ | S1 | | |
| C-014 | Cart | Change qty by step | Only valid steps accepted | S2 | | |
| C-015 | Cart | Remove line | Line gone; totals update | S2 | | |
| C-016 | Cart | Place COD / self-serve order | Order created; stock reserved | S1 | | |
| C-017 | Cart | Place with insufficient stock | Error; no partial order | S1 | | |
| C-018 | Cart | Double-submit place order | Single order only | S1 | | |
| C-019 | Orders | Orders list | Newest first; statuses readable | S1 | | |
| C-020 | Orders | Open order detail | Lines, totals, timeline | S1 | | |
| C-021 | Orders | Timeline after status change (admin) | Timeline updates (poll/realtime) | S2 | | |
| C-022 | Orders | Empty orders | Empty state copy | S3 | | |
| C-023 | Account | View linked shop / addresses | Correct shop data | S2 | | |
| C-024 | Account | Default address shown | Matches seed/link | S3 | | |
| C-025 | Restock | Restock suggestions from history | Sensible or empty | S3 | | |
| C-026 | Payments | Online pay when Razorpay configured | Intent created; no secret in client | S1 | | |
| C-027 | Payments | Online pay when Razorpay missing (non-dev) | Clear unavailable message | S2 | | |
| C-028 | Security | Inspect bundle / network | No service-role / webhook secret | S1 | | |
| C-029 | Realtime | Keep order detail open; admin advances status | UI refreshes without manual reload | S2 | | |
| C-030 | Errors | Airplane mode place order | Graceful error | S2 | | |
| C-031 | Perf | Cold start to interactive | < 5s on pilot device (record) | S3 | | |
| C-032 | Session | Customer cannot call admin RPC | Denied | S1 | | |
| C-033 | Session | Customer sees only linked shop orders | No other shops | S1 | | |
| C-034 | UX | Brand / green theme intact | No redesign regression | S3 | | |
| C-035 | Regression | Place order → appears in Admin orders | Cross-app consistency | S1 | | |

---

## B. Admin ERP (A-001 … A-040)

| ID | Area | Steps | Expected | Sev | Result | Notes |
|----|------|-------|----------|-----|--------|-------|
| A-001 | Auth | Login admin | Dashboard loads | S1 | | |
| A-002 | Auth | Wrong password | Denied | S2 | | |
| A-003 | Auth | Logout | Session cleared | S1 | | |
| A-004 | Auth | Read-only role (if seeded) | Writes blocked | S1 | | |
| A-005 | Dashboard | Load KPIs | Numbers load or empty; no crash | S1 | | |
| A-006 | Dashboard | Low stock card | Reflects inventory | S2 | | |
| A-007 | Categories | Create category | Appears in list | S1 | | |
| A-008 | Categories | Deactivate category | Hidden from customer browse | S2 | | |
| A-009 | Products | Create product + SKU | Persists | S1 | | |
| A-010 | Products | Edit product name | Updates | S2 | | |
| A-011 | Prices | Set open trade price | Customer sees new price | S1 | | |
| A-012 | Prices | Close price row (trusted path) | New open row only via allowed path | S1 | | |
| A-013 | Inventory | Adjust balance | Available/reserved coherent | S1 | | |
| A-014 | Inventory | Over-reserve prevention | Cannot sell above available | S1 | | |
| A-015 | Customers | List shops | Seed + new shops visible | S1 | | |
| A-016 | Customers | Open shop detail | Contacts / area | S2 | | |
| A-017 | Orders | List orders | New customer order visible | S1 | | |
| A-018 | Orders | Open order detail | Lines + payment + timeline | S1 | | |
| A-019 | Orders | Status via `update_order_status_admin` | Transition succeeds; audit + event | S1 | | |
| A-020 | Orders | Illegal transition | Rejected with message | S1 | | |
| A-021 | Orders | Mark DELIVERED unpaid | Rejected | S1 | | |
| A-022 | Orders | Cancel reserved order | Status CANCELLED; stock released (job or path) | S1 | | |
| A-023 | Orders | Direct table status update (if attempted) | Blocked by RLS / invariant | S1 | | |
| A-024 | Salesmen | List / create salesman | Persists | S2 | | |
| A-025 | Delivery | Create route + assign stops | Route visible to delivery user | S1 | | |
| A-026 | Delivery | Update route status | Reflects in Delivery PWA | S2 | | |
| A-027 | Reports | Open reports snapshot | Loads without error | S3 | | |
| A-028 | Settings | Read settings | Loads | S3 | | |
| A-029 | Settings | Change setting (admin) | Audit log entry | S2 | | |
| A-030 | Realtime | New order arrives while on Orders | List invalidates / refreshes | S2 | | |
| A-031 | Realtime | Inventory change | Inventory / dashboard refresh | S2 | | |
| A-032 | Security | Non-admin JWT status RPC | Denied | S1 | | |
| A-033 | Security | Anon key only in Vite env | No service role in client | S1 | | |
| A-034 | Soft delete | Soft-delete product | Hidden from live catalogue | S2 | | |
| A-035 | Images | Product image CRUD | Upload/list (if storage ready) | S3 | | |
| A-036 | Perf | Orders list 100+ rows | Usable scroll | S3 | | |
| A-037 | Audit | After status change | `audit_logs` row present | S1 | | |
| A-038 | Logs | Force RPC error | `application_logs` or UI error | S2 | | |
| A-039 | COD | Filter COD unpaid deliveries | Ops can find them | S2 | | |
| A-040 | Regression | End-to-end: confirm → reserve → route | Full path works | S1 | | |

---

## C. Salesman PWA (S-001 … C continues S-001…S-030)

| ID | Area | Steps | Expected | Sev | Result | Notes |
|----|------|-------|----------|-----|--------|-------|
| S-001 | Auth | Login salesman1 | Dashboard loads | S1 | | |
| S-002 | Auth | Customer credentials | Denied / wrong app role | S1 | | |
| S-003 | Auth | Logout | Cleared | S2 | | |
| S-004 | Dashboard | Today metrics | Load without crash | S1 | | |
| S-005 | Retailers | List retailers | Assigned / created shops | S1 | | |
| S-006 | Retailers | Create retailer | Shop LEAD; appears in list | S1 | | |
| S-007 | Retailers | Create with invalid mobile | Validation error | S2 | | |
| S-008 | Retailers | Open retailer detail | Contacts + status | S2 | | |
| S-009 | Invite | Create invitation | Token returned; pending invite | S1 | | |
| S-010 | Invite | Customer accepts invite | Shop activated / linked | S1 | | |
| S-011 | Invite | Expired invite | Rejected | S2 | | |
| S-012 | Visits | Log visit today | Visit row created | S2 | | |
| S-013 | Visits | List today’s visits | Shows logged visit | S2 | | |
| S-014 | Orders | Create assisted order | Order created for shop | S1 | | |
| S-015 | Orders | Assisted order below MOQ | Rejected | S1 | | |
| S-016 | Orders | Assisted order overstock | Rejected | S1 | | |
| S-017 | Orders | Unassigned shop | Denied | S1 | | |
| S-018 | Catalogue | Orderable SKUs list | Prices present | S2 | | |
| S-019 | Performance | Performance page | Numbers or empty | S3 | | |
| S-020 | Realtime | Retailer activated elsewhere | Retailers list refreshes | S2 | | |
| S-021 | Realtime | Assisted order status change | Dashboard updates | S2 | | |
| S-022 | Security | Cannot update admin settings | Denied | S1 | | |
| S-023 | Security | No secrets in Vite env | Pass | S1 | | |
| S-024 | Offline | Brief network loss | Graceful error | S3 | | |
| S-025 | Mobile | 390px viewport | Usable; no clipped CTA | S2 | | |
| S-026 | Regression | Created shop visible in Admin | Cross-app | S1 | | |
| S-027 | Regression | Assisted order in Customer orders | If shop linked | S2 | | |
| S-028 | Service area | Create without area | Allowed or validated per rules | S2 | | |
| S-029 | Duplicate | Rapid double create retailer | No duplicate spam / clear IDs | S2 | | |
| S-030 | Session expiry | Wait JWT expiry | Re-auth required | S2 | | |

---

## D. Delivery PWA (D-001 … D-030)

| ID | Area | Steps | Expected | Sev | Result | Notes |
|----|------|-------|----------|-----|--------|-------|
| D-001 | Auth | Login delivery1 | Dashboard loads | S1 | | |
| D-002 | Auth | Salesman credentials | Denied | S1 | | |
| D-003 | Routes | List assigned routes | Only own routes | S1 | | |
| D-004 | Routes | Open route detail | Stops ordered | S1 | | |
| D-005 | Routes | Start route | Status OUT_FOR_DELIVERY path | S1 | | |
| D-006 | Routes | Start route not assigned | Denied | S1 | | |
| D-007 | Stops | Mark stop in progress | Status updates | S2 | | |
| D-008 | Stops | Complete stop with COD collect | Payment PAID; stop done | S1 | | |
| D-009 | Stops | Complete COD without collect | Rejected | S1 | | |
| D-010 | Stops | Complete prepaid (already PAID) | Succeeds | S1 | | |
| D-011 | Stops | Fail stop with reason | DELIVERY_FAILED / note | S1 | | |
| D-012 | Stops | Photo / signature flags | Persisted if used | S3 | | |
| D-013 | COD | COD page totals | Match collected amounts | S1 | | |
| D-014 | COD | Partial collect amount | Validated | S2 | | |
| D-015 | Route | Complete route when stops done | Route closed | S1 | | |
| D-016 | Route | Complete route with open stops | Blocked | S2 | | |
| D-017 | Realtime | Admin assigns new route | Appears without reload | S2 | | |
| D-018 | Realtime | Stop status change elsewhere | UI refreshes | S2 | | |
| D-019 | Security | Cannot complete other driver’s stop | Denied | S1 | | |
| D-020 | Security | No service-role in client | Pass | S1 | | |
| D-021 | Mobile | One-hand complete flow | Primary CTA reachable | S2 | | |
| D-022 | Errors | Offline complete | Graceful failure | S2 | | |
| D-023 | Regression | Completed order = DELIVERED in Admin | Cross-app | S1 | | |
| D-024 | Regression | Customer timeline shows delivered | Cross-app | S1 | | |
| D-025 | Dashboard | Today’s stops count | Accurate | S2 | | |
| D-026 | Map/address | Address text readable | Matches shop | S3 | | |
| D-027 | Double tap | Double complete | Idempotent / single success | S1 | | |
| D-028 | Payment | Wrong COD amount | Rejected or corrected | S2 | | |
| D-029 | Audit | After complete | order_events + audit | S1 | | |
| D-030 | Session | Token refresh mid-route | Continues or re-login clear | S2 | | |

---

## E. Cross-cutting / Platform (X-001 … X-025)

| ID | Area | Steps | Expected | Sev | Result | Notes |
|----|------|-------|----------|-----|--------|-------|
| X-001 | Cron | `job_expire_stock_reservations` | `job_runs` SUCCESS | S1 | | |
| X-002 | Cron | `job_expire_shop_invitations` | Expired invites updated | S1 | | |
| X-003 | Cron | `job_drain_notification_outbox` | Outbox drained; job_runs | S1 | | |
| X-004 | Cron | pg_cron jobs present | 3 groaurum-* schedules | S2 | | |
| X-005 | Edge | expire-* without secret | 401/503 | S1 | | |
| X-006 | Edge | expire-* with CRON_SECRET | 200 | S1 | | |
| X-007 | Edge | webhook unsigned | 401/503 | S1 | | |
| X-008 | Edge | webhook bad HMAC | 401 | S1 | | |
| X-009 | Edge | webhook valid HMAC | Applied; payment updated | S1 | | |
| X-010 | Edge | create-order without JWT | 401 | S1 | | |
| X-011 | CORS | Disallowed Origin | Not reflected / restricted | S2 | | |
| X-012 | Providers | `assertProviderConfig` staging | Errors if Razorpay/cron missing | S1 | | |
| X-013 | Secrets | No VITE_/EXPO_PUBLIC secrets | Pass | S1 | | |
| X-014 | RLS | Customer cannot read other shops | Empty / denied | S1 | | |
| X-015 | RLS | Delivery cannot read all routes | Own only | S1 | | |
| X-016 | Backup | Snapshot restore drill (staging) | Restore succeeds | S1 | | |
| X-017 | SSL | HTTPS on pilot hosts | Valid cert | S1 | | |
| X-018 | DNS | Admin/sales/delivery/customer hosts | Resolve correctly | S1 | | |
| X-019 | Observability | Force edge failure | application_logs row | S2 | | |
| X-020 | Observability | Admin status change | audit_logs row | S1 | | |
| X-021 | Notifications | Enqueue SMS template | Outbox row; drain marks sent/fail | S2 | | |
| X-022 | Reservations | Expire past `expires_at` | Released; inventory freed | S1 | | |
| X-023 | Types | `pnpm typecheck` green | Pass | S2 | | |
| X-024 | Migrations | Fresh `db reset` applies 0030 | Pass | S1 | | |
| X-025 | Scripts | `verify_sprint91_*` | All PASS on staging | S1 | | |

---

## F. Pilot day scenarios (P-001 … P-015)

| ID | Scenario | Actors | Expected | Sev | Result | Notes |
|----|----------|--------|----------|-----|--------|-------|
| P-001 | New retailer onboard | Sales → Customer invite accept | ACTIVE/linked shop | S1 | | |
| P-002 | First COD order | Customer → Admin confirm path | Order progresses | S1 | | |
| P-003 | Assisted + deliver | Sales order → Route → COD | Cash collected; DELIVERED | S1 | | |
| P-004 | Online paid (if live) | Customer pay → webhook | PAID; dispatchable | S1 | | |
| P-005 | Stock shortage | Over-order | Blocked at place | S1 | | |
| P-006 | Failed delivery | Fail stop → retry plan | Status + note; ops visible | S1 | | |
| P-007 | Reservation expiry | Leave reserved past TTL | Job releases | S1 | | |
| P-008 | Invite expiry | Wait / force expire job | PENDING → EXPIRED | S2 | | |
| P-009 | Notification drain | Enqueue + cron/edge | Sent or failed logged | S2 | | |
| P-010 | Payment webhook replay | Same event id twice | Idempotent | S1 | | |
| P-011 | Inventory mismatch drill | Ops adjust vs physical | Documented variance | S2 | | |
| P-012 | Multi-stop route | 3+ stops | Sequence + COD totals | S1 | | |
| P-013 | Admin illegal cancel | Wrong transition | Rejected | S2 | | |
| P-014 | Concurrent order same SKU | Two retailers | Stock integrity | S1 | | |
| P-015 | End-of-day COD reconcile | Delivery COD vs Admin | Totals match | S1 | | |

---

## Summary counts

| Suite | Cases |
|-------|------:|
| Customer (C) | 35 |
| Admin (A) | 40 |
| Salesman (S) | 30 |
| Delivery (D) | 30 |
| Platform (X) | 25 |
| Pilot scenarios (P) | 15 |
| **Total** | **175** |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA lead | | | |
| Ops lead | | | |
| Engineering | | | |
| Product (pilot gate) | | | |

**Exit gate:** Zero open S1; S2 have owners + workaround; P-001…P-015 executed on staging.
