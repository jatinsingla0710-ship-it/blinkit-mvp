"""Generate GroAurum Phase 2 Sprint 4 Production CRUD Foundation report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint4-CRUD-Foundation-Report.pdf"


class Sprint4Pdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 4 - CRUD Foundation",
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
    pdf = Sprint4Pdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(20)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(
        0,
        9,
        "Phase 2 Sprint 4 - Production CRUD Foundation",
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
        "Real Supabase backend integration\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        "No UI redesign - repository architecture preserved",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Sprint Goal")
    pdf.body_text(
        "Connect GroAurum admin data access to the real Supabase backend. "
        "Extend the existing repository architecture with production CRUD "
        "(create, update, softDelete), Zod validation, React Query mutations, "
        "additive schema migrations, RLS for READ_ONLY, and a Sprint 4 seed. "
        "No new screens and no UI redesign."
    )

    pdf.section_title("2. Architecture (kept)")
    for item in [
        "packages/data - ReadRepository + CrudRepository contracts, query keys, QueryState",
        "packages/api - adapters, MemoryCache, DomainCrudRepositories, CrudServices",
        "packages/validation - shared Zod schemas",
        "packages/api-client - typed Supabase client + extended Database types",
        "Pages continue to load view-model data via repositories (mock sources)",
        "Mutations go through CrudServices -> domain repositories -> Supabase",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Database ERD (logical)")
    pdf.mono_block(
        "profiles (user_profiles)\n"
        "  |\n"
        "service_areas ---- operational_locations (warehouse)\n"
        "  |\n"
        "shops (customers) ---- customer_addresses\n"
        "  |                       |\n"
        "orders ---- order_lines (order_items)\n"
        "  |\n"
        "delivery_routes ---- route_stops\n"
        "\n"
        "categories ---- products ---- product_images\n"
        "                  |\n"
        "                 skus ---- sku_prices (price_history)\n"
        "                  |\n"
        "         inventory_balances (inventory)\n"
        "                  |\n"
        "         inventory_movements\n"
        "\n"
        "settings                 reports_snapshot (placeholder)"
    )

    pdf.add_page()
    pdf.section_title("4. Migration List (0001-0023)")
    rows = [
        ("No.", "Focus"),
        ("0001-0016", "Phase 2/2.5 core schema + RLS + grants"),
        ("0017", "Soft-delete deleted_at columns"),
        ("0018", "product_images"),
        ("0019", "customer_addresses"),
        ("0020", "settings + reports_snapshot"),
        ("0021", "Compat views (aliases)"),
        ("0022", "READ_ONLY staff_role"),
        ("0023", "RLS extensions for new tables + RO"),
    ]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), [35, 145], header=(i == 0))
        pdf.ln(0.5)
    pdf.body_text(
        "Full filename map: supabase/migrations/MIGRATION_INDEX.md"
    )

    pdf.section_title("5. Table Descriptions (Sprint 4 additions)")
    for item in [
        "product_images - normalized media rows; products.image_urls retained",
        "customer_addresses - extra shop delivery addresses; shops.delivery_* primary",
        "settings - key/jsonb admin configuration store",
        "reports_snapshot - placeholder for future analytics payloads",
        "Compat views: user_profiles, customers, price_history, order_items, inventory",
        "Soft delete: deleted_at on catalogue, shops, routes, profiles, areas, locations",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Repository Mapping")
    rows2 = [
        ("Repository", "Physical table(s)"),
        ("categories", "categories"),
        ("products", "products (+ product_images)"),
        ("skus", "skus"),
        ("prices", "sku_prices / price_history"),
        ("inventory", "inventory_balances + movements"),
        ("customers", "shops / customers view"),
        ("orders", "orders + order_lines"),
        ("salesmen", "profiles (SALESMAN role)"),
        ("delivery", "delivery_routes"),
        ("settings", "settings"),
    ]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), [50, 130], header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("7. CRUD Mapping")
    pdf.body_text(
        "Each domain repository implements list, getById, search, subscribe, "
        "create, update, softDelete. Pricing is append-only (create + close). "
        "Inventory updates write ADMIN_ADJUSTMENT movements. Orders softDelete "
        "cancels (status=CANCELLED)."
    )
    for item in [
        "CrudServices validates with Zod then calls repositories",
        "Products / Categories / Inventory / Pricing / Customers / Orders / "
        "Salesmen / Delivery / Settings services generated",
        "React Query mutations in apps/admin-web/src/data/mutations.ts",
        "Invalidation via queryKeys + AdminDataService.invalidate + MemoryCache",
        "Optimistic soft-delete for products (rollback on error)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. RLS Overview")
    for item in [
        "Existing policies: ADMIN / SALESMAN / DELIVERY / CUSTOMER (Phase 2.5)",
        "NEW: READ_ONLY role - select on catalogue + settings/reports; no writes",
        "product_images / customer_addresses / settings / reports_snapshot policies",
        "Admin write remains is_admin(); salesman may insert customer_addresses "
        "for assigned shops",
        "App RBAC (packages/auth) stays finer-grained; DB maps to staff_role",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Seed Overview")
    pdf.mono_block(
        "supabase/seed/sprint4_seed.sql\n"
        "pnpm db:seed:sprint4\n"
        "\n"
        "Includes: 2 categories, 2 products, 2 SKUs, prices, inventory,\n"
        "1 warehouse, 1 admin, 2 salesmen, 5 customers, 2 sample orders,\n"
        "settings + reports_snapshot placeholder"
    )

    pdf.section_title("10. Validation Overview")
    for item in [
        "Zod schemas in @groaurum/validation (category, product, sku, price, "
        "inventory, customer, order, salesman, delivery, settings)",
        "Shared helpers: uuid, pin code, money, quantity",
        "Services call schema.parse before repository writes",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("11. Future Realtime Points")
    for item in [
        "ReadRepository.subscribe / RealtimeBus already defined",
        "Domain repos publish INSERT/UPDATE/DELETE to bus after mutations",
        "createNoopRealtimeBus today - swap for supabase.channel postgres_changes",
        "Target tables: orders, inventory_balances, delivery_routes, sku_prices",
        "UI should invalidate queryKeys on realtime events (hooks prepared)",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Adapter Switch")
    pdf.mono_block(
        "VITE_DATA_ADAPTER=mock|supabase\n"
        "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY\n"
        "\n"
        "mock: view-model repos from fixtures; domain=null; CRUD unavailable\n"
        "supabase: domain CRUD live; UI still uses fixture view sources\n"
        "         (no redesign) until view-model mappers land"
    )

    pdf.section_title("13. Validation")
    rows3 = [
        ("Check", "Result"),
        ("@groaurum/data typecheck", "Pass"),
        ("@groaurum/validation typecheck + test", "Pass"),
        ("@groaurum/api typecheck + test", "Pass"),
        ("@groaurum/admin-web typecheck", "Pass"),
        ("UI redesign / new screens", "None"),
        ("Live realtime channels", "Interfaces + publish hooks only"),
    ]
    for i, row in enumerate(rows3):
        pdf.table_row(list(row), [125, 55], header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("14. Intent")
    pdf.body_text(
        "Sprint 4 establishes production database CRUD on the existing repository "
        "architecture so admin mutations and future view-model mappers can plug "
        "into stable Supabase-backed contracts without rewriting modules."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
