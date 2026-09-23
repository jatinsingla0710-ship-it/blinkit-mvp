"""Generate GroAurum Admin ERP progress summary PDF (through Sprint 3.4)."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-ERP-Progress-Through-Sprint-3.4.pdf"


class ProgressPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin ERP - Progress Summary (through Sprint 3.4)",
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
        safe = title.encode("latin-1", "replace").decode("latin-1")
        self.cell(0, 7, safe, new_x="LMARGIN", new_y="NEXT")
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

    def mono_block(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 8)
        self.set_text_color(15, 31, 24)
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 4, safe)
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
            safe = col.encode("latin-1", "replace").decode("latin-1")
            self.multi_cell(w, 4.5, safe, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 5
        x0 = self.l_margin
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)


def build_pdf() -> None:
    pdf = ProgressPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    # Cover
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(18)
    pdf.cell(0, 10, "GroAurum Admin ERP", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(
        0,
        8,
        "Application Progress Summary",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        7,
        "What we built through Sprint 3.4 (Orders Workflow & Invoice System)",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"Generated: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, "Audience: Product / Ops / Engineering", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, "Stack: Vite Admin Web + Supabase (live data) + React Query", new_x="LMARGIN", new_y="NEXT")

    # 1. Product overview
    pdf.section_title("1. What GroAurum Admin Is")
    pdf.body_text(
        "GroAurum Admin is the wholesale operations console for dry-fruit / kirana B2B. "
        "Owners and ops staff manage catalogue, customers, orders, delivery, salesmen, "
        "inventory, pricing, reports, and settings. Recent sprints focused on turning "
        "Orders into a full operational workflow with invoices and Convert-to-Sale."
    )
    pdf.bullet("App path: apps/admin-web (Vite + React + React Query)")
    pdf.bullet("Live data: Supabase Postgres + RLS (no mock business metrics in live mode)")
    pdf.bullet("Auth: Admin module guards (orders, customers, products, delivery, ...)")
    pdf.bullet("Dev: pnpm dev:admin -> http://localhost:5173/")

    # 2. Modules map
    pdf.section_title("2. Admin Modules Built (Map)")
    widths = [42, 70, 58]
    pdf.table_row(["Module", "What it does", "Status"], widths, header=True)
    rows = [
        ["Dashboard", "Control center KPIs, attention, activity", "Live (Sprint 2.x)"],
        ["Orders", "Workflow, invoice, delivery assign, sale", "Live (Sprint 3.1-3.4)"],
        ["Sales", "Converted sale invoices register", "Live (linked to Orders)"],
        ["Customers", "Shops, activation, addresses, activity", "Live foundation"],
        ["Products / Categories", "Catalogue, SKUs, publish checklist", "Live foundation"],
        ["Pricing", "SKU prices, schedule, history", "Live foundation"],
        ["Inventory", "Balances, movements, reservations", "Live foundation"],
        ["Salesmen", "Team, visits, collections views", "Live foundation"],
        ["Delivery", "Routes, stops, performance", "Live foundation"],
        ["Reports / Settings", "Analytics placeholders + company config", "Live foundation"],
    ]
    for r in rows:
        pdf.table_row(r, widths)

    # 3. Recent sprint focus
    pdf.add_page()
    pdf.section_title("3. Recent Sprint Focus (What Changed Most)")
    pdf.body_text(
        "The last stretch of work upgraded the Dashboard and completed the Orders "
        "operational lifecycle: packing, delivery assignment, invoice printing, "
        "payment, and Convert to Sale - all on live Supabase data."
    )

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Sprint 2.1 / 2.2 - Dashboard", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet("Quick Actions, Operations at a Glance, Attention Required, Recent Activity")
    pdf.bullet(
        "Six executive KPIs: Monthly Revenue, Pending Orders, Salesmen Present, "
        "Delivery Men Working, Active Routes Today, Today's Sales Not Yet Received"
    )
    pdf.bullet("Orders deep-links via presets (?preset=..., ?payment=...)")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Sprint 3.1 - Orders Module Redesign", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet("Orders list: summary cards, table, search/filter/sort/pagination")
    pdf.bullet("Order detail: overview, items, timeline, payment, delivery, invoice, activity")
    pdf.bullet("LiveAdminApi ordersSnapshot / orderDetail / assignOrderDelivery")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Sprint 3.2 / 3.3 - Workflow & Invoice", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet("In Transit Progress card (e.g. 5 / 17 Delivered)")
    pdf.bullet("Compact header search (order no / customer / mobile)")
    pdf.bullet("Multi-size invoice: A4, A5, A6, Thermal + Print Preview + PDF filename")
    pdf.bullet("Convert to Sale action; Sales section /sales for converted invoices")
    pdf.bullet("GST removed from order totals and invoice layouts")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Sprint 3.4 - Final Workflow + Trusted RPCs", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet(
        "Full lifecycle timeline: Create -> Confirm -> Print Invoice -> Packed -> "
        "Assign Delivery Boy -> Out For Delivery -> Delivered -> Payment Received -> "
        "Convert To Sale"
    )
    pdf.bullet("sales / sale_items / sales_payments tables + orders.sale_id")
    pdf.bullet(
        "Trusted server RPCs (no direct client status updates): "
        "admin_advance_order_to, admin_assign_order_delivery, admin_mark_payment_received"
    )

    # 4. Order workflow
    pdf.section_title("4. Order Lifecycle (Current Business Process)")
    pdf.mono_block(
        "Create Order\n"
        "   |\n"
        "Confirm Order\n"
        "   |\n"
        "Print Invoice\n"
        "   |\n"
        "Packed  (Ready for Dispatch)\n"
        "   |\n"
        "Assign Delivery Boy\n"
        "   |\n"
        "Out For Delivery\n"
        "   |\n"
        "Delivered   (DB requires payment PAID first)\n"
        "   |\n"
        "Payment Received\n"
        "   |\n"
        "Convert To Sale (Completed)\n"
    )
    pdf.body_text(
        "Important invariant: Postgres enforces DELIVERED only when payment is PAID. "
        "Ops should use Payment Received before Confirm Delivery when needed. "
        "Convert to Sale requires Delivered + Paid and creates a sale invoice record "
        "without duplicating customer/product master data (line snapshots in sale_items)."
    )

    # 5. Invoice system
    pdf.section_title("5. Invoice System")
    pdf.bullet("Print sizes: A4 / A5 / A6 / Thermal (compact rows so A5/A6 fit ~10+ lines)")
    pdf.bullet("Print Preview dialog -> choose size -> Browser Print or Download PDF")
    pdf.bullet("Header (~10%): company left; buyer / salesman / seller / order / invoice right")
    pdf.bullet("Footer (~10%): authorized + customer signatures, terms, thank-you")
    pdf.bullet("Totals: Subtotal, Discount (if any), Grand Total - no GST rows")
    pdf.bullet("Final Print/PDF unlock after Convert to Sale; Preview available earlier")

    # 6. Security / data model
    pdf.add_page()
    pdf.section_title("6. Security & Data Model Notes")
    pdf.body_text(
        "Order status and payment trusted fields cannot be updated directly from the "
        "browser. A database trigger requires groaurum.trusted_server_action=true, "
        "which only SECURITY DEFINER RPCs set."
    )
    pdf.bullet("admin_advance_order_to - walks happy-path statuses, writes order_events + audit")
    pdf.bullet("admin_assign_order_delivery - creates/updates route stop + ASSIGNED_TO_ROUTE")
    pdf.bullet("admin_mark_payment_received - marks payment PAID (trusted)")
    pdf.bullet("Existing: update_order_status_admin, delivery_* RPCs for Delivery PWA")
    pdf.ln(1)
    pdf.body_text("Sales conversion schema (migrations Sprint 3.3 / 3.4):")
    pdf.bullet("sales - one row per converted order (invoice_number, totals, converted_at)")
    pdf.bullet("sale_items - immutable line snapshots from order_lines")
    pdf.bullet("sales_payments - payment link/snapshot for the sale")
    pdf.bullet("orders.sale_id <-> sales.order_id bidirectional reference")
    pdf.bullet("RLS: admin-only policies on sales tables")

    # 7. Key UI surfaces
    pdf.section_title("7. Key UI Surfaces to Click Through")
    widths2 = [55, 115]
    pdf.table_row(["Screen", "What to look for"], widths2, header=True)
    ui_rows = [
        ["/ (Dashboard)", "6 KPIs, attention, activity, quick actions"],
        ["/orders", "Summary cards, compact search, filters, table"],
        ["/orders/:id", "Workflow actions, timeline, delivery assign, invoice"],
        ["/sales", "Converted invoices only; preview/print/PDF links"],
        ["Invoice tab", "Size radios, Print Preview, PDF filename dialog"],
    ]
    for r in ui_rows:
        pdf.table_row(r, widths2)

    # 8. How to run / migrate
    pdf.section_title("8. How to Run Locally")
    pdf.mono_block(
        "pnpm db:start\n"
        "pnpm db:reset          # applies all migrations including sales + admin RPCs\n"
        "pnpm dev:admin         # Admin UI on :5173\n"
    )
    pdf.body_text(
        "If Convert to Sale or workflow actions fail with missing table / trusted_server_action "
        "errors, the local Supabase DB is behind - run db:reset (Docker Desktop must be running)."
    )

    # 9. Acceptance snapshot
    pdf.section_title("9. Acceptance Snapshot (Orders Track)")
    checks = [
        "In Transit Progress card shows delivered/total and opens in-transit preset",
        "Compact search by order / customer / mobile; no large Browse Orders block",
        "Automatic timeline stages with date, time, user, action",
        "Delivery assignment + OFD + Delivered via trusted RPCs",
        "Invoice A4/A5/A6/Thermal + Print Preview + editable PDF name",
        "No GST on invoice / order totals",
        "Convert to Sale creates sales + sale_items + sales_payments and links order",
        "Live Supabase data only in live adapter mode",
    ]
    for c in checks:
        pdf.bullet(f"[x] {c}")

    # 10. Next sense
    pdf.section_title("10. What This Means Going Forward")
    pdf.body_text(
        "Orders is now the operational backbone: from warehouse packing through delivery "
        "assignment, payment, invoice print, and sale completion. The Sales register is "
        "a thin converted-invoice view today; a fuller Sales module can build on the "
        "sales / sale_items tables without rewriting order line logic."
    )
    pdf.bullet("Keep all status changes on trusted RPCs - never reopen direct client updates")
    pdf.bullet("Apply migrations before demoing Convert to Sale on a fresh DB")
    pdf.bullet("Align ops training with: Pack -> Assign -> OFD -> Payment -> Deliver -> Sale")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
