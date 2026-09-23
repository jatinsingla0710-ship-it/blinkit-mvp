# GroAurum Pilot — Launch Checklist

**Phase 4 · Pilot Readiness Kit**  
**Gate:** All **Must** items checked before inviting external pilot retailers.  
**Owner initials** required on each Must line.

---

## 1. Infrastructure

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| I-01 | Staging project separate from local | Must | ☐ | | |
| I-02 | Production project created (even if pilot on staging) | Should | ☐ | | |
| I-03 | Compute / DB size sized for pilot load | Must | ☐ | | |
| I-04 | Edge functions deployed (razorpay-*, expire-*, send-notification) | Must | ☐ | | |
| I-05 | Migrations through `20260716220002_*` applied | Must | ☐ | | |
| I-06 | Seed data **not** production catalogue pollution | Must | ☐ | | |
| I-07 | App hosts deployed (Admin, Sales, Delivery, Customer) | Must | ☐ | | |
| I-08 | Health endpoints / Studio reachable from ops network | Must | ☐ | | |
| I-09 | Timezone IST documented for cron interpretation | Should | ☐ | | |
| I-10 | Rollback plan for last deploy documented | Must | ☐ | | |

---

## 2. Security

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| S-01 | RLS enabled + forced on sensitive tables | Must | ☐ | | |
| S-02 | No service-role key in any client app | Must | ☐ | | |
| S-03 | Webhook HMAC required (unsigned rejected) | Must | ☐ | | |
| S-04 | Job edges require `CRON_SECRET` | Must | ☐ | | |
| S-05 | `ALLOWED_ORIGINS` set to pilot domains only | Must | ☐ | | |
| S-06 | `verify_jwt` policy matches config.toml | Must | ☐ | | |
| S-07 | Admin status only via `update_order_status_admin` | Must | ☐ | | |
| S-08 | Enqueue notification role checks active | Must | ☐ | | |
| S-09 | Auth email confirmations policy decided | Should | ☐ | | |
| S-10 | Pilot user list least-privilege roles | Must | ☐ | | |
| S-11 | Security review of staging secrets access | Must | ☐ | | |

---

## 3. Backups

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| B-01 | Automated DB backups enabled | Must | ☐ | | |
| B-02 | PITR / backup retention ≥ 7 days (pilot) | Must | ☐ | | |
| B-03 | Restore drill completed in last 30 days | Must | ☐ | | |
| B-04 | Backup alert on failure | Should | ☐ | | |
| B-05 | Export runbook for `audit_logs` / payments | Should | ☐ | | |

---

## 4. Monitoring

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| M-01 | KPI board live (see `03-monitoring-dashboard.md`) | Must | ☐ | | |
| M-02 | Alerts ALT-JOB-*, ALT-PAY-*, ALT-DB wired | Must | ☐ | | |
| M-03 | On-call rota published | Must | ☐ | | |
| M-04 | `job_runs` reviewed daily | Must | ☐ | | |
| M-05 | Error log dashboard | Must | ☐ | | |
| M-06 | COD variance check scheduled | Must | ☐ | | |

---

## 5. Provider credentials

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| P-01 | `APP_ENV=staging` or `production` (not development) | Must | ☐ | | |
| P-02 | Razorpay key id + secret (if online pay in pilot) | Must* | ☐ | | *or COD-only waiver |
| P-03 | `RAZORPAY_WEBHOOK_SECRET` + dashboard URL | Must* | ☐ | | |
| P-04 | SMS provider key (or written waiver + manual invites) | Must* | ☐ | | |
| P-05 | WhatsApp / Email / FCM keys or documented stub | Should | ☐ | | |
| P-06 | `assertProviderConfig` passes on boot | Must | ☐ | | |
| P-07 | No secrets in `VITE_` / `EXPO_PUBLIC_` | Must | ☐ | | |
| P-08 | Provider dashboards access for on-call | Must | ☐ | | |

---

## 6. SSL / DNS

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| N-01 | HTTPS on all pilot app hostnames | Must | ☐ | | |
| N-02 | Valid certificates (no browser warn) | Must | ☐ | | |
| N-03 | DNS A/CNAME for admin / sales / delivery / customer | Must | ☐ | | |
| N-04 | API / Supabase URL stable and documented | Must | ☐ | | |
| N-05 | HSTS considered for public hosts | Should | ☐ | | |
| N-06 | Deep links / redirect URLs match Auth settings | Must | ☐ | | |

---

## 7. Cron

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| C-01 | `groaurum-expire-reservations` scheduled | Must | ☐ | | |
| C-02 | `groaurum-expire-invitations` scheduled | Must | ☐ | | |
| C-03 | `groaurum-send-notification` scheduled | Must | ☐ | | |
| C-04 | Manual verify scripts PASS on staging | Must | ☐ | | |
| C-05 | Edge cron secret path tested (if used) | Must | ☐ | | |
| C-06 | Job failure alert (ALT-JOB-FAIL) | Must | ☐ | | |

---

## 8. Secrets management

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| K-01 | Secrets only in Supabase secrets / CI vault | Must | ☐ | | |
| K-02 | `CRON_SECRET` rotated and stored | Must | ☐ | | |
| K-03 | Service role restricted to server/CI | Must | ☐ | | |
| K-04 | `.env.local` gitignored; examples only in repo | Must | ☐ | | |
| K-05 | Access list for who can read secrets | Must | ☐ | | |
| K-06 | Rotation procedure documented | Should | ☐ | | |

---

## 9. People / process gate

| # | Item | Must? | Done | Owner | Notes |
|---|------|-------|------|-------|-------|
| G-01 | QA checklist ≥ critical S1 cases PASS | Must | ☐ | | |
| G-02 | Pilot scenarios P-001…P-015 executed | Must | ☐ | | |
| G-03 | SOPs read by Ops / Sales / Delivery leads | Must | ☐ | | |
| G-04 | Incident playbooks walkthrough (tabletop 30m) | Must | ☐ | | |
| G-05 | Pilot retailer list + support hours published | Must | ☐ | | |
| G-06 | COD-only waiver signed if online pay deferred | Should | ☐ | | |
| G-07 | Returns policy (manual) acknowledged | Must | ☐ | | |

---

## Sign-off

| Gate | Name | Date | Go / No-Go |
|------|------|------|------------|
| Engineering | | | |
| Operations | | | |
| Product | | | |
| Founder | | | |

**No-Go reasons must list open Must items by ID.**
