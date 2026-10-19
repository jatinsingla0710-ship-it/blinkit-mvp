# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Local runtime

Cloud Agent startup launches Docker with the fuse-overlayfs storage driver and turns bridge netfilter off so Supabase containers can reach Postgres. It then starts local Supabase (API `54421`, database `54422`), writes gitignored `.env.local` files from `supabase status`, and applies `supabase/seed/sprint4_seed.sql` through `sprint8_delivery_seed.sql`.

Vite must bind `127.0.0.1`. Node's default localhost listen is IPv6-only in this VM, so `http://127.0.0.1:<port>` is refused until `--host 127.0.0.1` is set. Startup already does that for:

- Admin: http://127.0.0.1:5173 — `admin@groaurum.local` / `password123`
- Sales: http://127.0.0.1:5174 — `salesman1@groaurum.local` / `password123`
- Delivery: http://127.0.0.1:5175 — `delivery1@groaurum.local` / `password123`

Customer app: `pnpm dev:customer`. Seed login `customer@groaurum.local` / `password123`.
