"""Generate GroAurum Phase 2 Sprint 5 Live Admin ERP report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint5-Live-Admin-ERP-Report.pdf"


class Sprint5Pdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 5 - Live Admin ERP",
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
        safe = text.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(width, 4.5, f"- {safe}")
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
    pdf = Sprint5Pdf()
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
        "Phase 2 Sprint 5 - Live Admin ERP",
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
        "Supabase-backed view-models for every admin module\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        "No UI redesign - repository architecture preserved",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Sprint Goal")
    pdf.body_text(
        "Replace remaining mock view-model sources with live Supabase-backed "
        "repositories so every Admin ERP page loads through React Query + "
        "repositories. CRUD works end-to-end when VITE_DATA_ADAPTER=supabase. "
        "No new modules and no UI redesign."
    )

    pdf.section_title("2. Modules Connected")
    rows = [
        ("Module", "Live source"),
        ("Dashboard", "Aggregates: revenue, orders, customers, inventory, delivery, collections"),
        ("Products", "products + skus + images + prices + inventory + publish checklist"),
        ("Categories", "categories (+ product counts)"),
        ("Pricing", "sku_prices append-only history / scheduled / live"),
        ("Inventory", "balances + movements + reservations"),
        ("Orders", "orders + lines + events + payment/delivery mapping"),
        ("Customers", "shops + contacts + addresses + activation rail"),
        ("Salesmen", "profiles(SALESMAN) + assigned shops + order stats"),
        ("Delivery", "routes + stops; vehicle/collections stubbed where absent"),
        ("Reports", "live KPIs + placeholder sections / reports_snapshot merge"),
        ("Settings", "settings jsonb + warehouses + service areas"),
    ]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), [40, 140], header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("3. Architecture")
    pdf.mono_block(
        "VITE_DATA_ADAPTER=supabase\n"
        "  -> createGroAurumSupabaseClient\n"
        "  -> buildAdminLiveSources(client)  # view-model EntitySources\n"
        "  -> LiveAdminApi mappers\n"
        "  -> createAdminRepositories + domain CRUD\n"
        "  -> React Query hooks / mutations\n"
        "\n"
        "VITE_DATA_ADAPTER=mock\n"
        "  -> buildAdminMockSources (fixtures) for offline UI review"
    )

    pdf.section_title("4. Remaining Mock Sources")
    for item in [
        "Fixture *-fixtures.ts files retained ONLY for mock adapter offline review",
        "Pages no longer import fixture data - helpers moved to nav/order-helpers/"
        "browse-helpers/publish/customer-helpers",
        "SIDEBAR_NAV is static navigation config (not business data)",
        "UI-only gaps stubbed in live mappers (see limitations)",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. Known Limitations")
    for item in [
        "No vehicles / visits / customer documents tables - stubbed as empty or '-'",
        "Publish workflow derived from is_active + checklist (no draft enum in DB)",
        "Preferred payment defaults to COD (no shop preference column)",
        "Reports chart series remain placeholders; KPIs are live",
        "Some Settings sections (taxes, notification templates, slots) default when "
        "keys missing from settings table",
        "Delivery collections approximated from payments / route totals",
        "Admin must be authenticated as ADMIN for RLS writes",
        "Mutations wired on Product publish/archive and Settings company upsert; "
        "other quick actions still navigate / no-op pending form UX",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("6. Production Readiness")
    rows2 = [
        ("Area", "Status"),
        ("Read path (all modules)", "Live via LiveAdminApi + repositories"),
        ("React Query cache / invalidation", "Ready"),
        ("Domain CRUD services + Zod", "Ready (Sprint 4)"),
        ("RLS Admin / Salesman / Delivery / Customer / RO", "Ready"),
        ("Seed script", "Sprint 4 seed available"),
        ("Login / Auth UI", "Mock auth still (Sprint 2)"),
        ("Realtime postgres_changes", "Interfaces only"),
        ("View-model polish (labels/joins)", "Good enough; iterate in ops"),
    ]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), [95, 85], header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("7. How to Run Live")
    pdf.mono_block(
        "pnpm db:reset\n"
        "pnpm db:seed:sprint4\n"
        "# apps/admin-web/.env.local:\n"
        "VITE_DATA_ADAPTER=supabase\n"
        "VITE_SUPABASE_URL=http://127.0.0.1:54421\n"
        "VITE_SUPABASE_ANON_KEY=<local anon key>\n"
        "pnpm dev:admin"
    )

    pdf.section_title("8. Next Sprint Recommendations")
    for item in [
        "Sprint 6: Login screens + real Supabase Auth for admin (replace mock auto-sign-in)",
        "Wire remaining quick-action mutations with minimal forms (create product, "
        "schedule price, adjust inventory, create order)",
        "Add vehicles + salesman visits tables if ops requires those tabs live",
        "Materialize reports_snapshot job for heavy analytics",
        "Enable realtime INVALIDATE on orders / inventory / delivery_routes",
        "Customer + Sales/Delivery PWA live adapters reuse same domain repos",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Intent")
    pdf.body_text(
        "Sprint 5 completes the Live Admin ERP read path on the Sprint 3/4 "
        "repository architecture so operators can run the console against "
        "Supabase without redesigning modules."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
