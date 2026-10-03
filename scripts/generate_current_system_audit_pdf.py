#!/usr/bin/env python3
"""Generate CURRENT_SYSTEM_AUDIT_ADMIN_SALESMAN_DELIVERY.pdf — documentation only."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "CURRENT_SYSTEM_AUDIT_ADMIN_SALESMAN_DELIVERY.pdf"


def safe(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2192", "->")
        .replace("\u2193", "|")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "-")
        .replace("\u00d7", "x")
        .replace("\u2026", "...")
        .replace("\u2705", "[OK]")
        .replace("\u26a0", "[!]")
        .replace("\u274c", "[X]")
        .replace("\u26aa", "[ ]")
        .replace("\U0001f7e1", "[~]")
        .replace("\U0001f535", "[B]")
        .replace("\U0001f7e3", "[U]")
        .replace("\u2753", "[?]")
        .encode("latin-1", "replace")
        .decode("latin-1")
    )


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(110, 110, 110)
            self.cell(
                0,
                7,
                "GroAurum - Current System Audit (Admin + Salesman + Delivery)",
                align="R",
                new_x="LMARGIN",
                new_y="NEXT",
            )
            self.ln(1)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(110, 110, 110)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}} | Generated {date.today().isoformat()}", align="C")

    def h1(self, title: str):
        self.ln(4)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(11, 83, 69)
        self.multi_cell(0, 7, safe(title))
        self.set_draw_color(26, 141, 73)
        self.set_line_width(0.4)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(3)

    def h2(self, title: str):
        self.ln(2)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(20, 60, 50)
        self.multi_cell(0, 6, safe(title))
        self.ln(1)

    def h3(self, title: str):
        self.ln(1)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5, safe(title))

    def p(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(20, 30, 25)
        self.multi_cell(0, 4.4, safe(text))
        self.ln(0.5)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(20, 30, 25)
        indent = 4
        self.set_x(self.l_margin + indent)
        w = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(w, 4.3, safe(f"- {text}"))
        self.set_x(self.l_margin)

    def kv(self, key: str, value: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(20, 30, 25)
        prefix = safe(f"{key}: ")
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 4.3, prefix + safe(value))

    def code(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 7.5)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 3.8, safe(text))
        self.ln(0.5)

    def table(self, headers: list[str], rows: list[list[str]], col_widths: list[float] | None = None):
        if not rows:
            return
        usable = self.w - self.l_margin - self.r_margin
        if col_widths is None:
            col_widths = [usable / len(headers)] * len(headers)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 7)
        self.set_fill_color(230, 242, 236)
        self.set_text_color(20, 30, 25)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 5, safe(h)[:48], border=1, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 6.5)
        fill = False
        for row in rows:
            if self.get_y() > self.h - 22:
                self.add_page()
                self.set_x(self.l_margin)
                self.set_font("Helvetica", "B", 7)
                self.set_fill_color(230, 242, 236)
                for i, h in enumerate(headers):
                    self.cell(col_widths[i], 5, safe(h)[:48], border=1, fill=True)
                self.ln()
                self.set_font("Helvetica", "", 6.5)
            self.set_x(self.l_margin)
            if fill:
                self.set_fill_color(248, 250, 249)
            else:
                self.set_fill_color(255, 255, 255)
            # Single-line truncated cells for reliability
            for i, cell in enumerate(row):
                text = safe(str(cell))
                max_chars = max(6, int(col_widths[i] / 1.55))
                if len(text) > max_chars:
                    text = text[: max_chars - 3] + "..."
                self.cell(col_widths[i], 4.8, text, border=1, fill=True)
            self.ln()
            fill = not fill
        self.ln(2)
        self.set_x(self.l_margin)


def build() -> Path:
    pdf = AuditPdf(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.alias_nb_pages()

    # ---- COVER ----
    pdf.add_page()
    pdf.ln(40)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(0, 10, safe("CURRENT SYSTEM AUDIT"), align="C")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, safe("Admin + Salesman + Delivery"), align="C")
    pdf.ln(6)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 6, safe("GroAurum / blinkit-mvp monorepo"), align="C")
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 6, safe(f"Audit date: {date.today().isoformat()}"), align="C")
    pdf.ln(10)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(140, 40, 40)
    pdf.multi_cell(0, 5, safe("DOCUMENTATION / AUDIT ONLY"), align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(60, 60, 60)
    for line in [
        "No application code was modified.",
        "No database schema or migrations were modified.",
        "No production data was changed.",
        "Findings are based on repository inspection.",
        'Uncertain items are marked UNVERIFIED.',
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, safe(line), align="C")
    pdf.ln(12)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 8)
    pdf.multi_cell(
        0,
        4,
        safe(
            "Primary apps audited: apps/admin-web, apps/sales-pwa, apps/delivery-pwa. "
            "Also discovered: apps/customer (Expo B2B customer app) - documented as adjacent scope. "
            "Shared packages under packages/. Database under supabase/migrations/."
        ),
        align="C",
    )

    # ---- TOC ----
    pdf.add_page()
    pdf.h1("Table of Contents")
    toc = [
        "1. Executive Summary",
        "2. Repository Architecture",
        "3. Admin App - Routes, Navigation, Auth",
        "4. Salesman App - Complete Screen Map",
        "5. Delivery App - Complete Screen Map",
        "6. UI Design System",
        "7. UX Notes (descriptive)",
        "8. Database Inventory",
        "9. Relationships & Lifecycles",
        "10. RLS / Security",
        "11. RPC Inventory",
        "12. API / LiveAdminApi Map",
        "13. Catalogue / Selling Units",
        "14. Orders / Inventory / Purchasing",
        "15. Accounting / P&L / GST",
        "16. Payroll / Commission / Attendance",
        "17. Payments / Collections / Delivery COD",
        "18. Photos / Camera / Media",
        "19. Notifications / Offline / PWA",
        "20. Reports / Settings / Deployment",
        "21. Tests & Verification",
        "22. Migrations Chronology",
        "23. Dead / Compatibility Code",
        "24. Feature Status Matrix",
        "25. Built / Missing / Partial",
        "26. Technical Risks & Performance",
        "27. Future Backlog (factual, not implemented)",
        "28. Appendices - Source References",
    ]
    for t in toc:
        pdf.bullet(t)

    # ---- 1 EXEC ----
    pdf.add_page()
    pdf.h1("1. Executive Summary")
    pdf.p(
        "GroAurum is a pnpm + Turborepo monorepo for B2B grocery wholesale operations. "
        "Three primary field/ops frontends share Supabase Postgres (RLS + SECURITY DEFINER RPCs) "
        "via @groaurum/api-client and @groaurum/auth."
    )
    pdf.h2("Apps")
    pdf.table(
        ["App", "Path", "Stack", "Audience"],
        [
            ["Admin ERP", "apps/admin-web", "Vite + React + RQ", "admin_erp"],
            ["Sales PWA", "apps/sales-pwa", "Vite + React + RQ", "sales_pwa / salesman"],
            ["Delivery PWA", "apps/delivery-pwa", "Vite + React + RQ", "delivery_pwa / delivery_executive"],
            ["Customer*", "apps/customer", "Expo Router 57", "customer (adjacent)"],
        ],
        [35, 45, 55, 45],
    )
    pdf.p("*Customer app exists and is active code (not a stub) but was outside the primary three-app request; noted for completeness.")

    pdf.h2("Scale (inspected)")
    pdf.bullet("Admin routes: 49 entries (1 login + 47 guarded pages + catch-all) - apps/admin-web/src/App.tsx")
    pdf.bullet("Sales routes: 21+ paths - apps/sales-pwa/src/App.tsx")
    pdf.bullet("Delivery routes: 6 paths - apps/delivery-pwa/src/App.tsx")
    pdf.bullet("SQL migrations: 97 files (excl. MIGRATION_INDEX.md)")
    pdf.bullet("Public tables created in migrations: ~67")
    pdf.bullet("admin_* RPCs: ~69; salesman_*: ~25; delivery_*: ~10")
    pdf.bullet("LiveAdminApi async methods: ~142 - apps/admin-web/src/data/live/LiveAdminApi.ts")
    pdf.bullet("Admin page TSX modules: 47; Sales pages: ~25; Delivery pages: 6")

    pdf.h2("Architecture pattern (confirmed)")
    pdf.code("UI -> React Query hooks -> LiveAdminApi / SalesmanApi / DeliveryApi")
    pdf.code("  -> Supabase JS (anon) -> RLS + SECURITY DEFINER RPCs -> Postgres")

    pdf.h2("Honest gaps (confirmed in code)")
    pdf.bullet("No COGS / inventory valuation / weighted average - P&L uses Operating Result")
    pdf.bullet("No supplier ledger / supplier payments (Phase 5A purchasing is draft->receive only)")
    pdf.bullet("No full GST engine (supplier GSTIN + purchase tax_amount field only)")
    pdf.bullet("Delivery photo/signature are UI placeholders (boolean flags only)")
    pdf.bullet("database.generated.ts is stale; app types use database.extended.ts")

    # ---- 2 REPO ----
    pdf.add_page()
    pdf.h1("2. Repository Architecture")
    pdf.h2("Root layout")
    pdf.bullet("apps/ - frontends")
    pdf.bullet("packages/ - shared libraries")
    pdf.bullet("supabase/migrations/ - schema + RLS + RPCs")
    pdf.bullet("scripts/ - db helpers, verify scripts, PDF generators")
    pdf.bullet("docs/ - architecture notes, prior audits, this PDF")

    pdf.h2("Packages")
    pdf.table(
        ["Package", "Path", "Purpose"],
        [
            ["@groaurum/api", "packages/api", "Repositories / services / adapters"],
            ["@groaurum/api-client", "packages/api-client", "Supabase client + salesman/delivery services + DB types"],
            ["@groaurum/auth", "packages/auth", "Session, audiences, RBAC modules"],
            ["@groaurum/ui", "packages/ui", "Web design system + tokens.css"],
            ["@groaurum/shared-types", "packages/shared-types", "Enums + domain types"],
            ["@groaurum/catalogue-display", "packages/catalogue-display", "Packaging/pricing display math"],
            ["@groaurum/data", "packages/data", "Domain models / query contracts"],
            ["@groaurum/validation", "packages/validation", "Zod schemas"],
            ["@groaurum/config", "packages/config", "ESLint / tsconfig shared"],
            ["@groaurum/db-tests", "packages/db-tests", "RLS + invariant vitest vs local Supabase"],
        ],
        [40, 45, 95],
    )

    pdf.h2("Important entry points")
    pdf.kv("Admin", "apps/admin-web/src/main.tsx -> AdminAuthProviders -> AdminDataProviders -> AppRoutes")
    pdf.kv("Sales", "apps/sales-pwa/src/main.tsx -> SalesAuthProviders -> SalesDataProviders -> App")
    pdf.kv("Delivery", "apps/delivery-pwa/src/main.tsx -> DeliveryAuthProviders -> DeliveryDataProviders -> App")
    pdf.kv("DB types", "packages/api-client/src/database.types.ts re-exports extended types")

    # ---- 3 ADMIN ----
    pdf.add_page()
    pdf.h1("3. Admin App")
    pdf.h2("3.1 Sidebar navigation (exact)")
    pdf.p("Source: apps/admin-web/src/data/nav.ts")
    pdf.code("Dashboard")
    pdf.code("Business")
    pdf.code("  Customers (/customers)")
    pdf.code("  Sales (/orders) match: /orders,/sales,/payments")
    pdf.code("  Products (/products) match: /products,/categories,/pricing excl /pricing/commission")
    pdf.code("  Inventory (/inventory)")
    pdf.code("  Delivery (/delivery)")
    pdf.code("Team")
    pdf.code("  Salesmen (/salesmen) match: /salesmen,/pricing/commission")
    pdf.code("Accounting")
    pdf.code("  Receivables (/receivables)")
    pdf.code("  Purchases (/purchases) match: /purchases,/suppliers")
    pdf.code("  Expenses (/expenses)")
    pdf.code("  Day Book (/day-book)")
    pdf.code("Reports (/reports)")
    pdf.code("Settings (/settings) match: /settings,/service-areas,/warehouses")

    pdf.h2("3.2 Module / permission notes")
    pdf.p("Source: apps/admin-web/src/auth/moduleRoutes.ts + packages/auth/src/permissions.ts")
    pdf.bullet("Accounting screens (receivables, purchases, suppliers, expenses, day-book) map to AdminModule 'payments'")
    pdf.bullet("Settings module: super_admin only")
    pdf.bullet("Sidebar filtered by canAccessModule(PATH_MODULE[item.path]) in AdminShell.tsx")

    pdf.h2("3.3 Complete route table")
    admin_routes = [
        ["/login", "LoginPage", "none", "Email/password"],
        ["/", "DashboardPage", "dashboard", "Ops KPIs"],
        ["/orders", "OrdersListPage", "orders", "Open orders"],
        ["/orders/:orderId", "OrderDetailPage", "orders", "Order lifecycle"],
        ["/sales", "SalesListPage", "orders", "Sales register"],
        ["/sales/:saleId", "SaleDetailPage", "orders", "Sale detail"],
        ["/customers", "CustomersListPage", "customers", "Shop list"],
        ["/customers/:customerId", "CustomerDetailPage", "customers", "Shop account"],
        ["/products", "ProductListPage", "products", "Catalogue"],
        ["/products/:productId", "ProductDetailPage", "products", "SKU editor"],
        ["/categories", "CategoriesListPage", "categories", "Categories"],
        ["/categories/:categoryId", "CategoryDetailPage", "categories", "Category detail"],
        ["/pricing", "PricingListPage", "pricing", "SKU prices"],
        ["/pricing/commission", "CommissionListPage", "pricing", "SKU commission terms"],
        ["/pricing/:skuId", "PricingDetailPage", "pricing", "Price history"],
        ["/inventory", "InventoryListPage", "inventory", "Balances"],
        ["/inventory/:skuId", "InventoryDetailPage", "inventory", "Adjust / history"],
        ["/salesmen", "SalesmenListPage", "salesmen", "Staff list"],
        ["/salesmen/payroll", "SalesmenPayrollPage", "salesmen", "Payroll hub"],
        ["/salesmen/:salesmanId", "SalesmanDetailPage", "salesmen", "Employment tabs"],
        ["/delivery", "DeliveryListPage", "delivery", "Routes"],
        ["/delivery/boys", "DeliveryBoysListPage", "delivery", "Delivery staff"],
        ["/delivery/boys/:boyId", "DeliveryBoyDetailPage", "delivery", "Boy detail"],
        ["/delivery/vehicles", "VehiclesListPage", "delivery", "Vehicles"],
        ["/delivery/:routeId", "DeliveryDetailPage", "delivery", "Route detail"],
        ["/payments", "PaymentsPage", "payments", "Collections / COD"],
        ["/receivables", "ReceivablesPage", "payments", "Customer dues"],
        ["/purchases", "PurchasesListPage", "payments", "Purchase bills"],
        ["/purchases/new", "PurchaseFormPage", "payments", "Create draft"],
        ["/purchases/:id/edit", "PurchaseFormPage", "payments", "Edit draft"],
        ["/purchases/:id", "PurchaseDetailPage", "payments", "Receive / lock"],
        ["/suppliers", "SuppliersListPage", "payments", "Vendor master"],
        ["/suppliers/:id", "SupplierDetailPage", "payments", "Supplier + purchase history"],
        ["/expenses", "ExpensesPage", "payments", "Company expenses"],
        ["/expenses/:id", "ExpenseDetailPage", "payments", "Expense detail"],
        ["/day-book", "DayBookPage", "payments", "Daily money"],
        ["/service-areas", "ServiceAreasListPage", "service_areas", "Deep under Settings"],
        ["/warehouses", "WarehousesListPage", "warehouses", "Deep under Settings"],
        ["/reports", "ReportsPage", "reports", "Reports hub"],
        ["/reports/profit-loss", "ProfitLossPage", "reports", "Operating result"],
        ["/reports/sales", "SalesReportPage", "reports", "Sales report"],
        ["/reports/collections", "CollectionsReportPage", "reports", "Collections"],
        ["/reports/outstanding", "OutstandingReportPage", "reports", "Outstanding"],
        ["/reports/expenses", "ExpenseReportPage", "reports", "Expenses"],
        ["/reports/payroll", "PayrollReportPage", "reports", "Payroll"],
        ["/reports/products", "ProductSalesReportPage", "reports", "Product sales"],
        ["/reports/salesmen", "SalesmanPerformanceReportPage", "reports", "Salesman perf"],
        ["/settings", "SettingsPage", "settings", "Company settings"],
    ]
    pdf.table(
        ["Route", "Page", "Module", "Purpose"],
        admin_routes,
        [42, 48, 28, 62],
    )

    pdf.h2("3.4 Related / section links")
    pdf.bullet("SALES_SECTION_LINKS: Orders, Invoices, Collections - section-links.ts")
    pdf.bullet("ACCOUNTING_SECTION_LINKS: Receivables, Purchases, Suppliers, Expenses, Day Book, Reports, Collections")
    pdf.bullet("PURCHASING_SECTION_LINKS: Purchases, Suppliers, Inventory, Expenses - purchasing.ts")

    pdf.h2("3.5 Auth")
    pdf.bullet("Audience admin_erp - AdminAuthProviders.tsx")
    pdf.bullet("Login: email/password (LoginPage.tsx); mock provider for DEV")
    pdf.bullet("Guards: ProtectedAdminRoute + AdminModuleGuard (guards.tsx)")

    # ---- 4 SALES ----
    pdf.add_page()
    pdf.h1("4. Salesman App (Salesaurum)")
    pdf.p("Path: apps/sales-pwa | Package: @groaurum/sales-pwa | Audience: sales_pwa / role salesman")

    pdf.h2("4.1 Bottom navigation")
    pdf.bullet("Home / | Orders /orders | Customers /customers | Profile /profile - layout/nav.ts")

    pdf.h2("4.2 Routes")
    sales_routes = [
        ["/login", "LoginPage", "Email OTP / password / mock"],
        ["/", "DashboardPage", "Today's Work Start/End Day, KPIs"],
        ["/visits", "VisitsPage", "Route visits + check-in + photo"],
        ["/orders", "OrdersPage", "Order history"],
        ["/orders/new", "CreateOrderPage", "Catalogue, cart, review, place"],
        ["/orders/:id", "OrderDetailPage", "Order detail"],
        ["/orders/:id/return", "ReturnFormPage", "Return request"],
        ["/customers", "CustomersPage", "Assigned shops"],
        ["/customers/new", "CreateCustomerPage", "Create retailer + photo"],
        ["/customers/:shopId", "CustomerDetailPage", "Shop detail"],
        ["/setup", "ProfileSetupPage", "First-time profile"],
        ["/profile", "ProfilePage", "Language/photo (name read-only)"],
        ["/profile/earnings", "PerformancePage", "Salary + commission"],
        ["/profile/expenses", "ExpensesPage", "Expense claims"],
        ["/profile/expenses/new", "ExpenseFormPage", "Claim + receipt"],
        ["/profile/returns", "ReturnsPage", "Return requests"],
        ["/profile/messages", "MessagesPage", "Admin messages"],
        ["/profile/notices", "NoticesPage", "Notices"],
        ["/performance", "redirect", "-> /profile/earnings"],
    ]
    pdf.table(["Route", "Page", "Notes"], sales_routes, [45, 45, 90])

    pdf.h2("4.3 Key behaviours (confirmed)")
    pdf.bullet("Catalogue: listOrderableSkus via createSupabaseSalesmanService - packages/api-client/.../salesman.ts")
    pdf.bullet("Cart qty stored as packs; UI may show Boxes when sellsInOuterUnits - order-quantity.ts")
    pdf.bullet("Server preview: preview assisted order RPC; place: assisted order RPCs")
    pdf.bullet("Realtime invalidation: shops, orders, products, skus, categories, sku_prices, inventory")
    pdf.bullet("Offline queue: messages + expenses only (NOT orders) - offline-queue.ts")
    pdf.bullet("PWA SW: public/sw.js salesaurum-shell-v2; registered in PROD only")
    pdf.bullet("Workday: startDay/endDay; earliest 08:00 Asia/Kolkata - migration 20261002140000")

    pdf.h2("4.4 Auth")
    pdf.bullet("Email OTP (default), email+password, DEV mock - LoginPage/LoginPanel")
    pdf.bullet("SetupGate forces /setup until profile complete")

    # ---- 5 DELIVERY ----
    pdf.add_page()
    pdf.h1("5. Delivery App")
    pdf.p("Path: apps/delivery-pwa | Package: @groaurum/delivery-pwa | Audience: delivery_pwa / delivery_executive")

    pdf.h2("5.1 Navigation")
    pdf.bullet("Dashboard / | Routes /routes | COD /cod - DeliveryShell.tsx")

    pdf.h2("5.2 Routes")
    pdf.table(
        ["Route", "Page", "Purpose"],
        [
            ["/login", "LoginPage", "Email+password (no OTP UI)"],
            ["/", "DashboardPage", "Today summary"],
            ["/routes", "RoutesPage", "Assigned routes"],
            ["/routes/:routeId", "RouteDetailPage", "Start/complete route"],
            ["/routes/:id/stops/:stopId", "StopDetailPage", "Stop lifecycle + COD"],
            ["/cod", "CodPage", "COD history / pending KPIs"],
        ],
        [55, 40, 85],
    )

    pdf.h2("5.3 Stop lifecycle (confirmed)")
    pdf.code("markStopInProgress -> recordCashPayment / reportDigitalPayment")
    pdf.code("-> completeStop OR failStop")
    pdf.bullet("Photo/signature: placeholder checkboxes only (photoCaptured/signatureCaptured booleans) - StopDetailPage.tsx")
    pdf.bullet("No offline queue in delivery app")
    pdf.bullet("PWA SW: public/sw.js groaurum-delivery-shell-v2")

    # ---- 6 UI ----
    pdf.add_page()
    pdf.h1("6. UI Design System")
    pdf.h2("Shared web tokens")
    pdf.p("packages/ui/src/tokens/tokens.css - CSS variables --ga-* (colors, space, radius, shadow, typography, sidebar)")
    pdf.p("Imported by Admin/Sales/Delivery via @groaurum/ui/tokens.css + base.css")

    pdf.h2("packages/ui exports")
    pdf.bullet("Button, Badge, Card, Tabs, PageHeader, EmptyState, DataTable, TextField, SelectField")
    pdf.bullet("ActionBar, FilterBar, ChipGroup, FieldGrid, Field, Timeline, Modal, Icon")

    pdf.h2("App-local patterns")
    pdf.bullet("Admin: ga-shell layout, PageHeader on most pages, data-table.css, QueryStateGate")
    pdf.bullet("Sales: ga-sales-* mobile-first cards, bottom nav, QuantityStepper, NetworkBanner")
    pdf.bullet("Delivery: DeliveryShell bottom nav, stop action cards")

    pdf.h2("Duplicate / unused UI (document only)")
    pdf.bullet("SellingUnitFields.tsx exists but has no imports - UNUSED (Admin uses pack/outer/MOQ instead)")
    pdf.bullet("Admin re-exports PageHeader/Button/Badge from @groaurum/ui under components/ui/")

    pdf.h2("Screenshots")
    pdf.p("Screenshots were NOT generated in this audit run (no browser capture performed). UNVERIFIED visual appearance beyond CSS tokens.")

    # ---- 7 UX ----
    pdf.add_page()
    pdf.h1("7. UX Notes (descriptive, not redesigned)")
    pdf.h2("Admin")
    pdf.bullet("Dense ERP lists with filters/Reset; deep routes under parent highlights")
    pdf.bullet("Accounting items live under Accounting but RBAC module is payments - possible confusion")
    pdf.bullet("Purchases/Suppliers share Purchases nav highlight")
    pdf.h2("Salesman")
    pdf.bullet("Order flow: pick shop -> catalogue Add -> stepper -> Review -> Submit")
    pdf.bullet("Stock quantities removed from product cards; Out of stock still shown")
    pdf.bullet("Manual qty entry in QuantityStepper; invalid qty adjusted with toast reason")
    pdf.bullet("Start Day blocked before 08:00 IST at RPC (client should surface error message)")
    pdf.h2("Delivery")
    pdf.bullet("COD collection happens on stop detail, not COD page")
    pdf.bullet("Photo/signature placeholders create friction risk (appear complete without capture)")

    # ---- 8 DB ----
    pdf.add_page()
    pdf.h1("8. Database Inventory")
    pdf.p("Source of truth: supabase/migrations/*.sql (97 files). Typed surface: packages/api-client/src/database.extended.ts")

    pdf.h2("8.1 Tables (~67)")
    tables = [
        "profiles, service_areas, serviceability_rules, operational_locations",
        "shops, shop_contacts, shop_invitations, shop_auth_links, shop_salesman_assignments, customer_addresses",
        "categories, products, product_images, skus, sku_prices, sku_price_tiers, sku_outer_discount_tiers, sku_commission_terms",
        "inventory_balances, inventory_movements, stock_reservations",
        "orders, order_lines, order_events, order_confirmation_challenges",
        "payments, payment_events, sales, sale_items, sales_payments",
        "delivery_routes, route_stops, delivery_attempts, vehicles, vehicle_assignment_history",
        "delivery_employment, delivery_time_slots, delivery_exceptions, delivery_schedule_events",
        "delivery_cod_custody, delivery_cod_custody_events, delivery_cod_settlements, delivery_notification_events",
        "sales_visits, salesman_employment, salesman_salary_terms, salesman_attendance, company_holidays",
        "salesman_commission_entries, salesman_payroll, salesman_targets, salesman_expenses, salesman_return_requests",
        "salesman_messages, salesman_voice_notes, salesman_notices, salesman_push_subscriptions",
        "company_expenses, suppliers, purchases, purchase_items",
        "settings, reports_snapshot, audit_logs, notification_outbox, job_runs, application_logs",
    ]
    for t in tables:
        pdf.bullet(t)

    pdf.h2("8.2 Key enums")
    pdf.bullet("order_status - full assisted/self lifecycle including CANCELLED")
    pdf.bullet("payment_status - UNPAID, PAYMENT_PENDING, PAID, FAILED, REFUNDED")
    pdf.bullet("inventory_movement_type - RECEIPT, ORDER_DISPATCH, DAMAGE, RETURN, ADMIN_ADJUSTMENT")
    pdf.bullet("purchase_status - DRAFT, RECEIVED, CANCELLED")
    pdf.bullet("salesman_payroll_status - DRAFT, APPROVED, PAID")
    pdf.bullet("salesman_attendance_status - PRESENT, ABSENT, PAID_LEAVE, UNPAID_LEAVE, HOLIDAY, WEEKLY_OFF")

    pdf.h2("8.3 Purchasing (Phase 5A)")
    pdf.bullet("Tables: suppliers, purchases, purchase_items - migration 20261002120000_suppliers_purchasing.sql")
    pdf.bullet("Receive creates inventory_movements RECEIPT with unique index on purchase_item reference")
    pdf.bullet("Explicitly does NOT create supplier ledger, Day Book entries, or COGS")

    # ---- 9 REL ----
    pdf.add_page()
    pdf.h1("9. Relationships & Lifecycles")
    pdf.h2("9.1 Order lifecycle (confirmed pattern)")
    pdf.code("Salesman assisted cart -> preview RPC -> place assisted order")
    pdf.code("-> Admin advance/pack/assign -> Delivery route stops")
    pdf.code("-> COD/digital payment -> verify/settle -> convert to sale")
    pdf.code("-> inventory consume on sale convert (fulfill_sale_consume_inventory)")
    pdf.code("-> commission accrue on convert; payroll monthly later")

    pdf.h2("9.2 Inventory lifecycle")
    pdf.code("Purchase RECEIVED -> RECEIPT movements (+on_hand packs)")
    pdf.code("Sale convert -> consume reserved / ORDER_DISPATCH path")
    pdf.code("Admin adjust -> ADMIN_ADJUSTMENT")
    pdf.p("Canonical stock unit = selling packs (inventory_balances.on_hand_quantity). Outer boxes are display conversion.")

    pdf.h2("9.3 Purchasing lifecycle")
    pdf.code("Supplier -> Purchase DRAFT (items with unit_cost) -> admin_receive_purchase")
    pdf.code("-> status RECEIVED (locked) + RECEIPT movements (idempotent)")

    pdf.h2("9.4 Payroll lifecycle")
    pdf.code("salary terms + attendance unpaid leave + commission ledger")
    pdf.code("-> admin_calculate_salesman_payroll (month snapshot)")
    pdf.code("-> APPROVED -> PAID (Day Book payroll entry when paid)")

    # ---- 10 RLS ----
    pdf.add_page()
    pdf.h1("10. RLS / Security")
    pdf.bullet("FORCE RLS on most business tables (20260715101200_rls_enable.sql + later migrations)")
    pdf.bullet("is_admin() SECURITY DEFINER helper - 20260715101300_rls_policies.sql")
    pdf.bullet("Salesman scoped via salesman_shop_ids / employment guards")
    pdf.bullet("Delivery scoped via delivery_route_ids")
    pdf.bullet("Mutations typically SECURITY DEFINER admin_*/salesman_*/delivery_* RPCs")
    pdf.bullet("Purchasing tables: admin-only policies; salesman blocked (db-tests/rls/suppliers-purchasing.test.ts)")
    pdf.h2("Risk notes (document only)")
    pdf.bullet("Some early tables ENABLE RLS without FORCE (product_images, settings, reports_snapshot, price tier tables) - table owner bypass possible")
    pdf.bullet("database.generated.ts stale - risk of type drift vs runtime schema")
    pdf.bullet("Client holds anon key only (expected); service role not for browsers - UNVERIFIED hosted config")

    # ---- 11 RPC ----
    pdf.add_page()
    pdf.h1("11. RPC Inventory (major)")
    pdf.h2("Admin (sample of domains)")
    pdf.bullet("Orders: admin_pack_order, admin_cancel_order, admin_convert_order_to_sale, admin_replace_order_lines, ...")
    pdf.bullet("Payments: admin_mark_payment_received, admin_verify_reported_payment, admin_refund_converted_sale")
    pdf.bullet("Delivery/COD: admin_schedule_and_assign_delivery, admin_settle_delivery_cod*, admin_confirm_owner_cod_receipt*")
    pdf.bullet("Inventory: admin_adjust_inventory_balance")
    pdf.bullet("Purchasing: admin_create/update_supplier, admin_upsert_purchase_draft, admin_receive_purchase, admin_cancel_purchase_draft")
    pdf.bullet("Payroll: admin_calculate/approve/mark_paid salesman_payroll, salary terms, attendance")
    pdf.bullet("Commission: admin_set_salesman_earning_model, admin_set_sku_commission_term")
    pdf.h2("Salesman")
    pdf.bullet("salesman_start_day / end_day (08:00 IST gate), visit check-in/complete")
    pdf.bullet("assisted order create/replace/preview; create retailer; expenses; returns; messages; profile")
    pdf.h2("Delivery")
    pdf.bullet("delivery_start_route, mark_stop_in_progress, complete/fail_stop, complete_route")
    pdf.bullet("delivery_record_cash_payment, delivery_report_digital_payment, delivery_collect_cod")
    pdf.p("Full enumerated lists were produced during inspection (~69 admin / ~25 salesman / ~10 delivery). See migrations and database.extended.ts Functions.")

    # ---- 12 API ----
    pdf.add_page()
    pdf.h1("12. API / LiveAdminApi Map")
    pdf.p("Admin UI: hooks.ts + mutations.ts -> requireLiveAdminApi() -> LiveAdminApi (~142 async methods)")
    pdf.p("Sales: SalesmanApi from createSupabaseSalesmanService")
    pdf.p("Delivery: DeliveryApi from createSupabaseDeliveryService (+ mock)")
    pdf.h2("Example maps")
    pdf.code("PurchasesListPage -> usePurchasesListQuery -> purchasesList() -> from('purchases')")
    pdf.code("PurchaseDetail receive -> useReceivePurchaseMutation -> rpc admin_receive_purchase")
    pdf.code("CreateOrderPage -> preview/place via salesman service RPCs")
    pdf.code("StopDetailPage -> delivery_complete_stop / record_cash_payment RPCs")

    # ---- 13 CATALOGUE ----
    pdf.add_page()
    pdf.h1("13. Catalogue / Selling Units")
    pdf.bullet("products + skus + sku_prices; packaging: net_quantity, packs_per_carton, outer_type, moq, quantity_step")
    pdf.bullet("Inventory & order_lines.quantity are in packs")
    pdf.bullet("When Admin sets MOQ/step in Boxes, packs stored as multiples; Sales UI can sell in Boxes")
    pdf.bullet("Price display: / Box when sellsInOuterUnits else selling unit (Pack/Kg)")
    pdf.bullet("Catalogue sync: Sales listOrderableSkus + realtime invalidation + query cache (sales-query-cache.ts)")
    pdf.bullet("Historical order lines keep selling_unit_snapshot + pack quantities")

    # ---- 14 ORDERS/INV/PURCH ----
    pdf.add_page()
    pdf.h1("14. Orders / Inventory / Purchasing")
    pdf.h2("Orders")
    pdf.bullet("Sources: SALESMAN_ASSISTED, CUSTOMER_SELF_SERVE")
    pdf.bullet("Admin lifecycle automation migrations under 20260827150000 and related")
    pdf.bullet("Sale conversion creates sales/sale_items and consumes inventory")
    pdf.h2("Inventory")
    pdf.bullet("Balances + movements + reservations")
    pdf.bullet("Purchase receive idempotent via unique (reference_id) for purchase_item RECEIPT")
    pdf.h2("Purchasing status")
    pdf.table(
        ["Capability", "Status"],
        [
            ["Suppliers CRUD", "Implemented + Admin UI"],
            ["Purchase draft/edit", "Implemented + Admin UI"],
            ["Receive -> stock", "Implemented + RPC idempotent"],
            ["Supplier payments", "Missing"],
            ["Supplier ledger/outstanding", "Missing"],
            ["Purchase returns", "Missing"],
            ["COGS from purchase cost", "Missing (costs stored only)"],
        ],
        [80, 100],
    )

    # ---- 15 ACCOUNTING ----
    pdf.add_page()
    pdf.h1("15. Accounting / P&L / GST")
    pdf.h2("Implemented")
    pdf.bullet("Receivables / customer balances UI - ReceivablesPage")
    pdf.bullet("Collections / payments / COD custody - PaymentsPage + delivery COD tables")
    pdf.bullet("Company expenses - company_expenses + Expenses pages")
    pdf.bullet("Day Book aggregates: sale, collection, expense, refund, payroll (PAID) - day-book.ts / LiveAdminApi.dayBookSnapshot")
    pdf.bullet("Salesman payroll snapshots")
    pdf.bullet("Purchase bills with unit_cost (foundation only)")

    pdf.h2("P&L (confirmed)")
    pdf.p("apps/admin-web/src/data/financial-reports.ts: operatingResult = salesTotal - (expenses + paid payroll)")
    pdf.p("UI label: Operating Result. Disclaimer: Purchase cost (COGS) is not included. - ProfitLossPage.tsx")

    pdf.h2("GST")
    pdf.bullet("suppliers.gstin optional text field")
    pdf.bullet("purchases.tax_amount manual numeric (not CGST/SGST/IGST engine)")
    pdf.bullet("Company settings may map GSTIN/PAN for invoices - company-settings-map")
    pdf.bullet("No GSTR reports / e-invoice / tax rate tables found as full engine")

    pdf.h2("Missing accounting")
    pdf.bullet("Supplier ledger, supplier payments, advances, debit/credit notes, double-entry journals, bank reconciliation")

    # ---- 16 PAYROLL ----
    pdf.add_page()
    pdf.h1("16. Payroll / Commission / Attendance")
    pdf.h2("Payroll")
    pdf.bullet("Monthly period via payroll_month / date_trunc month - salesman_payroll migration 20261001120000")
    pdf.bullet("Uses salary terms + unpaid leave deductions + earned commission sum")
    pdf.bullet("Statuses DRAFT -> APPROVED -> PAID; paid appears in Day Book as payroll")
    pdf.bullet("Does NOT create daily salary records")

    pdf.h2("Commission")
    pdf.bullet("sku_commission_terms + salesman_commission_entries accrued on sale convert")
    pdf.bullet("Earning models: SALARY, COMMISSION, SALARY_PLUS_COMMISSION")
    pdf.bullet("Separate from base salary; rolled into monthly payroll snapshot as earned_commission")

    pdf.h2("Attendance / workday")
    pdf.bullet("salesman_attendance unique (profile_id, work_date)")
    pdf.bullet("Start/End Day RPCs; Start gated before 08:00 Asia/Kolkata (20261002140000)")
    pdf.bullet("Admin can correct via admin_set_salesman_attendance (SalesmanDetail attendance tab)")
    pdf.bullet("Visits are separate (sales_visits check-in)")

    # ---- 17 PAYMENTS ----
    pdf.add_page()
    pdf.h1("17. Payments / Collections / Delivery COD")
    pdf.bullet("payments + payment_events; sales_payments after convert")
    pdf.bullet("Delivery: cash COD record + digital report awaiting admin verify")
    pdf.bullet("COD custody chain: delivery_cod_custody + events + settlements; manager/owner confirm RPCs")
    pdf.bullet("Receivables page for outstanding; Collections report under /reports/collections")
    pdf.bullet("Refunds: admin_refund_converted_sale")

    # ---- 18 MEDIA ----
    pdf.add_page()
    pdf.h1("18. Photos / Camera / Media")
    pdf.table(
        ["Capability", "App", "Status", "Evidence"],
        [
            ["Product images", "Admin", "Implemented", "product-media bucket; ProductFormModal upload"],
            ["Shop photo", "Sales", "Implemented", "salesman-media; CreateCustomer/CustomerDetail"],
            ["Visit photo", "Sales", "Implemented", "VisitsPage / VisitRouteCard"],
            ["Profile avatar", "Sales", "Implemented", "ProfilePage file input"],
            ["Expense receipt", "Sales", "Implemented", "ExpenseFormPage"],
            ["Return photo", "Sales", "Implemented", "ReturnFormPage"],
            ["Voice note", "Sales", "Implemented", "getUserMedia audio VoiceNoteButton"],
            ["Delivery proof photo", "Delivery", "UI placeholder only", "StopDetailPage checkboxes"],
            ["Delivery signature", "Delivery", "UI placeholder only", "StopDetailPage checkboxes"],
            ["OCR / scanner", "Any", "Missing", "Not found"],
        ],
        [40, 25, 40, 75],
    )
    pdf.bullet("Buckets: product-media (public), salesman-media (private)")

    # ---- 19 NOTIF / PWA ----
    pdf.add_page()
    pdf.h1("19. Notifications / Offline / PWA")
    pdf.h2("Notifications")
    pdf.bullet("notification_outbox + job_runs production services (sprint9)")
    pdf.bullet("Sales: messages, notices, push subscription RPC salesman_save_push_subscription; SW push handler present")
    pdf.bullet("Delivery notification_events table exists")
    pdf.bullet("SMS/WhatsApp deep integration: UNVERIFIED beyond invitation/link tracking fields")

    pdf.h2("Offline / PWA")
    pdf.bullet("Sales + Delivery: manifest.json + sw.js; register in PROD main.tsx")
    pdf.bullet("Sales offline queue: messages/expenses only; NetworkBanner; localStorage query cache")
    pdf.bullet("Delivery: shell cache only; no offline mutation queue")
    pdf.bullet("Orders intentionally not queued offline (uncertain submit UX exists)")

    # ---- 20 REPORTS / SETTINGS / DEPLOY ----
    pdf.add_page()
    pdf.h1("20. Reports / Settings / Deployment")
    pdf.h2("Reports routes")
    for r in [
        "/reports hub",
        "/reports/profit-loss",
        "/reports/sales",
        "/reports/collections",
        "/reports/outstanding",
        "/reports/expenses",
        "/reports/payroll",
        "/reports/products",
        "/reports/salesmen",
    ]:
        pdf.bullet(r)
    pdf.p("Date boundaries: financial helpers emphasize Asia/Kolkata in several report/day-book paths - verify per report helper.")

    pdf.h2("Settings")
    pdf.bullet("/settings - SettingsPage (company map, roles matrix components)")
    pdf.bullet("Deep: /service-areas, /warehouses under Settings nav prefixes")

    pdf.h2("Deployment")
    pdf.bullet("Turborepo tasks: typecheck, lint, test, build")
    pdf.bullet("vercel.json found for sales-pwa SPA rewrite; Admin/Delivery vercel: UNVERIFIED (may use similar hosting)")
    pdf.bullet("Supabase local scripts: db:start/reset/types/test:db")
    pdf.bullet("Env keys (names only): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AUTH_PROVIDER, VITE_DATA_ADAPTER, GROAURUM_APP_ENV")
    pdf.p("Secrets were not printed.")

    # ---- 21 TESTS ----
    pdf.add_page()
    pdf.h1("21. Tests & Verification")
    pdf.h2("Test file counts (inspected)")
    pdf.table(
        ["Scope", "*.test.ts(x) files"],
        [
            ["apps/admin-web", "71"],
            ["apps/sales-pwa", "38"],
            ["apps/delivery-pwa", "3"],
            ["packages/db-tests", "38"],
        ],
        [80, 60],
    )
    pdf.h2("Safe verification (this audit session)")
    pdf.p("Commands run or previously confirmed in continuous workstreams:")
    pdf.bullet("pnpm --filter @groaurum/admin-web test -> 445 passed (recent)")
    pdf.bullet("pnpm --filter @groaurum/sales-pwa test -> 255 passed (recent)")
    pdf.bullet("Admin/Sales typecheck, lint, build: pass in prior Phase 5A / selling-unit workstreams")
    pdf.bullet("Delivery tests: suite small (3 files) - exact pass count UNVERIFIED in this PDF generation moment if not re-run")
    pdf.bullet("db-tests require local Supabase (supabase status); often skipped when local DB down")

    # ---- 22 MIGRATIONS ----
    pdf.add_page()
    pdf.h1("22. Migrations Chronology (summary)")
    pdf.p("97 SQL migrations from 20260715100000 through 20261002140000.")
    pdf.bullet("Foundation catalogue/inventory/orders/payments/delivery/RLS: 20260715*")
    pdf.bullet("Sprint customer/salesman/delivery/production: 20260716*")
    pdf.bullet("Sales conversion + admin workflows: 20260724-20260822*")
    pdf.bullet("HR attendance/salary + COD custody + dashboards: 20260825-20260831*")
    pdf.bullet("Packaging/pricing/discounts/consume inventory: 20260902-03*")
    pdf.bullet("Commission/earnings/expenses/messages: 20260915-29*")
    pdf.bullet("Company expenses: 20260930120000")
    pdf.bullet("Payroll: 20261001120000")
    pdf.bullet("Suppliers/purchasing: 20261002120000")
    pdf.bullet("Workday 08:00 IST: 20261002140000")
    pdf.p("Index doc MIGRATION_INDEX.md covers early migrations only (incomplete vs full folder).")

    # ---- 23 DEAD ----
    pdf.add_page()
    pdf.h1("23. Dead / Compatibility / Unused")
    pdf.table(
        ["Item", "Classification", "Evidence"],
        [
            ["SellingUnitFields.tsx", "Safe unused UI", "No imports outside its file"],
            ["database.generated.ts", "Stale generated", "Extended types used instead"],
            ["Customer app activation UX in Admin", "Compatibility / minimized", "Phase 4B honesty tests forbid invite/activation language in section links"],
            ["sku_price_tiers", "Deprecated-ish", "shared-types marks legacy absolute tiers"],
            ["Delivery photo/signature checkboxes", "UI-only placeholder", "StopDetailPage"],
            ["Sprint4 compat views", "Compatibility", "20260716160005_sprint4_compat_views.sql"],
            ["apps/customer not-implemented stubs", "Partial stubs", "services still include not-implemented"],
        ],
        [55, 40, 85],
    )
    pdf.p("Nothing deleted in this audit.")

    # ---- 24 MATRIX ----
    pdf.add_page()
    pdf.h1("24. Feature Status Matrix")
    pdf.p("Legend: OK=Complete, PART=Partial, BE=Backend only, UI=UI only, COMP=Compatibility, MISS=Missing, UNK=Unverified")
    matrix = [
        ["Catalogue products/SKUs", "OK", "OK", "N/A", "OK"],
        ["Pricing / discounts", "OK", "OK(preview)", "N/A", "OK"],
        ["Inventory balances/movements", "OK", "stock gate", "N/A", "OK"],
        ["Assisted orders", "OK", "OK", "consume via sale", "OK"],
        ["Delivery routes/stops", "OK", "N/A", "OK", "OK"],
        ["COD custody", "OK", "N/A", "PART", "OK"],
        ["Delivery proof photo", "N/A", "N/A", "UI", "flags only"],
        ["Receivables/collections", "OK", "N/A", "COD", "OK"],
        ["Day Book", "OK", "N/A", "N/A", "OK"],
        ["Company expenses", "OK", "claims separate", "N/A", "OK"],
        ["Salesman attendance", "OK", "OK", "N/A", "OK"],
        ["Payroll monthly", "OK", "earnings view", "N/A", "OK"],
        ["Commission", "OK", "earnings view", "N/A", "OK"],
        ["Suppliers/purchases", "OK", "N/A", "N/A", "OK"],
        ["Supplier payments/ledger", "MISS", "MISS", "MISS", "MISS"],
        ["COGS / valuation", "MISS", "MISS", "MISS", "MISS"],
        ["Full GST engine", "MISS", "MISS", "MISS", "PART fields"],
        ["P&L operating result", "OK", "N/A", "N/A", "no COGS"],
        ["Offline orders", "N/A", "MISS", "MISS", "N/A"],
        ["Customer Expo app", "N/A", "N/A", "N/A", "OK adjacent"],
    ]
    pdf.table(
        ["Feature", "Admin", "Sales", "Delivery", "DB/API"],
        matrix,
        [45, 28, 35, 32, 40],
    )

    # ---- 25 BUILT/MISSING ----
    pdf.add_page()
    pdf.h1("25. Built / Missing / Partial")
    pdf.h2("Everything currently built (confirmed)")
    for x in [
        "Admin ERP across customers, catalogue, pricing, inventory, orders/sales, delivery ops, salesmen HR, payments/COD, receivables, expenses, day book, purchasing, reports, settings",
        "Sales PWA field workflow: auth, workday, visits, catalogue ordering, customers, earnings, expenses, returns, messages",
        "Delivery PWA routes/stops/COD collection reporting",
        "Supabase RLS + extensive RPC surface",
        "Purchase->inventory RECEIPT foundation with unit_cost history",
        "Monthly payroll + commission ledger",
        "PWA install shells for Sales and Delivery",
        "Product and salesman media storage",
    ]:
        pdf.bullet(x)

    pdf.h2("Missing (supported by inspection)")
    for x in [
        "COGS, inventory valuation (WAC/FIFO), true gross profit",
        "Supplier payments, supplier ledger, purchase returns, debit/credit notes",
        "Full GST (CGST/SGST/IGST rates, GSTR, e-invoice)",
        "Delivery real photo/signature capture & upload",
        "Offline order placement queue",
        "Double-entry accounting / bank reconciliation",
        "AI features",
    ]:
        pdf.bullet(x)

    pdf.h2("Partial")
    pdf.bullet("Purchase tax_amount without tax engine")
    pdf.bullet("Day Book covers selected money movements only (not inventory liability on credit purchase)")
    pdf.bullet("P&L operating result without purchase cost")
    pdf.bullet("Delivery proof UI without media backend")
    pdf.bullet("Customer app present but Admin intentionally avoids customer-app activation UX language")

    # ---- 26 RISKS ----
    pdf.add_page()
    pdf.h1("26. Technical Risks & Performance")
    pdf.h2("Security / data")
    pdf.bullet("Broad payments module for many accounting screens - review least privilege")
    pdf.bullet("SECURITY DEFINER RPCs require continued audit of is_admin/role checks")
    pdf.bullet("Stale generated DB types")
    pdf.bullet("Placeholder delivery proof may inflate compliance confidence")

    pdf.h2("Performance (observed in builds)")
    pdf.bullet("Admin production build warns chunks >500kB (index ~960kB gzipped ~260kB) - vite warning")
    pdf.bullet("Sales index ~570kB - similar warning")
    pdf.bullet("Admin LiveAdminApi is a large facade (~142 methods) - maintainability cost")
    pdf.bullet("Some list endpoints load broad selects then filter client-side (e.g. supplier purchase history filter) - N+1 risk patterns possible")

    # ---- 27 BACKLOG ----
    pdf.add_page()
    pdf.h1("27. Future Backlog (factual gaps only - NOT implemented)")
    pdf.h2("P0 - core incompleteness")
    pdf.bullet("Inventory valuation + COGS before calling P&L net/gross profit")
    pdf.bullet("Supplier payments + outstanding after purchasing foundation")
    pdf.bullet("Real delivery proof media (replace placeholders)")
    pdf.h2("P1 - important")
    pdf.bullet("GST engine using existing GSTIN/tax fields carefully")
    pdf.bullet("Purchase returns / reversal path for received bills")
    pdf.bullet("Offline strategy clarity for Sales orders")
    pdf.bullet("Regenerate database.generated.ts / reduce type drift")
    pdf.h2("P2 - enhancement")
    pdf.bullet("Deeper report exports, bank reconciliation, AI, customer-app Admin activation polish")
    pdf.p("This section does not prioritize business decisions; it lists technical incompleteness found in code.")

    # ---- 28 APPENDIX ----
    pdf.add_page()
    pdf.h1("28. Appendices - Key Source References")
    refs = [
        "apps/admin-web/src/App.tsx",
        "apps/admin-web/src/data/nav.ts",
        "apps/admin-web/src/auth/moduleRoutes.ts",
        "apps/admin-web/src/data/live/LiveAdminApi.ts",
        "apps/admin-web/src/data/financial-reports.ts",
        "apps/admin-web/src/data/day-book.ts",
        "apps/sales-pwa/src/App.tsx",
        "apps/sales-pwa/src/data/order-quantity.ts",
        "apps/sales-pwa/src/pages/DashboardPage.tsx",
        "apps/delivery-pwa/src/App.tsx",
        "apps/delivery-pwa/src/pages/StopDetailPage.tsx",
        "packages/api-client/src/adapters/supabase/salesman.ts",
        "packages/api-client/src/database.extended.ts",
        "packages/auth/src/permissions.ts",
        "packages/ui/src/tokens/tokens.css",
        "supabase/migrations/20260715100600_inventory.sql",
        "supabase/migrations/20261001120000_salesman_payroll.sql",
        "supabase/migrations/20261002120000_suppliers_purchasing.sql",
        "supabase/migrations/20261002140000_salesman_workday_start_0800_ist.sql",
    ]
    for r in refs:
        pdf.code(r)

    pdf.ln(4)
    pdf.h2("Audit constraints confirmation")
    pdf.p("No application code was modified during this audit.")
    pdf.p("No database/schema/migrations were modified.")
    pdf.p("No production data was changed.")
    pdf.p("PDF generator script only writes this documentation artifact under docs/.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    return OUTPUT


if __name__ == "__main__":
    path = build()
    print(path)
    print(path.stat().st_size)
