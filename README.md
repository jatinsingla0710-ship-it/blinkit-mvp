# GroAurum

B2B dry-fruit wholesale ordering and distribution platform.

Launch market: Gurugram, India. Ops base: Fatehpur Beri.

## Monorepo

```text
apps/customer/      Expo customer app (live Supabase — Sprint 6)
apps/sales-pwa/     Salesman field PWA (live Supabase — Sprint 7)
apps/delivery-pwa/  Delivery field PWA (live Supabase — Sprint 8)
apps/admin-web/     Admin ERP (live Supabase — Sprint 4–5.1)
packages/shared-types/  B2B domain types + transition policies
packages/api-client/    Service contracts + DB type boundary
packages/validation/    Schema invariant tests
packages/config/        Shared ESLint + TSConfig
supabase/migrations/    PostgreSQL schema (Phase 2)
```

See [`docs/architecture/phase-2-monorepo.md`](docs/architecture/phase-2-monorepo.md).

## Run delivery PWA

```bash
pnpm dev:delivery
```

Sign in: `delivery1@groaurum.local` / `password123` (port 5175).

## Run salesman PWA

```bash
pnpm db:start
# apply migrations including Sprint 7; seed: supabase/seed/sprint7_salesman_seed.sql
pnpm install
pnpm dev:sales
```

Sign in: `salesman1@groaurum.local` / `password123` (port 5174).

## Run customer MVP

```bash
pnpm install
pnpm dev:customer
```

## Workspace validation

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Important

- No production Supabase credentials are committed.
- Service-role keys must never appear in Expo/browser bundles.
- Generated database types are produced locally after `supabase start` (see Phase 2 docs).
