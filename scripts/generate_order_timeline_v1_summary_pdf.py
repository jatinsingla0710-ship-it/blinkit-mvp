"""Generate GroAurum Customer Order Timeline v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Customer-Order-Timeline-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class OrderTimelinePdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Customer App - Order Timeline v1",
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
    pdf = OrderTimelinePdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Customer Order Timeline v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale order lifecycle from confirmation to delivery\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Aligned with Home / Restock / Review Order v1 · Phase 3 adapters ({PHASE3_COMMIT})",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "This is NOT a consumer rider-tracking screen. Retailers follow warehouse and "
        "route fulfilment stages for a confirmed wholesale order.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Show the complete lifecycle of a wholesale order from confirmation to delivery. "
        "Opened after Confirm Order on Review Order, or from the Orders list via /order/[id]."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional B2B, calm hierarchy, timeline-based",
        "GroAurum Design System and 8px spacing grid",
        "No marketing banners, coupons, or wallet",
        "Home, Restock, and Review Order screens were not redesigned",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Timeline States")
    rows = [
        ("Stage", "Explanation"),
        ("Order Confirmed", "Wholesale order confirmed and locked for fulfilment"),
        ("Stock Reserved", "Inventory reserved against this order"),
        ("Packing", "Warehouse packing SKUs to the packing list"),
        ("Ready for Dispatch", "Packed and waiting for route assignment"),
        ("Assigned to Route", "Assigned to a delivery route for the shop area"),
        ("Out for Delivery", "On the delivery vehicle to the shop"),
        ("Delivered", "Delivered to the shop"),
    ]
    widths = [50, 130]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.body_text(
        "Each stage shows status, timestamp when available, and a short explanation. "
        "Upcoming stages show Pending until reached."
    )

    pdf.add_page()
    pdf.section_title("4. Screen Sections")
    for item in [
        "Header - order id, current status, confirmation time",
        "Timeline - seven-stage wholesale fulfilment rail",
        "Shop summary - shop, delivery window, sales executive, warehouse",
        "Order items - SKU lines with qty, unit price, line total",
        "Payment summary - subtotal, fees, total, method, payment status",
        "Delivery information - address label, text, scheduled window",
        "Notes - optional retailer notes from Review Order",
        "Repeat Order CTA - opens Restock for a new draft",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. Repeat Order")
    pdf.body_text(
        "Repeat Order does not reopen the historical order. It navigates to the Restock "
        "tab so the retailer builds a new draft through the Restock flow."
    )
    pdf.mono_block("router.push('/(tabs)/restock')")

    pdf.section_title("6. Mock Lifecycle")
    for item in [
        "createOrder starts at CONFIRMED with statusHistory stamped",
        "Simulator advances through all seven stages (~2.8s each)",
        "Each transition appends a timestamped statusHistory event",
        "Restock seed order is DELIVERED with a completed history",
        "Review Order notes, shop name, sales executive, and schedule are stored on the order",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Files")
    for item in [
        "apps/customer/app/order/[id].tsx - Order Timeline v1 screen",
        "apps/customer/components/order-timeline/* - header, rail, sections, CTA",
        "apps/customer/services/order-timeline.ts - stages, labels, builders",
        "apps/customer/services/mock/orders.ts - B2B status flow + history",
        "apps/customer/types/index.ts - expanded OrderStatus + statusHistory",
        "apps/customer/app/_layout.tsx - stack title Order",
        "apps/customer/app/cart.tsx - passes notes/shop fields into createOrder",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("8. Status Mapping")
    pdf.body_text(
        "Customer UI OrderStatus aligns to the wholesale timeline (not legacy "
        "PLACED / PACKING / OUT_FOR_DELIVERY only):"
    )
    pdf.mono_block(
        "CONFIRMED\n"
        "STOCK_RESERVED\n"
        "PACKING\n"
        "READY_FOR_DISPATCH\n"
        "ASSIGNED_TO_ROUTE\n"
        "OUT_FOR_DELIVERY\n"
        "DELIVERED"
    )

    pdf.section_title("9. Validation")
    rows2 = [
        ("Check", "Result"),
        ("Customer app typecheck (tsc --noEmit)", "Pass"),
        ("Home / Restock / Review Order layouts", "Unchanged"),
        ("Rider progress UI", "Removed from order detail"),
    ]
    w2 = [110, 70]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("10. How to Review")
    pdf.mono_block(
        "pnpm dev:customer\n"
        "# Review Order -> Confirm Order\n"
        "# Opens /order/[id] Order Timeline\n"
        "# Or Orders tab -> select an order\n"
        "# Repeat Order -> Restock tab"
    )

    pdf.section_title("11. Out of Scope")
    for item in [
        "Live map / rider GPS tracking",
        "Supabase order placement and live status events",
        "Payment gateway settlement",
        "Home / Restock / Review Order visual redesign",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Intent")
    pdf.body_text(
        "Order Timeline should feel like a calm B2B fulfilment record: confirmation, "
        "stock, packing, dispatch, route, delivery - not a Blinkit-style live rider chase."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
