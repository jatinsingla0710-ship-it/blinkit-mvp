"""Generate GroAurum Phase 2.5 database proof summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase-2.5-Summary.pdf"
PHASE25_INFRA_COMMIT = "726e175"
PHASE25_COMPLETE_COMMIT = "ca2967b"
PHASE2_COMMIT = "fbcddb7"
PHASE1_COMMIT = "eb05c74"
CHECKPOINT = "18ee50a"


class Phase25PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2.5 - Database Proof",
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
    pdf = Phase25PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Phase 2.5 Completion Summary", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        f"Database proof: integration tests, RLS validation, local Supabase workflow\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Live proof commit: {PHASE25_COMPLETE_COMMIT}",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Phase 2.5 proves the Supabase/PostgreSQL schema with live integration tests and "
        "local tooling. Customer screens still use the legacy mock adapter. Phase 3 not started.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Phase 2.5 Goal")
    pdf.body_text(
        "Validate the Phase 2 schema against a real local Supabase/PostgreSQL environment: "
        "apply migrations, generate database types, test business invariants, and prove RLS "
        "role boundaries. Validation and correction only - no customer Supabase wiring."
    )

    pdf.section_title("2. What Was Added")
    for item in [
        "@groaurum/db-tests - live PostgreSQL + Supabase Auth integration test package",
        "Root scripts: db:start, db:stop, db:reset, db:status, db:types, test:db, db:proof",
        "scripts/check-db-prerequisites.mjs - Docker/local Supabase/production URL guards",
        "scripts/generate-db-types.mjs - CLI-generated database.generated.ts workflow",
        "Migration 014 - trusted sku_prices row closure (append-only price history fix)",
        "Migration 015 - API role grants for PostgREST authenticated/anon clients",
        "docs/architecture/phase-2.5-database-proof.md",
        ".env.test.example - safe local test configuration template",
        "supabase as project devDependency (pnpm exec supabase)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Local Tooling Status")
    rows = [
        ("Tool", "Status"),
        ("Node.js", "v24.15.0 - available"),
        ("pnpm", "9.15.4 - available"),
        ("Supabase CLI", "Available via pnpm exec supabase"),
        ("Docker Desktop", "Reachable - Engine 29.6.1 (local Supabase verified)"),
    ]
    widths = [48, 132]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.body_text(
        "Live database proof completed: pnpm db:start, pnpm db:reset, pnpm db:types, "
        "and pnpm test:db (34/34) all passed against local PostgreSQL."
    )

    pdf.section_title("4. Local Supabase Commands")
    pdf.mono_block(
        "pnpm db:start     # start local stack\n"
        "pnpm db:reset     # clean replay migrations 000-015\n"
        "pnpm db:status    # local URLs and keys\n"
        "pnpm db:types     # generate database.generated.ts\n"
        "pnpm test:db      # integration + RLS tests\n"
        "pnpm db:proof     # reset + types + tests"
    )

    pdf.section_title("5. Migration Corrections")
    pdf.body_text("014 - sku_prices trusted row closure:")
    for item in [
        "Blocked: mutating trade_price, sku_id, or other commercial fields on sku_prices",
        "Allowed (trusted only): setting effective_to to close the open row before new insert",
        "Replaces blanket prevent_modification UPDATE trigger on sku_prices",
    ]:
        pdf.bullet(item)
    pdf.body_text("015 - API role grants:")
    for item in [
        "Grants authenticated/anon table privileges required for PostgREST clients",
        "Fixes permission denied for table despite RLS policies being present",
        "RLS still enforces row scope; grants only enable client access to tables",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("6. Database Invariant Tests")
    for item in [
        "Empty catalogue - zero categories/products/skus/prices is valid",
        "DELIVERED requires PAID - UNPAID rejected; PAID allowed via trusted workflow",
        "Order snapshot immutability - commercial fields locked after CONFIRMED",
        "Price history append-only - UPDATE/DELETE on trade fields rejected; new row for new price",
        "Inventory movement append-only - UPDATE and DELETE rejected",
        "Audit log append-only - UPDATE and DELETE rejected",
        "Zero credit - no CREDIT enum; invalid payment intent insert fails",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. RLS Behaviour Tests")
    pdf.body_text("Tests use real authenticated Supabase clients - not SQL text presence only.")
    for item in [
        "CUSTOMER: read linked shop/orders; cannot read other customers; no price/order status writes",
        "SALESMAN: assigned shop access only; cannot mark DELIVERED; no payment completion writes",
        "DELIVERY: assigned route access only; cannot change prices or order totals; no DELIVERED bypass",
        "ADMIN: catalogue writes allowed; append-only protections still apply on sku_prices",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Mobile Normalization and Shop Linking")
    pdf.body_text("Canonical stored format: E.164 +91XXXXXXXXXX")
    rows2 = [
        ("Input", "Canonical"),
        ("9876543210", "+919876543210"),
        ("+91 98765 43210", "+919876543210"),
        ("919876543210", "+919876543210"),
        ("09876543210", "+919876543210"),
    ]
    w2 = [55, 125]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)
    pdf.ln(2)
    pdf.body_text(
        "shop_auth_links enforces one active shop per auth user (unique on auth_user_id). "
        "OTP activation service not implemented - database proof only."
    )

    pdf.section_title("9. Service Area Schema Proof")
    for item in [
        "Active and inactive service_areas accepted",
        "PIN_CODE rules require config.pinCodes array with entries",
        "ADMIN_AREA rules require config.areaCodes array with entries",
        "Invalid/empty rule configs rejected by CHECK constraints",
        "Test fixtures only - no production Gurugram seeds committed",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Trusted Workflow Test Context")
    pdf.mono_block(
        "SET LOCAL groaurum.trusted_server_action = 'true';\n"
        "-- order status, payment completion, sku_prices effective_to closure"
    )
    pdf.body_text(
        "Tests use withTrusted() helper - same session flag intended for SECURITY DEFINER RPCs."
    )

    pdf.add_page()
    pdf.section_title("11. Generated DB Type Status")
    pdf.body_text(
        "database.generated.ts is CLI-generated and committed after successful pnpm db:types "
        "against the live local schema. No handwritten types labelled as generated."
    )
    pdf.mono_block(
        "pnpm db:start\n"
        "pnpm db:reset\n"
        "pnpm db:types"
    )

    pdf.section_title("12. Validation Results")
    rows3 = [
        ("Command", "Result"),
        ("pnpm typecheck", "Pass (all workspaces)"),
        ("pnpm lint", "Pass"),
        ("pnpm test", "Pass - 14 domain + 9 schema file tests"),
        ("pnpm test:db", "Pass - 34/34 live invariant + RLS tests"),
        ("pnpm db:reset", "Pass - migrations 000-015 clean replay"),
        ("pnpm --filter @groaurum/customer build", "Pass - Expo web export, 14 routes"),
    ]
    w3 = [62, 118]
    for i, row in enumerate(rows3):
        pdf.table_row(list(row), w3, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("13. Safety Guards")
    for item in [
        "GROAURUM_DB_TEST_ALLOWED=true required for database tests",
        "SUPABASE_DB_URL must target 127.0.0.1:54322 (local only)",
        "Remote supabase.co hosts rejected by prerequisite script",
        "No production credentials committed",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. What Phase 2.5 Did NOT Do")
    for item in [
        "No Supabase wiring in customer screens",
        "No mock adapter replacement (Phase 3)",
        "No Admin, Sales, or Delivery feature UI",
        "No payment gateway or SMS integration",
        "No hard-coded catalogue products",
        "Phase 3 not started",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Git History")
    pdf.mono_block(
        f"{CHECKPOINT} checkpoint: preserve original customer MVP\n"
        f"{PHASE1_COMMIT} feat: add GroAurum B2B domain and service boundaries\n"
        f"{PHASE2_COMMIT} feat: scaffold monorepo and Supabase B2B schema\n"
        f"{PHASE25_INFRA_COMMIT} test: prove Supabase schema invariants and RLS\n"
        f"{PHASE25_COMPLETE_COMMIT} test: complete live Supabase database proof"
    )

    pdf.section_title("16. Remaining Before Phase 3")
    for item in [
        "Implement Supabase-backed service adapters in @groaurum/api-client",
        "Replace mock adapter behind feature flag (customer screens)",
        "Wire shop auth and service area gating in customer flows",
        "OTP activation service (shop invitation to auth link)",
    ]:
        pdf.bullet(item)

    pdf.section_title("17. Next Step (Phase 3 - not started)")
    pdf.body_text(
        "Replace not-implemented adapters with Supabase-backed implementations. "
        "Gate customer flows on shop auth and service area. Customer screens still "
        "use legacy mock until Phase 3 cutover."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
