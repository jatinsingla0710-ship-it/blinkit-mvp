"""Generate GroAurum Phase 2 Sprint 3 Supabase Data Layer report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint3-Data-Layer-Report.pdf"


class Sprint3Pdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 3 - Data Layer",
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
    pdf = Sprint3Pdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(24)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(
        0,
        9,
        "Phase 2 Sprint 3 - Supabase Data Layer",
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
        "Production-ready read architecture\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        "No CRUD mutations - no UI redesign - mock until Supabase enabled",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Sprint Goal")
    pdf.body_text(
        "Replace typed fixtures as the page data source with a production-ready "
        "data access architecture: repository pattern, service layer, adapters, "
        "caching, shared query states, and TanStack Query. Pages load through "
        "repositories; fixtures remain mock seed only. Switching to Supabase "
        "requires changing one adapter (VITE_DATA_ADAPTER)."
    )

    pdf.section_title("2. Architecture Overview")
    for item in [
        "packages/data - domain models, ReadRepository contract, query keys, query states, errors, realtime interfaces",
        "packages/api - MemoryCache, mock + Supabase stub adapters, AdminRepositories factory, AdminDataService",
        "apps/admin-web/src/data - typed client, mock sources, React Query hooks, QueryStateGate",
        "Pages call hooks -> repositories -> adapter; no direct fixture data loading on pages",
        "Read-only surface: list, getById, search, subscribe (noop realtime bus)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Layer Responsibilities")
    rows = [
        ("Layer", "Responsibility"),
        ("Domain (@groaurum/data)", "Typed models, errors, QueryState, keys"),
        ("Repository", "ReadRepository<TList,TDetail> per entity"),
        ("Adapter (@groaurum/api)", "Mock seed vs Supabase stub implementations"),
        ("Cache", "MemoryCache TTL memoization at adapter"),
        ("Service", "AdminDataService facades + invalidation hooks"),
        ("React Query", "Network/UI cache, staleTime, query keys"),
        ("UI gate", "Loading / Empty / Error / Success"),
    ]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), [55, 125], header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("4. Folder Structure")
    pdf.mono_block(
        "packages/data/src/\n"
        "  models.ts repository.ts query-keys.ts query-state.ts realtime.ts\n"
        "packages/api/src/\n"
        "  adapters/create-admin-repositories.ts\n"
        "  repositories/create-read-repository.ts admin-repositories.ts\n"
        "  cache/memory-cache.ts\n"
        "  services/admin-data-service.ts\n"
        "apps/admin-web/src/data/\n"
        "  adminDataClient.ts buildAdminMockSources.ts\n"
        "  AdminDataProviders.tsx hooks.ts QueryStateGate.tsx\n"
        "  *-fixtures.ts (seed only) *-types.ts"
    )

    pdf.section_title("5. Repositories")
    pdf.body_text(
        "Each repository implements list(), getById(), search(), subscribe(). "
        "No create/update/delete in Sprint 3."
    )
    for entity in [
        "products",
        "categories",
        "skus",
        "prices",
        "inventory",
        "customers",
        "orders",
        "salesmen",
        "delivery",
        "reports",
        "settings",
        "dashboard (console snapshot companion)",
    ]:
        pdf.bullet(entity)

    pdf.section_title("6. Domain Models")
    for item in [
        "Strict TypeScript contracts in packages/data/src/models.ts (no any)",
        "Admin ERP specializes AdminRepositories with view-model types "
        "(ProductListRow, OrderDetail, snapshots, etc.)",
        "Fixtures keep the same shapes; they are EntitySource seed inputs only",
        "Categories seeded in buildAdminMockSources for repository completeness",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("7. Caching Strategy")
    for item in [
        "Adapter MemoryCache: key prefixes entity:list | entity:detail:id | entity:search:q; default TTL 30s",
        "TanStack Query: staleTime 30s, gcTime 5m, retry 1, refetchOnWindowFocus false",
        "queryKeys factory: root, entity, list, detail, search, snapshot",
        "invalidation.entity(name) / invalidation.all() prepared for future CRUD",
        "AdminDataService.invalidate drops MemoryCache prefix and returns query key prefixes",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Query Strategy")
    pdf.mono_block(
        "Page -> useXQuery hook\n"
        "  -> queryKey from queryKeys.*\n"
        "  -> queryFn: repositories.<entity>.list|getById|search\n"
        "     or client.getSnapshot for KPI+row consoles\n"
        "  -> toQueryState(...) -> QueryStateGate\n"
        "     loading | empty | error | success"
    )
    for item in [
        "List pages: products, prices use repository.list",
        "Module consoles: inventory, customers, orders, salesmen, delivery use getSnapshot",
        "Detail pages: getById(id) with enabled when id present",
        "Reports / Settings / Dashboard: getById('current') via repository",
        "Pure UI helpers may still import fixture helpers (filters, browse builders)",
    ]:
        pdf.bullet(item)

    pdf.section_title("9. Shared Query States")
    for item in [
        "QueryStatus: loading | empty | error | success",
        "DataError codes: not_found, unauthorized, forbidden, offline, timeout, "
        "adapter_unavailable, unexpected",
        "QueryStateGate renders PageHeader + EmptyState for non-success paths",
        "Success path renders children(data) without redesigning module UI",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("10. Supabase Integration Points")
    for item in [
        "Single switch: VITE_DATA_ADAPTER=mock|supabase (apps/admin-web/.env.example)",
        "createAdminRepositories({ mode }) builds mock repos or Supabase stubs",
        "createSupabaseReadRepositoryStub throws adapter_unavailable until wired",
        "Future: inject Supabase client; map tables to EntitySource / ReadRepository",
        "Keep queryKeys + hooks unchanged when swapping adapter implementations",
        "RealtimeBus + ReadRepository.subscribe ready; createNoopRealtimeBus today",
        "Do not open live channels in Sprint 3",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Realtime Interfaces (prepared only)")
    pdf.mono_block(
        "RealtimeEventType / RealtimeEvent / RealtimeListener / Unsubscribe\n"
        "RealtimeBus.subscribe(entity, listener) -> Unsubscribe\n"
        "createNoopRealtimeBus() - no channels\n"
        "Mock repo subscribe listens for INVALIDATE and clears MemoryCache prefix"
    )

    pdf.section_title("12. Future CRUD Hooks (not implemented)")
    for item in [
        "useCreateProductMutation / useUpdateProductMutation / useDeleteProductMutation",
        "useCreateOrderMutation / useUpdateInventoryMutation / useUpdateSettingsMutation",
        "On success: AdminDataService.invalidate(entity) + queryClient.invalidateQueries",
        "Mutation methods stay off ReadRepository until a dedicated write interface",
        "Exported type FutureMutationHookNames documents planned names",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("13. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/data typecheck", "Pass"),
        ("pnpm --filter @groaurum/api typecheck", "Pass"),
        ("pnpm --filter @groaurum/api test", "Pass"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("CRUD / mutations", "Not implemented (by design)"),
        ("Live Supabase reads", "Stub only (by design)"),
        ("UI redesign / business logic change", "None"),
        ("Realtime subscriptions", "Interfaces only"),
    ]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), [125, 55], header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("14. How to Review")
    pdf.mono_block(
        "pnpm install\n"
        "pnpm dev:admin\n"
        "# Default VITE_DATA_ADAPTER=mock - pages load via repositories\n"
        "# Confirm Loading gate flashes then module content renders\n"
        "# Set VITE_DATA_ADAPTER=supabase - adapter_unavailable error states\n"
        "# Fixtures only referenced from buildAdminMockSources (+ pure helpers)"
    )

    pdf.section_title("15. Intent")
    pdf.body_text(
        "Sprint 3 establishes a production-ready read data layer so Supabase and "
        "future CRUD can plug into stable contracts without rewriting admin modules "
        "or inventing per-page data access."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
