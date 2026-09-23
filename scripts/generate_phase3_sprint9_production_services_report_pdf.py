"""Generate GroAurum Phase 3 Sprint 9 Production Services report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase3-Sprint9-Production-Services-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 3 Sprint 9 - Production Services",
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


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(14)
    pdf.cell(0, 10, "GroAurum Production Services", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(
        0,
        8,
        "Sprint 9 - Payments, Notifications, Realtime, Jobs, Monitoring, Audit",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        6,
        "Goal: production infrastructure for launch (no UI redesign / no new business modules).",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "OVERALL: Launch infrastructure foundations are in place. COD remains live; "
        "online Razorpay path is stub-capable with webhook architecture; notification "
        "outbox + workers, reservation/invitation jobs, realtime bus, audit writers, "
        "and application logs are ready. Live provider credentials and cron scheduling "
        "are the main remaining launch gates.",
    )

    pdf.section_title("1. Production Services Delivered")
    pdf.bullet("Payments: create_online_payment_intent + apply_payment_webhook_event")
    pdf.bullet("Edge: razorpay-create-order (live or stub) + razorpay-webhook (HMAC verify)")
    pdf.bullet("COD unchanged: delivery_collect_cod (Sprint 8)")
    pdf.bullet("Notifications: notification_outbox + enqueue_notification + send-notification worker")
    pdf.bullet("Channels prepared: SMS, WhatsApp, Push, Email (stub without provider keys)")
    pdf.bullet("Realtime: createSupabaseRealtimeBus; wired into orders/inventory/delivery repos")
    pdf.bullet("Jobs: expire reservations, expire invitations, notification claim/retry")
    pdf.bullet("Monitoring: application_logs + createAppLogger + job_runs")
    pdf.bullet("Audit: write_audit_log + triggers for prices/settings/inventory/order status")

    pdf.section_title("2. Supabase Integration")
    pdf.bullet("Migration: 20260716210001_sprint9_production_services.sql")
    pdf.bullet("stock_reservations.expires_at (+2h default trigger)")
    pdf.bullet("Tables: notification_outbox, job_runs, application_logs")
    pdf.bullet("Edge functions under supabase/functions/")
    pdf.bullet("Facades: createSupabasePaymentService, createSupabaseNotificationService")

    pdf.add_page()
    pdf.section_title("3. Remaining Gaps")
    pdf.bullet("Production Razorpay keys + Checkout UI wire-up in customer/sales apps")
    pdf.bullet("Live SMS / WhatsApp / FCM / email provider configuration")
    pdf.bullet("Scheduled cron to invoke expire-* and send-notification workers")
    pdf.bullet("Optional external APM (Sentry) — application_logs covers first-party telemetry")
    pdf.bullet("Admin consoles for outbox/logs (explicitly out of Sprint 9 scope)")
    pdf.bullet("Returned/RTO and POD media storage remain prior-sprint placeholders")

    pdf.section_title("4. Launch Readiness")
    pdf.body_text(
        "Infrastructure-ready for staging. Can ship COD + stub online locally today. "
        "Production launch requires provider secrets, webhook URL registration, and "
        "cron schedules. Business modules from Sprints 4-8 are unchanged."
    )
    pdf.bullet("PASS: Payment webhook architecture + COD path")
    pdf.bullet("PASS: Central notification queue + retry")
    pdf.bullet("PASS: Realtime bus for order/inventory/delivery")
    pdf.bullet("PASS: Reservation timeout + invitation expiry jobs")
    pdf.bullet("PASS: Application logs + RPC failure logging helpers")
    pdf.bullet("PASS: Audit trail writers for key admin/ops mutations")
    pdf.bullet("PARTIAL: Live Razorpay/SMS until secrets configured")
    pdf.bullet("PARTIAL: Cron scheduling (manual invoke works now)")

    pdf.section_title("5. How to Operate")
    pdf.bullet("Apply Sprint 9 migration; deploy edge functions")
    pdf.bullet("Set secrets: RAZORPAY_*, optional SMS/WA/EMAIL/FCM keys")
    pdf.bullet("POST /functions/v1/expire-reservations and expire-invitations on a schedule")
    pdf.bullet("POST /functions/v1/send-notification to drain outbox")
    pdf.bullet("Webhook URL: /functions/v1/razorpay-webhook")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "Sprint 9 complete. Production services foundation is ready for staging launch prep.",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
