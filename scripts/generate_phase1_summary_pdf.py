"""Generate GroAurum Phase 1 completion summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase-1-Summary.pdf"
CHECKPOINT = "18ee50a"
PHASE1_COMMIT = "eb05c74"


class Phase1PDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0, 8, "GroAurum Phase 1 - B2B Domain and Service Boundaries",
                align="R", new_x="LMARGIN", new_y="NEXT",
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
    pdf = Phase1PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(28)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 9, "Phase 1 Completion Summary", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0, 5,
        f"B2B domain model and service adapter boundaries\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        f"MVP checkpoint: {CHECKPOINT}\n"
        f"Phase 1 commit: {PHASE1_COMMIT}",
        align="C",
    )
    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0, 4.5,
        "Phase 1 introduces the target GroAurum B2B domain and service contracts "
        "while preserving the runnable consumer MVP. No UI redesign, no Supabase, "
        "no monorepo move.",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Phase 1 Goal")
    pdf.body_text(
        "Introduce the target B2B domain model and service adapter boundary while "
        "keeping the current Expo consumer MVP runnable until deliberate backend cutover."
    )

    pdf.section_title("2. What Was Added")
    for item in [
        "domain/ - B2B types in focused modules (service areas, shops, catalog, inventory, orders, payments, delivery, audit)",
        "domain/policies/ - testable order and payment transition policies",
        "services/contracts/ - 9 service interfaces for future Supabase/Edge implementations",
        "services/adapters/legacy-mvp/ - documents current mock port",
        "services/adapters/not-implemented.ts - B2B stub adapters",
        "services/index.ts - b2b.* boundary + legacyMvp re-exports",
        "docs/architecture/phase-1-domain.md - architecture documentation",
        "vitest + 14 domain policy tests",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Domain Modules")
    rows = [
        ("Module", "Key entities / concepts"),
        ("enums.ts", "ProductType, SellingUnit, lifecycle, roles, movement types"),
        ("service-area.ts", "ServiceArea + extensible ServiceabilityRule (PIN/ADMIN/POLYGON)"),
        ("operational-location.ts", "Ops base / warehouse (Fatehpur Beri)"),
        ("shop.ts", "Shop, contacts, invitations, auth links"),
        ("staff.ts", "StaffProfile, roles"),
        ("catalog.ts", "Category, Product, Sku, SkuPrice + config helpers"),
        ("inventory.ts", "Balance, Movement ledger, StockReservation"),
        ("order.ts", "Order states, snapshot OrderLine, events, assisted challenge"),
        ("payment.ts", "Payment states and events (separate from order)"),
        ("delivery.ts", "DeliveryRoute, RouteStop, DeliveryAttempt"),
        ("audit.ts", "Append-only AuditLog"),
        ("policies/", "canTransitionOrder, canTransitionPayment"),
    ]
    widths = [42, 138]
    for i, row in enumerate(rows):
        if pdf.get_y() > 250:
            pdf.add_page()
        pdf.table_row(list(row), widths, header=(i == 0))
        pdf.ln(0.5)

    pdf.add_page()
    pdf.section_title("4. Architecture Corrections Applied")
    pdf.body_text("Service areas:")
    for item in [
        "ServiceArea is the primary business entity (not PIN-code-only)",
        "ServiceabilityRule supports PIN_CODE, ADMIN_AREA, POLYGON configs",
        "Polygon/geofence not implemented in Phase 1 - model only",
    ]:
        pdf.bullet(item)

    pdf.body_text("Catalogue extensibility:")
    for item in [
        "PACKED/BULK and CARTON/KG are domain values on Sku",
        "SKU carries MOQ, quantity step, net quantity, packs per carton, grade, spec",
        "UI/services reason from getSkuOrderConstraints() - no scattered conditionals",
    ]:
        pdf.bullet(item)

    pdf.body_text("Inventory ledger (types only, no persistence):")
    for item in [
        "InventoryBalance: on-hand, reserved, available (derived)",
        "InventoryMovement: append-only ledger (RECEIPT, ORDER_DISPATCH, etc.)",
        "StockReservation: order-linked reservations",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. State Transition Policies")
    pdf.mono_block(
        "Order states:\n"
        "DRAFT_ASSISTED -> AWAITING_CUSTOMER_CONFIRMATION -> CONFIRMED\n"
        "-> STOCK_RESERVED -> PROCESSING -> READY_FOR_DISPATCH\n"
        "-> ASSIGNED_TO_ROUTE -> OUT_FOR_DELIVERY -> DELIVERED\n"
        "(also DELIVERY_FAILED, CANCELLED)\n"
        "\n"
        "Payment states (separate field):\n"
        "UNPAID -> PAYMENT_PENDING -> PAID | FAILED | REFUNDED\n"
        "\n"
        "Critical invariant: DELIVERED requires payment status PAID.\n"
        "Clients cannot set isTrustedServerAction - server-side only."
    )

    pdf.section_title("6. Service Contracts")
    for item in [
        "CatalogueService",
        "ServiceAreaService",
        "ShopService",
        "AuthenticationShopLinkingService",
        "OrderService (confirmCustomerOrder, reserveOrderStock, completeDelivery, etc.)",
        "AssistedOrderConfirmationService",
        "PaymentService",
        "InventoryService",
        "DeliveryRouteService",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Adapter Boundary")
    pdf.mono_block(
        "services/\n"
        "  contracts/       B2B interfaces\n"
        "  adapters/\n"
        "    legacy-mvp/    current mock port (documented)\n"
        "    not-implemented.ts\n"
        "  mock/            unchanged runnable consumer MVP\n"
        "  index.ts         b2b.* + legacyMvp exports\n"
        "\n"
        "Screens still import @/services/mock directly.\n"
        "types/index.ts remains legacy consumer types.\n"
        "New B2B types live in domain/."
    )

    pdf.add_page()
    pdf.section_title("8. Tests and Validation")
    rows2 = [
        ("Check", "Result"),
        ("npm run test", "Pass - 14/14 tests"),
        ("npx expo export --platform web", "Pass - 14 static routes"),
        ("npm run typecheck", "Pre-existing ExternalLink.tsx error (not Phase 1)"),
        ("Lint", "Not configured"),
    ]
    w2 = [55, 125]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), w2, header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("9. What Phase 1 Did NOT Do")
    for item in [
        "No monorepo move",
        "No Supabase provisioning or connection",
        "No UI redesign",
        "No removal of mock implementation",
        "No Sales PWA, Delivery PWA, or Admin Web",
        "No hard-coded launch products",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Compatibility Compromises")
    for item in [
        "Dual type systems: legacy types/index.ts + new domain/",
        "Mock layer untouched - screens unchanged",
        "Adapter boundary structural only - not wired into UI yet",
        "Inventory types/contracts only - no persistence",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Git History")
    pdf.mono_block(
        f"{CHECKPOINT} checkpoint: preserve original customer MVP\n"
        f"{PHASE1_COMMIT} feat: add GroAurum B2B domain and service boundaries"
    )

    pdf.section_title("12. Next Step (Phase 2 - not started)")
    pdf.body_text(
        "After approval: monorepo scaffold (apps/customer), Supabase migrations, "
        "RLS stubs, generated DB types. Then Phase 3 replaces not-implemented "
        "adapters with Supabase-backed implementations."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
