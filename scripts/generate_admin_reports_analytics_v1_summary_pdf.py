"""Generate GroAurum Admin Reports & Analytics v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Reports-Analytics-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class ReportsPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Reports & Analytics v1",
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
    pdf = ReportsPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Reports & Analytics v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Executive analytics center for business decisions\n"
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
        "This is NOT a collection of random charts. Every report answers a business "
        "question for owners and managers of the wholesale operation.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide an Executive Analytics Center inside the GroAurum Admin shell. "
        "Sidebar navigation is unchanged; Reports replaces the placeholder module. "
        "Focus is decision support across sales, products, customers, salesmen, "
        "delivery, and inventory."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Every report includes a business question it answers",
        "Typed fixtures only - no backend queries in v1",
        "Placeholder charts only - reusable PlaceholderChart component",
        "Do not redesign prior modules",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Dashboard KPIs")
    pdf.body_text("Route: /reports")
    for item in [
        "Revenue Today",
        "Revenue This Month",
        "Orders Today",
        "Active Customers",
        "Inventory Value",
        "Delivery Success Rate",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Filters")
    for item in [
        "Date Range",
        "Category",
        "Area",
        "Salesman",
        "Warehouse",
        "Customer",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Filters are UI state in v1. They prepare the control surface for later "
        "warehouse / analytics queries."
    )

    pdf.section_title("5. Export")
    for item in ["PDF", "Excel", "CSV"]:
        pdf.bullet(item)
    pdf.body_text("Export buttons are stubs - no file generation in v1.")

    pdf.add_page()
    pdf.section_title("6. Report Sections")
    rows = [
        ("Section", "Reports"),
        (
            "Sales",
            "Revenue by Day / Month / Category / Salesman / Area; AOV",
        ),
        (
            "Products",
            "Top selling, slow moving, category & SKU performance, OOS, near reorder",
        ),
        (
            "Customers",
            "New / active / inactive, repeat rate, top customers, growth",
        ),
        (
            "Salesmen",
            "Revenue, orders, new retailers, activation, AOV, visit completion",
        ),
        (
            "Delivery",
            "Routes completed, success, failed, COD collected, avg delivery time",
        ),
        (
            "Inventory",
            "Value, reserved, stock movement, low stock, turnover (placeholder)",
        ),
    ]
    widths = [35, 145]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("7. Decision Design")
    pdf.body_text(
        "Each report card shows a title, the business question it answers, optional "
        "headline metric, and a placeholder chart or dense table. Charts are visual "
        "shells (bar / line / donut) - not a charting library."
    )

    pdf.add_page()
    pdf.section_title("8. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/reports-types.ts\n"
        "apps/admin-web/src/data/reports-fixtures.ts\n"
        "# REPORTS_SNAPSHOT_FIXTURE\n"
        "# sections[] with question-driven ReportMetricCard\n"
        "# Replace with warehouse / analytics queries"
    )

    pdf.section_title("9. Files")
    for item in [
        "pages/reports/ReportsPage.tsx - KPIs, filters, export, section tabs",
        "components/reports/PlaceholderChart.tsx - bar / line / donut shells",
        "components/reports/ReportCard.tsx - question + metric + chart/table",
        "components/reports/ReportsFilters.tsx - date / category / area / etc.",
        "components/reports/ReportsExportActions.tsx - PDF / Excel / CSV stubs",
        "App.tsx - /reports route",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / prior modules", "Unchanged"),
        ("Backend queries / exports", "Not implemented (by design)"),
    ]
    w2 = [125, 55]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/reports\n"
        "# Switch Sales / Products / Customers / Salesmen / Delivery / Inventory\n"
        "# Confirm each card shows a business question\n"
        "# Inventory Turnover shows Placeholder badge"
    )

    pdf.section_title("12. Out of Scope")
    for item in [
        "Live warehouse / Supabase analytics queries",
        "Real chart library integration (Recharts, etc.)",
        "Actual PDF / Excel / CSV file generation",
        "Saved report packs or scheduled email digests",
        "Drill-down into operational modules from chart points",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "Reports & Analytics should feel like an executive decision surface for "
        "wholesale distribution: see revenue health, product risk, retail growth, "
        "field productivity, last-mile execution, and inventory capital - not a "
        "dashboard of decorative charts."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
