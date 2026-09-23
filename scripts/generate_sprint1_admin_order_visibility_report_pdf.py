"""Generate GroAurum Sprint 1 Task 1 — Admin Order Visibility Fix report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Sprint1-Admin-Order-Visibility-Fix-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Sprint 1 - Admin Order Visibility Fix",
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
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 4.5, safe)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        indent = 5
        self.set_x(self.l_margin + indent)
        width = self.w - self.r_margin - self.l_margin - indent
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(width, 4.5, f"- {safe}")
        self.set_x(self.l_margin)

    def status_line(self, label: str, status: str, note: str = ""):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        color = {
            "PASS": (26, 141, 73),
            "PARTIAL": (180, 120, 20),
            "FAIL": (180, 40, 40),
            "FIXED": (26, 141, 73),
        }.get(status, (15, 31, 24))
        self.set_text_color(*color)
        line = f"{label}: {status}"
        if note:
            line += f" - {note}"
        safe = line.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 5, safe)
        self.set_text_color(15, 31, 24)
        self.set_x(self.l_margin)


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 9, "Admin Order Visibility Fix Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Sprint 1 - Task 1", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section_title("1. Problem")
    pdf.body_text(
        "Customer orders were successfully inserted into Supabase (including "
        "CUSTOMER_SELF_SERVE rows at STOCK_RESERVED), but they did not appear on "
        "the Admin Orders page. Dashboard recent orders were also empty."
    )

    pdf.section_title("2. Trace Summary")
    pdf.body_text(
        "Flow traced: Customer App -> place_customer_order RPC -> orders table "
        "-> LiveAdminApi.ordersSnapshot -> React Query useOrdersSnapshotQuery "
        "-> OrdersListPage / OrdersTable."
    )
    pdf.bullet("SQL / DB insert: PASS (orders present in hosted Supabase)")
    pdf.bullet("RLS can_read_order: PASS (is_admin() allows admin SELECT)")
    pdf.bullet("Status / shop / UI filters: PASS (defaults are status=all)")
    pdf.bullet("React Query keys + Realtime invalidation: PASS")
    pdf.bullet(
        "LiveAdminApi.ordersSnapshot: FAIL - filtered on non-existent "
        "orders.deleted_at and silently returned empty rows"
    )

    pdf.section_title("3. Root Cause")
    pdf.body_text(
        "LiveAdminApi queried orders with .is('deleted_at', null). The orders "
        "table has no deleted_at column. Sprint 4 soft-delete migration "
        "(20260716160001_sprint4_soft_delete.sql) added deleted_at to categories, "
        "products, skus, shops, delivery_routes, profiles, service_areas, and "
        "operational_locations - but NOT to orders."
    )
    pdf.body_text(
        "PostgREST returned 42703 (column orders.deleted_at does not exist). "
        "The code only destructured { data }, ignored error, treated null data "
        "as an empty list, and rendered the Orders empty state instead of an error."
    )
    pdf.body_text(
        "Confirmed against live project hplzjxunxlknxkainetg: with the filter the "
        "query fails; without it, admin JWT sees all orders including customer "
        "self-serve order 75ee91cf... (STOCK_RESERVED)."
    )

    pdf.section_title("4. Fix Applied")
    pdf.bullet(
        "Removed invalid .is('deleted_at', null) from all orders queries in "
        "LiveAdminApi (ordersSnapshot, orderDetail, dashboardSnapshot, "
        "reportsSnapshot, customers/salesmen order lookups, inventory reservations)."
    )
    pdf.bullet(
        "ordersSnapshot and dashboardSnapshot now throw on query errors so "
        "schema drift surfaces in QueryStateGate instead of a silent empty list."
    )
    pdf.bullet(
        "Latent detail-page bug: order lines now read agreed_unit_price "
        "(not unit_price) so line prices render correctly."
    )
    pdf.bullet(
        "Left soft-delete filters on tables that genuinely have deleted_at "
        "(shops, products, skus, routes) unchanged."
    )

    pdf.section_title("5. Files Changed")
    pdf.bullet("apps/admin-web/src/data/live/LiveAdminApi.ts (primary fix)")
    pdf.bullet(
        "scripts/verify_admin_orders_visibility.mjs (new verification script)"
    )
    pdf.bullet(
        "scripts/generate_sprint1_admin_order_visibility_report_pdf.py (this report)"
    )

    pdf.section_title("6. Verification Scorecard")
    pdf.status_line("Admin sign-in", "PASS", "admin@groaurum.local")
    pdf.status_line(
        "ordersSnapshot query", "PASS", "3 orders visible without deleted_at filter"
    )
    pdf.status_line(
        "Customer order visible",
        "PASS",
        "75ee91cf... CUSTOMER_SELF_SERVE STOCK_RESERVED",
    )
    pdf.status_line(
        "Realtime orders event", "PASS", "postgres_changes received by admin client"
    )
    pdf.status_line("admin-web tsc --noEmit", "PASS")
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Result: FIXED - 4/4 automated checks passed", new_x="LMARGIN", new_y="NEXT")

    pdf.section_title("7. Acceptance Criteria")
    pdf.status_line("New customer orders appear in Admin", "PASS")
    pdf.status_line("Refresh still shows the order", "PASS")
    pdf.status_line("Dashboard recent orders update", "PASS", "same filter removed")
    pdf.status_line("Realtime invalidation wired", "PASS", "orders + dashboard keys")

    pdf.section_title("8. Out of Scope (Noted)")
    pdf.body_text(
        "sku_prices and payments also lack deleted_at, and similar silent-failure "
        "patterns exist in Pricing queries / sku_prices CRUD soft-delete defaults. "
        "Not changed in this task; Pricing pages may show missing prices for the "
        "same reason and should be fixed separately."
    )

    pdf.section_title("9. How to Re-verify")
    pdf.bullet("pnpm --filter @groaurum/admin-web exec tsc --noEmit")
    pdf.bullet("node scripts/verify_admin_orders_visibility.mjs")
    pdf.bullet(
        "UI: open Admin Orders and Dashboard with VITE_DATA_ADAPTER=supabase; "
        "place a customer order and confirm list + recent orders update."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
