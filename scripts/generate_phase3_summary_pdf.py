"""Generate GroAurum Phase 3 customer adapter summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase-3-Summary.pdf"
PHASE3_COMMIT = "af9e616"
PHASE25_COMMIT = "ca2967b"
PHASE25_INFRA = "726e175"
PHASE2_COMMIT = "fbcddb7"
PHASE1_COMMIT = "eb05c74"
CHECKPOINT = "18ee50a"


class Phase3PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 3 - Customer Supabase Adapters",
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
    pdf = Phase3PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Phase 3 Completion Summary", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Customer data adapters: auth session, linked shop, serviceability, catalogue\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Phase 3 commit: {PHASE3_COMMIT}",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Phase 3 proves authenticated customer -> linked shop -> serviceability -> "
        "dynamic catalogue against local Supabase, while preserving the legacy mock "
        "adapter behind an explicit development flag. Phase 4 not started.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Phase 3 Goal")
    pdf.body_text(
        "Connect the existing customer Expo architecture to real Supabase-backed "
        "read/auth/shop/serviceability/catalogue adapters. Database remains source of "
        "truth. Customer UI may remain visually legacy. No invitation SMS, assisted-order "
        "OTP, payment gateway, Sales/Delivery/Admin features, or production catalogue seeds."
    )

    pdf.section_title("2. Adapter Selection")
    rows = [
        ("Mode", "Behavior"),
        ("mock (default)", "Legacy MVP: dark-store location + in-memory catalogue"),
        ("supabase", "Real anon client + RLS; empty catalogue stays empty"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)
    pdf.ln(2)
    pdf.mono_block("EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock|supabase")
    pdf.body_text(
        "Invalid values fail validation. Mode is logged in development only - never shown "
        "as a technical label to production customers."
    )

    pdf.section_title("3. Public Supabase Client Boundary")
    for item in [
        "createGroAurumSupabaseClient in @groaurum/api-client - typed Database access",
        "Expo may use EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY only",
        "Rejects postgresql:// URLs and service-role / secret keys",
        "Anon key is public by design; RLS enforces row access",
        "Local API URL in this repo: http://127.0.0.1:54421 (ports remapped for Windows)",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Auth Session Foundation")
    for item in [
        "Restore session on startup (getSession) and subscribe via onAuthStateChange",
        "Expose loading / authenticated / unauthenticated states; provide sign-out",
        "Local/dev path: signInWithEmailPassword against local Auth users",
        "Phone OTP request/verify throw clear not-configured errors (no fake SMS)",
        "Assisted-order confirmation OTP is a separate concept - not implemented",
        "Sign-out clears customer-specific React Query caches",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. Linked Shop Resolution")
    pdf.body_text(
        "resolveCustomerSession() never auto-creates shops or auth links. "
        "Invitation activation remains a later trusted workflow."
    )
    rows2 = [
        ("Phase", "Meaning"),
        ("AUTH_LOADING", "Session loading"),
        ("UNAUTHENTICATED", "No session"),
        ("AUTHENTICATED_NO_SHOP_LINK", "Auth OK, no shop_auth_links row"),
        ("LINKED_SHOP_LOADING", "Resolving link"),
        ("LINKED_SHOP_READY", "Shop + contacts loaded"),
        ("LINKED_SHOP_INACTIVE_OR_BLOCKED", "Inactive or blocked shop"),
        ("ERROR", "Load failure"),
    ]
    w2 = [70, 110]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("6. Serviceability Adapter")
    pdf.body_text(
        "Pure evaluator evaluateServiceabilityRules supports PIN_CODE and ADMIN_AREA. "
        "ADMIN_AREA matches shop.deliveryCity. Multiple matches: lowest displayOrder, then name. "
        "No polygon matching. No dark-store / nearest-hub radius logic in supabase mode."
    )
    rows3 = [
        ("Status", "When"),
        ("SERVICEABLE", "Active area + active matching rule"),
        ("NOT_SERVICEABLE", "No match / inactive area or rule"),
        ("INSUFFICIENT_ADDRESS_DATA", "No PIN / admin area"),
        ("UNSUPPORTED_RULE_TYPE", "Only POLYGON rules present"),
        ("ERROR", "Unexpected failure"),
    ]
    w3 = [55, 125]
    for i, row in enumerate(rows3):
        pdf.table_row(list(row), w3, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("7. Dynamic Catalogue Adapter")
    for item in [
        "Reads categories -> products -> skus -> sku_prices",
        "Only active categories/products/SKUs; category display_order respected",
        "Current price: effective_from <= now and (effective_to null or > now)",
        "Among matches: newest effective_from, then newest created_at",
        "SKU without current price is not orderable / not exposed",
        "Empty DB returns empty result - no demo product injection in supabase mode",
        "Malformed SKU rows skipped when safe; backend errors remain errors",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Customer Query Integration and Flow Gate")
    for item in [
        "Screens use @/services/customer-catalogue (not direct mock imports for catalogue)",
        "Query keys include customer scope: store id (mock) or shop id (supabase)",
        "CustomerFlowGate: mock uses location; supabase uses auth -> shop -> serviceability",
        "Minimal panels: sign-in, awaiting activation, shop unavailable, not serviceable, error",
        "Empty catalogue shown as empty state; backend error as error state",
        "Checkout blocked in supabase mode (order placement deferred)",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Legacy Dark-Store Isolation")
    for item in [
        "findNearestStore / store radius do not gate catalogue in supabase mode",
        "/location redirects away when adapter is supabase",
        "Location store skips geo matching outside mock mode",
        "Dark-store code retained under services/mock/geo.ts for mock-only development",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Test Fixtures")
    pdf.body_text(
        "supabase/fixtures/phase3_dev_fixtures.sql is test/development only. "
        "Not wired as seed.sql. Not presented as GroAurum launch catalogue. "
        "Live integration tests also insert ephemeral fixtures via db-tests helpers."
    )

    pdf.add_page()
    pdf.section_title("11. Tests Added")
    for item in [
        "api-client unit: adapter mode validation, effective price selection, serviceability rules",
        "db-tests live: unauthenticated, no shop link, own shop only, inactive shop",
        "db-tests live: PIN match serviceable; inactive area/rule not serviceable; insufficient data",
        "db-tests live: unpriced SKU not exposed; priced SKU visible; inactive category hides products",
        "Preserved all prior Phase 2.5 invariant and RLS tests",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Validation Results")
    rows4 = [
        ("Command", "Result"),
        ("pnpm typecheck", "Pass (all workspaces)"),
        ("pnpm lint", "Pass"),
        ("pnpm test", "Pass - 14 shared-types + 15 api-client + 9 validation"),
        ("pnpm test:db", "Pass - 44/44 (incl. 10 Phase 3 adapter tests)"),
        ("pnpm --filter @groaurum/customer build", "Pass - Expo web export"),
        ("Mock mode", "Default adapter; location -> catalogue path preserved"),
        ("Supabase mode", "Live adapters under RLS; empty catalogue stays empty"),
    ]
    w4 = [70, 110]
    for i, row in enumerate(rows4):
        pdf.table_row(list(row), w4, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("13. Local Ports (Windows)")
    pdf.body_text(
        "Default Supabase ports 54321-54341 overlapped a Windows Hyper-V reserved range "
        "on this host. Local stack remapped in supabase/config.toml:"
    )
    pdf.mono_block(
        "API    http://127.0.0.1:54421\n"
        "DB     postgresql://...@127.0.0.1:54422/postgres\n"
        "Studio http://127.0.0.1:54423\n"
        "Analytics disabled locally (not required for Phase 3)"
    )

    pdf.section_title("14. What Phase 3 Did NOT Do")
    for item in [
        "No invitation activation / SMS provider integration",
        "No assisted-order confirmation OTP",
        "No payment gateway",
        "No Supabase order placement",
        "No customer UI redesign / TradeFlow / Restock",
        "No Sales PWA, Delivery PWA, or full Admin UI",
        "No production Gurugram or launch catalogue seeds",
        "Phase 4 not started",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Git History")
    pdf.mono_block(
        f"{CHECKPOINT} checkpoint: preserve original customer MVP\n"
        f"{PHASE1_COMMIT} feat: add GroAurum B2B domain and service boundaries\n"
        f"{PHASE2_COMMIT} feat: scaffold monorepo and Supabase B2B schema\n"
        f"{PHASE25_INFRA} test: prove Supabase schema invariants and RLS\n"
        f"{PHASE25_COMMIT} test: complete live Supabase database proof\n"
        f"{PHASE3_COMMIT} feat: connect customer data adapters to Supabase"
    )

    pdf.section_title("16. Documentation")
    pdf.body_text(
        "Primary architecture doc: docs/architecture/phase-3-customer-adapters.md. "
        "Env template: apps/customer/.env.example."
    )

    pdf.section_title("17. Next Step (Phase 4 - not started)")
    pdf.body_text(
        "Phase 4 is out of scope for this commit. Likely later work includes invitation "
        "activation, order placement against Supabase, and product-facing UI redesign - "
        "none of which were implemented in Phase 3."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
