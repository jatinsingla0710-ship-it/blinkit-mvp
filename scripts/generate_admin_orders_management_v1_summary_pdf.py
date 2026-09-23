"""Generate GroAurum Admin Orders Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Orders-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class OrdersMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Orders Management v1",
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
    pdf = OrdersMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Orders Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale order operations control center\n"
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
        "This is NOT a simple order list. Operators run fulfilment, payment, delivery, "
        "and audit from one console - not a CRUD page.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide administrators with a complete wholesale order operations console "
        "inside the GroAurum Admin shell. Sidebar navigation is unchanged; Orders "
        "replaces the placeholder module."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Operations control center feel - not a CRUD page",
        "Timeline reuses customer wholesale lifecycle states",
        "Activity log is append-only audit history",
        "Typed fixtures only - no backend mutations in v1",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Orders Dashboard KPIs")
    pdf.body_text("Route: /orders")
    for item in [
        "Today's Orders",
        "Pending Confirmation",
        "Packing",
        "Ready for Dispatch",
        "Out for Delivery",
        "Delivered",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Orders Table")
    rows = [
        ("Column", "Meaning"),
        ("Order ID", "GA code - links to detail"),
        ("Customer", "Retail shop / account"),
        ("Order Value", "Commercial total label"),
        ("Payment Status", "Paid / Unpaid / Pending / Partial"),
        ("Fulfillment Status", "Wholesale lifecycle stage"),
        ("Delivery Status", "Not started / Assigned / OFD / Delivered"),
        ("Salesman", "Assigned field executive"),
        ("Updated", "Last ops update timestamp"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. Filters")
    for item in [
        "Date",
        "Status (fulfillment)",
        "Payment",
        "Salesman",
        "Warehouse",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Order Detail")
    pdf.body_text("Route: /orders/:orderId")
    for item in [
        "Overview - customer, salesman, warehouse, statuses, notes",
        "Items - commercial SKU lines with qty and totals",
        "Timeline - customer wholesale lifecycle (Confirmed to Delivered)",
        "Payment - method, status, collected, outstanding",
        "Delivery - address, window, route, challan, delivery status",
        "Activity Log - append-only operational audit events",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Timeline States")
    for item in [
        "Order Confirmed",
        "Stock Reserved",
        "Packing",
        "Ready for Dispatch",
        "Assigned to Route",
        "Out for Delivery",
        "Delivered",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Quick Actions")
    for item in [
        "Assign Route",
        "Mark Packing",
        "Print Invoice",
        "Generate Challan",
        "View Timeline",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI stubs in v1 - they focus related tabs. Mutations deferred."
    )

    pdf.add_page()
    pdf.section_title("9. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/orders-types.ts\n"
        "apps/admin-web/src/data/orders-fixtures.ts\n"
        "# ORDERS_SNAPSHOT_FIXTURE + ORDER_DETAIL_FIXTURES\n"
        "# buildOrderTimeline() mirrors customer Order Timeline v1\n"
        "# Replace with Supabase order / event queries"
    )

    pdf.section_title("10. Files")
    for item in [
        "pages/orders/OrdersListPage.tsx - KPIs, filters, table, quick actions",
        "pages/orders/OrderDetailPage.tsx - six-tab operations detail",
        "components/orders/* - badges, filters, table, timeline, payment, delivery, activity",
        "App.tsx - /orders and /orders/:orderId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / Products / Pricing / Inventory", "Unchanged"),
        ("Backend mutations", "Not implemented (by design)"),
    ]
    w2 = [120, 60]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("12. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/orders\n"
        "# GA-14K2 - Packing + COD unpaid\n"
        "# GA-15B2 - Out for Delivery\n"
        "# GA-13P1 - Delivered with full timeline"
    )

    pdf.section_title("13. Out of Scope")
    for item in [
        "Supabase assign route / packing / invoice / challan mutations",
        "Live payment gateway settlement",
        "Driver / map tracking UI",
        "Bulk order tools",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. Intent")
    pdf.body_text(
        "Orders Management should feel like a wholesale operations control center: "
        "scan today's pipeline, filter by payment and warehouse, open an order, and "
        "run fulfilment through timeline and audit - never a flat editable list."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
