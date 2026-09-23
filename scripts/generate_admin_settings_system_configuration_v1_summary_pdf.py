"""Generate GroAurum Admin Settings & System Configuration v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Settings-System-Configuration-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class SettingsPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Settings & System Configuration v1",
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
    pdf = SettingsPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(
        0,
        9,
        "Admin Settings & System Configuration v1",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Business configuration center for wholesale operations\n"
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
        "This is NOT a generic settings page. Operators configure company identity, "
        "warehouses, coverage, payments, taxes, roles, and system preferences.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Provide a Business Configuration Center inside the GroAurum Admin shell. "
        "Sidebar navigation is unchanged; Settings replaces the placeholder module. "
        "Focus is system-wide wholesale operating policy - not personal account prefs."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS / ERP, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "Typed fixtures only - no backend mutations in v1",
        "Reusable settings components per configuration domain",
        "Do not redesign prior modules",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Quick Actions")
    pdf.body_text("Route: /settings")
    for item in [
        "Update Company",
        "Add Warehouse",
        "Add Service Area",
        "Manage Roles",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI stubs in v1 - they focus related tabs. Mutations deferred."
    )

    pdf.section_title("4. Configuration Sections")
    rows = [
        ("Section", "Contents"),
        (
            "Company Profile",
            "Name, GST, PAN, email, phone, logo, business address",
        ),
        (
            "Warehouses",
            "Name, code, address, manager, status; Add / Edit / Disable",
        ),
        (
            "Service Areas",
            "Area, city, delivery days, slots, status",
        ),
        (
            "Delivery Slots",
            "Morning, Afternoon, Evening, Custom Slot",
        ),
        (
            "Payments",
            "COD, Online enabled; Credit disabled; gateway placeholder",
        ),
        (
            "Notifications",
            "SMS, WhatsApp, Push, Email templates - view only",
        ),
        (
            "Taxes",
            "GST %, HSN code, category mapping",
        ),
        (
            "User Roles",
            "Super Admin, Ops, Warehouse, Sales, Delivery, Read Only",
        ),
        (
            "Preferences",
            "Currency, timezone, date format, language",
        ),
    ]
    widths = [40, 140]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("5. User Roles")
    for item in [
        "Super Admin - full system configuration",
        "Operations Manager - orders, delivery, customers",
        "Warehouse Manager - inventory and packing",
        "Sales Manager - salesmen and retail coverage",
        "Delivery Manager - routes and COD closeout",
        "Read Only - dashboards and reports",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Payment Configuration")
    for item in [
        "COD - enabled",
        "Online - enabled",
        "Credit - disabled (wholesale default)",
        "Payment gateway credentials - future placeholder",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/settings-types.ts\n"
        "apps/admin-web/src/data/settings-fixtures.ts\n"
        "# SETTINGS_SNAPSHOT_FIXTURE\n"
        "# Replace with Supabase org / warehouse / policy settings"
    )

    pdf.section_title("8. Files")
    for item in [
        "pages/settings/SettingsPage.tsx - quick actions + nine section tabs",
        "components/settings/* - profile, warehouses, areas, slots, payments, taxes, roles",
        "App.tsx - /settings route",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Validation")
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

    pdf.section_title("10. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/settings\n"
        "# Company Profile - GST / PAN / address\n"
        "# Warehouses - Okhla active, Gurugram disabled\n"
        "# Payments - COD + Online on, Credit off\n"
        "# Notifications - view only templates"
    )

    pdf.section_title("11. Out of Scope")
    for item in [
        "Supabase create / update / disable mutations",
        "Logo upload and document storage",
        "Payment gateway credential entry and live toggles",
        "Notification template editing / send tests",
        "Fine-grained ACL editor beyond role list",
        "Standalone /service-areas module (still placeholder; configured here)",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Intent")
    pdf.body_text(
        "Settings should feel like a wholesale ERP configuration center: company "
        "identity, warehouse network, delivery coverage, payment policy, tax "
        "mapping, and operator roles - not a consumer app preference screen."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
