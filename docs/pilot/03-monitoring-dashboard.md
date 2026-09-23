# GroAurum Pilot — Monitoring Dashboard Spec

**Phase 4 · Pilot Readiness Kit**  
**Sources:** Admin dashboard · `job_runs` · `application_logs` · `audit_logs` · `notification_outbox` · provider consoles (Razorpay)  
**Cadence:** Live during pilot hours; 30-minute scan by Ops; daily Eng review

This document defines **what to watch**, not a new UI product. Wire queries to Studio / Metabase / spreadsheet until a dedicated ops UI exists.

---

## 1. KPI board

| KPI | Definition | Good (pilot) | Warn | Critical | Source |
|-----|------------|--------------|------|----------|--------|
| Orders placed (24h) | Count new orders | Trend vs plan | −30% vs 7d avg | Zero for >2h peak | `orders` |
| Orders delivered (24h) | Status `DELIVERED` | Matches routes | Gap >20% vs OFD | Gap >40% | `orders` |
| COD collected (₹) | Sum COD PAID today | = cash sheet | Variance >₹500 | Variance >₹2,000 | `payments` + sheet |
| Fill rate | Lines fulfilled / requested | ≥95% | <95% | <85% | orders + inventory |
| Reservation release lag | Expire job last success age | <30m | >45m | >2h | `job_runs` |
| Invite conversion | Accepts / invites 7d | Track | <20% | — | invitations |
| Notification drain | Pending outbox count | <20 | >50 | >200 or growing 1h | `notification_outbox` |
| Job success rate | SUCCESS / runs 24h | ≥99% | <99% | Any FAILED expire job | `job_runs` |
| Error log rate | `application_logs` level=error /15m | ≤5 | >10 | >30 | `application_logs` |
| Payment webhook fails | Edge 4xx/5xx + log errors | 0 | ≥1/hour | ≥5/hour | Razorpay + logs |
| Active routes | Routes in progress | Expected | Unassigned OFD orders | Stuck >8h | `delivery_routes` |
| Low-stock SKUs | Available ≤ threshold | Action list | >10 SKUs | Top seller at 0 | inventory + dashboard |
| Auth failures | Failed logins /15m | Baseline | 3× baseline | Suspected attack | Auth logs |
| API latency p95 | Edge / PostgREST | <800ms | >1.5s | >3s | Gateway / APM |

---

## 2. Alert matrix

| Alert ID | Condition | Severity | Notify | Auto action |
|----------|-----------|----------|--------|-------------|
| ALT-JOB-FAIL | `job_runs.status=FAILED` for expire/drain | S1 | Eng on-call + Ops | Re-run RPC; page if 2nd fail |
| ALT-JOB-STALE | No SUCCESS expire-reservations in 45m | S1 | Eng | Manual `job_expire_stock_reservations` |
| ALT-OUTBOX | Pending notifications >50 for 15m | S2 | Eng | Invoke `send-notification` with cron secret |
| ALT-PAY-WH | Webhook signature failures ≥3/15m | S1 | Eng + Finance | Freeze online pay; COD only |
| ALT-PAY-STUCK | Payment `PENDING` >30m with paid Razorpay | S1 | Eng | Replay webhook carefully |
| ALT-INV-NEG | Any available_quantity < 0 | S1 | Warehouse + Eng | Stop SKU; playbook |
| ALT-ERR-SPIKE | application_logs error >30/15m | S1 | Eng | Check deploy / provider |
| ALT-DEL-STUCK | Stop IN_PROGRESS >4h | S2 | Ops | Call driver |
| ALT-COD-VAR | Daily COD variance > threshold | S1 | Finance + Ops | Hold deposit |
| ALT-EDGE-401 | Spike unauthorized edge calls | S2 | Sec/Eng | Rotate CRON_SECRET if leak suspected |
| ALT-DB | Supabase / DB unreachable | S1 | Eng | Incident playbook Database outage |
| ALT-SMS | SMS provider error rate >20% /15m | S2 | Eng | Fall back WhatsApp/email if configured |

---

## 3. Error thresholds (engineering SLOs for pilot)

| Signal | Window | Target | Page if |
|--------|--------|--------|---------|
| Edge function 5xx | 15m | <1% | ≥5% or ≥10 events |
| RPC failures (logged) | 15m | <2% | ≥10 unique errors |
| Auth API errors | 15m | <1% | Complete outage |
| Realtime disconnect rate | 1h | <10% sessions | Mass disconnect |
| Migration drift | deploy | 0 | Any pending required migration |

---

## 4. Suggested SQL / Studio checks

```sql
-- Job health (last 24h)
SELECT job_name, status, count(*)
FROM public.job_runs
WHERE started_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;

-- Outbox backlog
SELECT status, count(*)
FROM public.notification_outbox
GROUP BY 1;

-- Error burst
SELECT source, count(*)
FROM public.application_logs
WHERE level = 'error'
  AND created_at > now() - interval '15 minutes'
GROUP BY 1
ORDER BY 2 DESC;

-- Negative inventory
SELECT sku_id, available_quantity, reserved_quantity
FROM public.inventory_balances
WHERE available_quantity < 0
   OR reserved_quantity < 0;
```

---

## 5. Dashboard layout (ops screen)

```
┌──────────────────────────────┬─────────────────────────────┐
│ Orders 24h / Delivered 24h   │ COD collected vs sheet      │
├──────────────────────────────┼─────────────────────────────┤
│ Job runs (last success age)  │ Outbox pending              │
├──────────────────────────────┼─────────────────────────────┤
│ Error logs (15m)             │ Low-stock count             │
├──────────────────────────────┼─────────────────────────────┤
│ Active routes / stuck stops  │ Payment webhook health      │
└──────────────────────────────┴─────────────────────────────┘
         Alerts feed (ALT-*) — newest first
```

---

## 6. On-call rota (fill for pilot)

| Shift | Primary | Backup | Channel |
|-------|---------|--------|---------|
| Business hours | ________ | ________ | WhatsApp/Slack |
| After hours | ________ | ________ | Phone |

**Escalation:** Ops → Eng on-call → Founder (S1 >30m unresolved)
