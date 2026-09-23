"""Generate GroAurum Phase 2 Sprint 2 Authentication & Application Foundation report."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-Phase2-Sprint2-Auth-Foundation-Report.pdf"


class Sprint2Pdf(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(
                0,
                8,
                "GroAurum Phase 2 Sprint 2 - Auth Foundation",
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
    pdf = Sprint2Pdf()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(24)
    pdf.cell(0, 10, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 15)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(
        0,
        9,
        "Phase 2 Sprint 2 - Authentication Foundation",
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
        "Secure multi-role application foundations\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}\n"
        "Architecture only - no login screens - no Supabase connection",
        align="C",
    )

    pdf.add_page()
    pdf.section_title("1. Sprint Goal")
    pdf.body_text(
        "Convert GroAurum from a UI shell into a secure multi-role application "
        "foundation. No new product screens, no UI redesign, no live Supabase Auth. "
        "Reusable providers, guards, hooks, RBAC, env config, and error/loading states."
    )

    pdf.section_title("2. Architecture Overview")
    for item in [
        "packages/auth - framework-agnostic types, RBAC, providers, env parsing",
        "packages/auth/react - SessionProvider, hooks, ProtectedRoute, RoleGuard, NavigationGuard",
        "Mock AuthProvider for development; Supabase stub adapter prepared",
        "Admin ERP wires SessionProvider + route/module guards around existing shell",
        "Sales/Delivery PWA scaffolds document audience constants for Phase 7",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Package Folders")
    pdf.mono_block(
        "packages/auth/src/\n"
        "  roles.ts permissions.ts types.ts helpers.ts errors.ts env.ts\n"
        "  navigation.ts create-auth-provider.ts\n"
        "  providers/mock-auth-provider.ts\n"
        "  providers/supabase-auth-provider.stub.ts\n"
        "  react/ SessionProvider ProtectedRoute RoleGuard\n"
        "         NavigationGuard hooks usePermissions AuthStatusViews\n"
        "apps/admin-web/src/auth/\n"
        "  AdminAuthProviders guards AuthFoundationViews\n"
        "  createAdminAuthProvider moduleRoutes"
    )

    pdf.add_page()
    pdf.section_title("4. Roles (RBAC)")
    for item in [
        "Super Admin",
        "Operations Manager",
        "Warehouse Manager",
        "Sales Manager",
        "Delivery Manager",
        "Salesman",
        "Delivery Executive",
        "Retail Customer",
        "Read Only",
    ]:
        pdf.bullet(item)

    pdf.section_title("5. Navigation Audiences")
    rows = [
        ("Role group", "Destination"),
        ("Admin roles + Read Only", "admin_erp"),
        ("Salesman", "sales_pwa"),
        ("Delivery Executive", "delivery_pwa"),
        ("Retail Customer", "customer_app"),
    ]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), [70, 110], header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("6. Providers")
    for item in [
        "AuthProvider interface - getSession, signIn, signOut, refresh, subscribe",
        "createMockAuthProvider - in-memory sessions; auto-sign-in in development",
        "createSupabaseAuthProviderStub - explicit not-connected errors",
        "createAuthProvider(config) - factory selected by AUTH_PROVIDER env",
        "SessionProvider - React context wrapping any AuthProvider",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Guards & Hooks")
    for item in [
        "ProtectedRoute - requires authenticated session for a given audience",
        "RoleGuard - module allow-list or explicit roles",
        "NavigationGuard - detects wrong product surface for the signed-in user",
        "useSession / useAuthSession - status, session, signIn/signOut",
        "useCurrentUser - AuthUser | null",
        "usePermissions - hasPermission, hasRole, canAccessModule",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("8. Authentication Flow (current)")
    pdf.mono_block(
        "1. App boots -> parsePublicAuthConfig(env)\n"
        "2. createAuthProvider({ config }) -> mock | supabase stub\n"
        "3. SessionProvider subscribes to provider state\n"
        "4. Mock (dev): autoSignIn as VITE_AUTH_MOCK_ROLE (default super_admin)\n"
        "5. ProtectedRoute waits for status !== loading\n"
        "6. Authenticated + matching audience -> render AdminShell\n"
        "7. AdminModuleGuard checks MODULE_ALLOWED_ROLES per route\n"
        "8. Sidebar filters nav items via usePermissions().canAccessModule"
    )

    pdf.section_title("9. RBAC Flow")
    for item in [
        "Each AdminModule declares MODULE_ALLOWED_ROLES",
        "Each AppRole declares ROLE_PERMISSIONS capability grants",
        "Routes wrap pages with AdminModuleGuard(module)",
        "Settings is super_admin only; Reports open to all admin roles including read_only",
        "Forbidden foundation view shown when role lacks module access",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Error & Loading States")
    for item in [
        "unauthorized - no session",
        "forbidden - authenticated but role denied",
        "session_expired - expiresAt passed; provider signed out",
        "offline - reserved code for network failures",
        "unexpected - provider/config failures",
        "Session loading + route loading presentational helpers in @groaurum/auth/react",
    ]:
        pdf.bullet(item)

    pdf.section_title("11. Environment Configuration")
    pdf.mono_block(
        "apps/admin-web/.env.example\n"
        "  VITE_APP_ENV=development|staging|production\n"
        "  VITE_AUTH_PROVIDER=mock|supabase\n"
        "  VITE_AUTH_MOCK_ROLE=super_admin\n"
        "  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (public only)\n"
        ".env.example (root) + apps/customer/.env.example updated\n"
        "No secrets committed; service-role keys forbidden in public env"
    )

    pdf.add_page()
    pdf.section_title("12. Future Supabase Integration Points")
    for item in [
        "Replace createSupabaseAuthProviderStub with real adapter using api-client",
        "Map profiles.roles / JWT claims -> AppRole[]",
        "Implement signInWithPassword / phone OTP on AuthProvider",
        "hydrateFromExternal(session) after supabase.auth.getSession()",
        "Keep MODULE_ALLOWED_ROLES as source of truth; sync with RLS policies",
        "Turn off mock autoSignIn; mount login screens in a later sprint",
        "Customer app can share parsePublicAuthConfig + SessionProvider gradually",
    ]:
        pdf.bullet(item)

    pdf.section_title("13. Validation")
    rows2 = [
        ("Check", "Result"),
        ("pnpm --filter @groaurum/auth typecheck", "Pass"),
        ("pnpm --filter @groaurum/auth test", "Pass"),
        ("pnpm --filter @groaurum/admin-web typecheck", "Pass"),
        ("pnpm --filter @groaurum/admin-web build", "Pass"),
        ("Login screens", "Not implemented (by design)"),
        ("Live Supabase Auth", "Stub only (by design)"),
        ("New product screens / redesign", "None"),
    ]
    for i, row in enumerate(rows2):
        pdf.table_row(list(row), [125, 55], header=(i == 0))
        pdf.ln(0.5)

    pdf.section_title("14. How to Review")
    pdf.mono_block(
        "pnpm install\n"
        "pnpm dev:admin\n"
        "# Default mock super_admin - full sidebar\n"
        "# Set VITE_AUTH_MOCK_ROLE=read_only in .env.local\n"
        "# Confirm Settings route shows Forbidden; Settings nav hidden\n"
        "# Set VITE_AUTH_MOCK_ROLE=salesman - Wrong application foundation view"
    )

    pdf.section_title("15. Intent")
    pdf.body_text(
        "Sprint 2 establishes production-ready authentication and RBAC architecture "
        "so login UI and Supabase Auth can plug into stable contracts without "
        "rewriting modules or inventing per-app auth forks."
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
