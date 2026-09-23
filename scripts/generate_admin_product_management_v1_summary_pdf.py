"""Generate GroAurum Admin Product Management v1 summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Admin-Product-Management-v1-Summary.pdf"
PHASE3_COMMIT = "af9e616"


class ProductMgmtPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Admin - Product Management v1",
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
    pdf = ProductMgmtPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Admin Product Management v1", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        "Wholesale product, SKU, pricing, inventory readiness, and publication\n"
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
        "This is NOT a simple CRUD page. Operators manage catalogue readiness and "
        "publish status with a checklist before a product goes live.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Purpose")
    pdf.body_text(
        "Allow administrators to manage wholesale products, SKUs, pricing readiness, "
        "inventory readiness, and publication status inside the GroAurum Admin shell. "
        "Sidebar navigation is unchanged; Products is a full module instead of a placeholder."
    )

    pdf.section_title("2. Design Principles")
    for item in [
        "Professional SaaS, desktop-first, high information density",
        "GroAurum Design System - white cards, green branding, 8px spacing",
        "No clutter, no marketing widgets",
        "Reusable admin components (Card, Badge, Button, Tabs, tables)",
        "No backend CRUD in v1 - typed fixtures ready for Supabase later",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Product List")
    pdf.body_text("Route: /products")
    rows = [
        ("Column", "Meaning"),
        ("Product", "Name - links to detail"),
        ("Category", "Assigned catalogue category"),
        ("SKU Count", "Number of SKUs under the product"),
        ("Current Trade Price", "Primary priced SKU label, or - if not ready"),
        ("Inventory Status", "In stock / Low / Out / Not tracked"),
        ("Publish Status", "Draft / Published / Archived"),
        ("Updated", "Last update timestamp label"),
    ]
    widths = [50, 130]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("4. Product Detail")
    pdf.body_text("Route: /products/:productId")
    for item in [
        "Overview - category, statuses, SKU count, trade price, timestamps, description",
        "SKUs - code, grade, selling unit, MOQ, step, packs/carton, price, inventory",
        "Price History - append-only style trade price rows",
        "Inventory - movement readiness table (receipts / sales / adjustments)",
        "Images - file labels with primary/gallery role",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("5. Product Status")
    for item in [
        "Draft - work in progress; may fail publish checklist",
        "Published - live for catalogue consumption when checklist is complete",
        "Archived - retained historically; archive/publish actions disabled",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Publish Checklist")
    pdf.body_text(
        "Before Publish is enabled, every checklist item must be ready:"
    )
    for item in [
        "Category",
        "Image",
        "SKU",
        "Current Price",
        "MOQ",
        "Selling Unit",
        "Inventory",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Checklist is derived by buildPublishChecklist() from product readiness flags. "
        "canPublish is true only when all items pass and the product is not archived."
    )

    pdf.section_title("7. Quick Actions")
    for item in [
        "Add Product",
        "Duplicate Product",
        "Archive",
        "Publish (disabled until checklist ready; disabled when already published/archived)",
    ]:
        pdf.bullet(item)
    pdf.body_text(
        "Actions are UI-only stubs in v1 - handlers are no-ops until backend CRUD exists."
    )

    pdf.section_title("8. Data Preparation")
    pdf.mono_block(
        "apps/admin-web/src/data/product-types.ts\n"
        "apps/admin-web/src/data/product-fixtures.ts\n"
        "# PRODUCT_LIST_FIXTURE + PRODUCT_DETAIL_FIXTURES\n"
        "# Replace with Supabase catalogue / price / inventory queries"
    )

    pdf.add_page()
    pdf.section_title("9. Files")
    for item in [
        "pages/products/ProductListPage.tsx - list + list-level quick actions",
        "pages/products/ProductDetailPage.tsx - tabs + checklist + actions",
        "components/products/* - table, badges, checklist, tabs content, actions",
        "components/ui/Tabs.tsx - reusable admin tabs",
        "App.tsx - /products and /products/:productId routes",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Sidebar / Dashboard layout", "Unchanged"),
        ("Backend CRUD", "Not implemented (by design)"),
    ]
    w2 = [120, 60]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("11. How to Review")
    pdf.mono_block(
        "pnpm dev:admin\n"
        "# Open http://localhost:5173/products\n"
        "# Akhrot Giri - published, checklist complete\n"
        "# Kashmiri Chilli - draft, missing image blocks Publish\n"
        "# Festival Assortment - incomplete draft\n"
        "# Legacy Gift Mix - archived"
    )

    pdf.section_title("12. Out of Scope")
    for item in [
        "Supabase create / update / archive / publish mutations",
        "Image upload and media storage",
        "Live price history and inventory ledgers",
        "Categories / Pricing module UIs beyond Products",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Intent")
    pdf.body_text(
        "Product Management should feel like a wholesale catalogue control room: "
        "see readiness at a glance, inspect SKUs and commercial history, and publish "
        "only when category, image, SKU, price, MOQ, selling unit, and inventory are ready."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
