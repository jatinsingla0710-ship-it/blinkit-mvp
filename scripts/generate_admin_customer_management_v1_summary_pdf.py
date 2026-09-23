"""Generate GroAurum Admin Customer Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Customer-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class CustomerMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Customer Management v1",
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
    pdf = CustomerMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Customer Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale retailer network management console\n"
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
        "This is NOT a simple customer list. Operators manage activation, health, "
        "sales coverage, and retailer history - not a generic CRM.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide administrators with a complete retail network management console "
        "inside the GroAurum Admin shell. Sidebar navigation is unchanged; Customers "
        "replaces the placeholder module."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Wholesale retailer network console - not a generic CRM",
        "Typed fixtures only - no backend mutations in v1",
        "Reusable admin components (Card, Badge, Button, Tabs, KPI cards)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Customer Dashboard KPIs")
    pdf.body_text("Route: /customers")
    for item in [
        "Active Retailers",
        "Awaiting Activation",
        "Inactive",
        "Blocked",
        "Today's New Customers",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Customer Table")
    rows = [
        ("Column", "Meaning"),
        ("Shop Name", "Trade name - links to detail"),
        ("Owner", "Shop owner contact name"),
        ("Area", "Service / delivery area"),
        ("Assigned Salesman", "Field coverage owner"),
        ("Last Order", "Latest order code / relative time"),
        ("Preferred Payment", "COD / Online / Credit"),
        ("Status", "Active / Awaiting / Inactive / Blocked"),
    ]
    widths = [50, 130]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Customer Detail")
    pdf.body_text("Route: /customers/:customerId")
    for item in [
        "Overview - owner, phone, area, salesman, payment preference, status",
        "Orders - recent wholesale orders for the shop",
        "Payments - collections and settlement status",
        "Addresses - delivery addresses and serviceability",
        "Activity - network / activation event history",
        "Documents - GST, license, credit docs",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Activation Workflow")
    for item in [
        "Created - shop record added to the network",
        "Invitation Sent - activation invite delivered",
        "OTP Verified - owner phone verified",
        "Activated - retailer live for catalogue and ordering",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Customer Health")
    for item in [
        "Orders This Month",
        "Average Order Value",
        "Last Order Date",
        "Last Payment Status",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Quick Actions")
    for item in [
        "Add Customer",
        "Send Invitation",
        "Reassign Salesman",
        "View Orders",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI stubs in v1 - they focus related tabs. Mutations deferred."
    )

    pdf.add_page()
    pdf.section_title("9. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/customers-types.ts\n"
        "apps/admin-web/src/data/customers-fixtures.ts\n"
        "# CUSTOMERS_SNAPSHOT_FIXTURE + CUSTOMER_DETAIL_FIXTURES\n"
        "# buildActivationWorkflow() for invitation readiness rail\n"
        "# Replace with Supabase shop / invite / order queries"
    )

    pdf.section_title("10. Files")
    for item in [
        "pages/customers/CustomersListPage.tsx - KPIs, actions, retailer table",
        "pages/customers/CustomerDetailPage.tsx - tabs + health + activation",
        "components/customers/* - badges, table, health, activation, tab panels",
        "App.tsx - /customers and /customers/:customerId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / Orders / Products / Pricing / Inventory", "Unchanged"),
        ("Backend mutations", "Not implemented (by design)"),
    ]
    w2 = [125, 55]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("12. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/customers\n"
        "# Sharma Kirana - active + full health\n"
        "# Laxmi Stores - awaiting activation (invite sent)\n"
        "# Quick Mart - blocked credit hold"
    )

    pdf.section_title("13. Out of Scope")
    for item in [
        "Supabase invite / OTP / activate / reassign mutations",
        "Document upload and verification workflows",
        "Generic CRM pipelines or marketing campaigns",
        "Live map of retailer locations",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. Intent")
    pdf.body_text(
        "Customer Management should feel like a wholesale retailer network console: "
        "see who is active or stuck in activation, inspect shop health, and keep "
        "sales coverage clear - not a consumer CRM address book."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
