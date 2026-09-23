"""Generate GroAurum Admin Delivery Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Delivery-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class DeliveryMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Delivery Management v1",
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
    pdf = DeliveryMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Delivery Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Last-mile wholesale delivery operations console\n"
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
        "This is NOT a driver directory. Operators manage routes, vehicles, "
        "stop execution, COD collections, and delivery performance.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide administrators with a Delivery Operations Console inside the "
        "GroAurum Admin shell. Sidebar navigation is unchanged; Delivery replaces "
        "the placeholder module. Focus is last-mile wholesale execution - not fleet HR."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Typed fixtures only - no backend mutations in v1",
        "Reusable admin components (Card, Badge, Button, Tabs, KPI cards)",
        "Do not redesign prior modules (Dashboard through Salesman Management)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Delivery Dashboard KPIs")
    pdf.body_text("Route: /delivery")
    for item in [
        "Active Routes",
        "Vehicles Running",
        "Orders Out For Delivery",
        "Deliveries Completed",
        "Pending COD Collections",
        "Failed Deliveries",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Delivery Route List")
    rows = [
        ("Column", "Meaning"),
        ("Route ID", "Route code - links to detail"),
        ("Driver", "Assigned field driver"),
        ("Vehicle", "Vehicle registration"),
        ("Delivery Area", "Coverage geography"),
        ("Orders Assigned", "Stops on the route"),
        ("COD Amount", "Cash expected on route"),
        ("Route Status", "Planned / Loading / Running / Completed / Cancelled"),
        ("Updated", "Last activity stamp"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.body_text(
        "Browse supports Search (route / driver / vehicle / area), Status filter, "
        "Sort (Route A-Z, Orders, COD, Updated), and Pagination."
    )

    pdf.add_page()
    pdf.section_title("5. Route Detail")
    pdf.body_text("Route: /delivery/:routeId")
    for item in [
        "Overview - route number, driver, vehicle, warehouse, area, departure, "
        "expected completion, status",
        "Assigned Orders - order, customer, area, amount, payment, delivery status; "
        "View / Mark Delivered / Skip Delivery",
        "Timeline - Route Created, Vehicle Loaded, Departed Warehouse, Delivering, "
        "Completed, Cancelled",
        "Collections - COD expected, collected, pending, and history",
        "Performance - delivered, success rate, avg time, failed, customer rating (future)",
        "Vehicle - number, driver, capacity, status",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Route Status Model")
    for item in [
        "Planned - route built, not yet loading",
        "Loading - vehicle being packed at warehouse",
        "Running - departed and delivering stops",
        "Completed - route closed",
        "Cancelled - aborted before or during execution",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Quick Actions")
    for item in [
        "Create Route",
        "Assign Driver",
        "Assign Orders",
        "Close Route",
        "Export Manifest",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI stubs in v1 - they focus related tabs. Mutations deferred."
    )

    pdf.add_page()
    pdf.section_title("8. Timeline Stages")
    for item in [
        "Route Created",
        "Vehicle Loaded",
        "Departed Warehouse",
        "Delivering",
        "Completed",
        "Cancelled",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Performance Cards")
    for item in [
        "Orders Delivered",
        "Delivery Success Rate",
        "Average Delivery Time",
        "Failed Deliveries",
        "Customer Rating (future placeholder)",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/delivery-types.ts\n"
        "apps/admin-web/src/data/delivery-fixtures.ts\n"
        "# DELIVERY_SNAPSHOT_FIXTURE + DELIVERY_ROUTE_DETAIL_FIXTURES\n"
        "# browseDeliveryRoutes() for search / filter / sort / pagination\n"
        "# Replace with Supabase route / vehicle / stop queries"
    )

    pdf.section_title("11. Files")
    for item in [
        "pages/delivery/DeliveryListPage.tsx - KPIs, browse, route table",
        "pages/delivery/DeliveryDetailPage.tsx - six-tab operations console",
        "components/delivery/* - badges, browse, table, tabs, timeline",
        "App.tsx - /delivery and /delivery/:routeId routes",
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
        "# Open http://localhost:5173/delivery\n"
        "# RT-D14 - running, full stops + COD\n"
        "# RT-S08 - loading at warehouse\n"
        "# RT-N02 - cancelled / maintenance vehicle"
    )

    pdf.section_title("14. Out of Scope")
    for item in [
        "Supabase create route / assign / mark delivered / close mutations",
        "Live GPS tracking or map-based route editing",
        "Driver payroll, attendance, or fleet maintenance workflows",
        "Customer delivery rating capture (placeholder only)",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Intent")
    pdf.body_text(
        "Delivery Management should feel like a last-mile operations console for "
        "wholesale distribution: see which routes are running, what is on the "
        "vehicle, COD still outstanding, and how the day is performing - not a "
        "driver employee list."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
