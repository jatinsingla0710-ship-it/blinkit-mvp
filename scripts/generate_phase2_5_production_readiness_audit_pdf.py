"""Generate GroAurum Phase 2.5 Production Readiness Audit PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2.5-Production-Readiness-Audit.pdf"


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2.5 - Production Readiness Audit",
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

    def verdict(self, label: str, status: str, detail: str):
        self.set_font("Helvetica", "B", 9)
        if status == "PASS":
            self.set_text_color(11, 83, 69)
        elif status == "PARTIAL":
            self.set_text_color(160, 100, 20)
        else:
            self.set_text_color(160, 40, 40)
        self.set_x(self.l_margin)
        self.cell(22, 5, status, new_x="RIGHT")
        self.set_text_color(15, 31, 24)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 5, label, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.set_x(self.l_margin + 22)
        safe = detail.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 4, safe)
        self.ln(1.5)

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
            self.multi_cell(w, 4.2, safe, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 5
        x0 = self.l_margin
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)


def build_pdf() -> None:
    pdf = AuditPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(16)
    pdf.cell(0, 10, "GroAurum Admin ERP", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "Phase 2.5 Production Readiness Audit", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Scope: Live Admin ERP verification only (no new features)", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "Method: Static code audit + local Supabase schema/seed probes", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(160, 40, 40)
    pdf.multi_cell(
        0,
        6,
        "VERDICT: NOT PRODUCTION-READY for end-to-end CRUD.\n"
        "Architecture is live-read ready when the Supabase adapter is configured;\n"
        "auth session, env activation, SKU/category UI, and most mutations are not.",
    )
    pdf.ln(4)

    # --- Scorecard ---
    pdf.section_title("1. Verification Scorecard (15 checks)")

    pdf.verdict(
        "1. Every repository reads from Supabase",
        "PARTIAL",
        "When VITE_DATA_ADAPTER=supabase, view repos use LiveAdminApi and domain repos use createSupabaseDomainRepositories. Without that env, getAdminDataClient() defaults to mock fixtures.",
    )
    pdf.verdict(
        "2. No page imports fixtures directly",
        "PASS",
        "Fixture imports are confined to buildAdminMockSources.ts. Pages use hooks/QueryStateGate. Stale comments still say 'fixtures are read-only' on Pricing/Inventory detail.",
    )
    pdf.verdict(
        "3. VITE_DATA_ADAPTER=supabase is active",
        "FAIL",
        "Set only in apps/admin-web/.env.example. No .env.local found at audit time. Vite does not load .env.example, so runtime mode falls back to mock.",
    )
    pdf.verdict(
        "4. Every React Query hook works",
        "PARTIAL",
        "17 hooks in hooks.ts cover products, prices, inventory, customers, orders, salesmen, delivery, reports, settings, dashboard. No useCategories* / useSkus* hooks. Categories route is PlaceholderPage.",
    )
    pdf.verdict(
        "5. CRUD works (8 domains)",
        "FAIL",
        "CrudServices + mutation hooks exist for most domains except SKUs (repo only). UI wiring: Product publish/archive + Settings company upsert only. Categories page missing. See section 2.",
    )
    pdf.verdict(
        "6. Foreign keys",
        "PASS",
        "46 foreign keys on public schema (products->categories, skus->products, sku_prices->skus, inventory->skus/locations, orders->shops, etc.). Seed relationships intact.",
    )
    pdf.verdict(
        "7. RLS policies",
        "PASS",
        "All 30 public tables have rowsecurity=true; 54 policies. Catalogue SELECT/write policies require authenticated + is_admin() / is_admin_or_read_only(). Anon has table GRANT SELECT but no RLS policy -> empty reads; anon INSERT denied by GRANT.",
    )
    pdf.verdict(
        "8. Every mutation succeeds",
        "FAIL",
        "Not verified end-to-end in the app. Default VITE_AUTH_PROVIDER=mock does not attach a Supabase JWT to the data client. Admin writes need authenticated JWT passing is_admin(). Most mutation hooks are unused by pages.",
    )
    pdf.verdict(
        "9. Optimistic updates",
        "PARTIAL",
        "Implemented only for useSoftDeleteProductMutation (list cache patch + rollback). Other mutations cancel/invalidate without optimistic patches.",
    )
    pdf.verdict(
        "10. Cache invalidation",
        "PASS",
        "Mutations call invalidateEntity (MemoryCache + React Query keys). CrudServices also invalidates MemoryCache on success. Pattern is consistent for wired and unwired hooks.",
    )
    pdf.verdict(
        "11. Loading states",
        "PASS",
        "QueryStateGate shows Loading EmptyState on all repository-backed pages audited.",
    )
    pdf.verdict(
        "12. Error handling",
        "PASS",
        "QueryStateGate surfaces state.error.message. Soft-delete mutation rolls back optimistic cache on onError.",
    )
    pdf.verdict(
        "13. Report every TODO",
        "PASS",
        "No formal TODO/FIXME/HACK markers in repo source. Operational debt is expressed as 'Mutation deferred' comments and PlaceholderPage routes (listed below).",
    )
    pdf.verdict(
        "14. Report every mocked feature",
        "PASS",
        "Inventory complete; see section 4.",
    )
    pdf.verdict(
        "15. Report every placeholder",
        "PASS",
        "Inventory complete; see section 5.",
    )

    # --- CRUD matrix ---
    pdf.add_page()
    pdf.section_title("2. CRUD Domain Matrix")
    pdf.body_text(
        "Legend: Domain repo = Supabase CrudRepository exists. CrudServices = Zod + service method. "
        "Hook = React Query mutation. UI = page action calls the hook."
    )
    widths = [28, 22, 28, 22, 70]
    pdf.table_row(
        ["Domain", "Repo", "CrudServices", "Hook", "UI / notes"],
        widths,
        header=True,
    )
    rows = [
        ["Categories", "Yes", "Yes", "Yes", "FAIL: PlaceholderPage; hooks unused"],
        ["Products", "Yes", "Yes", "Yes", "PARTIAL: publish/archive only"],
        ["SKUs", "Yes", "No", "No", "FAIL: no service/hooks/UI CRUD"],
        ["Prices", "Yes", "create/close", "create", "FAIL: list/detail read-only UI"],
        ["Inventory", "Yes", "adjust/update", "update", "FAIL: mutations deferred"],
        ["Customers", "Yes", "Yes", "Yes", "FAIL: list/detail read-only UI"],
        ["Orders", "Yes", "create/status", "create", "FAIL: mutations deferred"],
        ["Settings", "Yes", "upsert/update", "upsert", "PARTIAL: company upsert only"],
    ]
    for r in rows:
        pdf.table_row(r, widths)

    pdf.ln(4)
    pdf.section_title("3. Environment & Auth Blockers")
    pdf.bullet(
        "apps/admin-web/.env.example sets VITE_DATA_ADAPTER=supabase, but VITE_SUPABASE_URL / ANON_KEY remain commented."
    )
    pdf.bullet(
        "No apps/admin-web/.env.local at audit time -> resolveMode() returns 'mock' -> fixtures path."
    )
    pdf.bullet(
        "VITE_AUTH_PROVIDER defaults to mock; mock auth auto-signs for RBAC UI but does not establish Supabase Auth session for PostgREST."
    )
    pdf.bullet(
        "createGroAurumSupabaseClient uses anon key with persistSession; admin data client never signs in that client when auth provider is mock."
    )
    pdf.bullet(
        "RLS write path requires role authenticated and is_admin(). Without JWT, mutations cannot succeed even if adapter=supabase."
    )

    pdf.section_title("4. Mocked Features")
    pdf.bullet("Data adapter mock mode: entire ERP view-models from *-fixtures via buildAdminMockSources.")
    pdf.bullet("Auth: @groaurum/auth mock provider + VITE_AUTH_MOCK_ROLE (default super_admin).")
    pdf.bullet("Supabase auth provider is still a stub (createSupabaseAuthProviderStub).")
    pdf.bullet("Salesman visits: LiveAdminApi returns visits: [].")
    pdf.bullet("Customer documents: LiveAdminApi returns documents: [].")
    pdf.bullet(
        "Inventory incomingLabel hardcoded '0' and reorderLevelLabel hardcoded '10' in LiveAdminApi."
    )
    pdf.bullet("Domain reports/dashboard repositories are placeholder throwers; UI uses LiveAdminApi snapshots instead.")
    pdf.bullet("Reports chart series largely placeholder:true (not live analytics).")
    pdf.bullet("Payment gateway label falls back to 'Razorpay (placeholder)'.")
    pdf.bullet("Sales / Delivery PWA apps remain scaffold stubs (out of Admin ERP scope).")

    pdf.section_title("5. Placeholders & Deferred UI")
    pdf.bullet("Routes: /categories and /service-areas render PlaceholderPage.")
    pdf.bullet("PlaceholderChart component for report visuals awaiting live metrics.")
    pdf.bullet("reports_snapshot seed payload status=placeholder (analytics sprint pending).")
    pdf.bullet(
        "'Mutation deferred' comments: Settings warehouses/service areas; Delivery detail; Salesman detail; "
        "Customer/Order detail; Pricing/Inventory detail; Reports export stubs."
    )
    pdf.bullet("HTML input placeholder attributes on browse bars/forms (cosmetic only; not product gaps).")

    pdf.section_title("6. TODOs / Deferred Markers")
    pdf.body_text("Formal TODO/FIXME scan across repo: zero matches.")
    pdf.body_text("Deferred markers found (non-exhaustive comments):")
    pdf.bullet("PricingListPage / PricingDetailPage / InventoryListPage / InventoryDetailPage: mutations deferred")
    pdf.bullet("CustomersListPage / CustomerDetailPage / OrdersListPage / OrderDetailPage: no backend mutations")
    pdf.bullet("Salesmen* / Delivery*: mutations deferred")
    pdf.bullet("ReportsPage: export stubs; placeholder charts")
    pdf.bullet("SettingsPage: warehouse/service-area add/edit/disable deferred")
    pdf.bullet("packages/data repository subscribe: live channel wiring deferred")
    pdf.bullet("Polygon serviceability matching: not implemented")

    pdf.add_page()
    pdf.section_title("7. React Query Hook Inventory")
    pdf.body_text("Present and used by pages via QueryStateGate:")
    for name in [
        "useProductsListQuery / useProductDetailQuery",
        "usePricesListQuery / usePriceDetailQuery",
        "useInventorySnapshotQuery / useInventoryDetailQuery",
        "useCustomersSnapshotQuery / useCustomerDetailQuery",
        "useOrdersSnapshotQuery / useOrderDetailQuery",
        "useSalesmenSnapshotQuery / useSalesmanDetailQuery",
        "useDeliverySnapshotQuery / useDeliveryDetailQuery",
        "useReportsSnapshotQuery / useSettingsSnapshotQuery / useDashboardSnapshotQuery",
    ]:
        pdf.bullet(name)
    pdf.body_text("Missing for checklist completeness:")
    pdf.bullet("useCategoriesListQuery / useCategoryDetailQuery")
    pdf.bullet("useSkusListQuery / useSkuDetailQuery (skus source exists in live adapter but no page hooks)")

    pdf.section_title("8. Mutation Hook Wiring")
    widths2 = [55, 35, 80]
    pdf.table_row(["Hook", "Used by UI?", "Notes"], widths2, header=True)
    for r in [
        ["useCreateProductMutation", "No", "Exported only"],
        ["useUpdateProductMutation", "Yes", "ProductDetail publish"],
        ["useSoftDeleteProductMutation", "Yes", "ProductDetail archive + optimistic"],
        ["useCreateCategoryMutation", "No", "No Categories page"],
        ["useUpdateCategoryMutation", "No", "No Categories page"],
        ["useCreatePriceMutation", "No", "Pricing UI deferred"],
        ["useUpdateInventoryMutation", "No", "Inventory UI deferred"],
        ["useCreateCustomerMutation", "No", "Customers UI deferred"],
        ["useUpdateCustomerMutation", "No", "Customers UI deferred"],
        ["useCreateOrderMutation", "No", "Orders UI deferred"],
        ["useCreateSalesmanMutation", "No", "Salesmen UI deferred"],
        ["useCreateDeliveryRouteMutation", "No", "Delivery UI deferred"],
        ["useUpsertSettingMutation", "Yes", "Settings company quick action"],
    ]:
        pdf.table_row(r, widths2)

    pdf.ln(4)
    pdf.section_title("9. Database Probe (local)")
    pdf.bullet("Seed counts: categories=2, products=2, skus=2, prices=2, inventory_balances=2, shops=5, orders=2, settings=1, reports_snapshot=1")
    pdf.bullet("RLS enabled on 30/30 public tables; 54 policies; 46 foreign keys")
    pdf.bullet("Anon REST SELECT on categories: empty (no anon RLS policy)")
    pdf.bullet("Anon REST INSERT on categories: blocked (GRANT / permission denied)")

    pdf.section_title("10. Sprint 6 Gate Recommendation")
    pdf.body_text("Do not treat Live Admin ERP as production-complete. Before Sprint 6 feature work, close these blockers:")
    pdf.bullet("Create apps/admin-web/.env.local with VITE_DATA_ADAPTER=supabase and local URL/anon key.")
    pdf.bullet("Wire real Supabase Auth session into the same client used by LiveAdminApi / domain repos (or stop using mock auth for live mode).")
    pdf.bullet("Add Categories UI + SKU CrudServices/hooks/UI.")
    pdf.bullet("Wire remaining mutation hooks to existing forms/actions and re-run mutation success probes under ADMIN JWT.")
    pdf.bullet("Replace hardcoded inventory reorder/incoming and empty visits/documents with real sources or explicit empty-state copy.")
    pdf.bullet("Keep reports charts marked placeholder until analytics sprint.")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "End of audit. No application features were built as part of this verification.",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
