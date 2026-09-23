# Phase 2: Monorepo and Supabase B2B Schema

Phase 2 scaffolds the pnpm + Turborepo monorepo and initial PostgreSQL schema for GroAurum B2B. Customer screens still use the legacy mock adapter. Supabase cutover is Phase 3.

**Prior commits:** `18ee50a` (MVP checkpoint), `eb05c74` (Phase 1 domain)

## Monorepo structure

```text
groaurum/
  apps/
    customer/       Expo RN customer app (runnable MVP)
    sales-pwa/      Live Supabase field PWA (Sprint 7)
    delivery-pwa/   Live Supabase field PWA (Sprint 8)
    admin-web/      Scaffold only (Phase 6+)
  packages/
    shared-types/   B2B domain types + transition policies + unit tests
    api-client/     Service contracts + database type generation boundary
    validation/     Schema/migration invariant tests
    config/         Shared ESLint + TSConfig base
  supabase/
    migrations/     Forward-only SQL migrations
    functions/      Edge function placeholder
  docs/
```

## Package boundaries

| Package | Contents | Rationale |
|---------|----------|-----------|
| `@groaurum/shared-types` | Domain entities, enums, SKU helpers, order/payment transition policies | Single source for B2B domain logic shared across apps and backend contracts |
| `@groaurum/api-client` | Service interfaces (`CatalogueService`, `OrderService`, etc.) and DB type placeholder | Future Supabase client home; no secrets in bundle |
| `@groaurum/validation` | Migration invariant tests | Validates SQL without requiring live Supabase |
| `@groaurum/config` | ESLint flat config, `tsconfig.base.json` | Shared tooling |
| `@groaurum/customer` | Expo app, legacy `services/mock`, UI | Runnable MVP; mock not removed |

Pure transition policies live in `shared-types` (not DTO-only) because they are testable domain logic reused by server and client read models.

## Customer app after move

- Path: `apps/customer`
- Run: `pnpm dev:customer` or `pnpm --filter @groaurum/customer start`
- Screens import `@/services/mock` unchanged
- `services/index.ts` exposes `b2b.*` stubs via `@groaurum/api-client` contracts

## Database schema overview

14 migrations covering:

1. Extensions and helpers (`set_updated_at`, `normalize_mobile`, `prevent_modification`)
2. Enums (order/payment status, lifecycle, roles, movement types, etc.)
3. Profiles linked to `auth.users`
4. Service areas + extensible serviceability rules + operational locations
5. Shops, contacts, invitations, auth links, salesman assignments
6. Catalogue (categories, products, skus, append-only sku_prices) — **empty by default**
7. Inventory balances, append-only movements, stock reservations
8. Orders, snapshot order lines, events, confirmation challenges (`otp_hash` only)
9. Payments/events — `PAY_ONLINE_NOW` / `PAY_ON_DELIVERY` only, zero credit
10. Delivery routes, stops, attempts
11. Append-only audit logs
12. Business invariant triggers (DELIVERED requires PAID, immutability guards)
13. RLS enable on all business tables
14. Role-scoped RLS policies (no `USING (true)` on sensitive tables)

## Trusted workflow boundary

Order/payment status changes require trusted server context (`groaurum.trusted_server_action` session flag for RPC/Edge Functions). Ordinary client roles cannot directly mutate trusted workflow fields.

Inventory balances are not directly writable by arbitrary clients; movements and reservations are designed for Edge Function workflows.

## Secrets and environment

- No production Supabase credentials committed
- Service role key must never appear in Expo or browser bundles
- Use `.env.local` (gitignored) when Supabase is connected in Phase 3+

## Local Supabase setup

```bash
# Install Supabase CLI, then from repo root:
supabase init   # already scaffolded
supabase start
supabase db reset
```

## Database type generation

Types are **not** committed in Phase 2. After local Supabase is running:

```bash
supabase gen types typescript --local > packages/api-client/src/database.generated.ts
```

Then export from `packages/api-client/src/index.ts`. Do not hand-write types labeled as generated.

## Migration workflow

- All schema changes via new timestamped files in `supabase/migrations/`
- Forward-only; never edit applied migrations in production
- Run `packages/validation` tests after migration changes

## Known Phase 2 limitations

- Customer UI still consumer MVP mock data
- No Supabase connection in customer app
- Sales/Delivery/Admin apps are scaffolds only
- No payment gateway, SMS, or OTP delivery
- Supabase CLI not required for CI validation (SQL file tests only)
- Generated DB types pending local `supabase start`

## Next step (Phase 3)

Replace `not-implemented` adapters with Supabase-backed implementations and gate customer flows on shop auth + service area — without UI redesign.
