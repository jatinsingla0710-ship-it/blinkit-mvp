"""Generate GroAurum Phase 2 Sprint 1 Project Audit Report PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint1-Project-Audit-Report.pdf"
PHASE3_COMMIT = "af9e616"


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 1 - Project Audit Report",
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
    pdf = AuditPdf()
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
        "Phase 2 Sprint 1 - Project Audit Report",
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
        "Product Engineering - design system extraction and codebase cleanup\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        "No new screens · No Supabase wiring",
        align="C",
    )
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "Goal: convert the UI shell into a production-ready foundation by "
        "standardizing primitives, tokens, and shared patterns before live data.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Sprint Objective")
    pdf.body_text(
        "Phase 2 Sprint 1 focuses on product engineering hygiene: audit structure, "
        "remove duplication, extract a reusable Design System package, standardize "
        "visual tokens, and prepare modules to share one component library. "
        "Supabase remains deferred."
    )

    pdf.section_title("2. Monorepo Structure (Audit)")
    rows = [
        ("Area", "Finding"),
        ("apps/admin-web", "Vite React admin console - primary Sprint 1 consumer"),
        ("apps/customer", "Expo app - token parity via theme.ts; no shared React UI yet"),
        ("apps/sales-pwa, delivery-pwa", "Scaffold only - out of Sprint 1 cleanup"),
        ("packages/ui", "NEW @groaurum/ui design system package"),
        ("packages/shared-types, api-client, validation, config, db-tests", "Existing domain packages - unchanged"),
        ("docs/, scripts/", "Module PDFs + generators - unchanged"),
    ]
    widths = [55, 125]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("3. Pre-Sprint Duplication Findings")
    for item in [
        "6 UI primitives lived only under admin-web/components/ui",
        "8+ near-identical QuickActions CSS files (flex + 8px gap)",
        "Browse/filter bars duplicated across Salesmen, Delivery, Orders, Reports",
        "Overview field grids duplicated across modules (dt/dd 3-4 column layouts)",
        "Timeline rails duplicated (delivery, visits, price/inventory history)",
        "Design tokens only in admin global.css; customer mirrored hex in theme.ts",
        "No Modal / TextField / SelectField / FilterBar / ActionBar primitives",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("4. Design System Package: @groaurum/ui")
    pdf.body_text("Location: packages/ui")
    pdf.mono_block(
        "packages/ui/src/\n"
        "  tokens/tokens.css + tokens.ts\n"
        "  styles/base.css\n"
        "  components/ Button Badge Card Tabs PageHeader EmptyState\n"
        "             DataTable TextField SelectField ActionBar FilterBar\n"
        "             ChipGroup FieldGrid Timeline Modal Icon\n"
        "  index.ts"
    )

    pdf.section_title("5. Standardized Primitives")
    rows2 = [
        ("Primitive", "Role"),
        ("Button", "primary / secondary / ghost"),
        ("Badge", "neutral / success / warning / danger / info"),
        ("Card", "White surface shell with optional title/action"),
        ("Tabs", "Controlled tablist"),
        ("PageHeader", "Page title / subtitle / meta"),
        ("EmptyState", "Dense empty panel"),
        ("DataTable", "Shared table wrapper + .ga-table styles"),
        ("TextField / SelectField", "Labeled form controls"),
        ("ActionBar", "Quick-action button row"),
        ("FilterBar / ChipGroup", "Search, filter, sort chrome"),
        ("FieldGrid / Field", "Overview definition lists"),
        ("Timeline", "Execution / visit rails"),
        ("Modal", "Accessible dialog shell (Escape + backdrop)"),
        ("Icon", "sm / md / lg icon box sizing"),
    ]
    w2 = [55, 125]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("6. Token Standardization")
    for item in [
        "Colors: primary, accent, surfaces, text, border, danger, warning, success, overlay",
        "Spacing: --ga-space-1..6 (4-40px, 8px base)",
        "Radius: sm / md / lg / xl",
        "Shadows: --ga-shadow, --ga-shadow-md, --ga-shadow-lg",
        "Typography: font family + xs..2xl size scale + mono font",
        "Icons: --ga-icon-sm / md / lg",
        "Layout chrome: sidebar width, topnav height",
        "JS mirror exported from tokens.ts for future RN convergence",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Cleanup Completed This Sprint")
    for item in [
        "Moved tokens + base reset into @groaurum/ui; admin main.tsx imports them",
        "admin-web/components/ui/* now re-exports from @groaurum/ui (no local CSS copies)",
        "Module DataTable CSS imports point at @groaurum/ui/styles/data-table.css",
        "Collapsed 8 QuickActions (+ Reports export) onto ActionBar; deleted CSS clones",
        "Salesmen/Delivery browse bars + Orders/Reports filters use FilterBar + fields",
        "Salesman/Delivery/Settings overview panels use FieldGrid",
        "Delivery timeline + Salesman visits use shared Timeline",
        "No new screens added; Categories and Service Areas remain intentional placeholders",
        "Fixture data retained (not demo junk) - still the module data source until Supabase",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Intentionally Deferred")
    for item in [
        "Supabase queries / mutations",
        "Full migration of every overview tab and historical timeline to FieldGrid/Timeline",
        "Customer Expo consuming @groaurum/ui React components (tokens only later)",
        "Building Categories and Service Areas module UIs",
        "Chart library for Reports (PlaceholderChart remains)",
        "Icon SVG asset library beyond Icon sizing primitive",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("9. Module Usage Guidance")
    pdf.body_text(
        "Domain modules keep business-specific status mappers and tables. Shared chrome "
        "must come from @groaurum/ui. Prefer:"
    )
    for item in [
        "ActionBar for any button row quick actions",
        "FilterBar + TextField/SelectField/ChipGroup for browse/filter UIs",
        "FieldGrid for overview definition lists",
        "Timeline for stage/visit rails",
        "Modal for confirm/edit dialogs when mutations arrive",
        "DataTable / .ga-table for dense tables",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Validation")
    rows3 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/ui typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("New screens", "None"),
        ("Supabase wiring", "None (by design)"),
    ]
    w3 = [125, 55]
    for i, row in enumerate(rows3):
        pdf.table_row(list(row), w3, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm install\n"
        "pnpm dev:admin\n"
        "# Confirm modules still render with shared tokens\n"
        "# Spot-check Salesmen browse, Delivery timeline, Settings company\n"
        "# Inspect packages/ui for primitives before adding module CSS"
    )

    pdf.section_title("12. Recommended Sprint 2 Focus")
    for item in [
        "Finish migrating remaining overview/timeline CSS clones to FieldGrid/Timeline",
        "Introduce form validation patterns on TextField/SelectField",
        "Wire Modal into first mutation flows when Supabase adapters land",
        "Align customer theme.ts to import colors from @groaurum/ui tokens.ts",
        "Begin Phase 2 data adapters without inventing new screens",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "Sprint 1 establishes one Design System source of truth so production work "
        "does not fork styling per module. The admin shell remains fixture-backed, "
        "but the component and token layer is now package-owned and reusable."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
