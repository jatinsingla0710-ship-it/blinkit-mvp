"""Generate GroAurum Customer Catalogue v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Customer-Catalogue-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class CataloguePdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Customer App - Catalogue v1",
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
    pdf = CataloguePdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Customer Catalogue v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Professional wholesale product catalogue\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Aligned with Home / Restock / Review Order / Order Timeline v1 "
        f"· Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "This is NOT a consumer grocery catalogue. Retailers browse active SKUs with "
        "trade prices, MOQ, and selling-unit actions - no banners, coupons, wallet, or ads.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide a professional wholesale product catalogue for retailers to search, "
        "filter, sort, and add SKUs to today's order. Replaces the prior Search tab with "
        "a dedicated Catalogue tab at /(tabs)/catalogue."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional B2B, calm hierarchy, GroAurum design language",
        "8px spacing grid",
        "No banners, coupons, wallet, or ads",
        "Home, Restock, Review Order, and Order Timeline were not redesigned",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Screen Layout")
    for item in [
        "Header - Catalogue title + wholesale subtitle",
        "Search bar - product, SKU, grade or size",
        "Horizontal filter chips - All, Packed, Bulk, Dry Fruits, Spices",
        "Sort - Trade Price, A-Z, Available (with SKU count)",
        "Product list - wholesale ProductCard rows",
        "Sticky Review order bar when the draft has lines",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Filter Chips")
    rows = [
        ("Chip", "Rule"),
        ("All", "No facet filter"),
        ("Packed", "CARTON / PACK selling unit, or packs-per-carton set"),
        ("Bulk", "KG selling unit"),
        ("Dry Fruits", "Category name/id maps to dry-fruit families"),
        ("Spices", "Category name/id maps to spices"),
    ]
    widths = [40, 140]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Sort Options")
    for item in [
        "Trade Price - ascending trade price, then A-Z",
        "A-Z - product name ascending",
        "Available - in stock, then low stock, then out of stock; then A-Z",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Product Card Fields")
    rows2 = [
        ("Field", "Source"),
        ("Product image", "Catalogue mark / emoji"),
        ("Product name", "Product name"),
        ("Grade", "SKU grade / specification"),
        ("MOQ", "SKU moq"),
        ("Packs per carton", "SKU packsPerCarton when present"),
        ("Selling unit", "SKU unit label"),
        ("Trade price", "Current effective trade price"),
        ("Availability", "stockStatus / stock"),
        ("Primary action", "addActionLabel from sellingUnit + quantityStep"),
    ]
    w2 = [50, 130]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("7. Quantity Rules")
    pdf.body_text(
        "Do not hard-code carton or KG behavior in the Catalogue UI. Add / step actions "
        "use SKU configuration helpers:"
    )
    pdf.mono_block(
        "stepSkuQuantity(product, currentQty, +1 | -1)\n"
        "# Driven only by product.moq and product.quantityStep"
    )

    pdf.section_title("8. Data Rules")
    for item in [
        "Reads only active categories, products, SKUs, and current prices",
        "Mock adapter may include demo wholesale catalogue data",
        "Supabase mode: empty means empty - never falls back to mock demo products",
        "customer-catalogue boundary already enforces activeOnly + priced SKUs",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("9. Supported States")
    for item in [
        "Loading - LoadingBlock while products/categories fetch",
        "Error - message + Retry refetch",
        "Empty catalogue - no active priced SKUs",
        "Empty results - search/filter/sort produced no matches + Clear filters",
        "Search / Filter / Sort - client browse pipeline on loaded SKUs",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Files")
    for item in [
        "apps/customer/app/(tabs)/catalogue.tsx - Catalogue v1 screen",
        "apps/customer/app/(tabs)/_layout.tsx - Catalogue tab (replaces Search)",
        "apps/customer/components/catalogue/* - search, chips, sort",
        "apps/customer/services/catalogue-browser.ts - filter / sort / search pipeline",
        "apps/customer/services/customer-catalogue.ts - active catalogue boundary",
        "apps/customer/components/ProductCard.tsx - selling unit meta (shared)",
        "apps/customer/services/mock/data.ts - Spices category for mock facet coverage",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Navigation")
    for item in [
        "Tab bar: Home · Restock · Catalogue · Orders",
        "Home search field -> /(tabs)/catalogue",
        "Restock Browse catalogue -> /(tabs)/catalogue",
        "Legacy Search tab route removed",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Validation")
    rows3 = [
        ("Check", "Result"),
        ("Customer app typecheck (tsc --noEmit)", "Pass"),
        ("Home / Restock / Review Order / Order Timeline", "Layouts unchanged"),
        ("Supabase empty catalogue", "Shows empty, not demo data"),
    ]
    w3 = [110, 70]
    for i, row in enumerate(rows3):
        pdf.table_row(list(row), w3, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("13. How to Review")
    pdf.mono_block(
        "pnpm dev:customer\n"
        "# Open Catalogue tab\n"
        "# Search, filter chips, sort options\n"
        "# Add SKU via primary action -> Review order bar"
    )

    pdf.section_title("14. Out of Scope")
    for item in [
        "Consumer deal banners or promotional carousels",
        "Coupon / wallet / loyalty UI",
        "Hard-coded carton vs KG business rules in UI",
        "Home / Restock / Review Order / Order Timeline redesign",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Intent")
    pdf.body_text(
        "Catalogue should feel like a calm wholesale price book: searchable SKUs, "
        "clear trade terms, and SKU-driven add actions - not a Blinkit-style consumer "
        "grocery browse."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
