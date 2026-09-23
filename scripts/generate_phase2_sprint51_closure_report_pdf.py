"""Generate GroAurum Phase 2 Sprint 5.1 Closure Report PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint5.1-Closure-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 5.1 - Closure Report",
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


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(14)
    pdf.cell(0, 10, "GroAurum Admin ERP", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "Sprint 5.1 Closure Report", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        6,
        "Closes Phase 2.5 Production Readiness Audit blockers (no new product features).",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "OVERALL: Audit blockers closed for live Admin ERP reads + ADMIN JWT mutations.\n"
        "Remaining PARTIAL items are intentional deferrals (analytics charts, documents/visits tables, dedicated salesman-create UI).",
    )

    pdf.section_title("1. Audit Blocker Scorecard")
    pdf.verdict(
        "1. Create apps/admin-web/.env.local",
        "PASS",
        "Generated from local supabase status with VITE_DATA_ADAPTER=supabase, URL, anon key, auth provider, and dev credentials.",
    )
    pdf.verdict(
        "2. Configure adapter + Supabase URL/anon",
        "PASS",
        ".env.local and .env.example updated. Adapter resolves to supabase when env is present.",
    )
    pdf.verdict(
        "3. Replace mock auth with real Supabase Auth",
        "PASS",
        "createSupabaseAuthProvider maps profiles.roles -> AppRole, signs in via shared client. Dev auto-sign uses admin@groaurum.local.",
    )
    pdf.verdict(
        "4. Wire authenticated JWT into LiveAdminApi / repos",
        "PASS",
        "getAdminSupabaseClient() singleton shared by auth + adminDataClient / LiveAdminApi.",
    )
    pdf.verdict(
        "5. Categories CRUD UI",
        "PASS",
        "/categories uses CategoriesListPage with create/update/softDelete hooks (no PlaceholderPage).",
    )
    pdf.verdict(
        "6. Complete SKU CRUD (repo/service/hooks/UI)",
        "PASS",
        "CrudServices create/update/softDeleteSku + mutation hooks + ProductSkusTab create/activate/archive.",
    )
    pdf.verdict(
        "7. Wire mutation hooks (Pricing/Inventory/Customers/Orders/Salesmen/Delivery)",
        "PASS",
        "Pricing schedule/close; Inventory adjust; Customers create/reassign; Orders status; Salesmen add-customer/create-order; Delivery create/assign/close.",
    )
    pdf.verdict(
        "8. Verify mutations under ADMIN role",
        "PASS",
        "scripts/verify_sprint51_admin_mutations.mjs: 10/10 PASS after seed auth fix + admin write RLS migration.",
    )
    pdf.verdict(
        "9. Replace hardcoded placeholders where practical",
        "PARTIAL",
        "Inventory incoming/reorder show em dash; payment gateway fallback cleaned. Reports charts, documents[], visits[], activity[] remain until domain tables/analytics sprint.",
    )
    pdf.verdict(
        "10. Produce Sprint 5.1 Closure Report",
        "PASS",
        "This document.",
    )

    pdf.add_page()
    pdf.section_title("2. What Changed")
    pdf.bullet("Shared admin Supabase client (apps/admin-web/src/lib/adminSupabaseClient.ts)")
    pdf.bullet("Real createSupabaseAuthProvider in @groaurum/auth; stub retained as fallback without client")
    pdf.bullet("Seed auth.users token defaults + auth.identities so GoTrue password grant works")
    pdf.bullet("Migration 20260716170001_sprint51_admin_write_policies.sql for inventory/orders/delivery/prices")
    pdf.bullet("CategoriesListPage; SKU service/hooks/UI; mutation wiring across modules")
    pdf.bullet("Verification script: scripts/verify_sprint51_admin_mutations.mjs")

    pdf.section_title("3. ADMIN Mutation Probe Results")
    for line in [
        "auth.signIn",
        "categories.insert / update",
        "skus.insert",
        "sku_prices.insert",
        "inventory_balances.update",
        "shops.insert",
        "settings.update",
        "delivery_routes.insert",
        "products.update",
    ]:
        pdf.bullet(f"PASS — {line}")

    pdf.section_title("4. Remaining PARTIAL / Deferred")
    pdf.bullet("useCreateSalesmanMutation: no Add Salesman quick action (needs new auth.users); Salesmen actions use customer/order hooks instead")
    pdf.bullet("Service Areas route still PlaceholderPage")
    pdf.bullet("Reports PlaceholderChart / analytics snapshots")
    pdf.bullet("Customer documents / salesman visits empty arrays (no backing tables)")
    pdf.bullet("Dedicated login screen still deferred (dev auto-sign-in)")

    pdf.section_title("5. How to Run Locally")
    pdf.bullet("pnpm db:start && apply migrations; pnpm db:seed:sprint4 (or re-seed auth patch)")
    pdf.bullet("Ensure apps/admin-web/.env.local exists (copy from .env.example + anon key from supabase status)")
    pdf.bullet("pnpm --filter @groaurum/admin-web dev")
    pdf.bullet("node scripts/verify_sprint51_admin_mutations.mjs")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "Sprint 5.1 complete. Ready to begin Sprint 6 with live Admin ERP + ADMIN JWT CRUD foundation.",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
