"""Generate GroAurum Sprint 1.1 — Performance & Authentication report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Sprint1.1-Performance-Authentication-Report.pdf"


class ReportPdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Sprint 1.1 - Performance & Authentication",
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

    def status_line(self, label: str, status: str, note: str = ""):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        color = {
            "PASS": (26, 141, 73),
            "DONE": (26, 141, 73),
            "PARTIAL": (180, 120, 20),
            "FAIL": (180, 40, 40),
        }.get(status, (15, 31, 24))
        self.set_text_color(*color)
        line = f"{label}: {status}"
        if note:
            line += f" - {note}"
        safe = line.encode("latin-1", "replace").decode("latin-1")
        self.multi_cell(0, 5, safe)
        self.set_text_color(15, 31, 24)
        self.set_x(self.l_margin)


def build_pdf() -> None:
    pdf = ReportPdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(10)
    pdf.cell(0, 9, "Performance & Authentication Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 7, "Sprint 1.1", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Date: {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.section_title("1. Objective")
    pdf.body_text(
        "Improve Admin application startup experience and authentication: "
        "stop startup hangs, parallelize dashboard loading, add skeleton UX, "
        "and ship a dedicated email/password Login with route protection and logout. "
        "Business modules (Orders, Products, Inventory, etc.) were not modified."
    )

    pdf.section_title("2. Root Cause of Slow / Hanging Startup")
    pdf.bullet(
        "Auth gate blanked the entire app while status=loading. Bootstrap ran "
        "getSession -> optional auto signInWithPassword -> profiles load with "
        "NO timeout, so a bad/slow Supabase URL left users on Restoring session forever."
    )
    pdf.bullet(
        "Silent development auto sign-in hid the missing Login page and amplified "
        "network hangs when credentials or connectivity failed."
    )
    pdf.bullet(
        "dashboardSnapshot() was a serial waterfall (~8 awaits), including a "
        "duplicate inventory_balances query and select(*) on orders. QueryStateGate "
        "kept the page blank until the full chain finished."
    )
    pdf.bullet(
        "No skeleton loading states and no route code-splitting made waits feel longer."
    )

    pdf.section_title("3. Performance Improvements")
    pdf.status_line(
        "Dashboard parallel fan-out",
        "DONE",
        "Promise.all for orders, shops, balances, routes, payments, salesmen",
    )
    pdf.status_line(
        "Query efficiency",
        "DONE",
        "removed duplicate inventory query; narrowed order/SKU columns",
    )
    pdf.status_line(
        "Route code-splitting",
        "DONE",
        "React.lazy pages + Suspense skeleton in AdminShell",
    )
    pdf.status_line(
        "Skeleton loading",
        "DONE",
        "PageSkeleton for session, page chunks, QueryStateGate",
    )
    pdf.status_line(
        "React Query defaults",
        "DONE",
        "staleTime 60s, retry 0, no refetchOnWindowFocus",
    )
    pdf.status_line(
        "Auth bootstrap timeout",
        "DONE",
        "12s fail-open to Login instead of infinite hang",
    )

    pdf.section_title("4. Authentication Flow Implemented")
    pdf.body_text(
        "1) Visit any admin route -> restore persisted Supabase session (or timeout). "
        "2) Unauthenticated / auth error -> redirect to /login. "
        "3) Email + password via Supabase Auth signIn -> dashboard. "
        "4) Refresh keeps session (persistSession + autoRefreshToken). "
        "5) Top-right user menu -> Log out -> /login."
    )
    pdf.bullet(
        "VITE_AUTH_DEV_EMAIL / PASSWORD now only prefill the Login form; "
        "they no longer auto-sign-in."
    )
    pdf.bullet("Mock provider still auto-signs for offline UI work.")
    pdf.bullet("Clear auth failure messages shown on the Login page.")

    pdf.section_title("5. Files Changed")
    pdf.bullet("apps/admin-web/src/pages/LoginPage.tsx (+ CSS) [new]")
    pdf.bullet("apps/admin-web/src/components/ui/PageSkeleton.tsx (+ CSS) [new]")
    pdf.bullet("apps/admin-web/src/auth/guards.tsx")
    pdf.bullet("apps/admin-web/src/auth/createAdminAuthProvider.ts")
    pdf.bullet("apps/admin-web/src/auth/AuthFoundationViews.tsx (+ CSS)")
    pdf.bullet("apps/admin-web/src/App.tsx (login route + lazy pages)")
    pdf.bullet("apps/admin-web/src/layout/TopNav.tsx (+ CSS) - user menu + logout")
    pdf.bullet("apps/admin-web/src/layout/AdminShell.tsx - Suspense skeleton")
    pdf.bullet(
        "apps/admin-web/src/data/live/LiveAdminApi.ts - dashboardSnapshot only"
    )
    pdf.bullet("apps/admin-web/src/data/AdminDataProviders.tsx")
    pdf.bullet("apps/admin-web/src/data/QueryStateGate.tsx")
    pdf.bullet("apps/admin-web/.env.example")
    pdf.bullet(
        "packages/auth/src/providers/supabase-auth-provider.ts - bootstrap timeout"
    )
    pdf.bullet(
        "scripts/generate_sprint1_1_performance_authentication_report_pdf.py "
        "[this report]"
    )

    pdf.section_title("6. Acceptance Scorecard")
    pdf.status_line("Dedicated Login page (email + password)", "PASS")
    pdf.status_line("Protect admin routes / redirect to Login", "PASS")
    pdf.status_line("Logout in top-right user menu", "PASS")
    pdf.status_line("Session persists across refresh", "PASS")
    pdf.status_line("Meaningful loading (skeletons, not blank)", "PASS")
    pdf.status_line("Clear auth error messages", "PASS")
    pdf.status_line("Dashboard loads in parallel", "PASS")
    pdf.status_line("Business modules untouched", "PASS")
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(
        0,
        6,
        "Result: COMPLETE - admin-web + auth typecheck PASS",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.section_title("7. How to Verify")
    pdf.bullet("pnpm --filter @groaurum/admin-web exec tsc --noEmit")
    pdf.bullet("Open http://localhost:5173/ -> /login (or fast session restore)")
    pdf.bullet("Sign in with admin@groaurum.local / password123")
    pdf.bullet("Confirm dashboard skeleton then data (not a blank screen)")
    pdf.bullet("Refresh -> still authenticated")
    pdf.bullet("User menu -> Log out -> back to Login")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
