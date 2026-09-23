# GroAurum Pilot — Incident Playbooks

**Phase 4 · Pilot Readiness Kit**  
**Severity:** S1 = pilot-stopping · S2 = degraded · S3 = limited impact  
**Log every incident:** start time, commander, timeline, customer impact, resolution, follow-ups

---

## Playbook PB-1 · Payment failure

### Symptoms
- Customer cannot complete online pay
- Webhook 401/503 / HMAC failures in `application_logs`
- Payments stuck `PENDING` while Razorpay shows paid
- `razorpay-create-order` 502/503

### Immediate (0–15 min)
1. **Declare S1** if >3 customers affected or cash ops blocked.
2. Switch messaging: **COD only** until cleared.
3. Check secrets: `RAZORPAY_KEY_ID`, `KEY_SECRET`, `WEBHOOK_SECRET`, `APP_ENV`.
4. Confirm webhook URL + HMAC secret match Razorpay dashboard.
5. Tail `application_logs` source `razorpay-webhook` / `razorpay-create-order`.

### Diagnose
| Check | Pass looks like |
|-------|-----------------|
| Unsigned webhook | Rejected (expected); signed must 200 |
| Stub mode in staging/prod | Must **not** stub outside development |
| Idempotent replay | Same `provider_event_id` safe |
| Order payment row | Exists with provider reference |

### Mitigate
1. Re-send webhook from Razorpay for stuck payments (single event).
2. If secret rotated mid-flight, update Supabase secrets + redeploy functions.
3. Manual: Finance marks PAID **only** with Razorpay payment id evidence + Eng approval (audit note).

### Recover / verify
- Place test online order end-to-end
- Confirm `audit_logs` / payment status
- Resume online payments announcement

### Postmortem (48h)
Root cause · secret handling · monitoring gap · action items

---

## Playbook PB-2 · SMS failure

### Symptoms
- Invites / OTP / notifications not received
- `notification_outbox` status FAILED or backlog growing
- `send-notification` errors; ALT-SMS / ALT-OUTBOX

### Immediate
1. Severity S2 unless onboarding completely blocked (then S1).
2. Switch channel: WhatsApp / Email / verbal token for invites.
3. Check `SMS_PROVIDER_API_KEY` and provider console balance/rate limits.
4. Run drain: authorized edge `send-notification` or SQL `job_drain_notification_outbox`.

### Diagnose
- Outbox `error` text
- Provider 4xx (bad number) vs 5xx (provider)
- Template key typos

### Mitigate
1. Fix credentials / templates.
2. Re-enqueue critical messages only (avoid spam).
3. For pilot invites: Salesman shares token manually (SOP-1).

### Recover
- Send one test SMS
- Backlog <20 pending
- Document customers manually notified

---

## Playbook PB-3 · Inventory mismatch

### Symptoms
- ALT-INV-NEG or physical ≠ system
- Customers blocked incorrectly / oversell complaints
- Reserved stuck after cancel

### Immediate
1. **Freeze selling** of affected SKUs in Admin (deactivate or zero sellable).
2. Stop new routes containing disputed SKUs if already oversold.
3. Page Warehouse + Eng (S1 if top sellers).

### Diagnose
```sql
SELECT * FROM inventory_balances WHERE sku_id = '<id>';
SELECT * FROM stock_reservations
WHERE sku_id = '<id>' AND status IN ('PENDING','RESERVED');
```
- Compare last `job_runs` expire-reservations
- Review recent `inventory_movements` / audit

### Mitigate
1. Release expired reservations via job.
2. Adjust balances to physical count with note `MISMATCH_PILOT|<ticket>`.
3. Cancel/rebuild oversold orders with customer communication.

### Recover
- Physical spot-count sign-off
- Re-enable SKU
- Add SKU to daily count list for 7 days

---

## Playbook PB-4 · Delivery failure

### Symptoms
- Mass fail stops / app errors on complete
- COD collect blocked
- Routes stuck; customer complaints

### Immediate
1. Ops calls drivers; switch to **phone coordination** if app down.
2. Do not mark DELIVERED offline without Eng path.
3. If single stop: use **Fail stop** with reason; reschedule (SOP-4).
4. If platform: check Auth, RLS, RPC errors in logs.

### Diagnose
- `delivery_complete_stop` error (COD not collected, wrong status, ownership)
- Realtime not required for completion — retry submit
- Payment status vs method

### Mitigate
1. Collect COD via RPC then complete.
2. Reassign route if wrong driver.
3. Admin advances order only via `update_order_status_admin` when physically done **and** payment PAID.

### Recover
- Complete remaining stops
- COD reconcile (SOP-5)
- Customer timeline correct

---

## Playbook PB-5 · Database outage

### Symptoms
- All apps error / timeout
- Studio unreachable
- Auth fails globally

### Immediate (S1 always)
1. Incident commander + status page / WhatsApp broadcast: **systems down — pause orders**.
2. Check Supabase status / hosting / disk / connection limits.
3. Freeze cron-triggered side effects if partial (avoid duplicate sends on flap).
4. Do **not** run destructive resets on production.

### Diagnose
- Supabase dashboard health
- Connection pool exhaustion
- Recent migration / deploy
- Regional network

### Mitigate
1. Scale / restart pooler per host runbook.
2. If read-only replica available: Eng-only diagnostics (pilot may have none).
3. Fail closed: refuse payments/webhooks until consistent.

### Recover
1. Confirm writes succeed (insert canary row in non-prod or safe ping).
2. Run job health queries (monitoring doc).
3. Drain notification backlog carefully.
4. Replay webhooks if payments missed during outage.
5. Resume pilot; COD first 30–60 min.

### Postmortem
RTO/RPO actuals · backup restore drill date · follow-ups

---

## Cross-playbook checklist

- [ ] Severity declared and channel notified  
- [ ] Customer/driver communication sent  
- [ ] Timeline notes in shared doc  
- [ ] `application_logs` / `audit_logs` / `job_runs` captured  
- [ ] Feature flag / process mitigation (COD-only, freeze SKU, etc.)  
- [ ] Verify + monitoring green  
- [ ] Postmortem scheduled (S1/S2)

---

## Contacts (fill)

| Role | Name | Contact |
|------|------|---------|
| Incident commander | | |
| Eng on-call | | |
| Ops lead | | |
| Finance | | |
| Supabase / hosting | | |
| Razorpay support | | |
| SMS provider | | |
