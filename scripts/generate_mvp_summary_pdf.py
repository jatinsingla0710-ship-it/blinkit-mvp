"""Generate GroAurum MVP project summary PDF."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "GroAurum-MVP-Summary.pdf"


class SummaryPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 8, "GroAurum Customer MVP - Project Summary", align="R", new_x="LMARGIN", new_y="NEXT")
            self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(11, 83, 69)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(26, 141, 73)
        self.set_line_width(0.4)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def body_text(self, text: str):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(15, 31, 24)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(15, 31, 24)
        indent = 6
        self.set_x(self.l_margin + indent)
        width = self.w - self.r_margin - self.l_margin - indent
        self.multi_cell(width, 5, f"- {text}")
        self.set_x(self.l_margin)

    def table_row(self, cols: list[str], widths: list[int], header: bool = False):
        if header:
            self.set_font("Helvetica", "B", 9)
            self.set_fill_color(232, 246, 238)
        else:
            self.set_font("Helvetica", "", 9)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(15, 31, 24)
        y0 = self.get_y()
        x0 = self.l_margin
        heights = []
        for col, w in zip(cols, widths):
            self.set_xy(x0, y0)
            self.multi_cell(w, 5, col, border=0, fill=header)
            heights.append(self.get_y() - y0)
            x0 += w
        row_h = max(heights) if heights else 6
        x0 = self.l_margin
        for w in widths:
            self.rect(x0, y0, w, row_h)
            x0 += w
        self.set_xy(self.l_margin, y0 + row_h)


def build_pdf() -> None:
    pdf = SummaryPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()

    # Cover
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(11, 83, 69)
    pdf.ln(30)
    pdf.cell(0, 12, "GroAurum", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 16)
    pdf.set_text_color(26, 141, 73)
    pdf.cell(0, 10, "Blinkit-style Customer MVP", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(79, 99, 88)
    pdf.multi_cell(
        0,
        6,
        "Project summary document\nPremium dry-fruits quick-commerce app\n"
        f"Generated: {date.today().strftime('%B %d, %Y')}",
        align="C",
    )
    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        5,
        "This document describes what has been built so far in the blinkit-mvp repository: "
        "screens, features, architecture, demo data, and how to run the app.",
        align="C",
    )

    # 1. Overview
    pdf.add_page()
    pdf.section_title("1. Project Overview")
    pdf.body_text(
        "GroAurum is a customer-facing quick-commerce mobile/web app inspired by Blinkit. "
        "Users pick a delivery location, browse a nearby dark store catalog, add items to cart, "
        "checkout with simulated payment, and track order progress in real time."
    )
    pdf.body_text(
        "The MVP is fully client-side: all catalog, inventory, geo, and order logic runs in-memory "
        "under services/mock/. It is designed to be swapped for a real backend later."
    )
    pdf.body_text("Current status: Feature-complete for v1 demo. All work is local and uncommitted in git (1 initial Expo commit only).")

    pdf.section_title("2. Tech Stack")
    rows = [
        ("Layer", "Technology"),
        ("Framework", "Expo 57, React Native 0.86, React 19"),
        ("Language", "TypeScript"),
        ("Routing", "Expo Router (file-based)"),
        ("State", "Zustand (cart, location, session)"),
        ("Data fetching", "TanStack React Query"),
        ("Platforms", "iOS, Android, Web"),
    ]
    widths = [45, 135]
    for i, row in enumerate(rows):
        pdf.table_row(list(row), widths, header=(i == 0))

    # 3. Features
    pdf.section_title("3. Features Built")
    features = [
        "Location gate with serviceability check (3 demo dark stores + 1 out-of-area demo)",
        "Store-scoped catalog with 6 categories and 20 products per hub (60 SKUs total)",
        "Home screen with promo banner, category chips, bestsellers, and product grid",
        "Search with live filtering by product name and category",
        "Product detail with stock info, qty controls, and similar items",
        "Cart with live stock checks, bill breakdown, and substitute suggestion on OOS",
        "Checkout with guest details, optional mock OTP (1234), and UPI/Card/COD payment",
        "Order tracking with 4-step timeline and simulated rider progress",
        "Orders history tab with live status polling",
        "Floating cart bar across browse screens",
    ]
    for f in features:
        pdf.bullet(f)

    # 4. Screens
    pdf.add_page()
    pdf.section_title("4. Screens & Routes")
    screens = [
        ("Route", "File", "Purpose"),
        ("/", "app/index.tsx", "Gate: redirect to location or home tabs"),
        ("/location", "app/location.tsx", "Pick delivery address from 4 demo pins"),
        ("/(tabs)", "app/(tabs)/index.tsx", "Home: categories, bestsellers, products"),
        ("/(tabs)/search", "app/(tabs)/search.tsx", "Search products"),
        ("/(tabs)/orders", "app/(tabs)/orders.tsx", "Order history list"),
        ("/category/[id]", "app/category/[id].tsx", "Category product grid"),
        ("/product/[id]", "app/product/[id].tsx", "Product detail page"),
        ("/cart", "app/cart.tsx", "Cart review and bill"),
        ("/checkout", "app/checkout.tsx", "Guest info, OTP, payment, place order"),
        ("/order/[id]", "app/order/[id].tsx", "Live order tracking"),
    ]
    sw = [28, 52, 100]
    for i, row in enumerate(screens):
        pdf.table_row(list(row), sw, header=(i == 0))
        pdf.ln(1)

    # 5. Components
    pdf.section_title("5. UI Components")
    components = [
        "AppProviders - React Query provider wrapper",
        "BrandLogo - GroAurum wordmark",
        "ProductCard - Product tile with price, discount, qty button",
        "QtyButton - ADD / +/- quantity stepper",
        "CartBar - Fixed bottom bar with cart total and View cart CTA",
        "StatusTimeline - 4-step order progress (Placed to Delivered)",
        "EmptyState - Centered empty placeholder with optional action",
        "LoadingBlock - Full-screen loading spinner",
    ]
    for c in components:
        pdf.bullet(c)

    # 6. State & Services
    pdf.section_title("6. State Management (Zustand)")
    pdf.bullet("location.ts - address, store, distance, serviceable flag")
    pdf.bullet("cart.ts - cart lines, single-store enforcement, stock-aware add/setQty")
    pdf.bullet("session.ts - guest name and phone for checkout prefill")
    pdf.bullet("hooks.ts - useCartTotals, useCartItemCount")

    pdf.section_title("7. Mock API (services/mock/)")
    pdf.bullet("data.ts - Seed categories, stores, addresses, 60 store-scoped products")
    pdf.bullet("geo.ts - Haversine distance, nearest store lookup, service radius check")
    pdf.bullet("catalog.ts - Async catalog/search APIs with ~100-180ms delay")
    pdf.bullet("orders.ts - Pricing, stock validation, order creation, status simulator")

    # 7. Demo data
    pdf.add_page()
    pdf.section_title("8. Demo Data")
    pdf.body_text("Dark stores (Delhi/NCR):")
    stores = [
        ("store-cp", "Connaught Place", "10 min ETA, 4 km radius"),
        ("store-saket", "Saket", "12 min ETA, 4 km radius"),
        ("store-noida", "Noida Sec 18", "11 min ETA, 5 km radius"),
    ]
    for sid, name, meta in stores:
        pdf.bullet(f"{name} ({sid}) - {meta}")

    pdf.ln(2)
    pdf.body_text("Demo addresses:")
    pdf.bullet("Home (Connaught Place) - serviceable")
    pdf.bullet("Office (Saket) - serviceable")
    pdf.bullet("Parents (Noida) - serviceable")
    pdf.bullet("Far Away (Agra) - NOT serviceable (demo edge case)")

    pdf.ln(2)
    pdf.body_text("Categories (6): Luxury 6, Nuts, Raisins, Dates & Figs, Seeds, Mixes")

    pdf.ln(2)
    pdf.body_text(
        "Products: 20 premium dry-fruit SKUs per store (Akhrot Giri, Kesar Badam, Kaju W320, "
        "Chilgoza, Diwali Gift Box, etc.). Prices range from Rs 110 to Rs 899. "
        "Demo stock edge cases at CP hub: Chilgoza stock = 1, Diwali Gift Box = 0 (OOS)."
    )

    pdf.section_title("9. Pricing Rules")
    pdf.bullet("Delivery fee: Rs 39 (free when subtotal >= Rs 499)")
    pdf.bullet("Handling fee: Rs 9")
    pdf.bullet("Mock OTP code: 1234 (optional field)")
    pdf.bullet("Order ID format: GA-{timestamp}")

    # 8. User flows
    pdf.section_title("10. Key User Flows")
    pdf.body_text("Flow A - Onboarding & Browse:")
    pdf.bullet("App opens -> location gate if no serviceable address")
    pdf.bullet("Pick demo address -> nearest hub assigned -> Home tab loads catalog")
    pdf.bullet("Browse categories, bestsellers, or tap product for detail")

    pdf.body_text("Flow B - Cart & Checkout:")
    pdf.bullet("Add items via ProductCard or QtyButton on any browse screen")
    pdf.bullet("CartBar appears -> View cart -> review bill -> Proceed to checkout")
    pdf.bullet("Stock validation runs; OOS items can be removed or substituted")
    pdf.bullet("Enter guest details, optional OTP, pick payment -> Place order")

    pdf.body_text("Flow C - Order Tracking:")
    pdf.bullet("Redirected to /order/[id] after placement")
    pdf.bullet("Status auto-advances every 3.5s: Placed -> Packing -> Out for delivery -> Delivered")
    pdf.bullet("Rider progress bar shown during delivery stages")
    pdf.bullet("Orders tab lists all orders with live polling (every 2s)")

    # 9. Navigation
    pdf.add_page()
    pdf.section_title("11. Navigation Map")
    pdf.set_font("Courier", "", 8)
    pdf.set_text_color(15, 31, 24)
    nav = (
        "App launch\n"
        "    |\n"
        "    v\n"
        "index.tsx --> (no address) --> /location\n"
        "    |                              |\n"
        "    +-- (serviceable) --> /(tabs) <-+\n"
        "            |\n"
        "            +-- Home --> /category/[id], /product/[id]\n"
        "            +-- Search --> /product/[id]\n"
        "            +-- Orders --> /order/[id]\n"
        "\n"
        "CartBar --> /cart --> /checkout --> /order/[id]\n"
    )
    pdf.multi_cell(0, 4, nav)
    pdf.ln(4)

    # 10. Project structure
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(11, 83, 69)
    pdf.cell(0, 8, "12. Project Structure", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Courier", "", 8)
    structure = (
        "blinkit-mvp/\n"
        "  app/              Screens (Expo Router)\n"
        "  components/       Reusable UI components\n"
        "  store/            Zustand stores + hooks\n"
        "  services/mock/    In-memory catalog, geo, orders\n"
        "  types/            Shared TypeScript models\n"
        "  constants/        Design tokens (theme.ts)\n"
        "  assets/images/    App icon, splash, favicon\n"
    )
    pdf.multi_cell(0, 4, structure)

    pdf.section_title("13. How to Run")
    pdf.set_font("Courier", "", 9)
    pdf.multi_cell(0, 5, "cd blinkit-mvp\nnpm install\nnpx expo start")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)
    pdf.body_text("Open in Expo Go, an emulator, or press w for web.")

    pdf.section_title("14. What's NOT in v1")
    pdf.bullet("Real payments, GPS, SMS, or rider apps")
    pdf.bullet("Persistent storage (state resets on app restart)")
    pdf.bullet("Real backend API (mock only)")
    pdf.bullet("User authentication (guest checkout only)")

    pdf.section_title("15. Suggested Next Steps")
    pdf.bullet("Commit current MVP work to git")
    pdf.bullet("Connect to a real backend API")
    pdf.bullet("Add persistent cart and session storage")
    pdf.bullet("Real location via device GPS")
    pdf.bullet("Push notifications for order updates")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
