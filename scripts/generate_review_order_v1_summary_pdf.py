"""Generate GroAurum Customer Review Order v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Customer-Review-Order-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class ReviewOrderPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Customer App - Review Order v1",
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
    pdf = ReviewOrderPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Customer Review Order v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale order confirmation before submission\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Aligned with Home / Restock v1 · Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "This is NOT a consumer shopping cart. Retailers review shop context, SKU lines, "
        "estimated trade value, payment, and delivery address, then Confirm Order.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Allow retailers to review and confirm today's wholesale order before submission. "
        "Entry points: Restock Review order bar and Home sticky order bar both open /cart, "
        "now titled Review Order."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional B2B, calm interface, GroAurum design language",
        "8px spacing grid",
        "No banners, coupons, wallet, or ads",
        "Home and Restock screens were not redesigned",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Screen Layout")
    for item in [
        "Header - Review Order",
        "Shop summary - shop name, delivery schedule, sales executive",
        "Order items - image, name, grade, selling unit, stepper, unit price, line total",
        "Order summary - total items + estimated value",
        "Payment - Cash on Delivery / Pay Online",
        "Delivery address",
        "Notes (optional)",
        "Sticky bottom CTA - Confirm Order",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Order Item Row")
    rows = [
        ("Field", "Behavior"),
        ("Product image", "Catalogue mark"),
        ("Product name", "Primary title"),
        ("Grade", "SKU grade / specification"),
        ("Selling unit", "From SKU configuration"),
        ("Quantity stepper", "stepSkuQuantity (MOQ + step)"),
        ("Unit price", "Current trade price"),
        ("Line total", "trade price x quantity"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Quantity Rules")
    pdf.body_text(
        "Do not hard-code carton or KG logic in the Review Order UI. Steppers use the same "
        "SKU helpers as Restock:"
    )
    pdf.mono_block(
        "stepSkuQuantity(product, currentQty, +1 | -1)\n"
        "# Driven only by product.moq and product.quantityStep"
    )

    pdf.section_title("6. Order Value")
    pdf.body_text(
        "Estimated value is the sum of trade price x quantity across selected lines. "
        "No consumer delivery/handling fee strip, free-delivery thresholds, or coupon UI."
    )

    pdf.section_title("7. Payment Options")
    for item in [
        "Cash on Delivery - pay when delivery arrives",
        "Pay Online - UPI / card settlement path (UI selection; gateway not integrated)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Confirm Order Behavior")
    for item in [
        "Mock adapter: stock check, createOrder, clear cart, open order tracking",
        "Supabase adapter: Review Order UI available; submission deferred (coming soon alert)",
        "Optional notes field captured in UI for later backend wiring",
        "Legacy /checkout redirects to /cart (Review Order)",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Files")
    for item in [
        "apps/customer/app/cart.tsx - Review Order v1 screen",
        "apps/customer/app/checkout.tsx - redirect to /cart",
        "apps/customer/app/_layout.tsx - header title Review Order",
        "apps/customer/components/review-order/* - shop, items, summary, payment, CTA",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/customer typecheck", "Pass"),
        ("pnpm --filter @groaurum/customer lint", "Pass"),
        ("Home / Restock", "Unchanged layout"),
    ]
    w2 = [100, 80]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm dev:customer\n"
        "# Restock -> Review order  OR  Home sticky bar\n"
        "# Confirm Order on Review Order screen"
    )

    pdf.section_title("12. Out of Scope")
    for item in [
        "Payment gateway integration",
        "Supabase order placement persistence",
        "Assisted-order confirmation OTP",
        "Home / Restock visual redesign",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "Review Order should feel like confirming a wholesale purchase order: shop context, "
        "commercial lines, payment choice, and a single Confirm Order action - not a "
        "Blinkit-style consumer checkout."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
