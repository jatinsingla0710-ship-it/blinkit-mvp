"""Generate GroAurum Admin Pricing Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Pricing-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class PricingMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Pricing Management v1",
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
    pdf = PricingMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Pricing Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale SKU trade prices with history and scheduled future prices\n"
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
        "This is NOT a simple editable price table. Operators schedule append-only "
        "trade price records. History is never overwritten.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Manage wholesale SKU trade prices with historical records and scheduled "
        "future prices inside the GroAurum Admin shell. Sidebar navigation is "
        "unchanged; Pricing is a full module instead of a placeholder."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Append-only pricing architecture - never overwrite history",
        "Reusable admin components (Card, Badge, Button, Tabs, tables)",
        "Typed fixtures only - no backend mutations in v1",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. SKU Price List")
    pdf.body_text("Route: /pricing")
    rows = [
        ("Column", "Meaning"),
        ("SKU", "Name + code - links to detail"),
        ("Product", "Parent product name"),
        ("Current Price", "Live trade price label"),
        ("Future Price", "Next scheduled price, or -"),
        ("Effective Date", "Live effective-from (or focus date)"),
        ("Status", "Live / Scheduled / Expired"),
        ("Updated", "Last update timestamp label"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("4. SKU Detail")
    pdf.body_text("Route: /pricing/:skuId")
    for item in [
        "Current Price - live trade price, effective window, notes, append-only footnote",
        "Price History - newest-first timeline of immutable records",
        "Scheduled Prices - future records with Cancel affordance (UI-only)",
        "Schedule Price panel - New Price, Effective Date, Notes",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("5. Schedule Price")
    for item in [
        "New Price - trade price amount input",
        "Effective Date - date the record becomes live",
        "Notes - optional reason for the schedule",
        "Submit creates a new append-only record in real systems (stubbed in v1)",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Price History")
    pdf.body_text(
        "Append-only timeline. Live and expired records retain their values. "
        "Prior prices are closed with an effective-to date when superseded - "
        "they are never edited in place."
    )

    pdf.section_title("7. Status")
    for item in [
        "Live - currently effective trade price",
        "Scheduled - future price waiting to become live",
        "Expired - closed historical record",
        "Cancelled - reserved for cancelled scheduled rows",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Quick Actions")
    for item in [
        "Schedule Price - focuses schedule / scheduled tab",
        "Cancel Scheduled Price - opens scheduled tab (mutation deferred)",
        "View History - opens Price History tab",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/pricing-types.ts\n"
        "apps/admin-web/src/data/pricing-fixtures.ts\n"
        "# SKU_PRICE_LIST_FIXTURE + SKU_PRICING_DETAIL_FIXTURES\n"
        "# Replace with Supabase append-only price queries"
    )

    pdf.add_page()
    pdf.section_title("10. Files")
    for item in [
        "pages/pricing/PricingListPage.tsx - SKU price list + quick actions",
        "pages/pricing/PricingDetailPage.tsx - tabs + schedule form",
        "components/pricing/* - list, current, history timeline, scheduled, form, actions",
        "App.tsx - /pricing and /pricing/:skuId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / Dashboard / Products", "Unchanged"),
        ("Backend mutations", "Not implemented (by design)"),
    ]
    w2 = [120, 60]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("12. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/pricing\n"
        "# AKH-LA-10 - live + scheduled future price\n"
        "# KIS-EL-CTN - scheduled status with future price\n"
        "# MIX-LEG-CTN - expired history only"
    )

    pdf.section_title("13. Out of Scope")
    for item in [
        "Supabase schedule / cancel / activate mutations",
        "In-place price edits (intentionally forbidden)",
        "Bulk price upload / CSV tools",
        "Customer-facing price display wiring from this module",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. Intent")
    pdf.body_text(
        "Pricing Management should feel like a wholesale trade-book console: "
        "see live and future prices at a glance, inspect immutable history, and "
        "schedule the next price without ever rewriting the past."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
