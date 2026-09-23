"""Generate GroAurum Admin Inventory Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Inventory-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class InventoryMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Inventory Management v1",
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
    pdf = InventoryMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Inventory Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Warehouse stock console with append-only movement ledger\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"apps/admin-web · UI shell only · Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "This is NOT a simple stock table. Operators manage warehouse positions, "
        "reservations, and an append-only ledger - not a spreadsheet.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide warehouse operators and administrators with a complete stock "
        "management console inside the GroAurum Admin shell. Sidebar navigation "
        "is unchanged; Inventory replaces the placeholder module."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Warehouse operations console feel - not a spreadsheet",
        "Append-only movement ledger - balances derived, history never overwritten",
        "Typed fixtures only - no backend mutations in v1",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Inventory Dashboard")
    pdf.body_text("Route: /inventory")
    for item in [
        "Total Stock Value",
        "Available Stock",
        "Reserved Stock",
        "Incoming Stock",
        "Low Stock Alerts",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Inventory Table")
    rows = [
        ("Column", "Meaning"),
        ("SKU", "Name + code - links to detail"),
        ("Warehouse", "Stock location / hub"),
        ("Available", "Free to sell"),
        ("Reserved", "Held for open orders"),
        ("Incoming", "Supplier receipts pending"),
        ("Reorder Level", "Threshold for low alerts"),
        ("Status", "Healthy / Low / Out of Stock / Incoming"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. SKU Detail")
    pdf.body_text("Route: /inventory/:skuId")
    for item in [
        "Overview - warehouse balances, reorder level, stock value, ledger footnote",
        "Movement History - append-only timeline of stock events",
        "Reservations - stock held for wholesale orders",
        "Adjustments - cycle counts, damage write-offs, clearance",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Stock Movement Types")
    for item in [
        "Supplier Receipt",
        "Customer Order",
        "Damage",
        "Manual Adjustment",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Movements form an append-only ledger. Historical rows retain their values; "
        "available / reserved / incoming are derived views."
    )

    pdf.section_title("7. Inventory Status")
    for item in [
        "Healthy - above reorder level",
        "Low - at or below reorder level",
        "Out of Stock - zero available",
        "Incoming - inbound supplier stock in flight",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Quick Actions")
    for item in [
        "Receive Stock - focuses Movement History (mutation deferred)",
        "Adjust Stock - focuses Adjustments tab",
        "View Ledger - opens Movement History",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/inventory-types.ts\n"
        "apps/admin-web/src/data/inventory-fixtures.ts\n"
        "# INVENTORY_SNAPSHOT_FIXTURE + INVENTORY_DETAIL_FIXTURES\n"
        "# Replace with Supabase inventory / ledger queries"
    )

    pdf.add_page()
    pdf.section_title("10. Files")
    for item in [
        "pages/inventory/InventoryListPage.tsx - KPI dashboard + table + actions",
        "pages/inventory/InventoryDetailPage.tsx - tabs for overview / ledger / reservations",
        "components/inventory/* - table, badges, timeline, reservations, adjustments, actions",
        "components/dashboard/KpiCards.tsx - shared KPI cards (widened for inventory)",
        "App.tsx - /inventory and /inventory/:skuId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / Products / Pricing", "Unchanged"),
        ("Backend mutations", "Not implemented (by design)"),
    ]
    w2 = [120, 60]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("12. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/inventory\n"
        "# AKH-LA-10 - low stock + full movement ledger\n"
        "# KIS-EL-CTN - incoming status\n"
        "# MIX-LEG-CTN - out of stock"
    )

    pdf.section_title("13. Out of Scope")
    for item in [
        "Supabase receive / adjust / reserve mutations",
        "In-place balance edits (intentionally forbidden)",
        "Barcode / WMS device workflows",
        "Multi-warehouse transfer UI",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. Intent")
    pdf.body_text(
        "Inventory Management should feel like a warehouse operations console: "
        "see stock value and risk at a glance, inspect SKU positions by hub, and "
        "trace every change through an append-only ledger - never a flat editable grid."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
