# GroAurum Phase 4 — Pilot Readiness Kit

Operational launch assets. **No new business features.**

| Doc | Purpose |
|-----|---------|
| [01-qa-checklist.md](./01-qa-checklist.md) | 175 test cases — Customer, Admin, Sales, Delivery, Platform, Pilot day |
| [02-pilot-sops.md](./02-pilot-sops.md) | SOPs — onboarding, orders, inventory, delivery, COD, returns (future-ready) |
| [03-monitoring-dashboard.md](./03-monitoring-dashboard.md) | KPIs, alerts, error thresholds |
| [04-incident-playbooks.md](./04-incident-playbooks.md) | Payment, SMS, inventory, delivery, DB outage |
| [05-launch-checklist.md](./05-launch-checklist.md) | Infrastructure, security, backups, monitoring, providers, SSL, DNS, cron, secrets |

**Report PDF:** `docs/GroAurum-Phase4-Pilot-Readiness-Report.pdf`  
**Generator:** `python scripts/generate_phase4_pilot_readiness_report_pdf.py`

## How to use (pilot week 0)

1. Fill on-call + contacts in monitoring + playbooks.  
2. Execute Launch Checklist Must items on staging.  
3. Run QA critical path (all S1) + scenarios P-001…P-015.  
4. Tabletop each incident playbook (15–30 min).  
5. Sign Go/No-Go on launch checklist.
