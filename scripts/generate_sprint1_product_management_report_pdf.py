"""Generate GroAurum Sprint 1 Task 2 — Product Management Completion report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Sprint1-Product-Management-Completion-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Sprint 1 - Product Management Completion",
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

    def status_line(self, label: str, status: str, note: str = ""):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        color = {
            "PASS": (26, 141, 73),
            "PARTIAL": (180, 120, 20),
            "FAIL": (180, 40, 40),
            "DONE": (26, 141, 73),
            "PENDING": (180, 120, 20),
        }.get(status, (15, 31, 24))
        self.set_text_color(*color)
        line = f"{label}: {status}"
        if note:
            line += f" - {note}"
        safe = line.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 5, safe)
        self.set_text_color(15, 31, 24)
        self.set_x(self.l_margin)


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 9, "Product Management Completion Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Sprint 1 - Task 2", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section_title("1. Objective")
    pdf.body_text(
        "Make the Admin Product module fully operational using the existing "
        "architecture: list/search, create, edit, soft-delete, SKU CRUD, detail "
        "tabs, React Query invalidation, and proper loading/error states."
    )

    pdf.section_title("2. Root Causes")
    pdf.bullet(
        "Write UI missing: useCreateProductMutation / useUpdateProductMutation "
        "existed but no create/edit forms; Add Product was a no-op."
    )
    pdf.bullet(
        "SKU create incomplete: only code + name collected; pack size, unit, "
        "MOQ, and related fields were hardcoded."
    )
    pdf.bullet(
        "Product list had no search/filter UI despite live repository data."
    )
    pdf.bullet(
        "sku_prices.deleted_at filter failed silently (column does not exist), "
        "breaking trade price and price history in live mode."
    )
    pdf.bullet(
        "productType missing from ProductDetail VM; SKU tab inferred type from "
        "first SKU instead of the product row."
    )

    pdf.section_title("3. Features Completed")
    pdf.status_line("Product list from Supabase", "DONE")
    pdf.status_line("Search + status/category filter", "DONE")
    pdf.status_line(
        "Create product",
        "DONE",
        "name, category, description, type, status -> Supabase",
    )
    pdf.status_line("Edit product", "DONE", "all editable schema fields")
    pdf.status_line(
        "Soft-delete / archive",
        "DONE",
        "list hide + detail redirects to /products",
    )
    pdf.status_line(
        "SKU create / edit / archive",
        "DONE",
        "code, pack/size, unit, MOQ, step, status",
    )
    pdf.status_line(
        "Detail tabs",
        "DONE",
        "Overview, SKUs, Inventory, Price History, Images (read-only)",
    )
    pdf.status_line("React Query invalidation", "DONE", "existing mutations wired")
    pdf.status_line("Loading / success / error states", "DONE")

    pdf.section_title("4. Files Changed")
    pdf.bullet("apps/admin-web/src/pages/products/ProductListPage.tsx (+ CSS)")
    pdf.bullet("apps/admin-web/src/pages/products/ProductDetailPage.tsx (+ CSS)")
    pdf.bullet(
        "apps/admin-web/src/components/products/ProductFormModal.tsx (+ CSS) [new]"
    )
    pdf.bullet(
        "apps/admin-web/src/components/products/ProductsBrowseBar.tsx [new]"
    )
    pdf.bullet("apps/admin-web/src/components/products/ProductOverviewTab.tsx (+ CSS)")
    pdf.bullet("apps/admin-web/src/components/products/ProductSkusTab.tsx (+ CSS)")
    pdf.bullet("apps/admin-web/src/components/products/ProductImagesTab.tsx (+ CSS)")
    pdf.bullet("apps/admin-web/src/components/products/ProductQuickActions.tsx")
    pdf.bullet("apps/admin-web/src/data/product-types.ts")
    pdf.bullet("apps/admin-web/src/data/product-fixtures.ts")
    pdf.bullet("apps/admin-web/src/data/live/LiveAdminApi.ts")
    pdf.bullet("scripts/verify_admin_product_crud.mjs [new]")
    pdf.bullet(
        "scripts/generate_sprint1_product_management_report_pdf.py [this report]"
    )

    pdf.section_title("5. Verification Scorecard")
    pdf.status_line("Admin sign-in", "PASS")
    pdf.status_line("Categories available", "PASS")
    pdf.status_line("Create Product", "PASS")
    pdf.status_line("Edit Product", "PASS")
    pdf.status_line("Create SKU", "PASS")
    pdf.status_line("Edit SKU", "PASS")
    pdf.status_line("Archive SKU (soft-delete)", "PASS")
    pdf.status_line("SKU hidden after archive", "PASS")
    pdf.status_line("Archive Product (soft-delete)", "PASS")
    pdf.status_line("Product hidden after archive", "PASS")
    pdf.status_line("List refresh still works", "PASS")
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(
        0,
        6,
        "Result: COMPLETE - 11/11 automated checks passed",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 31, 24)
    pdf.body_text("admin-web tsc --noEmit: PASS. No linter errors on changed files.")

    pdf.section_title("6. Remaining Limitations")
    pdf.status_line(
        "Brand field",
        "PENDING",
        "not in catalogue schema; form notes not supported",
    )
    pdf.status_line(
        "Image upload",
        "PENDING",
        "no Storage bucket / product_images write API; UI marked pending, read-only",
    )
    pdf.status_line(
        "Duplicate Product",
        "PENDING",
        "button disabled with not available yet",
    )
    pdf.body_text(
        "Publish remains activate + checklist readiness; it does not upload "
        "images or schedule prices."
    )

    pdf.section_title("7. How to Re-verify")
    pdf.bullet("pnpm --filter @groaurum/admin-web exec tsc --noEmit")
    pdf.bullet("node scripts/verify_admin_product_crud.mjs")
    pdf.bullet(
        "UI: Admin Products with VITE_DATA_ADAPTER=supabase - create, edit, "
        "archive product; create/edit/archive SKU; confirm list filters and "
        "detail tabs."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
