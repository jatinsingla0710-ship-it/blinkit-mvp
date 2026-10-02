"""Generate GroAurum Phase 5 Admin Business & Accounting Audit PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase5-Admin-Business-Accounting-Audit.pdf"


def safe(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2192", "->")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "-")
        .replace("\u00d7", "x")
        .replace("\u2260", "!=")
        .replace("\u2264", "<=")
        .replace("\u2265", ">=")
        .encode("latin-1", "replace")
        .decode("latin-1")
    )


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 5 - Admin Business & Accounting Audit",
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
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(11, 83, 69)
        self.cell(0, 7, safe(title), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(26, 141, 73)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def body_text(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 4.5, safe(text))
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 31, 24)
        indent = 5
        self.set_x(self.l_margin + indent)
        width = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(width, 4.5, safe(f"- {text}"))
        self.set_x(self.l_margin)

    def status_line(self, label: str, status: str, note: str = ""):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        color = {
            "WORKING": (26, 141, 73),
            "PARTIAL": (180, 120, 20),
            "MISSING": (180, 40, 40),
            "UI ONLY": (180, 120, 20),
            "READY": (26, 141, 73),
        }.get(status, (15, 31, 24))
        self.set_text_color(*color)
        line = f"{label}: {status}"
        if note:
            line += f" - {note}"
        self.multi_cell(0, 5, safe(line))
        self.set_text_color(15, 31, 24)
        self.set_x(self.l_margin)

    def table_row(self, cols: list[str], widths: list[float], header: bool = False):
        if self.get_y() > self.h - 28:
            self.add_page()
        if header:
            self.set_font("Helvetica", "B", 7.5)
            self.set_fill_color(232, 246, 238)
        else:
            self.set_font("Helvetica", "", 7.5)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(15, 31, 24)
        y0 = self.get_y()
        x0 = self.l_margin
        line_h = 4.0
        heights = []
        for col, w in zip(cols, widths):
            self.set_xy(x0, y0)
            self.multi_cell(w, line_h, safe(col), border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else line_h
        if y0 + row_h > self.h - 14:
            self.add_page()
            return self.table_row(cols, widths, header=header)
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

    # Cover
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(
        0,
        8,
        "Phase 5 - Admin Business & Accounting Audit",
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
        safe(
            "AUDIT ONLY - No code, schema, or hosted Supabase changes\n"
            f"Generated: {date.today().strftime('%B %d, %Y')}\n"
            "Scope: apps/admin-web + packages/api* + supabase/migrations"
        ),
        align="C",
    )
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 6, "Change confirmation", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(15, 31, 24)
    for line in (
        "Code changes: NONE",
        "Database changes: NONE",
        "Migrations applied: NONE",
        "Hosted Supabase changes: NONE",
        "Commit / Push / Deployment: NONE",
    ):
        pdf.cell(0, 5, line, align="C", new_x="LMARGIN", new_y="NEXT")

    # 1. Executive Summary
    pdf.add_page()
    pdf.section_title("1. Executive Summary")
    pdf.body_text(
        "Admin is a working owner ERP shell with strong order -> payment -> sale -> "
        "inventory consume ops, plus cash-oriented accounting (residual AR, Day Book, "
        "company expenses, paid payroll, lightweight P&L). It is NOT a general ledger: "
        "no journals, chart of accounts, double-entry, supplier/purchasing domain, "
        "cost basis, or GST engine."
    )
    pdf.bullet(
        "Already solid: residual ledger/receivables, payments/COD, company expenses, "
        "Day Book, payroll, financial reports, inventory quantity + warehouses, "
        "catalogue/pricing, Phase 4A owner money dashboard."
    )
    pdf.bullet(
        "Largest gaps: purchasing/suppliers, inventory cost/COGS, true profitability, "
        "GST compliance, cash/bank opening-closing balances, payment-without-order / "
        "advances / credit notes."
    )
    pdf.bullet(
        "Direction: extend existing cash + residual AR model; do not rebuild a "
        "traditional double-entry ERP unless a later phase explicitly requires it."
    )

    # 2. Accounting
    pdf.section_title("2. Accounting Audit")
    pdf.body_text(
        "Customer ledger is a residual outstanding (AR) model derived from orders "
        "joined to payments - NOT a full double-entry accounting ledger. Debit/Credit/"
        "Balance columns are presentation only. No journal table, COA, or stored balances."
    )
    pdf.status_line("Customer ledger (residual AR)", "WORKING", "customer-ledger.ts")
    pdf.status_line("Receivables / outstanding", "WORKING", "/receivables + outstanding report")
    pdf.status_line("Payments / COD / cash / online", "WORKING", "payments + COD custody RPCs")
    pdf.status_line("Company expenses", "WORKING", "company_expenses + admin_* RPCs")
    pdf.status_line("Day Book", "WORKING", "client-composed cash events")
    pdf.status_line("Paid payroll in Day Book", "WORKING", "salesman_payroll PAID only")
    pdf.status_line("Full refunds", "PARTIAL", "admin_refund_converted_sale; no partial CN")
    pdf.status_line("Formal credit sales", "MISSING", "zero-credit payment intents")
    pdf.status_line("Cash advances / payment w/o order", "MISSING", "")
    pdf.status_line("Opening/closing cash-bank balances", "MISSING", "")
    pdf.status_line("Journal / double-entry / account heads / CN-DN", "MISSING", "")

    pdf.body_text(
        "Outstanding rule: sum max(0, order.total - cash_collected - online_collected) "
        "for non-CANCELLED orders; PAID/REFUNDED -> 0. Day Book entries: sale (PAID), "
        "collection (partial), refund, company expense, paid payroll. Salesman expense "
        "claims are excluded from Day Book."
    )

    # 3. Purchasing
    pdf.section_title("3. Purchasing Audit")
    pdf.status_line("Purchasing domain (suppliers/PO/GRN/bills)", "MISSING", "no tables/routes")
    pdf.bullet(
        "Closest non-procurement surfaces: company_expense_category.PURCHASE "
        "(cash expense only) and inventory movement RECEIPT labeled Supplier Receipt "
        "(seed/initial create/fixtures - not PO->GRN)."
    )
    pdf.bullet(
        "salesman_return_requests = customer return claims, not vendor returns; "
        "approval does not move stock as a purchase return."
    )

    # 4. Inventory
    pdf.section_title("4. Inventory Valuation Audit")
    pdf.status_line("Quantity / warehouses / adjust / fulfill", "WORKING", "")
    pdf.status_line("Cost basis / COGS / FIFO / batch / transfers", "MISSING", "")
    pdf.body_text(
        "Quantity: inventory_balances on_hand/reserved; available = generated "
        "GREATEST(on_hand - reserved, 0). Movements append-only "
        "(RECEIPT, ORDER_DISPATCH, DAMAGE, RETURN, ADMIN_ADJUSTMENT). "
        "Convert consumes reserved stock via _consume_reserved_inventory_for_order. "
        "Adjust via admin_adjust_inventory_balance. Stock value UI reads cost_per_unit "
        "which is NOT a DB column - live value effectively blank."
    )

    # 5. Profitability
    pdf.section_title("5. Profitability Audit")
    pdf.body_text(
        "Current P&L is a hybrid operating snapshot, not accounting net profit. "
        "From buildProfitLoss in financial-reports.ts:"
    )
    pdf.bullet("Operating Result = converted sales total - company expenses - paid payroll")
    pdf.bullet(
        "Net Cash Movement = Day Book (sale-in + collection-in) - refunds - expenses "
        "- paid payroll"
    )
    pdf.bullet("COGS explicitly excluded (disclaimer in code)")
    pdf.bullet("Commission only via paid payroll totals, not a separate P&L line")
    pdf.bullet("Product/salesman reports = sales value / commission earned, not margin")
    pdf.bullet(
        "Convert requires DELIVERED + PAID; sales register is paid conversions. "
        "Outstanding comes from order residual (pre-convert / partial)."
    )

    # 6. GST
    pdf.section_title("6. GST / Tax Audit")
    pdf.status_line("Company GSTIN/PAN on settings + invoice print", "PARTIAL", "display only")
    pdf.status_line("Taxes Settings section", "UI ONLY", "live taxes: [] ; fixtures only")
    pdf.status_line("CGST/SGST/IGST, HSN on SKU, line tax, GSTR, e-invoice", "MISSING", "")

    # 7. Owner control
    pdf.section_title("7. Owner Control Audit")
    pdf.body_text(
        "Dashboard hierarchy: Money -> Attention -> Operations -> Quick actions -> "
        "Recent activity. Money KPIs from ownerFinancialOverview are live. Ops KPIs "
        "from dashboardSnapshot / admin_ops_dashboard_kpis. Phase 4A strips duplicate "
        "monthly_revenue from ops cards."
    )
    pdf.bullet(
        "Risk: if Money query fails/loads slowly, dashboard can show no sales revenue "
        "because ops already removed monthly_revenue."
    )
    pdf.bullet(
        "Hard read caps: listSalesRegister limit 500 (owner overview) / 2000 (P&L) "
        "can undercount busy periods."
    )
    pdf.bullet("Cash/bank balances, purchase/GST/profit controls: MISSING")

    # 8. Database
    pdf.section_title("8. Database Inventory")
    pdf.body_text(
        "Relevant tables include: shops, orders, order_lines, payments, payment_events, "
        "sales, sale_items, sales_payments, products, skus, sku_prices, categories, "
        "inventory_balances, inventory_movements, stock_reservations, operational_locations, "
        "company_expenses, salesman_payroll, salesman_salary_terms, salesman_attendance, "
        "sku_commission_terms, salesman_commission_entries, salesman_expenses, "
        "salesman_return_requests, delivery/COD tables, settings, reports_snapshot "
        "(placeholder)."
    )
    pdf.body_text(
        "No tables for: suppliers, purchases, journals, tax lines, cost layers, "
        "account heads."
    )
    pdf.body_text(
        "Key migrations: 20260715100600_inventory, 20260715100800_payments, "
        "20260724180000_sales_conversion, 20260820190000_admin_adjust_inventory, "
        "20260827160000_payment_cash_remaining, 20260903120000_fulfill_sale_consume, "
        "20260930120000_company_expenses, 20261001120000_salesman_payroll."
    )

    # 9. API
    pdf.section_title("9. API / RPC Inventory")
    w = [38, 55, 97]
    pdf.table_row(["Feature", "Admin API", "RPC / tables"], w, header=True)
    rows = [
        ("Receivables/ledger", "receivablesSnapshot", "Client calc over orders+payments"),
        ("Day Book", "dayBookSnapshot", "buildDayBookEntries (derived)"),
        ("Expenses", "companyExpenses* + mutations", "admin_*_company_expense"),
        ("Payroll", "payrollMonthSnapshot + CRUD", "admin_*_salesman_payroll"),
        ("P&L / owner money", "profitLossSnapshot / ownerFinancialOverview", "Composes above"),
        ("Sales / reports", "listSalesRegister / productSalesReport", "sales / sale_items"),
        ("Payments / COD", "Payments page APIs", "mark/settle/verify COD RPCs"),
        ("Inventory", "inventorySnapshot/Detail", "balances; adjust via packages/api RPC"),
        ("Pricing/commission", "LiveAdminApi methods", "admin_set_sku_price / commission"),
    ]
    for r in rows:
        pdf.table_row(list(r), w)

    # 10. Source of truth
    pdf.section_title("10. Source-of-Truth Map")
    w2 = [32, 55, 50, 53]
    pdf.table_row(["Metric", "Source", "Calc", "Mode"], w2, header=True)
    sot = [
        ("Revenue", "sales.total (not REFUNDED)", "sumSalesTotal", "Recalculated"),
        ("Collections", "Day Book sale+collection in", "summarizeDayBookByType", "Recalculated"),
        ("Outstanding", "order residual vs cash+online", "orderOutstandingResidual", "Recalculated"),
        ("Expenses", "company_expenses.amount", "date filter", "Recalculated"),
        ("Payroll", "salesman_payroll PAID total", "paid filter", "Frozen when PAID"),
        ("Commission", "entries -> payroll total", "payroll calc RPC", "Accrual + snapshot"),
        ("Inventory qty", "inventory_balances", "generated available", "Live"),
        ("Inventory value", "None real", "UI stub cost_per_unit", "N/A"),
        ("COGS", "None", "-", "N/A"),
        ("Profit", "buildProfitLoss operatingResult", "sales - opex - payroll", "Recalculated"),
        ("Refunds", "REFUNDED payments/sales", "Day Book refund out", "Recalculated"),
    ]
    for r in sot:
        pdf.table_row(list(r), w2)

    # 11. Matrix
    pdf.section_title("11. Existing vs Missing Matrix (summary)")
    w3 = [28, 42, 28, 92]
    pdf.table_row(["Area", "Feature", "Status", "Location"], w3, header=True)
    matrix = [
        ("Accounting", "Residual ledger/AR", "WORKING", "customer-ledger.ts; /receivables"),
        ("Accounting", "Day Book", "WORKING", "day-book.ts; /day-book"),
        ("Accounting", "Company expenses", "WORKING", "company_expenses RPCs"),
        ("Accounting", "GL / journals / COA", "MISSING", "-"),
        ("Purchasing", "Suppliers / PO / GRN", "MISSING", "-"),
        ("Inventory", "Qty ops", "WORKING", "balances/movements/RPCs"),
        ("Inventory", "Cost / COGS", "MISSING", "-"),
        ("Profit", "Operating P&L", "WORKING", "financial-reports.ts"),
        ("Profit", "Gross / true net", "MISSING", "-"),
        ("GST", "Company GSTIN print", "PARTIAL", "settings JSON + invoice"),
        ("GST", "Tax engine / GSTR", "MISSING", "-"),
        ("Owner", "Money dashboard", "WORKING", "DashboardPage + overview API"),
        ("Owner", "Taxes settings", "UI ONLY", "TaxesSection; taxes=[]"),
        ("AI", "LLM / embeddings", "MISSING", "no deps/keys found"),
    ]
    for r in matrix:
        pdf.table_row(list(r), w3)

    # 12. Do not rebuild
    pdf.section_title("12. Do-Not-Rebuild List")
    for item in (
        "Residual AR / ledger helpers (customer-ledger.ts) and receivablesSnapshot",
        "Payment + COD custody RPCs and Payments UI",
        "Company expense CRUD RPCs + Day Book expense mapping",
        "Salesman payroll calculate -> approve -> paid + Day Book payroll mapping",
        "Day Book composition and IST business-dates.ts",
        "buildProfitLoss / report hub / CSV exporters",
        "Inventory balances/movements/reservations + adjust + fulfill-on-convert",
        "Sale conversion core and refund RPC",
        "Catalogue sku_prices trade pricing + commission accrual",
        "Phase 1 nav / section hubs (keep secondary modules nested)",
    ):
        pdf.bullet(item)

    # 13. Missing features
    pdf.section_title("13. Missing Features (priority)")
    w4 = [55, 18, 117]
    pdf.table_row(["Missing feature", "Pri", "Reuse / note"], w4, header=True)
    missing = [
        ("Supplier master + balances", "P0", "None domain; expense PURCHASE only"),
        ("Purchase bill / GRN -> stock with cost", "P0", "balances + RECEIPT enum patterns"),
        ("Cost basis / COGS / stock valuation", "P0", "movements + sale_items qty"),
        ("Gross/net profit with COGS", "P1", "Extend buildProfitLoss"),
        ("Cash/bank closing view", "P1", "Day Book Cash/Bank/UPI methods"),
        ("GST line tax + HSN", "P1", "Company GSTIN + invoice print"),
        ("Supplier dues report", "P1", "Receivables UX patterns"),
        ("Payment w/o order / advances", "P2", "payments today are order-bound"),
        ("Credit / debit notes", "P2", "Full refund only today"),
        ("Real category tax mappings", "P2", "TaxesSection shell"),
        ("Admin AI assistant", "P3", "No AI infra yet"),
    ]
    for r in missing:
        pdf.table_row(list(r), w4)

    # 14. Duplicates
    pdf.section_title("14. Duplicate / Conflict Findings")
    for item in (
        "Sales revenue vs collections easy to confuse; owner KPI merges Day Book sale-in+collection-in as Collections Today",
        "Sales totals from sales table vs Day Book money-in from orders/payments (intentional but must stay labeled)",
        "Outstanding (order residual) vs unpaid sales language on dashboard",
        "Company expenses vs salesman expense claims (only company in Day Book)",
        "Payroll vs company expense SALARY category (double-count risk)",
        "Inventory Supplier Receipt label without purchasing domain",
        "Settings taxes fixtures vs live empty taxes array",
        "Stock value reads non-existent cost_per_unit",
        "COD FIFO settle legacy vs settle-by-order-ids (prefer selected)",
    ):
        pdf.bullet(item)

    # 15. Risks
    pdf.section_title("15. Data Integrity Risks")
    for item in (
        "Salary double-count if company_expenses SALARY used alongside paid salesman_payroll",
        "Operating result != cash profit; COGS absent -> overstated profit appearance",
        "Inventory value UI misleading without cost column",
        "PAID Day Book uses order.total as sale-in (assumes paid = full total)",
        "Refunds full-order only; no partial credit-note path",
        "PURCHASE expense does not create inventory",
        "Hard query limits (500/2000) can understate busy periods",
        "Dashboard revenue can disappear if Money overview fails",
        "No shop GSTIN; invoice shows seller GSTIN only",
    ):
        pdf.bullet(item)

    # 16. UX
    pdf.section_title("16. UX / Navigation Findings")
    pdf.body_text(
        "Keep Phase 1 sidebar philosophy (no top-level Pricing/Payments/Warehouses/"
        "Commission/Service Areas). Recommended eventual homes (no changes in this audit):"
    )
    pdf.bullet("Purchasing/suppliers -> Business Purchasing hub or Accounting child")
    pdf.bullet("Inventory valuation -> Inventory + Reports")
    pdf.bullet("GST -> Settings (config) + Reports (GSTR) + invoice print")
    pdf.bullet("Profitability -> Reports (extend P&L) + Dashboard money strip")
    pdf.bullet("Supplier dues -> Accounting next to Receivables")

    # 17. AI
    pdf.section_title("17. AI Infrastructure Findings")
    pdf.body_text(
        "No OpenAI / Anthropic / Gemini / AI SDK / embeddings / vector DB dependencies "
        "or env keys found in app/package/config searches. Future AI would be new "
        "infrastructure over existing LiveAdminApi read models - not present today."
    )

    # 18. Sequence
    pdf.section_title("18. Recommended Phase 5 Sequence")
    pdf.bullet("5A Purchasing foundation: supplier master + purchase bill/GRN -> stock with cost")
    pdf.bullet("5B Inventory valuation + COGS; extend P&L honesty")
    pdf.bullet("5C Owner money controls: cash/bank views, expense vs payroll guardrails")
    pdf.bullet("5D GST foundation: HSN/tax on catalogue + invoice lines; GSTR later")
    pdf.bullet("5E Edge money flows (optional): advances / payment-without-order / credit notes")
    pdf.bullet("5F AI (optional, last): only after financial sources of truth stabilize")
    pdf.body_text(
        "Avoid introducing double-entry unless a later audit proves residual cash "
        "accounting is insufficient."
    )

    # 19-21
    pdf.section_title("19. Files Inspected (sample)")
    pdf.body_text(
        "apps/admin-web/src/data/customer-ledger.ts, day-book.ts, financial-reports.ts, "
        "business-dates.ts, company-expenses.ts, salesman-payroll.ts, "
        "live/LiveAdminApi.ts, inventory-movement-map.ts; pages/DashboardPage.tsx, "
        "App.tsx, nav.ts, section-links.ts, pages/reports/*; "
        "components/settings/TaxesSection.tsx, CompanyProfileSection.tsx, "
        "OrderInvoicePrint.tsx; packages/validation company-settings; "
        "packages/api ops-repositories; packages/api-client database.generated.ts / "
        "database.extended.ts."
    )

    pdf.section_title("20. Database Objects Inspected (sample)")
    pdf.body_text(
        "Tables/enums/RPCs listed in sections 8-9. Migrations inspected include inventory, "
        "payments, sales conversion, adjust inventory, cash remaining, COD custody, "
        "fulfill sale consume, company expenses, salesman payroll."
    )

    pdf.section_title("21. Verification")
    pdf.bullet("Tests / typecheck / lint / build: NOT run (audit-only)")
    pdf.bullet("Database inspection: YES - repository migrations + generated types")
    pdf.bullet("Hosted Supabase live query: NO")
    pdf.bullet("Data changed: NO")

    pdf.section_title("22. Change Confirmation")
    for line in (
        "Code changes: NONE",
        "Database changes: NONE",
        "Migrations applied: NONE",
        "Hosted Supabase changes: NONE",
        "Commit: NONE",
        "Push: NONE",
        "Deployment: NONE",
    ):
        pdf.bullet(line)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
