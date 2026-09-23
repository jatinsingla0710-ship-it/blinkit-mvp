"""Generate GroAurum Phase 2 Sprint 6 Customer Auth & Live App report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint6-Customer-Auth-Live-App-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 6 - Customer Auth & Live App",
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
    pdf.cell(0, 10, "GroAurum Customer App", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(
        0,
        8,
        "Sprint 6 - Customer Authentication & Live App",
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
        "Goal: production-ready Customer Expo app on Supabase (no UI/nav redesign).",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "OVERALL: Customer app is live-ready for Auth, profile, catalogue, cart confirm, "
        "orders, and account against local/remote Supabase with RLS + trusted RPCs.",
    )

    pdf.section_title("1. Customer Auth Flow")
    pdf.bullet("Supabase Auth session restore on launch (getSession + onAuthStateChange)")
    pdf.bullet("Email/password sign-in (local seed: customer@groaurum.local / password123)")
    pdf.bullet("Phone OTP via signInWithOtp / verifyOtp (requires SMS provider in production)")
    pdf.bullet("Email OTP helpers ready (requestEmailOtp / verifyEmailOtp)")
    pdf.bullet(
        "Onboarding: Invitation token -> accept_shop_invitation RPC -> shop_auth_links -> dashboard"
    )
    pdf.bullet("CustomerFlowGate phases unchanged structurally; invitation panel added")

    pdf.section_title("2. Connected Modules")
    for item in [
        "Auth + session persistence",
        "Customer profile / shop context (trade name, phone, service area, lifecycle)",
        "Invitation activation RPC",
        "Home: categories, featured SKUs, last order (live), promotions placeholder",
        "Catalogue: categories, products, SKUs, pricing, search (existing Phase 3)",
        "Restock: suggestions from live order history when present",
        "Cart / Review Order: MOQ + step validation, place_customer_order RPC",
        "Inventory reservation inside place_customer_order (stock_reservations + reserved_quantity)",
        "Orders list + detail timeline from order_events",
        "Account: profile, primary delivery, customer_addresses, logout",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Supabase Integration")
    pdf.bullet("Migration: 20260716180001_sprint6_customer_rpcs.sql")
    pdf.bullet("Seed: supabase/seed/sprint6_customer_seed.sql")
    pdf.bullet("createSupabaseOrderService + placeCustomerSelfServeOrder")
    pdf.bullet("Auth acceptShopInvitation + phone/email OTP methods")
    pdf.bullet("EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=supabase (+ URL/anon)")

    pdf.add_page()
    pdf.section_title("4. Remaining Placeholders")
    pdf.bullet("Promotions strip (no marketing tables)")
    pdf.bullet("Invoice PDF / download")
    pdf.bullet("Payment gateway capture (COD intent only)")
    pdf.bullet("SMS provider for phone OTP in production (local uses email/password)")
    pdf.bullet("GST field on Shop (shown as legal name until schema adds GST)")
    pdf.bullet("Assisted-order confirmation OTP workflow")

    pdf.section_title("5. Production Readiness")
    pdf.body_text(
        "Ready for local/staging customer flows with seeded retailer account. "
        "Production requires: SMS OTP provider, real invitation tokens from sales, "
        "and monitoring of place_customer_order failures (stock/MOQ)."
    )
    pdf.bullet("PASS: Auth session restore + linked shop gate")
    pdf.bullet("PASS: Live catalogue reads under RLS")
    pdf.bullet("PASS: Live order create + reserve + timeline")
    pdf.bullet("PASS: Orders history + account logout")
    pdf.bullet("PARTIAL: Phone OTP until SMS configured")
    pdf.bullet("PARTIAL: Promotions / invoice / payments")

    pdf.section_title("6. How to Run")
    pdf.bullet("pnpm db:start; apply migrations including sprint6 RPCs")
    pdf.bullet("pnpm db:seed:sprint4 then apply supabase/seed/sprint6_customer_seed.sql")
    pdf.bullet("Configure apps/customer/.env from .env.example")
    pdf.bullet("pnpm --filter @groaurum/customer start (or expo start)")
    pdf.bullet("Sign in as customer@groaurum.local / password123")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(0, 5, "Sprint 6 complete. Customer app is live on Supabase foundations.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
