"""Generate GroAurum Admin Dashboard v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Dashboard-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class AdminDashboardPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Dashboard v1",
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
    pdf = AdminDashboardPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Dashboard v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Operational dashboard for today's wholesale operations\n"
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
        "Professional SaaS console - calm, premium, green GroAurum branding. "
        "No flashy charts, gradients, or marketing widgets. Business logic deferred.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide a single operational dashboard that lets the business owner understand "
        "today's operations within about 30 seconds. Desktop-first admin web app with "
        "reusable components prepared for live backend wiring."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS - clean, calm, premium",
        "Green GroAurum branding, white cards, 8px spacing",
        "High information density without clutter",
        "No flashy charts, gradients, or marketing widgets",
        "No consumer-style UI",
        "No business logic in v1 - UI shell and typed view models only",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Layout")
    for item in [
        "Top navigation - logo, notifications/alerts, profile",
        "Sidebar - Dashboard, Orders, Customers, Products, Categories, Pricing, "
        "Inventory, Salesmen, Delivery, Service Areas, Reports, Settings",
        "Main content - Dashboard widgets (other nav items are placeholders)",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Dashboard Widgets")
    rows = [
        ("Widget", "Role"),
        ("KPI Cards", "Today's Revenue, Orders, Customers, Delivery, Collections"),
        ("Daily Focus", "Actionable operational items with priority badges"),
        ("Low Stock", "SKU availability vs threshold table"),
        ("Sales Team Performance", "Orders / revenue / collections / status table"),
        ("Quick Actions", "Add Product, Update Price, Add Customer, Create Route"),
        ("Recent Orders", "Order feed table (empty until live data)"),
    ]
    widths = [55, 125]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Reusable Components")
    for item in [
        "Card, Button, Badge, PageHeader, EmptyState",
        "Shared DataTable styles for dense admin tables",
        "AdminShell, TopNav, Sidebar layout primitives",
        "Dashboard widgets accept typed props for future API snapshots",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Data Preparation")
    pdf.body_text(
        "Widgets consume DashboardSnapshot view models. A static fixture "
        "(DASHBOARD_FIXTURE) fills layout review only - KPIs show placeholders, "
        "recent orders stay empty until a live feed is connected. Swap the fixture "
        "for a backend query without redesigning the UI."
    )
    pdf.mono_block(
        "apps/admin-web/src/data/dashboard-types.ts\n"
        "apps/admin-web/src/data/dashboard-fixtures.ts\n"
        "# Replace fixture with live snapshot when ready"
    )

    pdf.section_title("7. Stack")
    for item in [
        "Vite + React 19 + TypeScript",
        "React Router for shell navigation",
        "CSS design tokens aligned to GroAurum (no gradients)",
        "Source Sans 3 for calm professional typography",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Files")
    for item in [
        "apps/admin-web/src/pages/DashboardPage.tsx - dashboard composition",
        "apps/admin-web/src/layout/* - TopNav, Sidebar, AdminShell",
        "apps/admin-web/src/components/dashboard/* - KPI and operational cards",
        "apps/admin-web/src/components/ui/* - reusable admin primitives",
        "apps/admin-web/src/App.tsx - routes (placeholders for non-dashboard modules)",
        "package.json root script: pnpm dev:admin",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("9. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Business logic / live APIs", "Not implemented (by design)"),
    ]
    w2 = [120, 60]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("10. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173\n"
        "# Dashboard home + sidebar placeholder modules"
    )

    pdf.section_title("11. Out of Scope")
    for item in [
        "Live revenue / order / inventory queries",
        "Auth, roles, and notification backends",
        "CRUD workflows behind Quick Actions",
        "Charts, maps, or marketing analytics",
        "Full Orders / Customers / Products module UIs",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Intent")
    pdf.body_text(
        "Admin Dashboard v1 should feel like a calm wholesale operations console: "
        "owner sees today's focus, stock risk, sales activity, and recent orders in "
        "one scan - not a consumer analytics billboard."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
