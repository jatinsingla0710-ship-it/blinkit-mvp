"""Generate GroAurum Customer Home Screen v1 UI refinement summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Customer-Home-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class HomeUiPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Customer App - Home Screen v1",
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
        self.multi_cell(0, 4.5, text)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        indent = 5
        self.set_x(self.l_margin + indent)
        width = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(width, 4.5, f"- {text}")
        self.set_x(self.l_margin)

    def mono_block(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 8)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 4, text)
        self.ln(2)
        self.set_x(self.l_margin)

    def table_row(self, cols: list[str], widths: list[int], header: bool = False):
        if header:
            self.set_font("Helvetica", "B", 8)
            self.set_fill_color(232, 246, 238)
        else:
            self.set_font("Helvetica", "", 8)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(15, 31, 24)
        y0 = self.get_y()
        x0 = self.l_margin
        heights = []
        for col, w in zip(cols, widths):
            self.set_xy(x0, y0)
            self.multi_cell(w, 4.5, col, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 5
        x0 = self.l_margin
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)


def build_pdf() -> None:
    pdf = HomeUiPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Customer Home Screen v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Premium B2B home UI refinement for professional retailers\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Built on Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Refined the existing customer home into a quieter wholesale experience "
        "(Stripe / Linear / Apple restraint) while preserving GroAurum green branding. "
        "No promo banners, coupons, wallet, ads, or floating quick-action FAB.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Goal")
    pdf.body_text(
        "Treat the attached Home Screen mockup as the visual reference for Customer App v1. "
        "Do not redesign from scratch. Refine into a production-ready B2B UI for retailers: "
        "clear commercial information, calm hierarchy, 8px spacing, excellent whitespace."
    )

    pdf.section_title("2. Home Layout (top to bottom)")
    for item in [
        "Brand header + shop / location context",
        "Search field - placeholder: Search product, SKU, grade or size...",
        "Service card - Next Delivery / Tomorrow / Time Slot",
        "Trade prices strip - today's increase / decrease with clearer hierarchy",
        "Category tiles - premium muted icon tiles (not candy consumer chips)",
        "Featured SKUs - full-width B2B product cards",
        "Last order - Delivered / Paid / amount",
        "Sticky Review order bar only (primary floating action)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. B2B Product Card Contract")
    rows = [
        ("Field", "Display"),
        ("Product image", "Muted tile with product mark"),
        ("Product name", "Primary title"),
        ("Grade / specification", "Secondary commercial line"),
        ("MOQ", "Explicit MOQ value"),
        ("Packs per carton", "Shown when applicable"),
        ("Stock status", "In stock / Low stock / Out of stock"),
        ("Trade price", "Price + selling unit"),
        ("Primary action", "+ Add Carton or + Add N KG by SKU"),
    ]
    widths = [50, 130]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("4. Trade Price Cards")
    for item in [
        "Horizontal strip of commodity trade prices",
        "Clear amount and percent movement for today",
        "Increase / decrease / unchanged states with restrained color",
        "Unit shown beside trade price (KG or Carton)",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. Service Card")
    pdf.body_text('Replaced consumer "Delivery Tomorrow" copy with structured wholesale service info:')
    pdf.mono_block("Next Delivery\nTomorrow\n10:00 - 13:00")

    pdf.section_title("6. Last Order")
    pdf.body_text("Payment status is visible alongside fulfillment status:")
    pdf.mono_block("Delivered\nPaid\nRs 24,850")
    pdf.body_text(
        "Mock mode shows a representative last-order snapshot when no live order exists yet, "
        "so retailers can evaluate the payment-status pattern."
    )

    pdf.section_title("7. Explicit Removals")
    for item in [
        "Marketing banner removed from home",
        "Floating Quick Action button removed",
        "No coupons, wallet, ads, flashy gradients, or gaming elements",
        "Sticky order bar remains the only primary floating CTA",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Design System Notes")
    for item in [
        "GroAurum green primary / primaryDark retained",
        "Background softened to #F7FAF8; borders quieter",
        "Spacing grid aligned to 8px (8 / 16 / 24 / 32)",
        "Animations limited to subtle press opacity",
        "Category tiles use unified primarySoft surfaces",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Files Touched")
    for item in [
        "apps/customer/app/(tabs)/index.tsx - home composition",
        "apps/customer/components/ProductCard.tsx - B2B card",
        "apps/customer/components/home/* - search, service, trade prices, categories, last order",
        "apps/customer/components/CartBar.tsx - Review order sticky bar",
        "apps/customer/types/index.ts + utils/product-b2b.ts - commercial fields",
        "apps/customer/services/mock/data.ts - wholesale-oriented mock catalogue",
        "apps/customer/services/home-summary.ts - trade/service/last-order helpers",
        "Search / category / product screens aligned to B2B card + add-step behavior",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("10. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/customer typecheck", "Pass"),
        ("pnpm --filter @groaurum/customer lint", "Pass"),
        ("Mock mode home", "Runnable with refined B2B layout"),
    ]
    w2 = [95, 85]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm dev:customer\n"
        "# default adapter = mock\n"
        "# pick a location, then review Home"
    )

    pdf.section_title("12. Out of Scope")
    for item in [
        "Full TradeFlow / Restock redesign across the app",
        "Sales / Delivery / Admin UIs",
        "Payment gateway and live order placement against Supabase",
        "Production catalogue photography / Gurugram launch seeds",
        "Phase 4 backend workflows",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "This screen should feel closer to Stripe, Linear, and Apple than Blinkit: "
        "professional retailers scanning trade prices, MOQ, stock, and next delivery - "
        "not a consumer grocery feed."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
