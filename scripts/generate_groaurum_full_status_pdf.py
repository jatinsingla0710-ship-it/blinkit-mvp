"""Generate GroAurum FULL project status PDF — ready vs gaps, all SQL, apps.

Outputs:
  - docs/GroAurum-Full-Project-Status-Ready-vs-Gaps.pdf
  - Desktop/groaurum-app.pdf
"""

from datetime import date
from pathlib import Path
import shutil

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Full-Project-Status-Ready-vs-Gaps.pdf"
DESKTOP_COPY = Path.home() / "Desktop" / "groaurum-app.pdf"


class StatusPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum - Full Project Status (Ready vs Gaps)",
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
        self.multi_cell(0, 4.4, text.encode("latin-1", "replace").decode("latin-1"))
        self.ln(0.8)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        indent = 4
        self.set_x(self.l_margin + indent)
        w = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(w, 4.3, f"- {text.encode('latin-1', 'replace').decode('latin-1')}")
        self.set_x(self.l_margin)

    def mono(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 7.5)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 3.6, text.encode("latin-1", "replace").decode("latin-1"))
        self.ln(1.5)
        self.set_x(self.l_margin)

    def row(self, cols: list[str], widths: list[float], header: bool = False):
        if self.get_y() > 270:
            self.add_page()
        if header:
            self.set_font("Helvetica", "B", 8)
            self.set_fill_color(232, 246, 238)
        else:
            self.set_font("Helvetica", "", 7.5)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(15, 31, 24)
        y0 = self.get_y()
        x0 = self.l_margin
        heights = []
        for col, w in zip(cols, widths):
            self.set_xy(x0, y0)
            safe = col.encode("latin-1", "replace").decode("latin-1")
            self.multi_cell(w, 4.0, safe, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 4.5
        x0 = self.l_margin
        self.set_draw_color(200, 210, 205)
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)

    def status_legend(self):
        self.p(
            "Status key: READY = usable for daily ops | PARTIAL = works but gaps | "
            "GAP / FAULT = broken, deferred, or blocks understanding | MISSING = not built."
        )


def build() -> None:
    pdf = StatusPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    # Cover
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(12)
    pdf.cell(0, 9, "GroAurum", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Full Project Status Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        6,
        "Everything built so far | What is READY | Where the FAULTS / GAPS are",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.cell(
        0,
        6,
        "Includes all SQL migrations, RPCs, apps, Admin ERP, and run commands",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, f"Generated {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.p(
        "Product: B2B dry-fruit wholesale ordering & distribution. "
        "Market: Gurugram. Ops: Fatehpur Beri. Repo: blinkit-mvp (GroAurum monorepo)."
    )
    pdf.status_legend()

    # Executive verdict
    pdf.h1("1. Executive verdict (read this first)")
    pdf.bullet(
        "Overall: strong MVP / pilot-capable stack exists (Admin + Customer + Salesman + Delivery + DB)."
    )
    pdf.bullet(
        "Production launch: NOT ready yet (Phase 3.5 launch readiness ~56/100 historically). "
        "Pilot with COD-first posture is the realistic next step."
    )
    pdf.bullet(
        "Strongest area: Orders smart workflow (Sprint 3.5) + trusted DB RPCs + Delivery/Salesman PWAs."
    )
    pdf.bullet(
        "Weakest areas: Reports (placeholders), Settings writes (mostly deferred), "
        "some Admin detail mutations, Customer mock bleed on a few screens."
    )
    pdf.bullet(
        "Critical DB rule that feels like a 'fault' in UX: DELIVERED requires payment PAID "
        "(business invariant). Delivery must collect COD (or order must already be paid) before Delivered."
    )

    # Architecture
    pdf.h1("2. What we built - architecture")
    pdf.h2("2.1 Apps")
    w = [42, 28, 110]
    pdf.row(["App", "Port / runtime", "Purpose"], w, header=True)
    pdf.row(["admin-web", "Vite :5173", "Admin ERP - wholesale operations console"], w)
    pdf.row(["customer", "Expo 57", "Retailer app - catalogue, cart, orders"], w)
    pdf.row(["sales-pwa", "Vite :5174", "Salesman field PWA - shops, visits, assisted orders"], w)
    pdf.row(["delivery-pwa", "Vite :5175", "Delivery field PWA - routes, stops, COD"], w)

    pdf.h2("2.2 Shared packages")
    for line in [
        "api - repositories / adapters / services",
        "api-client - Supabase client + generated DB types boundary",
        "auth - session + RBAC helpers",
        "data - domain models + query keys",
        "ui - shared web design system",
        "validation - Zod schemas + invariant tests",
        "shared-types - B2B types + order/payment transition policies",
        "config - ESLint / TSConfig",
        "db-tests - Postgres integration tests against local Supabase",
    ]:
        pdf.bullet(line)

    # Admin readiness
    pdf.h1("3. Admin ERP - READY vs GAPS")
    wa = [32, 22, 126]
    pdf.row(["Module", "Status", "Notes / fault"], wa, header=True)
    rows = [
        ("Auth / Login", "READY", "Login + guards + module RBAC"),
        ("Dashboard", "PARTIAL", "Live KPIs exist; some realtime / polish incomplete"),
        ("Products", "PARTIAL", "List/detail/create/edit/SKUs/images; lifecycle polish gaps"),
        ("Pricing", "READY", "Schedule / close append-only prices"),
        ("Inventory", "PARTIAL", "Snapshot + adjust live; full WMS/ledger UX deferred"),
        ("Customers", "PARTIAL", "List/detail/activation; create may use seed shortcuts; docs/activity thin"),
        ("Orders", "READY", "Smart Action Panel (3.5); timeline read-only; trusted RPCs"),
        ("Sales", "READY", "Convert to Sale + sales register /sale tables"),
        ("Delivery (admin)", "PARTIAL", "Routes list/create; detail mutations partly deferred"),
        ("Salesmen", "PARTIAL", "List/detail tabs live; some mutations deferred / seed IDs"),
        ("Reports", "PARTIAL", "Shell + KPIs; charts/tables placeholder; export stub"),
        ("Settings", "PARTIAL", "Company upsert works; warehouse/areas/taxes etc. often deferred"),
        ("Service Areas page", "MISSING", "Nav placeholder; areas live more under Settings tab"),
    ]
    for a, b, c in rows:
        pdf.row([a, b, c], wa)

    pdf.h2("3.1 Orders workflow (Sprint 3.5) - READY")
    pdf.mono(
        "Admin clicks only next action:\n"
        "Confirm -> Print Invoice -> Pack -> Assign Delivery Boy\n"
        "  -> Driver starts route = Out For Delivery (auto)\n"
        "  -> Driver confirms = Delivered (auto, requires PAID)\n"
        "  -> Receive Payment -> Convert To Sale -> Completed\n"
        "Timeline = automatic history only (no stage buttons)."
    )

    # Field apps
    pdf.h1("4. Customer / Salesman / Delivery apps")
    pdf.h2("4.1 Customer (Expo) - PARTIAL / MVP READY")
    pdf.bullet("Exists: Home, catalogue, product, cart, checkout, orders, restock, account, location.")
    pdf.bullet("Live path: invitation accept + place_customer_order RPCs.")
    pdf.bullet("FAULT/GAP: some screens still use mock services (cart / order detail / restock paths).")
    pdf.bullet("Adapter: EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER = mock | supabase.")

    pdf.h2("4.2 Salesman PWA - READY for field demo")
    pdf.bullet("Login, dashboard, customers create, visits, assisted orders, performance.")
    pdf.bullet("RPCs: salesman_create_retailer, salesman_create_invitation, place_assisted_order.")
    pdf.bullet("Demo: salesman1@groaurum.local / password123 (port 5174). Seed: sprint7_salesman_seed.sql.")

    pdf.h2("4.3 Delivery PWA - READY for field demo")
    pdf.bullet("Routes, stop progress, COD collect, complete/fail stop, complete route.")
    pdf.bullet(
        "RPCs: delivery_start_route, delivery_mark_stop_in_progress, delivery_collect_cod, "
        "delivery_complete_stop, delivery_fail_stop, delivery_complete_route."
    )
    pdf.bullet("Demo: delivery1@groaurum.local / password123 (port 5175). Seed: sprint8_delivery_seed.sql.")

    # Faults
    pdf.h1("5. Faults / gaps / blockers (where things break or confuse)")
    wf = [40, 140]
    pdf.row(["Area", "What is wrong / incomplete"], wf, header=True)
    faults = [
        (
            "DELIVERED needs PAID",
            "DB invariant enforce_delivered_requires_paid. Feels like a bug if admin/driver tries Delivered before payment. Fix in process: collect COD in Delivery PWA first, or mark payment in Admin.",
        ),
        (
            "Trusted status updates",
            "Clients cannot UPDATE orders.status directly. Must use admin_advance_order_to / delivery_* / place_* RPCs with trusted GUC. Raw updates fail.",
        ),
        (
            "Reports",
            "Charts/tables are placeholders; export not real. Do not use for business decisions yet.",
        ),
        (
            "Settings writes",
            "Many sections show UI but mutation deferred (warehouses, slots, taxes, etc.). Company profile is the stronger part.",
        ),
        (
            "Service Areas route",
            "Dedicated page still PlaceholderPage in admin App.tsx.",
        ),
        (
            "Seed UUID shortcuts",
            "Some quick-create flows hardcode seed IDs (salesmen/delivery/customers). Fine for demo; not production.",
        ),
        (
            "Customer mock bleed",
            "Mixed mock + live on some screens can look like 'data is wrong'.",
        ),
        (
            "Docker / local DB",
            "supabase start needs Docker. If migrations not applied: missing sales tables / RPC errors.",
        ),
        (
            "Env secrets",
            "No prod credentials in repo. Never put service-role key in Vite/Expo. Use anon + local URL.",
        ),
        (
            "Launch readiness",
            "Production launch = No. Pilot = conditional (COD-first, email auth, manual/cron jobs).",
        ),
    ]
    for a, b in faults:
        pdf.row([a, b], wf)

    # SQL inventory
    pdf.h1("6. ALL SQL migrations (complete inventory)")
    pdf.p(
        "Location: supabase/migrations/  |  Apply with: pnpm db:start && pnpm db:reset  "
        "(Docker required). Index doc: supabase/migrations/MIGRATION_INDEX.md (may lag Sprint 3.3/3.4)."
    )

    pdf.h2("6.1 Phase 2 core schema")
    ws = [78, 102]
    pdf.row(["File", "Purpose"], ws, header=True)
    core = [
        ("20260715100000_extensions.sql", "pgcrypto/citext + updated_at helpers"),
        ("20260715100100_enums_and_helpers.sql", "Domain enums + mobile/order helpers"),
        ("20260715100200_profiles.sql", "profiles linked to auth.users"),
        ("20260715100300_service_territory.sql", "Service areas / locations"),
        ("20260715100400_shops.sql", "Shops (retailers), contacts, salesman assign"),
        ("20260715100500_catalogue.sql", "Categories, products, SKUs, prices"),
        ("20260715100600_inventory.sql", "Inventory balances + movements"),
        ("20260715100700_orders.sql", "Orders + order_lines"),
        ("20260715100800_payments.sql", "Payments"),
        ("20260715100900_delivery.sql", "Delivery routes + route_stops"),
        ("20260715101000_audit.sql", "Audit logs"),
        ("20260715101100_business_invariants.sql", "Hard rules (DELIVERED requires PAID)"),
        ("20260715101200_rls_enable.sql", "Enable RLS"),
        ("20260715101300_rls_policies.sql", "Role policies Admin/Salesman/Delivery/Customer"),
        ("20260715101400_sku_prices_close_open_row.sql", "Append-only price close trigger"),
        ("20260715101500_api_role_grants.sql", "API role grants"),
    ]
    for a, b in core:
        pdf.row([a, b], ws)

    pdf.h2("6.2 Sprint 4 - Admin CRUD foundation")
    pdf.row(["File", "Purpose"], ws, header=True)
    for a, b in [
        ("20260716160001_sprint4_soft_delete.sql", "Soft-delete columns"),
        ("20260716160002_sprint4_product_images.sql", "product_images"),
        ("20260716160003_sprint4_customer_addresses.sql", "customer_addresses"),
        ("20260716160004_sprint4_settings_and_reports.sql", "settings + reports_snapshot"),
        ("20260716160005_sprint4_compat_views.sql", "Compat / alias views"),
        ("20260716160006_sprint4_read_only_role.sql", "READ_ONLY staff role"),
        ("20260716160007_sprint4_rls_extensions.sql", "RLS for new tables"),
    ]:
        pdf.row([a, b], ws)

    pdf.h2("6.3 Sprint 5.1 - 9.1 production path")
    pdf.row(["File", "Purpose"], ws, header=True)
    for a, b in [
        ("20260716170001_sprint51_admin_write_policies.sql", "Admin write policies for ERP"),
        ("20260716180001_sprint6_customer_rpcs.sql", "accept_shop_invitation, place_customer_order"),
        ("20260716190001_sprint7_salesman_visits_and_rpcs.sql", "Visits + salesman create/invite/order"),
        ("20260716200001_sprint8_delivery_rpcs.sql", "Delivery field RPCs + confirmation fields"),
        ("20260716210001_sprint9_production_services.sql", "Payment intents, outbox, jobs, audit"),
        ("20260716220001_sprint91_blocker_closure.sql", "pg_cron, admin status, enqueue, realtime"),
        ("20260716220002_sprint91_place_order_trusted_guc.sql", "place_customer_order trusted GUC"),
    ]:
        pdf.row([a, b], ws)

    pdf.h2("6.4 Admin ERP Sprint 3.3 / 3.4 (orders -> sales)")
    pdf.row(["File", "Purpose"], ws, header=True)
    for a, b in [
        ("20260724150000_sprint33_order_sales.sql", "Early order->sale conversion support"),
        ("20260724180000_sprint34_sales_conversion.sql", "sales, sale_items, sales_payments, orders.sale_id"),
        ("20260724190000_sprint34_admin_workflow_rpcs.sql", "admin_advance / assign / mark payment RPCs"),
    ]:
        pdf.row([a, b], ws)

    pdf.h2("6.5 Seeds / fixtures (not migrations)")
    pdf.bullet("supabase/seed/sprint4_seed.sql - catalogue, staff, shops, sample orders")
    pdf.bullet("supabase/seed/sprint6_customer_seed.sql - customer auth seed")
    pdf.bullet("supabase/seed/sprint7_salesman_seed.sql - salesman field seed")
    pdf.bullet("supabase/seed/sprint8_delivery_seed.sql - delivery field seed")
    pdf.bullet("supabase/fixtures/phase3_dev_fixtures.sql - dev/test only")
    pdf.bullet("pnpm db:seed:sprint4 - scripts/seed-sprint4.mjs")

    # RPCs
    pdf.h1("7. Critical RPCs / DB functions (do not bypass)")
    pdf.h2("7.1 Orders / Admin")
    for x in [
        "place_customer_order",
        "place_assisted_order",
        "update_order_status_admin",
        "admin_advance_order_to",
        "admin_assign_order_delivery",
        "admin_mark_payment_received",
        "order_status_happy_path_index / order_status_from_happy_path_index",
    ]:
        pdf.bullet(x)

    pdf.h2("7.2 Delivery")
    for x in [
        "delivery_start_route",
        "delivery_mark_stop_in_progress",
        "delivery_collect_cod",
        "delivery_complete_stop",
        "delivery_fail_stop",
        "delivery_complete_route",
        "assert_delivery_owns_route",
    ]:
        pdf.bullet(x)

    pdf.h2("7.3 Salesman / Auth helpers")
    for x in [
        "salesman_create_retailer",
        "salesman_create_invitation",
        "accept_shop_invitation",
        "is_admin / profile_has_role / current_profile_id / customer_shop_ids / salesman_shop_ids",
    ]:
        pdf.bullet(x)

    pdf.h2("7.4 Jobs / payments (Sprint 9)")
    for x in [
        "create_online_payment_intent / apply_payment_webhook_event",
        "enqueue_notification / job_drain_notification_outbox / job_claim_notification_batch",
        "job_expire_stock_reservations / job_expire_shop_invitations",
        "write_audit_log / log_application_event",
        "enforce_delivered_requires_paid (trigger invariant)",
    ]:
        pdf.bullet(x)

    # Sprint map
    pdf.h1("8. Build history map (what phase delivered what)")
    pdf.bullet("Phase 1 / MVP: product concept + early summaries")
    pdf.bullet("Phase 2: monorepo + full Postgres schema + RLS")
    pdf.bullet("Sprint 2: Auth foundation")
    pdf.bullet("Sprint 3: Data layer")
    pdf.bullet("Sprint 4: Admin CRUD foundation + soft delete + settings/reports tables")
    pdf.bullet("Sprint 5 / 5.1: Live Admin ERP + write policies")
    pdf.bullet("Sprint 6: Customer live app + invitation / place order")
    pdf.bullet("Sprint 7: Salesman PWA")
    pdf.bullet("Sprint 8: Delivery PWA")
    pdf.bullet("Sprint 9 / 9.1: Production services + blocker closure (jobs, payment intents, trusted GUC)")
    pdf.bullet("Phase 2.5 / 3.5 / 4 docs: readiness audits (pilot vs production)")
    pdf.bullet("Admin Sprint 2.x-3.5: Dashboard ops + Orders redesign + invoice + Convert to Sale + smart workflow")

    # How to run
    pdf.h1("9. How to run everything")
    pdf.mono(
        "pnpm install\n"
        "pnpm db:start          # Docker Desktop must be running\n"
        "pnpm db:reset          # apply ALL migrations + configured seeds\n"
        "pnpm db:types          # regenerate TS DB types\n"
        "\n"
        "pnpm dev:admin         # http://localhost:5173\n"
        "pnpm dev:sales         # http://localhost:5174\n"
        "pnpm dev:delivery      # http://localhost:5175\n"
        "pnpm dev:customer      # Expo\n"
        "\n"
        "pnpm typecheck && pnpm lint && pnpm test\n"
        "pnpm db:proof          # reset + types + db-tests"
    )
    pdf.p(
        "Admin live mode needs VITE_DATA_ADAPTER=supabase and local Supabase URL/anon key "
        "(see apps/admin-web/.env.example and root .env.example). "
        "If you see 'Could not find public.sales' or trusted_server_action errors: DB is behind - run db:reset."
    )

    # What to trust
    pdf.h1("10. What you can trust TODAY vs what not to trust")
    pdf.h2("Trust for demo / pilot SOP")
    pdf.bullet("Order lifecycle with Action Panel + Delivery PWA + payment + Convert to Sale")
    pdf.bullet("Pricing append-only schedule")
    pdf.bullet("Salesman create retailer / assisted order")
    pdf.bullet("Delivery route start / COD / complete stop")
    pdf.bullet("Auth login + role separation (Admin / Salesman / Delivery / Customer)")

    pdf.h2("Do NOT trust yet for production decisions")
    pdf.bullet("Reports analytics charts / export")
    pdf.bullet("Full Settings configuration writes")
    pdf.bullet("Online payment webhooks end-to-end in live ops (schema exists; ops maturity lagging)")
    pdf.bullet("Any flow still on mock adapters")
    pdf.bullet("Hardcoded seed UUID create shortcuts")

    # Recommended next fixes
    pdf.h1("11. Recommended fix order (if you want fewer faults)")
    pdf.bullet("1) Always db:reset before demos so Sprint 3.3/3.4 SQL is present.")
    pdf.bullet("2) Train ops: COD collect before Delivered (or mark payment first).")
    pdf.bullet("3) Finish Customer mock bleed - force live adapter on cart/order/restock.")
    pdf.bullet("4) Replace Reports placeholders with real aggregates.")
    pdf.bullet("5) Enable Settings mutations for warehouses / service areas / taxes.")
    pdf.bullet("6) Remove seed UUID shortcuts from create flows.")
    pdf.bullet("7) Then re-run Phase 3.5 / Phase 4 pilot checklist.")

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(
        0,
        4,
        "Files: docs/GroAurum-Full-Project-Status-Ready-vs-Gaps.pdf  |  "
        "Desktop: groaurum-app.pdf  |  Regenerate: "
        "python scripts/generate_groaurum_full_status_pdf.py",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    shutil.copy2(OUTPUT, DESKTOP_COPY)
    print(f"Wrote {OUTPUT}")
    print(f"Copied to {DESKTOP_COPY}")


if __name__ == "__main__":
    build()
