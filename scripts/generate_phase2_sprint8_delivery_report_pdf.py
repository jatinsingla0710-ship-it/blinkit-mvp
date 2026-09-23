"""Generate GroAurum Phase 2 Sprint 8 Delivery PWA report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint8-Delivery-PWA-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 8 - Live Delivery PWA",
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


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(14)
    pdf.cell(0, 10, "GroAurum Delivery PWA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(
        0,
        8,
        "Sprint 8 - Live Delivery PWA",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        6,
        "Goal: production-ready Delivery Vite PWA on Supabase (shared UI/auth, no redesign).",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        "OVERALL: apps/delivery-pwa converted from scaffold to a live field PWA with "
        "Supabase Auth (DELIVERY), dashboard KPIs, route/stop workflow, COD collection, "
        "and route completion summary.",
    )

    pdf.section_title("1. Delivery Auth Flow")
    pdf.bullet("Supabase Auth via @groaurum/auth createAuthProvider + SessionProvider")
    pdf.bullet("Audience gate: delivery_pwa; role required: delivery_executive / DELIVERY")
    pdf.bullet("Session persist + restore; ProtectedDeliveryRoute on shell")
    pdf.bullet("Dev auto sign-in: delivery1@groaurum.local / password123")

    pdf.section_title("2. Connected Modules")
    for item in [
        "Dashboard: today's routes, assigned deliveries, COD pending, completed, failed",
        "Route management: assigned routes, ordered stops, customer/address details",
        "Navigation link placeholder (Google Maps search URL)",
        "Workflow: Start route (Loaded/OFD) -> stop in progress -> delivered / failed",
        "Confirmation: status, timestamp via attempts, notes, photo/signature placeholders",
        "COD: expected amount, collect amount, paid status, collection history",
        "Route completion: close route when stops done; COD reconciliation summary",
        "Returned status: deferred (future)",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Supabase Integration")
    pdf.bullet("Migration: 20260716200001_sprint8_delivery_rpcs.sql")
    pdf.bullet("Seed: supabase/seed/sprint8_delivery_seed.sql")
    pdf.bullet("api-client: createSupabaseDeliveryService")
    pdf.bullet("RPCs: delivery_start_route, mark_stop_in_progress, complete_stop, fail_stop")
    pdf.bullet("RPCs: delivery_collect_cod, delivery_complete_route")
    pdf.bullet("Trusted GUC groaurum.trusted_server_action for order/payment updates")
    pdf.bullet("RLS: delivery_route_ids() scopes assigned routes to the executive")

    pdf.add_page()
    pdf.section_title("4. Remaining Placeholders")
    pdf.bullet("Photo blob capture / storage (boolean placeholder only)")
    pdf.bullet("Customer signature capture / storage (boolean placeholder only)")
    pdf.bullet("Native turn-by-turn navigation SDK (Maps URL only)")
    pdf.bullet("Returned / RTO workflow")
    pdf.bullet("Offline service worker beyond PWA manifest")
    pdf.bullet("Push notifications for route assignment")

    pdf.section_title("5. Production Readiness")
    pdf.body_text(
        "Ready for local/staging delivery field flows with seeded delivery1 account and "
        "today's PLANNED route. Production requires media storage for POD, hardened COD "
        "reconciliation reporting, and device GPS/navigation integration."
    )
    pdf.bullet("PASS: Auth session restore + DELIVERY role gate")
    pdf.bullet("PASS: Live dashboard / routes / stops under RLS")
    pdf.bullet("PASS: Start route + OFD order transitions")
    pdf.bullet("PASS: Deliver / fail with attempt notes + placeholders")
    pdf.bullet("PASS: COD collect + history + route close summary")
    pdf.bullet("PARTIAL: Photo/signature (flags only, no files)")
    pdf.bullet("PARTIAL: Navigation (external Maps link)")

    pdf.section_title("6. How to Run")
    pdf.bullet("pnpm db:start; apply Sprint 8 migration + sprint8_delivery_seed.sql")
    pdf.bullet("Copy apps/delivery-pwa/.env.example to .env.local")
    pdf.bullet("pnpm dev:delivery  (http://127.0.0.1:5175)")
    pdf.bullet("Sign in as delivery1@groaurum.local / password123")

    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(0, 5, "Sprint 8 complete. Delivery PWA is live on Supabase foundations.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
