"""Generate GroAurum Admin Salesman Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Salesman-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class SalesmanMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Salesman Management v1",
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
    pdf = SalesmanMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Salesman Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Field sales operations console\n"
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
        "This is NOT an employee directory. Operators manage coverage, performance, "
        "onboarding progress, order generation, and daily field activity.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide administrators with a Sales Operations Console inside the GroAurum "
        "Admin shell. Sidebar navigation is unchanged; Salesmen replaces the "
        "placeholder module. Focus is field productivity and retail coverage - not HR."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Salesforce + Stripe Admin + Linear feel for wholesale distribution",
        "Typed fixtures only - no backend mutations in v1",
        "Reusable admin components (Card, Badge, Button, Tabs, KPI cards)",
        "Do not redesign prior modules (Dashboard, Products, Pricing, Inventory, Orders, Customers)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Salesman Dashboard KPIs")
    pdf.body_text("Route: /salesmen")
    for item in [
        "Active Salesmen",
        "Customers Assigned",
        "Orders This Month",
        "New Customers Added",
        "Pending Activations",
        "Today's Visits",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Salesman List")
    rows = [
        ("Column", "Meaning"),
        ("Salesman Name", "Field rep - links to detail"),
        ("Territory", "Coverage geography"),
        ("Assigned Customers", "Retail shops owned"),
        ("Orders This Month", "Tagged order volume"),
        ("Collections", "COD + online collected"),
        ("Status", "Active / On Leave / Inactive"),
        ("Updated", "Last activity stamp"),
    ]
    widths = [50, 130]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.body_text(
        "Browse supports Search (name / territory), Status filter, Sort "
        "(A-Z, Orders, Customers, Updated), and Pagination."
    )

    pdf.add_page()
    pdf.section_title("5. Salesman Detail")
    pdf.body_text("Route: /salesmen/:salesmanId")
    for item in [
        "Overview - name, phone, employee ID, territory, joining date, status, "
        "assigned customers, total orders",
        "Assigned Customers - shop, area, status, last order, last visit, "
        "activation; View / Create Order / Reassign",
        "Orders - recent orders created / tagged to this salesman",
        "Daily Visits - timeline of planned, completed, and missed visits",
        "Collections - COD, online, pending, and collection history",
        "Performance - orders, revenue, new/repeat customers, activation rate, AOV",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Status Model")
    for item in [
        "Active - currently operating in the field",
        "On Leave - temporarily unavailable",
        "Inactive - not in the active sales roster",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Quick Actions")
    for item in [
        "Add Customer",
        "Create Order",
        "Send Invitation",
        "View Territory",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI stubs in v1 - they focus related tabs. Mutations deferred."
    )

    pdf.section_title("8. Daily Visits")
    for item in [
        "Timeline of today's planned visits",
        "Completed visits with optional notes",
        "Missed visits highlighted for follow-up",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("9. Performance Cards")
    for item in [
        "Orders This Month",
        "Revenue Generated",
        "New Customers",
        "Repeat Customers",
        "Activation Success Rate",
        "Average Order Value",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/salesmen-types.ts\n"
        "apps/admin-web/src/data/salesmen-fixtures.ts\n"
        "# SALESMEN_SNAPSHOT_FIXTURE + SALESMAN_DETAIL_FIXTURES\n"
        "# browseSalesmen() for search / filter / sort / pagination\n"
        "# Replace with Supabase salesman / coverage / visit queries"
    )

    pdf.section_title("11. Files")
    for item in [
        "pages/salesmen/SalesmenListPage.tsx - KPIs, browse, team table",
        "pages/salesmen/SalesmanDetailPage.tsx - six-tab operations console",
        "components/salesmen/* - badges, browse, table, tabs, visits timeline",
        "App.tsx - /salesmen and /salesmen/:salesmanId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / prior modules", "Unchanged"),
        ("Backend mutations", "Not implemented (by design)"),
    ]
    w2 = [125, 55]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("13. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/salesmen\n"
        "# Priya Sharma - active, full coverage + visits\n"
        "# Neha Joshi - on leave\n"
        "# Vikram Singh - inactive, empty visits"
    )

    pdf.section_title("14. Out of Scope")
    for item in [
        "Supabase create / invite / reassign / visit check-in mutations",
        "Live GPS tracking or territory map editing",
        "HR payroll, attendance, or leave management systems",
        "Commission calculation engines",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Intent")
    pdf.body_text(
        "Salesman Management should feel like a sales operations console for "
        "wholesale distribution: see who is covering which shops, how orders and "
        "collections are tracking, and what happened on today's route - not an "
        "employee directory."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
