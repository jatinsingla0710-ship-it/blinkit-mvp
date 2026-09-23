"""Generate GroAurum B2B domain migration plan summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-B2B-Migration-Plan.pdf"
CHECKPOINT = "18ee50a"


class MigrationPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum B2B Domain Migration Plan",
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
    pdf = MigrationPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "B2B Domain Migration Plan", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        5,
        f"B2B dry-fruit wholesale ordering and distribution platform\n"
        f"Launch market: Gurugram, India | Ops base: Fatehpur Beri\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"Git checkpoint: {CHECKPOINT}",
        align="C",
    )
    pdf.ln(14)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4.5,
        "This document summarizes the migration from the current Blinkit-style consumer "
        "quick-commerce MVP to the target GroAurum B2B architecture. "
        "No migration implementation has started yet.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Domain Correction Summary")
    pdf.body_text(
        "The current repository is a functional consumer quick-commerce MVP. "
        "The business domain is incorrect for GroAurum. The target product is a B2B "
        "dry-fruit wholesale ordering and distribution platform serving verified "
        "retailers and shops in Gurugram."
    )
    pdf.body_text("Incorrect assumptions to remove:")
    for item in [
        "Nearest dark store and service radius",
        "Store-scoped hard-coded catalog",
        "Guest checkout",
        "Simulated OTP, payment, and rider progress",
        "Auto-advancing order status",
        "Consumer grocery pricing and fees",
    ]:
        pdf.bullet(item)

    pdf.body_text("Target architecture pillars:")
    for item in [
        "Service areas (Gurugram clusters), not dark stores",
        "Fully dynamic admin-managed catalogue (empty catalog must work)",
        "Verified shop accounts with lifecycle and salesman assignment",
        "Salesman-assisted orders with customer-only confirmation OTP",
        "Zero credit: Pay Online Now or Pay on Delivery only",
        "Separate order status and payment status state machines",
        "Route-based B2B delivery, not fake rider GPS",
        "Four interfaces on one Supabase/PostgreSQL backend",
    ]:
        pdf.bullet(item)

    pdf.section_title("2. Module Classification (KEEP / ADAPT / REPLACE / REMOVE)")
    rows = [
        ("Module", "Disposition", "Notes"),
        ("Expo Router shell", "KEEP", "Adapt routes later for TradeFlow UX"),
        ("React Query + AppProviders", "KEEP", "Swap mock queryFns for Supabase"),
        ("Zustand pattern", "KEEP/ADAPT", "Shop session + draft order stores"),
        ("Design tokens (theme.ts)", "KEEP", "Brand foundation"),
        ("ProductCard, QtyButton, CartBar", "ADAPT", "B2B trade price, MOQ, units"),
        ("EmptyState, LoadingBlock, BrandLogo", "KEEP", "Domain-agnostic"),
        ("StatusTimeline", "ADAPT", "Real order states, no rider copy"),
        ("Search, PDP, cart, orders screens", "ADAPT", "Keep shells, rebind data"),
        ("Location flow + location store", "REPLACE", "Shop address + service area"),
        ("Dark store / geo radius", "REMOVE", "Pin-code service areas instead"),
        ("Mock catalogue + data.ts seed", "REPLACE", "Admin-managed dynamic catalog"),
        ("types/index.ts", "REPLACE", "New B2B domain types"),
        ("Cart store", "ADAPT", "Shop-scoped draft order lines"),
        ("Session store (guest)", "REPLACE", "Verified shop + auth session"),
        ("Checkout + mock OTP/payment", "REPLACE", "Real confirmation + payment"),
        ("Order service + simulator", "REPLACE", "Server-driven state machine"),
        ("Rider progress UI", "REMOVE", "Route-based delivery"),
        ("Consumer delivery fees", "REMOVE", "B2B trade pricing rules"),
        ("Expo template leftovers", "REMOVE", "Cleanup phase"),
    ]
    widths = [42, 22, 116]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("3. Target Repository Structure")
    pdf.mono_block(
        "groaurum/\n"
        "  apps/customer/     Expo RN app (current MVP moved here)\n"
        "  apps/sales-pwa/    Salesman mobile-first PWA\n"
        "  apps/delivery-pwa/ Delivery user PWA\n"
        "  apps/admin-web/    Desktop-first admin panel\n"
        "  packages/shared-types/  Domain enums + DTOs\n"
        "  packages/db/       Migrations, empty-catalog default seed\n"
        "  packages/api-client/    Typed Supabase + Edge clients\n"
        "  supabase/migrations/  PostgreSQL + RLS\n"
        "  supabase/functions/   Privileged workflows"
    )
    pdf.body_text("Defaults: pnpm monorepo; current Expo app becomes apps/customer via git mv.")

    pdf.section_title("4. Target Domain Model (Core Entities)")
    for group, items in [
        ("Territory", ["ServiceArea (Gurugram clusters, pin codes)", "Warehouse/OpsBase (Fatehpur Beri)"]),
        (
            "Catalog",
            [
                "Category, Product, Sku, SkuPrice (history)",
                "InventoryBalance",
                "Product types: PACKED, BULK",
                "Selling units: CARTON, KG (extensible)",
            ],
        ),
        (
            "Shops",
            [
                "Shop, ShopInvitation, ShopAuthLink",
                "Profile roles: CUSTOMER, SALESMAN, DELIVERY, ADMIN",
                "Lifecycle: LEAD -> INVITED -> ACTIVATED -> FIRST_ORDER -> REPEAT_CUSTOMER",
            ],
        ),
        ("Orders", ["Order, OrderLine, OrderEvent", "OrderConfirmationChallenge (customer OTP only)"]),
        ("Payments", ["Payment, PaymentEvent (separate from order status)"]),
        ("Fulfillment", ["StockReservation, DeliveryRoute, RouteStop, DeliveryAttempt"]),
        ("Audit", ["AuditLog (append-only)"]),
    ]:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(11, 83, 69)
        pdf.cell(0, 5, group, new_x="LMARGIN", new_y="NEXT")
        for item in items:
            pdf.bullet(item)
        pdf.ln(1)

    pdf.section_title("5. Authentication and Authorization")
    pdf.body_text("Auth: Supabase Auth with phone OTP. Shop identity is separate from auth user.")
    for item in [
        "Salesman creates shop + invitation before customer installs app",
        "Customer authenticates with registered mobile -> link to existing shop",
        "No duplicate shops; lifecycle INVITED -> ACTIVATED on link",
        "No guest checkout",
        "Privileged ops via Edge Functions (service role server-side only)",
        "RLS: customers see own shop/orders; salesmen assigned shops only",
        "Salesmen cannot confirm OTP, grant credit, or force DELIVERED",
        "Delivery users cannot grant credit",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Assisted-Order Confirmation Flow")
    pdf.mono_block(
        "salesman prepares DRAFT_ASSISTED\n"
        "  -> AWAITING_CUSTOMER_CONFIRMATION\n"
        "  -> customer reviews items, units, prices, total, delivery\n"
        "  -> customer chooses PAY_ONLINE_NOW or PAY_ON_DELIVERY\n"
        "  -> customer confirms on own device + OTP\n"
        "  -> CONFIRMED\n"
        "\n"
        "Outcomes: customer confirmed | requested changes | rejected\n"
        "Salesman cannot enter or bypass customer confirmation OTP."
    )

    pdf.section_title("7. Order State Machine")
    pdf.mono_block(
        "DRAFT_ASSISTED\n"
        "  -> AWAITING_CUSTOMER_CONFIRMATION\n"
        "  -> CONFIRMED\n"
        "  -> STOCK_RESERVED\n"
        "  -> PROCESSING\n"
        "  -> READY_FOR_DISPATCH\n"
        "  -> ASSIGNED_TO_ROUTE\n"
        "  -> OUT_FOR_DELIVERY\n"
        "  -> DELIVERED (only if payment PAID)\n"
        "  -> DELIVERY_FAILED | CANCELLED\n"
        "\n"
        "No automatic timer-based status progression."
    )

    pdf.section_title("8. Payment State Machine (Separate Field)")
    pdf.mono_block(
        "UNPAID -> PAYMENT_PENDING -> PAID | FAILED | REFUNDED\n"
        "\n"
        "Launch methods: Pay Online Now | Pay on Delivery (cash or confirmed UPI)\n"
        "Zero credit at launch. DELIVERED requires PAID (DB + Edge Function enforced)."
    )

    pdf.add_page()
    pdf.section_title("9. Service Area Model")
    for item in [
        "Admin manages Gurugram clusters with pin-code membership",
        "Shop delivery address maps to active ServiceArea to order",
        "Territory expansion cluster by cluster",
        "Fatehpur Beri is ops base metadata, not a consumer store picker",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Route-Based Delivery")
    pdf.mono_block(
        "confirmed -> stock reserved -> processing -> ready for dispatch\n"
        "  -> grouped into DeliveryRoute -> assigned delivery user\n"
        "  -> route stops -> payment collected/confirmed at stop\n"
        "  -> goods handed over -> DELIVERED\n"
        "\n"
        "Failure reasons: customer_unavailable, shop_closed, payment_not_available,\n"
        "customer_requested_credit, customer_refused_order, address_location_issue,\n"
        "damaged_order_issue, other (+ note)"
    )

    pdf.section_title("11. Four Target Interfaces")
    rows2 = [
        ("Interface", "Stack", "Focus"),
        ("Customer app", "Expo + RN + TS", "Retailer ordering, assisted review"),
        ("Sales PWA", "Mobile-first PWA", "Shop creation, draft orders"),
        ("Delivery PWA", "Mobile-first PWA", "Routes, POD, delivery outcomes"),
        ("Admin web", "Desktop responsive", "Catalog, areas, inventory, users"),
    ]
    w2 = [35, 40, 105]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("12. Migration Phases")
    phases = [
        ("Phase 0 (done)", f"Git checkpoint {CHECKPOINT} - preserve consumer MVP"),
        ("Phase 1", "B2B domain types + service adapter boundary; no UI redesign"),
        ("Phase 2", "Monorepo scaffold + Supabase migrations, RLS stubs, DB types"),
        ("Phase 3", "Replace services/mock with Supabase; empty catalog; service-area gate"),
        ("Phase 4", "Phone OTP auth + shop invitation/activation linking"),
        ("Phase 5", "Order/payment state machines; assisted OTP; remove simulator"),
        ("Phase 6", "Inventory reservation + admin catalog/service-area CRUD"),
        ("Phase 7", "Sales PWA + Delivery PWA"),
        ("Phase 8", "Customer TradeFlow UX redesign (HOME/CATALOGUE/RESTOCK/ORDERS/ACCOUNT)"),
    ]
    for phase, desc in phases:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(11, 83, 69)
        pdf.cell(0, 5, phase, new_x="LMARGIN", new_y="NEXT")
        pdf.body_text(desc)

    pdf.section_title("13. Preserve from Existing MVP")
    for item in [
        "Expo 57 + Expo Router + TypeScript shell",
        "TanStack Query provider pattern",
        "Zustand client state pattern",
        "ProductCard, QtyButton, CartBar, EmptyState, LoadingBlock, BrandLogo",
        "Search, PDP, cart, orders list, order detail screen foundations",
        "Theme tokens as starting visual language",
    ]:
        pdf.bullet(item)

    pdf.section_title("14. Remove Before UI Redesign")
    for item in [
        "Dark stores, nearest-store, service radius, preset consumer addresses",
        "Hard-coded catalog seed in app source",
        "Guest checkout and mock OTP 1234",
        "Simulated payment and auto status simulator",
        "Rider progress and consumer delivery fee logic",
        "Store-scoped cart lock and Q-commerce copy",
    ]:
        pdf.bullet(item)

    pdf.section_title("15. Explicit Non-Goals (Current Step)")
    for item in [
        "No UI redesign / TradeFlow visual overhaul yet",
        "No deleting project or rebuilding Expo from zero",
        "No hard-coding Kaju/Badam/W320 etc. as permanent catalog",
        "No implementing all four apps in one PR",
        "No migration implementation until plan approval",
    ]:
        pdf.bullet(item)

    pdf.section_title("16. Immediate Next Step After Approval")
    pdf.body_text(
        "Start Phase 1 only: introduce B2B domain types and a service adapter boundary "
        "without breaking the runnable MVP until a deliberate cutover in Phase 3. "
        "Stop again for approval before monorepo move and Supabase provisioning."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
