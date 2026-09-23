"""Generate GroAurum Phase 3.5 Launch Readiness Audit PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase3.5-Launch-Readiness-Audit.pdf"

# Equal-weight score: PASS=100, PARTIAL=55, FAIL=15
SCORE_MAP = {"PASS": 100, "PARTIAL": 55, "FAIL": 15}

ITEMS: list[tuple[str, str, str]] = [
    # (label, status, detail)
    (
        "Customer App",
        "PARTIAL",
        "Live auth/session, catalogue, place order + reserve, orders/account reads. "
        "Phone OTP needs SMS; promotions/invoice placeholders; online pay UI not wired; "
        "account address edit missing.",
    ),
    (
        "Admin ERP",
        "PARTIAL",
        "Live catalogue/customer/order-list/pricing/inventory/delivery list CRUD paths. "
        "No production login screen (dev auto-sign). Reports charts FAIL live. "
        "Service-areas route placeholder; many settings/salesman/delivery detail mutations deferred. "
        "Order status update blocked by trusted_server_action without admin RPC.",
    ),
    (
        "Salesman PWA",
        "PARTIAL",
        "Strongest field surface: auth role gate, dashboard, retailers, invite token, "
        "assisted order + MOQ, visits, performance. Assisted OTP confirmation is placeholder "
        "(no SMS). Offline = manifest only.",
    ),
    (
        "Delivery PWA",
        "PARTIAL",
        "Auth, routes, start/complete/fail, COD collect + history live. "
        "Photo/signature are boolean placeholders; Maps is external URL; offline = manifest only.",
    ),
    (
        "Authentication",
        "PARTIAL",
        "@groaurum/auth + Supabase sessions for admin/sales/delivery; customer custom session. "
        "Seeded users work. Phone OTP / production login UX incomplete.",
    ),
    (
        "Permissions",
        "PARTIAL",
        "Audience + RoleGuard + AdminModuleGuard present. Live DB collapses ADMIN to "
        "super_admin; fine-grained ERP roles are mock-only. READ_ONLY order visibility gap.",
    ),
    (
        "CRUD",
        "PARTIAL",
        "Core admin mutations wired (Sprint 5.1). Gaps: reports write, service areas UI, "
        "salesman create UI unused, delivery detail actions deferred, admin order status RPC.",
    ),
    (
        "Realtime",
        "PARTIAL",
        "createSupabaseRealtimeBus implemented and attached to domain repos. "
        "No app React Query invalidation wiring found — infrastructure only.",
    ),
    (
        "Notifications",
        "PARTIAL",
        "notification_outbox + enqueue RPC + send-notification worker. "
        "Providers stub without SMS/WA/FCM/email secrets.",
    ),
    (
        "Payments",
        "PARTIAL",
        "COD live (delivery_collect_cod). Online: intent RPC + Razorpay edges "
        "(stub without keys). Webhook apply idempotent; HMAC optional if secret unset.",
    ),
    (
        "Inventory",
        "PARTIAL",
        "Balances + reserve inside place_* RPCs; expires_at + expire job. "
        "Customer InventoryService still proxy; admin adjust path present.",
    ),
    (
        "Orders",
        "PARTIAL",
        "Customer/salesman place + timeline; delivery OFD/delivered/failed. "
        "Admin status transitions lack trusted RPC wrapper.",
    ),
    (
        "RLS",
        "PARTIAL",
        "Scoped policies for admin/salesman/delivery/customer + Sprint 4–9 extensions. "
        "Sensitive writes via SECURITY DEFINER. READ_ONLY incomplete for orders.",
    ),
    (
        "Repository Layer",
        "PARTIAL",
        "Live api-client services for customer/sales/delivery/payment/notification. "
        "AssistedOrder/inventory/deliveryRoute proxies on customer factory; "
        "admin reports/dashboard placeholder repos.",
    ),
    (
        "Edge Functions",
        "PARTIAL",
        "razorpay-create-order, razorpay-webhook, send-notification, "
        "expire-reservations, expire-invitations. Shared CORS/log helpers. "
        "Job edges lack cron-secret auth.",
    ),
    (
        "Cron Jobs",
        "FAIL",
        "Job RPCs + HTTP invoke exist. supabase/config.toml has no schedules. "
        "Reservation/invitation/notification workers will not run unattended.",
    ),
    (
        "Seeds",
        "PARTIAL",
        "sprint4 admin/sales/catalogue/shops; sprint6 customer; sprint7 salesman visits; "
        "sprint8 delivery route/COD. No READ_ONLY seed; only db:seed:sprint4 scripted.",
    ),
    (
        "Migrations",
        "PASS",
        "MIGRATION_INDEX 0001–0028 present through Sprint 9 production services. "
        "Schema + RLS + RPCs coherent for local reset.",
    ),
    (
        "Environment Variables",
        "PASS",
        "Per-app .env.example uses public anon keys only. api-client rejects service_role "
        "in browser config. Edge secrets documented in functions/README.",
    ),
    (
        "Performance",
        "PARTIAL",
        "Solid indexes for core tables. Gaps: payments.provider_reference index; "
        "N+1 patterns in LiveAdminApi / listOrdersForShop.",
    ),
    (
        "Security",
        "FAIL",
        "CORS *; Razorpay webhook verify optional; expire/send edges unauthenticated; "
        "enqueue_notification granted to authenticated (outbox flood risk). "
        "Service role correctly kept out of apps.",
    ),
    (
        "Accessibility",
        "PARTIAL",
        "Shared FormControls use labels; bottom nav aria-labels. "
        "Customer OTP fields lean on placeholders; focus rings not systematized.",
    ),
    (
        "Error Handling",
        "PARTIAL",
        "RPC RAISE + edge try/catch + app EmptyState/Alert/QueryStateGate. "
        "No structured error codes or global retry/toast layer.",
    ),
    (
        "Offline Behaviour",
        "FAIL",
        "Sales/Delivery PWA: manifest.json only — no service worker/cache. "
        "Admin mock mode is offline fixtures, not true offline.",
    ),
    (
        "Responsive Layout",
        "PASS",
        "Field PWAs: 480px mobile shells with safe-area. Admin: responsive sidebar. "
        "Customer: Expo SafeArea + tabs. Adequate for intended form factors.",
    ),
]


def compute_score(items: list[tuple[str, str, str]]) -> int:
    total = sum(SCORE_MAP[status] for _, status, _ in items)
    return round(total / len(items))


class AuditPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 3.5 - Launch Readiness Audit",
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
        self.ln(1.2)


def build_pdf() -> None:
    score = compute_score(ITEMS)
    counts = {
        "PASS": sum(1 for _, s, _ in ITEMS if s == "PASS"),
        "PARTIAL": sum(1 for _, s, _ in ITEMS if s == "PARTIAL"),
        "FAIL": sum(1 for _, s, _ in ITEMS if s == "FAIL"),
    }

    pdf = AuditPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 10, "GroAurum Platform", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(
        0,
        8,
        "Phase 3.5 - Launch Readiness Audit",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        5,
        "Scope: Customer App, Admin ERP, Salesman PWA, Delivery PWA + infrastructure.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.cell(
        0,
        5,
        "Method: evidence-based audit only. No new features. No UI redesign.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 12, f"Launch Score: {score} / 100", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(15, 31, 24)
    pdf.multi_cell(
        0,
        5,
        f"Classification tally across {len(ITEMS)} checklist items: "
        f"PASS {counts['PASS']}  |  PARTIAL {counts['PARTIAL']}  |  FAIL {counts['FAIL']}. "
        "Scoring: PASS=100, PARTIAL=55, FAIL=15 (equal weight).",
    )
    pdf.ln(2)

    pdf.section_title("Recommendation")
    pdf.bullet("Development: READY — monorepo, migrations, seeds, and four apps run locally.")
    pdf.bullet(
        "Internal Testing: READY — exercise seeded flows (admin/sales/customer/delivery) "
        "with known stubs documented."
    )
    pdf.bullet(
        "Pilot Launch: CONDITIONAL — only with COD-only payments, email/password auth, "
        "manual job invocation, and ops acceptance of placeholders (OTP SMS, PoD media, "
        "reports charts, offline PWA)."
    )
    pdf.bullet(
        "Production Launch: NOT READY — close FAIL items (cron, edge/webhook security, "
        "offline) and critical PARTIAL gaps (admin order RPC, live providers, realtime wiring)."
    )

    pdf.section_title("Executive Summary")
    pdf.body_text(
        "GroAurum has progressed from scaffold to a coherent B2B platform: live Supabase "
        "schema/RLS, role-scoped field PWAs, customer self-serve order placement, and "
        "Sprint 9 production-service foundations (payments webhook path, notification "
        "outbox, audit/logs, job RPCs). The platform is suitable for internal testing and "
        "a tightly controlled pilot. It is not yet production-launch ready because "
        "unattended jobs are unscheduled, several security edges are open by default, "
        "realtime is unused in apps, and key operator/customer polish items remain stubs."
    )

    pdf.add_page()
    pdf.section_title("1. Application Surfaces")
    for label, status, detail in ITEMS[:4]:
        pdf.verdict(label, status, detail)

    pdf.section_title("2. Auth, Permissions, CRUD")
    for label, status, detail in ITEMS[4:7]:
        pdf.verdict(label, status, detail)

    pdf.section_title("3. Domain Capabilities")
    for label, status, detail in ITEMS[7:12]:
        pdf.verdict(label, status, detail)

    pdf.add_page()
    pdf.section_title("4. Data & Platform Layer")
    for label, status, detail in ITEMS[12:19]:
        pdf.verdict(label, status, detail)

    pdf.section_title("5. Quality, Security, UX Hardening")
    for label, status, detail in ITEMS[19:]:
        pdf.verdict(label, status, detail)

    pdf.add_page()
    pdf.section_title("6. Launch Blockers (must close for Production)")
    pdf.bullet("FAIL Cron Jobs: schedule expire-reservations, expire-invitations, send-notification.")
    pdf.bullet(
        "FAIL Security: require Razorpay webhook HMAC; protect job edges with cron secret/JWT; "
        "tighten CORS for production."
    )
    pdf.bullet(
        "FAIL Offline: add service worker / cache strategy for Sales & Delivery PWAs "
        "(or explicitly defer offline as non-goal)."
    )
    pdf.bullet(
        "CRITICAL PARTIAL: Admin order status updates need SECURITY DEFINER RPC "
        "(trusted_server_action)."
    )
    pdf.bullet("CRITICAL PARTIAL: Wire live SMS/WhatsApp for OTP + invitations; configure Razorpay keys.")
    pdf.bullet("CRITICAL PARTIAL: Subscribe apps to RealtimeBus for order/inventory/delivery KPIs.")

    pdf.section_title("7. Acceptable Pilot Constraints")
    pdf.bullet("Auth: email/password seeded users only (defer phone OTP).")
    pdf.bullet("Payments: COD only; online checkout disabled in UI.")
    pdf.bullet("Notifications: outbox stub mode acceptable if ops monitor manually.")
    pdf.bullet("Jobs: ops run expire/send functions on a manual schedule.")
    pdf.bullet("Reports: use operational lists; ignore analytics charts.")
    pdf.bullet("Delivery PoD: notes + failure reasons only (no photo/signature files).")

    pdf.section_title("8. Score Breakdown")
    pdf.body_text(
        f"Launch Score {score}/100 reflects a platform that is functionally rich for "
        "Gurugram dry-fruit wholesale ops demos and internal QA, but still carries "
        "operational and security debt inappropriate for unattended production."
    )
    pdf.bullet(f"PASS items ({counts['PASS']}): Migrations, Environment Variables, Responsive Layout.")
    pdf.bullet(
        f"PARTIAL items ({counts['PARTIAL']}): majority of product + infra — ship with documented debt."
    )
    pdf.bullet(
        f"FAIL items ({counts['FAIL']}): Cron Jobs, Security defaults, Offline Behaviour."
    )

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.multi_cell(
        0,
        5,
        f"Final call: READY for Development + Internal Testing. "
        f"CONDITIONAL Pilot. NOT READY for Production Launch. "
        f"Score {score}/100.",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")
    print(f"Launch Score: {score}/100")
    print(f"PASS={counts['PASS']} PARTIAL={counts['PARTIAL']} FAIL={counts['FAIL']}")


if __name__ == "__main__":
    build_pdf()
