"""Generate GroAurum Sprint 4.0 Business Scope Migration report PDF.

Outputs:
  - docs/GroAurum-Sprint4.0-Business-Scope-Migration.pdf
  - Desktop/groaurum-app.pdf
"""

from datetime import date
from pathlib import Path
import shutil

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Sprint4.0-Business-Scope-Migration.pdf"
DESKTOP_COPY = Path.home() / "Desktop" / "groaurum-app.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum - Sprint 4.0 Business Scope Migration",
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

    def h1(self, text: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(11, 83, 69)
        self.cell(
            0,
            7,
            text.encode("latin-1", "replace").decode("latin-1"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_draw_color(26, 141, 73)
        self.set_line_width(0.35)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def h2(self, text: str):
        self.ln(1)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(20, 70, 55)
        self.cell(
            0,
            5.5,
            text.encode("latin-1", "replace").decode("latin-1"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.ln(1)

    def p(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 4.3, text.encode("latin-1", "replace").decode("latin-1"))
        self.ln(0.6)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(15, 31, 24)
        indent = 4
        self.set_x(self.l_margin + indent)
        w = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(
            w, 4.1, f"- {text.encode('latin-1', 'replace').decode('latin-1')}"
        )
        self.set_x(self.l_margin)

    def mono(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 7.2)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 3.5, text.encode("latin-1", "replace").decode("latin-1"))
        self.ln(1.2)
        self.set_x(self.l_margin)

    def row(self, cols: list[str], widths: list[float], header: bool = False):
        if self.get_y() > 268:
            self.add_page()
        if header:
            self.set_font("Helvetica", "B", 7.2)
            self.set_fill_color(232, 246, 238)
        else:
            self.set_font("Helvetica", "", 6.8)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(15, 31, 24)
        y0 = self.get_y()
        x0 = self.l_margin
        heights = []
        for col, w in zip(cols, widths):
            self.set_xy(x0, y0)
            safe = col.encode("latin-1", "replace").decode("latin-1")
            self.multi_cell(w, 3.6, safe, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 4.0
        x0 = self.l_margin
        self.set_draw_color(200, 210, 205)
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)


def build() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(8)
    pdf.cell(0, 9, "GroAurum", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(
        0,
        7,
        "Sprint 4.0 - Business Scope Migration Report",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        6,
        "B2B wholesale grocery + FMCG  |  Initial area: South Delhi",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(
        0,
        6,
        f"Generated {date.today().isoformat()}  |  IMPLEMENTATION COMPLETE",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(3)

    pdf.h1("Verdict")
    pdf.p(
        "Sprint 4.0 code and seed changes are implemented. Active Gurugram / "
        "dry-fruit-only assumptions were removed from development seed, SKU units, "
        "customer catalogue, live cart, and admin defaults. Historical documentation "
        "and mock admin layout fixtures were left untouched."
    )
    pdf.p(
        "Status: BUSINESS SCOPE MIGRATION COMPLETE. Live database reset was not "
        "run on the implementation machine because Docker Desktop was not running."
    )

    pdf.h1("1. Scope of this sprint")
    pdf.bullet("New business: GroAurum B2B wholesale grocery + FMCG distribution.")
    pdf.bullet("Initial service area: South Delhi (not Gurugram).")
    pdf.bullet(
        "Initial categories from public.categories: Dry Fruits, Atta / Flour, "
        "Rice, Sugar, Spices, FMCG."
    )
    pdf.bullet("No brand table. No subcategory table. No core table rename.")
    pdf.bullet(
        "Orders, Payments, Delivery, Sales RPCs, RLS, and trusted workflow preserved."
    )
    pdf.bullet("Prefer seed/data changes. Only one focused RLS policy was added.")

    pdf.h1("2. Database / seed changes")
    pdf.p(
        "Stable seed UUIDs were kept so existing order lines, shops, and auth "
        "links remain valid. Geography and catalogue content were updated in place."
    )
    pdf.h2("Territory")
    tw = [48, 142]
    pdf.row(["Field", "New development value"], tw, header=True)
    pdf.row(["Service area", "South Delhi"], tw)
    pdf.row(["Warehouse", "South Delhi Warehouse 1 / Okhla / New Delhi / Delhi / 110020"], tw)
    pdf.row(["Company city", "New Delhi"], tw)
    pdf.row(
        [
            "Serviceable PINs",
            "110017 Saket, 110019, 110020 Okhla, 110024, 110048, 110062",
        ],
        tw,
    )
    pdf.ln(2)
    pdf.h2("Shops (same IDs, new addresses)")
    sw = [42, 78, 28, 42]
    pdf.row(["Shop", "Address", "PIN", "Area"], sw, header=True)
    pdf.row(["Sharma Kirana", "Press Enclave Road, Saket", "110017", "South Delhi"], sw)
    pdf.row(["Gupta Traders", "Okhla Industrial Area Phase 2", "110020", "South Delhi"], sw)
    pdf.row(["Anand General Store", "M-Block Market, Greater Kailash I", "110048", "South Delhi"], sw)
    pdf.row(["City Mart", "Main Market, Malviya Nagar", "110017", "South Delhi"], sw)
    pdf.row(["Royal Wholesale", "Krishna Market, Kalkaji", "110019", "South Delhi"], sw)
    pdf.ln(2)
    pdf.h2("Catalogue (Category -> Product -> SKU -> Price -> Inventory)")
    cw = [36, 62, 42, 50]
    pdf.row(["Category", "Sample product", "SKU unit", "Notes"], cw, header=True)
    pdf.row(["Dry Fruits", "California Almonds / W320 Cashews", "KG / CARTON", "Existing SKU IDs kept"], cw)
    pdf.row(["Atta / Flour", "Chakki Fresh Atta", "BAG", "New SKU"], cw)
    pdf.row(["Rice", "India Gate Basmati Rice", "BAG", "New SKU"], cw)
    pdf.row(["Sugar", "Refined Sugar", "KG", "New SKU"], cw)
    pdf.row(["Spices", "Garam Masala", "PACK", "New SKU"], cw)
    pdf.row(["FMCG", "Glucose Biscuits", "PCS", "New SKU"], cw)
    pdf.ln(2)
    pdf.p(
        "Existing sample order lines still point at almond KG and cashew CARTON. "
        "sprint7 / sprint8 inherit shops and were not duplicated."
    )
    pdf.bullet("Updated: supabase/seed/sprint4_seed.sql")
    pdf.bullet("Updated: supabase/seed/sprint6_customer_seed.sql (PIN rule)")
    pdf.bullet("Updated: supabase/fixtures/phase3_dev_fixtures.sql")
    pdf.bullet(
        "New migration: supabase/migrations/20260816120000_sprint40_customer_inventory_read.sql"
    )
    pdf.p(
        "The migration only adds a SELECT policy so authenticated CUSTOMER roles "
        "can read inventory_balances. No order, payment, delivery, or sales DDL."
    )

    pdf.h1("3. Selling units")
    pdf.p(
        "skus.selling_unit is already text. No extra unit table or enum migration "
        "was created. Application locks to CARTON / KG were removed."
    )
    pdf.p(
        "Supported units: KG, GRAM, BAG, PCS, BOX, PACK, TIN, CARTON, LITRE, BOTTLE."
    )
    pdf.bullet("Zod: packages/validation skuCreateSchema uses SELLING_UNITS.")
    pdf.bullet("Admin SKU form dropdown lists all units; edit no longer maps non-KG to CARTON.")
    pdf.bullet("Customer quantity step uses each SKU moq/step, not a nut-biased default of 10.")
    pdf.bullet("Packed carton SKUs still require packs_per_carton (existing DB check).")

    pdf.h1("4. Customer app changes")
    pdf.h2("Catalogue and UI copy")
    pdf.bullet("Category chips are built from live / mock categories, not hardcoded Dry Fruits / Spices.")
    pdf.bullet("Search placeholder: Search products (not Search dry fruits / almonds, cashews, dates).")
    pdf.bullet("Catalogue subtitle: Search products & wholesale SKUs.")
    pdf.bullet("Search matches product name, unit, grade, specification, description, and category name.")
    pdf.bullet("Mock adapter catalogue expanded to grocery + FMCG with South Delhi hubs.")
    pdf.h2("Live cart / checkout (highest-risk fix)")
    pdf.p(
        "When the Customer app is in Supabase adapter mode, cart confirmation no "
        "longer uses mock createOrder / validateCartStock."
    )
    pdf.bullet("Reads real product / SKU rows and effective trade prices.")
    pdf.bullet("Reads real available inventory from inventory_balances.")
    pdf.bullet("Validates MOQ, quantity step, and stock against live catalogue rows.")
    pdf.bullet("Places the order through place_customer_order (trusted RPC).")
    pdf.bullet("Returns the real order ID and shows it in Customer Orders.")
    pdf.bullet("placeCustomerOrder throws if called while mock mode is active.")
    pdf.p(
        "Mock mode still uses mock services. There is no silent fallback from "
        "Supabase mode to mock order creation."
    )

    pdf.h1("5. Admin changes")
    pdf.bullet(
        "CustomersListPage and SalesmenListPage no longer hardcode Gurugram / Haryana / 122001."
    )
    pdf.bullet(
        "New-customer defaults prefer the first live shop service area, city, and PIN."
    )
    pdf.bullet(
        "Fallback is central DEFAULT_SERVICE_TERRITORY: South Delhi / New Delhi / Delhi / 110017."
    )
    pdf.bullet(
        "Delivery map empty-address fallback is South Delhi from the same central constant, "
        "not Gurugram."
    )

    pdf.h1("6. Tests")
    tw2 = [72, 118]
    pdf.row(["Check", "Result"], tw2, header=True)
    pdf.row(["pnpm typecheck", "Passed"], tw2)
    pdf.row(
        [
            "Lint (shared-types, validation, customer, admin-web)",
            "Passed",
        ],
        tw2,
    )
    pdf.row(
        [
            "shared-types / validation / api-client tests",
            "Passed (South Delhi PINs; 122001 kept as NOT_SERVICEABLE)",
        ],
        tw2,
    )
    pdf.row(
        [
            "pnpm lint (full turbo)",
            "Pre-existing api-client notification.ts error",
        ],
        tw2,
    )
    pdf.row(
        [
            "pnpm test (full turbo)",
            "Pre-existing @groaurum/data has no test files",
        ],
        tw2,
    )
    pdf.row(
        [
            "pnpm db:reset",
            "Failed - Docker Desktop was not running",
        ],
        tw2,
    )
    pdf.ln(2)
    pdf.p(
        "Serviceability tests still verify a serviceable PIN, a non-serviceable PIN "
        "(122001 / Gurugram against South Delhi rules), and inactive area / inactive rule cases."
    )

    pdf.h1("7. Remaining old-scope references")
    pdf.p("These were left on purpose. This was not a blind find-and-replace.")
    pdf.bullet(
        "Admin mock layout fixtures (settings, delivery, reports, salesmen) still "
        "say Gurugram. Those are mock-mode layout data, not live seed."
    )
    pdf.bullet(
        "evaluateServiceabilityRules test still uses 122001 as a PIN that must NOT match "
        "a South Delhi rule."
    )
    pdf.bullet("Historical documentation and prior PDFs were not rewritten.")

    pdf.h1("8. Remaining mock-data paths")
    pdf.p(
        "The mock adapter remains for offline / demo development "
        "(EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock)."
    )
    pdf.bullet("Mock catalogue, mock geo, mock createOrder, mock restock history seeding.")
    pdf.bullet(
        "In Supabase mode: catalogue, stock, totals, and checkout do not create mock orders."
    )
    pdf.bullet("Order detail already branches on adapter mode.")

    pdf.h1("9. Files changed (summary)")
    pdf.h2("Shared")
    pdf.bullet("packages/shared-types: SELLING_UNITS, formatSellingUnitLabel, DEFAULT_SERVICE_TERRITORY")
    pdf.bullet("packages/validation: sku sellingUnit enum + BAG/PCS tests")
    pdf.bullet("packages/api-client: delivery map fallback; re-exports territory/units")
    pdf.h2("Customer")
    pdf.bullet("catalogue-browser.ts, catalogue.tsx, HomeSearchField, CatalogueSearchBar")
    pdf.bullet("customer-catalogue.ts (live stock), cart.tsx, store/cart.ts, store/hooks.ts")
    pdf.bullet("customer-orders.ts, restock.ts, product-b2b.ts, mock/data.ts, location.tsx")
    pdf.h2("Admin")
    pdf.bullet("ProductSkusTab.tsx, product-types.ts, LiveAdminApi.ts, business-defaults.ts")
    pdf.bullet("CustomersListPage.tsx, SalesmenListPage.tsx")
    pdf.h2("Tests / DB")
    pdf.bullet("db-tests fixtures + service-area / phase3 / shop-link tests")
    pdf.bullet("sprint4_seed.sql, sprint6_customer_seed.sql, phase3_dev_fixtures.sql")
    pdf.bullet("20260816120000_sprint40_customer_inventory_read.sql")

    pdf.h1("10. Verification still required locally")
    pdf.p("After Docker Desktop is running:")
    pdf.mono(
        "pnpm db:reset\n"
        "pnpm db:seed:sprint4\n"
        "# then apply sprint6 (and 7/8 if those apps are in use)"
    )
    pdf.p("Then confirm:")
    for item in [
        "South Delhi serviceability works; Gurugram 122001 is not the active area",
        "Categories show Dry Fruits, Atta, Rice, Sugar, Spices, FMCG",
        "Admin can create SKUs with KG, BAG, and PCS",
        "Customer can browse and search across all categories",
        "Customer cart reads live Supabase stock and prices",
        "Checkout creates a real place_customer_order result (no mock order)",
        "The new order appears in Customer Orders and Admin Orders",
        "Order -> Delivery -> Payment -> Sale workflow still works",
    ]:
        pdf.bullet(item)

    pdf.h1("11. Safety notes")
    pdf.bullet("No core tables renamed.")
    pdf.bullet("No Orders / Payments / Delivery / Sales redesign.")
    pdf.bullet("No brand or subcategory tables.")
    pdf.bullet("Categories are data-driven; adding a category does not require app code.")
    pdf.bullet("Blind replace of Gurugram / dry fruit was not used.")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 7, "BUSINESS SCOPE MIGRATION COMPLETE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4,
        "Repo copy: docs/GroAurum-Sprint4.0-Business-Scope-Migration.pdf  |  "
        "Desktop copy: groaurum-app.pdf",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    shutil.copy2(OUTPUT, DESKTOP_COPY)
    print(f"Wrote {OUTPUT}")
    print(f"Copied to {DESKTOP_COPY}")


if __name__ == "__main__":
    build()
