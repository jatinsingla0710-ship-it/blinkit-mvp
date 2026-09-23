"""Generate GroAurum Business Scope Audit PDF (inspect-only findings).

Outputs:
  - docs/GroAurum-Business-Scope-Audit.pdf
  - Desktop/groaurum-app.pdf
"""

from datetime import date
from pathlib import Path
import shutil

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Business-Scope-Audit.pdf"
DESKTOP_COPY = Path.home() / "Desktop" / "groaurum-app.pdf"


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum - Business Scope Audit (NO FILES MODIFIED)",
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
        self.multi_cell(w, 4.1, f"- {text.encode('latin-1', 'replace').decode('latin-1')}")
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
    pdf = AuditPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 9, "GroAurum", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Business Scope Audit Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        6,
        "Dry-fruit / Gurugram / Fatehpur Beri  ->  Grocery+FMCG / South Delhi",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(
        0,
        6,
        f"Generated {date.today().isoformat()}  |  AUDIT ONLY  |  NO FILES MODIFIED",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(3)
    pdf.p(
        "This report inspects the repository only. No code, database, seeds, UI, "
        "or business logic were changed. It lists where the old scope is hardcoded "
        "and what must change before the new business can be used."
    )

    pdf.h1("0. Scope change")
    w0 = [45, 145]
    pdf.row(["", "Definition"], w0, header=True)
    pdf.row(["OLD", "Dry-fruit-only B2B. Launch market Gurugram. Ops Fatehpur Beri."], w0)
    pdf.row(
        [
            "NEW",
            "B2B wholesale grocery + FMCG. Initial area: South Delhi. "
            "Categories: Dry Fruits, Atta/Flour, Rice, Sugar, Spices, FMCG. "
            "Future categories should be data-driven (no code per category).",
        ],
        w0,
    )

    pdf.h1("1. Old terminology - dry fruit")
    wd = [62, 18, 28, 22, 50]
    pdf.row(["File", "Line", "Type", "Change?", "What it does"], wd, header=True)
    for r in [
        ("README.md", "3", "Docs", "MUST", "Product one-liner: dry-fruit wholesale"),
        ("customer/catalogue-browser.ts", "8-112", "Logic/UI", "MUST", "Hardcoded dry_fruits filter + nut regex"),
        ("customer/catalogue.tsx", "125", "UI", "MUST", "Subtitle: Search dry fruits"),
        ("HomeSearchField / CatalogueSearchBar", "16-17", "UI", "MUST", "almonds, cashews, dates..."),
        ("customer/services/mock/data.ts", "81+", "Demo", "MUST", "Dry-fruit mock catalogue"),
        ("supabase/seed/sprint4_seed.sql", "193-355", "Seed", "MUST", "Almonds/Cashews; Anand Dry Fruits"),
        ("phase3_dev_fixtures.sql", "32", "Fixture", "P2", "Shop Test Dry Fruits"),
        ("admin *-fixtures.ts", "many", "Fixture", "P2", "City Dry Fruits shop name"),
        ("scripts/generate_*.py + docs PDFs", "var", "Docs", "Remain", "Historical wording"),
    ]:
        pdf.row(list(r), wd)

    pdf.h1("2. Old terminology - Gurugram / Gurgaon / 122001")
    pdf.row(["File", "Line", "Type", "Change?", "What it does"], wd, header=True)
    for r in [
        ("README.md", "5", "Docs", "MUST", "Launch market: Gurugram"),
        ("sprint4_seed.sql", "165-524", "Seed", "MUST", "Area, warehouse, shops, company city"),
        ("sprint6_customer_seed.sql", "72,99-107", "Seed", "MUST", "PIN rule 122001"),
        ("CustomersListPage.tsx", "46-48", "Logic", "MUST", "Quick-create Gurugram/Haryana/122001"),
        ("SalesmenListPage.tsx", "67-69", "Logic", "MUST", "Same hardcoded address"),
        ("api-client/.../delivery.ts", "349", "Logic", "MUST", "Maps fallback address || Gurugram"),
        ("admin settings/delivery/salesmen/reports fixtures", "var", "Fixture", "P2", "Territory Gurugram / Okhla mix"),
        ("packages/db-tests fixtures + tests", "var", "Test", "P1", "122001, Gurugram, HR-GURGAON"),
        ("serviceability evaluate.test.ts", "143-149", "Test", "P1", "Admin area Gurugram"),
        ("docs/architecture + PDF scripts", "var", "Docs", "Remain", "Launch-market narrative"),
    ]:
        pdf.row(list(r), wd)

    pdf.h1("3. Fatehpur Beri")
    pdf.p(
        "Appears only in README, a TypeScript comment "
        "(packages/shared-types/src/operational-location.ts), and historical PDF scripts. "
        "NOT in live schema or seeds. Seed warehouse is 'Gurugram Warehouse 1'. "
        "No DB row to migrate."
    )
    pdf.p("South Delhi: zero matches anywhere in the repository.")

    pdf.h1("4. Related hardcoded assumptions")
    pdf.bullet("PIN 122001 (Gurugram) in seeds, admin create, db-tests - MUST change.")
    pdf.bullet("State Haryana on seed shops and admin create - MUST change.")
    pdf.bullet("Selling units CARTON/KG only (Zod + Admin SKU form) - MUST for FMCG (BAG/PCS/TIN).")
    pdf.bullet("Product types PACKED/BULK only in Zod/Admin form - recommended to add UNIT.")
    pdf.bullet("Customer mock hubs: CP / Saket / Noida (already Delhi-ish; Noida is outside new scope).")
    pdf.bullet("Salesman mock shops: Mumbai (Andheri/Bandra) - P2 if mock API used.")
    pdf.bullet("Settings fixtures mix Okhla (South Delhi-adjacent) and Gurugram.")

    pdf.h1("5. Product architecture")
    pdf.p("Current DB model:")
    pdf.mono("Category (flat) -> Product -> SKU -> sku_prices + inventory_balances")
    pdf.p("Desired model:")
    pdf.mono("Category -> Subcategory -> Brand -> Product -> SKU -> Pricing -> Inventory")
    wa = [36, 28, 116]
    pdf.row(["Layer", "Status", "Notes"], wa, header=True)
    for r in [
        ("Category", "Data-driven", "categories table; Admin can create"),
        ("Subcategory", "MISSING", "No parent_id - new families are siblings only"),
        ("Brand", "MISSING", "No brands table - cannot model Aashirvaad / India Gate"),
        ("Product", "OK", "category_id + name + product_type text"),
        ("SKU / variant", "Partial", "grade/spec/unit are columns; units locked in app"),
        ("Pricing", "OK", "Per-SKU trade price, not category-specific"),
        ("Inventory", "OK", "Per SKU + warehouse"),
        ("Images", "OK", "product_images + products.image_urls"),
        ("Search/filters", "Hardcoded", "Customer chips + dry-fruit regex"),
        ("Admin forms", "Unit-locked", "CARTON/KG and PACKED/BULK only"),
        ("Customer live cat.", "OK", "Reads DB; mock path is dry-fruit-only"),
    ]:
        pdf.row(list(r), wa)
    pdf.p(
        "Verdict: You CAN add Atta / Rice / Sugar / Spices / FMCG as category rows "
        "with no migration. You CANNOT do real subcategory or brand trees. "
        "FMCG units are blocked by Zod + Admin form, not by Postgres (selling_unit is text)."
    )

    pdf.h1("6. Category audit")
    pdf.bullet("Stored in DB: YES (public.categories). Unique name. No dry-fruit enum.")
    pdf.bullet("Hardcoded in frontend: YES - CATALOGUE_FILTER_CHIPS all/packed/bulk/dry_fruits/spices.")
    pdf.bullet("Zod category schema: name + displayOrder only - no dry-fruit validation.")
    pdf.bullet("Category-specific UI: customer chips + isDryFruitsCategory / isSpicesCategory.")
    pdf.bullet("Admin product category dropdown: live DB (good).")

    pdf.h1("7. Location / service area")
    pdf.p(
        "Schema is flexible: service_areas, serviceability_rules (PIN_CODE / ADMIN_AREA / POLYGON), "
        "operational_locations, shops.delivery_city / delivery_pin_code (6-digit check only). "
        "Evaluator is list-based, not Gurugram-specific."
    )
    pdf.h2("Must change for South Delhi ops")
    pdf.bullet("Seed area Gurugram Central; warehouse Sector 37 / 122001 / Haryana.")
    pdf.bullet("sprint4 shops: city Gurugram, most PINs 122001.")
    pdf.bullet("sprint6 rule pinCodes [122001] - live customer serviceability.")
    pdf.bullet("Admin quick-create customer/salesman defaults.")
    pdf.bullet("Delivery maps fallback 'Gurugram'.")
    pdf.bullet("Tests using 122001 and HR-GURGAON.")
    pdf.h2("Later (do not implement in this audit)")
    pdf.bullet("New service_areas row e.g. South Delhi.")
    pdf.bullet("PIN_CODE rule with 1100xx (Saket 110017, Okhla 110020, GK, etc.).")
    pdf.bullet("Warehouse + shops in Delhi; company city; admin defaults; db-tests.")
    pdf.bullet("Admin /service-areas route is still PlaceholderPage - Settings tab incomplete.")

    pdf.h1("8. Seeds and fixtures")
    ws = [72, 108]
    pdf.row(["File", "Needs update?"], ws, header=True)
    for r in [
        ("supabase/seed/sprint4_seed.sql", "YES - primary (geo + catalogue + company)"),
        ("supabase/seed/sprint6_customer_seed.sql", "YES - PIN 122001 + comments"),
        ("supabase/seed/sprint7_salesman_seed.sql", "Indirect - inherits sprint4 shops"),
        ("supabase/seed/sprint8_delivery_seed.sql", "Indirect - same"),
        ("supabase/fixtures/phase3_dev_fixtures.sql", "Yes for consistency"),
        ("packages/db-tests/src/fixtures.ts", "Yes with seed change"),
        ("admin *-fixtures.ts", "Yes if mock admin still used"),
        ("customer services/mock/data.ts", "Yes - dry fruit + geo"),
    ]:
        pdf.row(list(r), ws)

    pdf.h1("9. Customer app + mock bleed")
    pdf.p(
        "Dry-fruit: mock catalogue, filter chips, search copy. "
        "Gurugram: NOT in mock geo (Delhi/Noida). YES in live via seed PIN 122001. "
        "No Atta/Rice/Sugar/FMCG in mock or sprint4 seed."
    )
    pdf.h2("Exact mock bleed")
    wm = [78, 102]
    pdf.row(["File", "Issue"], wm, header=True)
    for r in [
        ("app/cart.tsx", "createOrder/validateCartStock from mock - live confirm does NOT call place_customer_order"),
        ("store/cart.ts", "getLiveStock from mock/catalog"),
        ("store/hooks.ts", "computeTotals from mock/orders"),
        ("store/location.ts", "findNearestStore from mock/geo"),
        ("app/location.tsx", "Mock addresses - OK if mock adapter only"),
        ("services/restock.ts", "getOrders + seedMockDeliveredOrder (live branch uses fetchCustomerOrders)"),
        ("services/home-summary.ts", "Mock last-order fallback in mock mode"),
        ("app/order/[id].tsx", "Mock only when isMockAdapterMode() - correctly gated"),
    ]:
        pdf.row(list(r), wm)
    pdf.p("Highest-risk bleed: cart confirm + cart stock remain mock even if adapter is supabase.")

    pdf.h1("10. Admin / Salesman / Delivery")
    pdf.bullet("Admin Products: form locked PACKED/BULK, CARTON/KG; categories from DB (good).")
    pdf.bullet("Admin Categories page: data-driven create - ready for grocery rows.")
    pdf.bullet("Admin Customers/Salesmen create: Gurugram/122001.")
    pdf.bullet("Admin Service Areas route: PlaceholderPage. Settings mutations deferred.")
    pdf.bullet("Reports: placeholders + Gurugram/Okhla fixture charts.")
    pdf.bullet("Salesman PWA: no dry-fruit/Gurugram strings. Mock shops are Mumbai.")
    pdf.bullet("Delivery PWA: no dry-fruit/Gurugram in app. Inherits seed shops. Shared maps fallback Gurugram.")

    pdf.h1("11. Database")
    pdf.p(
        "No migration required to start if you only insert new rows. "
        "Order/payment/delivery RPCs, RLS, and trusted workflow are not city- or category-specific. "
        "Do not rename tables."
    )
    pdf.p("Later (recommended, not now): categories.parent_id; brands + products.brand_id.")

    pdf.h1("A. Critical changes (P0)")
    pdf.bullet("Replace seed geography: area, PINs, warehouse, shops, company city -> South Delhi.")
    pdf.bullet("Replace seed catalogue: Dry Fruits, Atta, Rice, Sugar, Spices, FMCG.")
    pdf.bullet("Admin create defaults: stop Gurugram / 122001 / Haryana.")
    pdf.bullet("Customer live serviceability: 122001 will mark South Delhi shops unserviceable.")
    pdf.bullet("Customer mock + filter chips + search copy.")
    pdf.bullet("Unlock selling units in Zod + Admin SKU form.")
    pdf.bullet("Fix cart mock bleed so Confirm writes live orders.")

    pdf.h1("B. Recommended / C. No change")
    pdf.h2("Recommended")
    pdf.bullet("Subcategory + brand tables when assortment grows.")
    pdf.bullet("Real Service Areas page + Settings writes.")
    pdf.bullet("Maps default South Delhi; db-tests off 122001; README; salesman mock geo.")
    pdf.bullet("Historical PDFs can stay; regenerate status PDF later.")
    pdf.h2("No change required")
    pdf.bullet("Order / payment / delivery / sales RPCs and RLS.")
    pdf.bullet("Pricing + inventory model; categories/products/skus/sku_prices shapes.")
    pdf.bullet("Serviceability engine (PIN/area/polygon).")
    pdf.bullet("Salesman/Delivery feature code (no dry-fruit logic).")

    pdf.h1("D. Files requiring modification")
    wf = [78, 22, 20, 60]
    pdf.row(["File", "Priority", "Type", "Reason"], wf, header=True)
    for r in [
        ("README.md", "P0", "Docs", "Product + market one-liner"),
        ("supabase/seed/sprint4_seed.sql", "P0", "Seed", "Area, warehouse, shops, catalogue"),
        ("supabase/seed/sprint6_customer_seed.sql", "P0", "Seed", "PIN 122001"),
        ("CustomersListPage.tsx", "P0", "Logic", "Hardcoded Gurugram/122001"),
        ("SalesmenListPage.tsx", "P0", "Logic", "Same"),
        ("customer/catalogue-browser.ts", "P0", "Logic/UI", "Dry-fruit/spice filters"),
        ("catalogue.tsx + search fields", "P0", "UI", "Dry-fruit copy"),
        ("customer/services/mock/data.ts", "P0", "Demo", "Catalogue + geo"),
        ("customer/app/cart.tsx + store/cart.ts", "P0", "Logic", "Mock place-order / stock"),
        ("packages/validation/.../crud.ts", "P0", "Validation", "CARTON/KG + PACKED/BULK"),
        ("ProductSkusTab.tsx", "P0", "UI", "Unit dropdown"),
        ("ProductFormModal.tsx", "P1", "UI", "Type dropdown"),
        ("api-client/.../delivery.ts", "P1", "Logic", "Maps Gurugram"),
        ("customer/utils/product-b2b.ts", "P1", "Logic", "KG/carton labels, step 10"),
        ("admin App.tsx + SettingsPage", "P1", "UI/Logic", "Service Areas placeholder"),
        ("packages/db-tests/**", "P1", "Test", "122001 / Gurugram / HR-GURGAON"),
        ("phase3_dev_fixtures + admin fixtures", "P2", "Fixture", "City Dry Fruits / Gurugram"),
        ("sales-pwa salesmanApi.ts", "P2", "Demo", "Mumbai mock shops"),
        ("operational-location.ts comment", "P3", "Docs", "Fatehpur comment"),
        ("scripts/generate_*.py + docs PDFs", "P3", "Docs", "Historical wording"),
    ]:
        pdf.row(list(r), wf)

    pdf.h1("E / F. Database and seed changes")
    pdf.h2("Database (none required to start)")
    pdf.bullet("No DDL required to insert South Delhi area + grocery categories.")
    pdf.bullet("Later: parent_id on categories; brands table. Do not implement in this audit.")
    pdf.h2("Seeds required")
    pdf.bullet("Service area South Delhi + PIN list 110017 / 110019 / 110020 / 110024 / 110048 / 110062 ...")
    pdf.bullet("Warehouse in South Delhi; shops with Delhi PINs.")
    pdf.bullet("Categories + sample SKUs per family; company city; sprint6 PIN rule.")
    pdf.bullet("sprint7/8 inherit sprint4 shops/routes - reset together.")

    pdf.h1("G / H / I. App file lists")
    pdf.h2("Customer")
    pdf.bullet("Home search, catalogue subtitle/chips, mock/data.ts, location presets.")
    pdf.bullet("cart.tsx + store/cart.ts (live place_customer_order).")
    pdf.bullet("product-b2b.ts unit labels. Order detail already gated.")
    pdf.h2("Admin")
    pdf.bullet("Customers/Salesmen create defaults; Product/SKU forms; Categories (add rows).")
    pdf.bullet("Settings / Service Areas; delivery maps default; fixtures if mock admin.")
    pdf.h2("Salesman / Delivery")
    pdf.bullet("salesmanApi.ts mock shops; shared delivery.ts maps fallback; seeds only for routes.")

    pdf.h1("J. Recommended implementation order")
    pdf.bullet("1. Data first: new seed area + PINs + warehouse + grocery categories/SKUs. Then db:reset.")
    pdf.bullet("2. Serviceability: sprint6 PIN rule + db-tests in the same change-set.")
    pdf.bullet("3. Admin defaults + SKU units so ops can enter Atta/Rice/FMCG.")
    pdf.bullet("4. Customer copy + filters driven by DB categories.")
    pdf.bullet("5. Align customer mock catalogue/geo (or disable mock for demos).")
    pdf.bullet("6. Fix cart mock bleed so Confirm writes live orders.")
    pdf.bullet("7. Settings / Service Areas UI so city expansion is data, not another seed edit.")
    pdf.bullet("8. Brand + subcategory migration only when assortment needs it.")
    pdf.bullet("9. README / status PDF last.")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(0, 6, "AUDIT COMPLETE - NO FILES MODIFIED")
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(90, 90, 90)
    pdf.ln(2)
    pdf.multi_cell(
        0,
        4,
        "Repo: docs/GroAurum-Business-Scope-Audit.pdf  |  "
        "Desktop: groaurum-app.pdf  |  "
        "Regenerate: python scripts/generate_business_scope_audit_pdf.py",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    shutil.copy2(OUTPUT, DESKTOP_COPY)
    print(f"Wrote {OUTPUT}")
    print(f"Copied to {DESKTOP_COPY}")


if __name__ == "__main__":
    build()
