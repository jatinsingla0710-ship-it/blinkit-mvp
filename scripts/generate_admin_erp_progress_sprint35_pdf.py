"""Generate GroAurum Admin ERP progress summary PDF (through Sprint 3.5).

Writes:
  - docs/GroAurum-Admin-ERP-Progress-Through-Sprint-3.5.pdf  (repo)
  - Desktop/groaurum-app.pdf  (copy for sharing)
"""

from datetime import date
from pathlib import Path
import shutil

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-ERP-Progress-Through-Sprint-3.5.pdf"
DESKTOP_COPY = Path.home() / "Desktop" / "groaurum-app.pdf"


class ProgressPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin ERP - Progress Summary (through Sprint 3.5)",
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


def build_pdf() -> None:
    pdf = ProgressPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(18)
    pdf.cell(0, 10, "GroAurum Admin ERP", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "Application Progress Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        7,
        "Through Sprint 3.5 - Smart Order Workflow Automation",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, f"Generated {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    pdf.section_title("1. What this document covers")
    pdf.body_text(
        "Stakeholder summary of GroAurum Admin ERP order operations after Sprint 3.5. "
        "Focus: fewer admin clicks, automatic timeline, delivery PWA status updates, "
        "and a single next-action button on Order Details."
    )

    pdf.section_title("2. Sprint 3.5 objective")
    pdf.body_text(
        "Redesign the Orders workflow so the system advances the order lifecycle "
        "whenever possible. Admins complete an order with the fewest actions."
    )
    pdf.bullet("Timeline is history only (read-only, automatic).")
    pdf.bullet("Only one primary action is shown at a time (Action Panel).")
    pdf.bullet("Delivery PWA auto-updates Out For Delivery and Delivered.")
    pdf.bullet("Payment unlocks Convert To Sale.")
    pdf.bullet("Invoice: seller left / buyer right; no salesman; no GST.")

    pdf.section_title("3. Operator path (typical)")
    pdf.mono_block(
        "Confirm Order\n"
        "  -> Print Invoice  (auto: invoice printed + timeline)\n"
        "  -> Pack Order     (auto: Packed / Ready for Dispatch)\n"
        "  -> Assign Delivery Boy  (auto: Assigned + route)\n"
        "  -> [Driver starts route]  auto Out For Delivery\n"
        "  -> [Driver confirms]      auto Delivered\n"
        "  -> Receive Payment        unlocks Convert To Sale\n"
        "  -> Convert To Sale        sale + final PDF + Completed"
    )

    pdf.section_title("4. What admin no longer clicks")
    pdf.bullet("Manual timeline stage buttons (Confirm/Pack/OFD/Delivered/etc. as a chain).")
    pdf.bullet("Out For Delivery (Delivery PWA starts the route).")
    pdf.bullet("Confirm Delivery from admin (Delivery PWA completes the stop).")
    pdf.bullet("Scattered multi-button toolbar on Order Details.")

    pdf.section_title("5. Action Panel states")
    pdf.bullet("Pending -> Confirm Order")
    pdf.bullet("Confirmed -> Print Invoice")
    pdf.bullet("Invoice Printed -> Pack Order")
    pdf.bullet("Packed -> Assign Delivery Boy")
    pdf.bullet("Assigned -> Waiting for Driver (no button)")
    pdf.bullet("Out For Delivery -> Waiting for delivery confirmation")
    pdf.bullet("Delivered (unpaid) -> Receive Payment")
    pdf.bullet("Paid -> Convert To Sale")
    pdf.bullet("Completed -> no workflow button")

    pdf.section_title("6. Invoice & print")
    pdf.bullet("Header ~10%: Seller (logo, company, address, phone, email) | Buyer details.")
    pdf.bullet("Salesman removed from invoice.")
    pdf.bullet("GST removed (subtotal / discount / grand total only).")
    pdf.bullet("Sizes: A4, A5, A6, Thermal. Preview matches print; multi-page when needed.")

    pdf.section_title("7. Performance")
    pdf.bullet("React Query optimistic updates on confirm, print, pack, assign, pay, convert.")
    pdf.bullet("Background refetch after mutations - no full page reload.")

    pdf.section_title("8. How to run")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "Open http://localhost:5173/ -> Orders -> open an order\n"
        "Use the Action Panel for the next step only"
    )
    pdf.body_text(
        "Trusted workflow RPCs (Sprint 3.4) remain required: "
        "admin_advance_order_to, admin_assign_order_delivery, admin_mark_payment_received. "
        "If DB is behind: pnpm db:start && pnpm db:reset."
    )

    pdf.section_title("9. Acceptance checklist")
    for item in [
        "Timeline fully automatic and read-only",
        "Admin does not click every workflow stage",
        "Only one primary action at a time",
        "Delivery PWA updates delivery status",
        "Payment unlocks Convert To Sale",
        "Cleaner Order Details + improved invoice",
        "Fewer clicks / production-ready wholesale flow",
    ]:
        pdf.bullet(f"[x] {item}")

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4,
        "Repo copy: docs/GroAurum-Admin-ERP-Progress-Through-Sprint-3.5.pdf  |  "
        "Desktop copy: groaurum-app.pdf",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    shutil.copy2(OUTPUT, DESKTOP_COPY)
    print(f"Wrote {OUTPUT}")
    print(f"Copied to {DESKTOP_COPY}")


if __name__ == "__main__":
    build_pdf()
