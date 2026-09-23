"""Generate GroAurum Customer Restock Screen v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Customer-Restock-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class RestockPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Customer App - Restock Screen v1",
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
    pdf = RestockPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Customer Restock Screen v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Reorder inventory in under one minute for professional retailers\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Consistent with Home Screen v1 / Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Calm B2B restock flow: prior order history drives suggestions; SKU MOQ and "
        "quantityStep control steppers. No promotional banners, coupons, wallet, or gaming UI.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Help retailers reorder inventory in under one minute. Suggested products come from "
        "what the shop previously ordered. Quantities follow each SKU's own commercial "
        "configuration - not hard-coded carton/KG business rules in the UI."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional B2B, minimal distractions, calm hierarchy",
        "GroAurum green branding retained",
        "8px spacing grid",
        "No promotional banners, coupons, wallet, or gaming UI",
        "Visual language consistent with Home Screen v1",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Screen Layout")
    for item in [
        "Header - Restock title + shop context",
        "Restock summary card - SKU count + suggested units",
        "Estimated order value - updates live with steppers",
        "Suggested products list",
        "Quantity steppers that follow SKU MOQ / quantityStep",
        "Add more products - navigates to Search",
        "Sticky Review order bar - merges draft into cart",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Suggested Product Row")
    rows = [
        ("Field", "Source"),
        ("Product image", "Catalogue product mark"),
        ("Product name", "Catalogue"),
        ("Grade / specification", "SKU commercial fields"),
        ("Last ordered quantity", "Most recent order history line"),
        ("Suggested quantity", "Last qty normalized via SKU MOQ/step"),
        ("Trade price + selling unit", "Current catalogue price / unit"),
        ("Stock status", "In stock / Low / Out of stock"),
        ("Quantity stepper", "stepSkuQuantity(product, qty, +/-1)"),
    ]
    widths = [55, 125]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Quantity Rules")
    pdf.body_text(
        "Do not hard-code business rules in the Restock UI. Carton and KG SKUs both use "
        "the same helpers driven by each product's moq and quantityStep:"
    )
    pdf.mono_block(
        "normalizeSkuQuantity(product, requestedQty)\n"
        "stepSkuQuantity(product, currentQty, +1 | -1)\n"
        "\n"
        "# Examples (from SKU config, not UI conditionals):\n"
        "# KG     moq=10 step=10  -> 0, 10, 20, ...\n"
        "# CARTON moq=1  step=1   -> 0, 1, 2, ..."
    )

    pdf.section_title("6. Empty State")
    pdf.body_text(
        "If no order history exists (or no matching in-stock SKUs remain), Restock shows "
        "an empty state encouraging the retailer to browse the catalogue. Supabase mode "
        "never invents purchase history."
    )
    pdf.body_text(
        "Mock adapter only: when history is empty, Restock may seed one prior delivered "
        "order from catalogue SKUs (qty = each SKU's own MOQ) so the screen is demoable "
        "without forcing a full checkout first."
    )

    pdf.section_title("7. Review Order Flow")
    for item in [
        "Retailer adjusts suggested quantities",
        "Estimated value and unit count update immediately",
        "Review order clears cart, adds selected restock lines, opens Cart",
        "Sticky bar is the only floating CTA (same pattern as Home)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Navigation")
    for item in [
        "New Restock tab in customer bottom navigation",
        "Home last-order card can deep-link into Restock for seeded/demo history",
        "Add more products opens Search",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Files Added / Updated")
    for item in [
        "apps/customer/app/(tabs)/restock.tsx - Restock screen",
        "apps/customer/app/(tabs)/_layout.tsx - Restock tab",
        "apps/customer/services/restock.ts - history + suggestion plan",
        "apps/customer/components/restock/* - summary, value, row, review bar",
        "apps/customer/utils/product-b2b.ts - normalize/step SKU quantity helpers",
        "apps/customer/services/mock/orders.ts - seedMockDeliveredOrder (mock only)",
        "apps/customer/types/index.ts - RestockSuggestion type",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("10. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/customer typecheck", "Pass"),
        ("pnpm --filter @groaurum/customer lint", "Pass"),
        ("Mock Restock tab", "Suggestions + steppers + Review order"),
        ("Empty history (Supabase / no orders)", "Browse catalogue empty state"),
    ]
    w2 = [100, 80]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm dev:customer\n"
        "# mock adapter (default)\n"
        "# pick a location, open Restock tab"
    )

    pdf.section_title("12. Out of Scope")
    for item in [
        "ML / demand forecasting beyond last-ordered qty",
        "Supabase-backed order history reads (still mock orders store)",
        "Assisted-order OTP, payments, or TradeFlow redesign",
        "Sales / Delivery / Admin apps",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "Restock should feel like a wholesale reorder checklist: previous purchases, "
        "valid SKU steps, clear trade value, and a single path to Review order - "
        "not a consumer promotion feed."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
