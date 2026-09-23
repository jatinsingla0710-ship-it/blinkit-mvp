"""Generate GroAurum Phase 2 Sprint 7 Salesman PWA report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint7-Salesman-PWA-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 7 - Live Salesman PWA",
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
    pdf.cell(0, 10, "GroAurum Salesman PWA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(
        0,
        8,
        "Sprint 7 - Live Salesman PWA",
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
        "Goal: production-ready Salesman Vite PWA on Supabase (shared UI/auth, no redesign).",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "OVERALL: apps/sales-pwa converted from scaffold to a live field PWA with "
        "Supabase Auth (SALESMAN), dashboard KPIs, retailer create/invite, assisted orders, "
        "visit tracking, and performance aggregates.",
    )

    pdf.section_title("1. Salesman Auth Flow")
    pdf.bullet("Supabase Auth via @groaurum/auth createAuthProvider + SessionProvider")
    pdf.bullet("Audience gate: sales_pwa; role required: salesman / SALESMAN")
    pdf.bullet("Session persist + restore (shared Supabase client for auth + data)")
    pdf.bullet("Dev auto sign-in: salesman1@groaurum.local / password123")
    pdf.bullet("Login page available at /login; ProtectedSalesRoute wraps shell")

    pdf.section_title("2. Connected Modules")
    for item in [
        "Dashboard: assigned retailers, today's visits, pending activations, orders, revenue",
        "Customers: assigned retailers list + profile detail",
        "Create retailer: salesman_create_retailer RPC (shop + contact + assignment)",
        "Send invitation: salesman_create_invitation RPC (token for customer onboarding)",
        "Reassign: admin-controlled only (PWA shows read-only note)",
        "Assisted order: place_assisted_order RPC (MOQ, live price, stock, reserve)",
        "Customer confirmation OTP: placeholder challenge row + UI message (SMS deferred)",
        "Visits: sales_visits table (PLANNED / PENDING / VISITED / MISSED) + status updates",
        "Performance: monthly orders, revenue, new retailers, activation rate, repeat customers",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Supabase Integration")
    pdf.bullet("Migration: 20260716190001_sprint7_salesman_visits_and_rpcs.sql")
    pdf.bullet("Seed: supabase/seed/sprint7_salesman_seed.sql")
    pdf.bullet("api-client: createSupabaseSalesmanService")
    pdf.bullet("RLS: salesman scoped via salesman_shop_ids(); visit policies for own rows")
    pdf.bullet("Assisted onboarding handoff uses Sprint 6 accept_shop_invitation on customer app")

    pdf.add_page()
    pdf.section_title("4. Remaining Placeholders")
    pdf.bullet("Real SMS delivery for invitation + assisted-order OTP")
    pdf.bullet("OTP verify / confirm assisted order (challenge row exists; verify UX deferred)")
    pdf.bullet("Offline / service-worker caching beyond basic PWA manifest")
    pdf.bullet("Push notifications for visit reminders")
    pdf.bullet("Collections / payment capture in field PWA")
    pdf.bullet("Map-based route optimization")

    pdf.section_title("5. Production Readiness")
    pdf.body_text(
        "Ready for local/staging salesman field flows with seeded salesman1 account. "
        "Production requires SMS providers, hardened invitation distribution, and "
        "monitoring of place_assisted_order / create retailer RPCs."
    )
    pdf.bullet("PASS: Auth session restore + SALESMAN role gate")
    pdf.bullet("PASS: Live dashboard / retailers / performance under RLS")
    pdf.bullet("PASS: Create retailer + invitation token generation")
    pdf.bullet("PASS: Assisted order MOQ/stock/reserve + timeline events")
    pdf.bullet("PASS: Visit tracking CRUD for today's route")
    pdf.bullet("PARTIAL: Customer confirmation OTP (placeholder only)")
    pdf.bullet("PARTIAL: PWA install/offline (manifest only)")

    pdf.section_title("6. How to Run")
    pdf.bullet("pnpm db:start; apply Sprint 7 migration + sprint7_salesman_seed.sql")
    pdf.bullet("Copy apps/sales-pwa/.env.example to .env.local (anon key from supabase status)")
    pdf.bullet("pnpm dev:sales  (http://127.0.0.1:5174)")
    pdf.bullet("Sign in as salesman1@groaurum.local / password123")
    pdf.bullet("Invite token demo: sprint7-salesman-invite-token (customer accept flow)")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(0, 5, "Sprint 7 complete. Salesman PWA is live on Supabase foundations.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
