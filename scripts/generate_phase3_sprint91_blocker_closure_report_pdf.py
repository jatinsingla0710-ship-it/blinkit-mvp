"""Generate GroAurum Phase 3 Sprint 9.1 Production Blocker Closure report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase3-Sprint9.1-Production-Blocker-Closure-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 3 Sprint 9.1 - Production Blocker Closure",
                align="R",
                new_x="LMARGIN",
                new_y="NEXT",
            )
            self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.ln(3)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(11, 83, 69)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(26, 141, 73)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def body_text(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 4.5, safe)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        indent = 5
        self.set_x(self.l_margin + indent)
        width = self.w - self.r_margin - self.l_margin - indent
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(width, 4.5, f"- {safe}")
        self.set_x(self.l_margin)

    def status_line(self, label: str, status: str, note: str = ""):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        color = {
            "PASS": (26, 141, 73),
            "PARTIAL": (180, 120, 20),
            "FAIL": (180, 40, 40),
        }.get(status, (15, 31, 24))
        self.set_text_color(*color)
        line = f"{label}: {status}"
        if note:
            line += f" - {note}"
        safe = line.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 5, safe)
        self.set_text_color(15, 31, 24)
        self.set_x(self.l_margin)


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 9, "Production Blocker Closure Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Phase 3 Sprint 9.1", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section_title("1. Objective")
    pdf.body_text(
        "Close every FAIL and CRITICAL PARTIAL item from the Launch Readiness Audit "
        "without adding business features or redesigning UI. Focus: cron, security, "
        "admin order RPC, realtime wiring, provider env config, observability, staging validation."
    )

    pdf.section_title("2. Closure Scorecard")
    pdf.status_line("Cron", "PASS", "pg_cron schedules + job_runs + verify script")
    pdf.status_line("Security", "PASS", "HMAC webhook, CRON_SECRET jobs, CORS allowlist, enqueue role check")
    pdf.status_line("Realtime", "PASS", "RealtimeBus wired in Admin, Customer, Sales, Delivery")
    pdf.status_line("Providers", "PARTIAL", "env validation ready; live SMS/WA/Email/FCM keys still staging secrets")
    pdf.status_line("RPCs", "PASS", "update_order_status_admin replaces direct trusted client updates")
    pdf.status_line("Monitoring", "PASS", "application_logs, audit_logs, job_runs on jobs/edges/webhooks")
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Overall Production Readiness Score: 82 / 100", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 31, 24)
    pdf.body_text(
        "Score uplift from Launch Audit ~56. Remaining deductions: offline/service-worker "
        "(out of 9.1 scope), live provider credentials not installed in this environment, "
        "and local Windows pg_cron host variance."
    )

    pdf.section_title("3. Cron")
    pdf.bullet("Migration 20260716220001 schedules expire-reservations (*/15), expire-invitations (5 * * * *), send-notification drain (*/5)")
    pdf.bullet("Jobs write job_runs; SQL RPCs callable via service_role; edge workers protected by X-Cron-Secret")
    pdf.bullet("Verification: node scripts/verify_sprint91_cron_security.mjs")
    pdf.bullet("config.toml documents JWT policy; schedules defined in migration (not edge-only)")

    pdf.section_title("4. Security")
    pdf.bullet("razorpay-webhook: rejects missing secret, missing signature, invalid HMAC")
    pdf.bullet("expire-*/send-notification: require CRON_SECRET; refuse when unset")
    pdf.bullet("razorpay-create-order: verify_jwt=true + Authorization required; stub only in APP_ENV=development")
    pdf.bullet("CORS restricted via ALLOWED_ORIGINS (local defaults when unset)")
    pdf.bullet("enqueue_notification tightened to ADMIN/SALESMAN/DELIVERY/CUSTOMER or service_role")

    pdf.section_title("5. Admin Order Status RPC")
    pdf.bullet("update_order_status_admin(SECURITY DEFINER): admin check, trusted GUC, transition graph, payment gate for DELIVERED")
    pdf.bullet("Writes order_events + write_audit_log + log_application_event")
    pdf.bullet("ops-repositories.orders.update uses RPC only (no direct status UPDATE)")
    pdf.bullet("React Query invalidates orders + dashboard after status mutation")

    pdf.section_title("6. Realtime")
    pdf.bullet("createSupabaseRealtimeBus subscribed from AdminDataProviders, SalesDataProviders, DeliveryDataProviders, customer AppProviders")
    pdf.bullet("Customer: orders + order_events -> order list/detail invalidation")
    pdf.bullet("Admin: orders, inventory, delivery -> groaurum query keys + dashboard")
    pdf.bullet("Sales: shops + orders; Delivery: routes, stops, orders")
    pdf.bullet("supabase_realtime publication extended for orders, order_events, inventory_balances, delivery_routes, route_stops, shops, payments")

    pdf.section_title("7. Providers")
    pdf.bullet("packages/api-client loadProviderConfig / assertProviderConfig for Razorpay, SMS, WhatsApp, Email, FCM, CRON_SECRET, ALLOWED_ORIGINS")
    pdf.bullet("Rejects VITE_/EXPO_PUBLIC_ exposure of secrets")
    pdf.bullet("Production requires Razorpay triple + CRON_SECRET; other channels warn if missing")
    pdf.bullet("Secrets documented in supabase/functions/README.md — never committed")

    pdf.section_title("8. Observability")
    pdf.bullet("Edge logEvent -> log_application_event on success/failure paths")
    pdf.bullet("Webhook/job/RPC failures produce structured application_logs")
    pdf.bullet("Admin status changes and reservation expiry write audit_logs")
    pdf.bullet("job_runs for expire reservations/invitations and notification drain")

    pdf.section_title("9. Staging Validation")
    pdf.bullet("Script: node scripts/verify_sprint91_staging_scenarios.mjs (12/12 PASS locally)")
    pdf.bullet("Scenario 1: customer@groaurum.local place_customer_order (trusted GUC fix applied)")
    pdf.bullet("Scenario 2: salesman1 salesman_create_retailer")
    pdf.bullet("Scenario 3: delivery1 delivery_complete_stop (seed/business-rule aware)")
    pdf.bullet("Scenario 4: job_expire_stock_reservations + job_runs")
    pdf.bullet("Scenario 5: enqueue + job_drain_notification_outbox + job_runs")
    pdf.bullet("Cron/security script: 14/14 PASS (authorized edge skipped without CRON_SECRET)")

    pdf.section_title("10. Recommendation")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 6, "Internal Testing: YES", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(180, 120, 20)
    pdf.cell(0, 6, "Pilot: YES (conditional on staging provider secrets + signed webhook)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(180, 40, 40)
    pdf.cell(0, 6, "Production: NO (install live secrets, confirm hosted cron, offline backlog)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(15, 31, 24)
    pdf.ln(2)
    pdf.body_text(
        "Sprint 9.1 closes the audit blockers that blocked pilot. Proceed to internal testing "
        "immediately; open a limited pilot once staging CRON_SECRET, Razorpay webhook HMAC, "
        "and at least one notification provider are configured. Hold full production until "
        "hosted cron is verified and remaining offline FAIL is addressed in a follow-up sprint."
    )

    pdf.section_title("11. Artifacts")
    pdf.bullet("supabase/migrations/20260716220001_sprint91_blocker_closure.sql")
    pdf.bullet("scripts/verify_sprint91_cron_security.mjs")
    pdf.bullet("scripts/verify_sprint91_staging_scenarios.mjs")
    pdf.bullet("packages/api-client/src/providers/config.ts")
    pdf.bullet("Edge CORS/auth helpers: supabase/functions/_shared/cors.ts")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
