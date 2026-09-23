"""Generate GroAurum Phase 2 completion summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase-2-Summary.pdf"
PHASE2_COMMIT = "fbcddb7"
PHASE1_COMMIT = "eb05c74"
CHECKPOINT = "18ee50a"


class Phase2PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 - Monorepo and Supabase B2B Schema",
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
    pdf = Phase2PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Phase 2 Completion Summary", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        f"Monorepo foundation + Supabase/PostgreSQL B2B schema\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Phase 2 commit: {PHASE2_COMMIT}",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Phase 2 scaffolds the pnpm/Turborepo monorepo and initial database schema. "
        "Customer screens still use the legacy mock adapter. Supabase cutover is Phase 3.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Phase 2 Goal")
    pdf.body_text(
        "Create the GroAurum monorepo foundation and initial Supabase/PostgreSQL schema, "
        "migrations, RLS foundation, and database type boundary while keeping the customer MVP runnable."
    )

    pdf.section_title("2. Foundation Cleanup")
    for item in [
        "Fixed ExternalLink.tsx with typed external href (http/https) - no ts-ignore",
        "Configured ESLint flat config in @groaurum/config",
        "Pre-move validation: typecheck, lint, test, Expo web export all passed",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Monorepo Structure")
    pdf.mono_block(
        "groaurum/\n"
        "  apps/customer/       Expo MVP (runnable, legacy mock)\n"
        "  apps/sales-pwa/      scaffold only\n"
        "  apps/delivery-pwa/   scaffold only\n"
        "  apps/admin-web/      scaffold only\n"
        "  packages/shared-types/  B2B domain + policies\n"
        "  packages/api-client/    service contracts\n"
        "  packages/validation/    schema tests\n"
        "  packages/config/        ESLint + TSConfig\n"
        "  supabase/migrations/    14 SQL migrations"
    )
    pdf.body_text("Tooling: pnpm workspaces + Turborepo (typecheck, lint, test, build)")

    pdf.section_title("4. Package Boundaries")
    rows = [
        ("Package", "Role"),
        ("@groaurum/shared-types", "Domain entities, enums, SKU helpers, transition policies"),
        ("@groaurum/api-client", "Service contracts; DB types pending generation"),
        ("@groaurum/validation", "Migration invariant tests (no live Supabase required)"),
        ("@groaurum/config", "Shared ESLint and tsconfig.base.json"),
        ("@groaurum/customer", "Expo app + legacy services/mock"),
    ]
    widths = [48, 132]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("5. Supabase Migrations (14 files)")
    for item in [
        "000 extensions + helpers (set_updated_at, normalize_mobile, prevent_modification)",
        "001 enums and domain helpers",
        "002 profiles (auth.users link)",
        "003 service_areas, serviceability_rules, operational_locations",
        "004 shops, contacts, invitations, auth links, salesman assignments",
        "005 catalogue (categories, products, skus, sku_prices) - empty by default",
        "006 inventory balances, movements, stock reservations",
        "007 orders, snapshot order_lines, events, confirmation challenges",
        "008 payments/events - zero credit model",
        "009 delivery routes, stops, attempts",
        "010 audit_logs append-only",
        "011 business invariant triggers",
        "012 RLS enable on business tables",
        "013 role-scoped RLS policies",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("6. Schema Highlights")
    for item in [
        "ServiceArea is primary entity; PIN/ADMIN_AREA/POLYGON rules are extensible",
        "Empty catalogue is valid - no product seeds in migrations",
        "product_type and selling_unit as text for extensibility",
        "Order status separate from payment status",
        "Order lines preserve commercial snapshots at confirmation",
        "otp_hash only - no plaintext OTP storage",
        "Inventory movements and audit logs are append-only",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Business Invariants (Database)")
    for item in [
        "DELIVERED requires payment status PAID (trigger)",
        "Confirmed order line snapshots immutable after confirmation",
        "sku_prices append-only (price history preserved)",
        "No CREDIT payment method - PAY_ONLINE_NOW and PAY_ON_DELIVERY only",
        "Trusted workflow writes require server session flag (not client-direct)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. RLS Model")
    pdf.body_text(
        "RLS enabled and forced on business tables. Policies scoped by CUSTOMER, "
        "SALESMAN, DELIVERY, and ADMIN roles. No permissive USING(true) on sensitive tables."
    )

    pdf.section_title("9. Generated DB Type Status")
    pdf.body_text(
        "Database types are NOT committed in Phase 2. Supabase CLI was not available locally. "
        "After supabase start, run:"
    )
    pdf.mono_block(
        "supabase gen types typescript --local >\n"
        "  packages/api-client/src/database.generated.ts"
    )

    pdf.section_title("10. Validation Results")
    rows2 = [
        ("Command", "Result"),
        ("pnpm typecheck", "Pass (all workspaces)"),
        ("pnpm lint", "Pass"),
        ("pnpm test", "Pass - 14 domain + 9 schema tests"),
        ("pnpm --filter @groaurum/customer build", "Pass - Expo web export, 14 routes"),
    ]
    w2 = [55, 125]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. What Phase 2 Did NOT Do")
    for item in [
        "No Supabase connection in customer screens",
        "No mock replacement (Phase 3)",
        "No Sales/Delivery/Admin feature UI",
        "No payment gateway or SMS/OTP delivery",
        "No hard-coded launch products",
        "No generated database types committed",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Git History")
    pdf.mono_block(
        f"{CHECKPOINT} checkpoint: preserve original customer MVP\n"
        f"{PHASE1_COMMIT} feat: add GroAurum B2B domain and service boundaries\n"
        f"{PHASE2_COMMIT} feat: scaffold monorepo and Supabase B2B schema"
    )

    pdf.section_title("13. Run Customer App")
    pdf.mono_block("pnpm install\npnpm dev:customer")

    pdf.section_title("14. Next Step (Phase 3 - not started)")
    pdf.body_text(
        "Replace not-implemented adapters with Supabase-backed implementations. "
        "Gate customer flows on shop auth and service area. Still no UI redesign."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
