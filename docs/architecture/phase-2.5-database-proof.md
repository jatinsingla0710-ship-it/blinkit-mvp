# Phase 2.5: Database Proof

Phase 2.5 validates the Phase 2 Supabase/PostgreSQL schema against a **real local Supabase stack**. It does **not** start Phase 3. Customer screens still use the legacy mock adapter.

**Prior commits:** `fbcddb7` (Phase 2 monorepo + schema)

## Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| Node.js | Yes | v24.x tested |
| pnpm | Yes | 9.15.x |
| Docker Desktop | **Yes** | Local Supabase runs in containers |
| Supabase CLI | Yes | Project devDependency (`pnpm exec supabase`) |

Install Docker Desktop for Windows: https://docs.docker.com/desktop/setup/install/windows-install/

No production credentials are committed. Database tests refuse remote `supabase.co` hosts unless explicitly misconfigured.

## Local Supabase commands

```bash
# Start local stack (first run pulls images)
pnpm db:start

# Clean reset + replay all migrations (000–015)
pnpm db:reset

# Show local URLs and keys
pnpm db:status

# Stop containers
pnpm db:stop
```

## Generate database types

After `pnpm db:start` and `pnpm db:reset`:

```bash
pnpm db:types
```

Writes:

- `packages/api-client/src/database.generated.ts` — **CLI-generated only**
- Updates `packages/api-client/src/database.types.ts` re-exports

Do not hand-edit `database.generated.ts`.

## Database integration tests

```bash
# Verifies Docker + local Supabase, then runs integration/RLS suite
pnpm test:db
```

Full proof workflow:

```bash
pnpm db:proof
```

### Safety guards

- `GROAURUM_DB_TEST_ALLOWED=true` is required (see `.env.test.example`)
- `SUPABASE_DB_URL` must target `127.0.0.1:54322`
- Remote production URLs are rejected in `scripts/check-db-prerequisites.mjs`

### Test package

`@groaurum/db-tests` — live PostgreSQL + Supabase Auth RLS tests:

| Area | Coverage |
|------|----------|
| Invariants | Empty catalogue, DELIVERED requires PAID, order snapshot immutability, append-only price/inventory/audit, zero credit |
| RLS | CUSTOMER, SALESMAN, DELIVERY, ADMIN role boundaries |
| Helpers | `normalize_mobile`, shop auth link uniqueness |
| Schema | Service area + serviceability rule constraints |

### Trusted workflow test context

Business mutations (order status, payment completion, closing open `sku_prices` rows) use:

```sql
SET LOCAL groaurum.trusted_server_action = 'true';
```

Tests use `withTrusted()` in `@groaurum/db-tests` — the same session flag intended for SECURITY DEFINER RPCs in production.

## Migration corrections

### 014 — sku_prices trusted row closure

Migration `20260715101400_sku_prices_close_open_row.sql` replaces blanket `sku_prices` update prevention with:

- **Blocked:** mutating `trade_price`, `sku_id`, or other commercial fields
- **Allowed (trusted only):** setting `effective_to` to close the open row before inserting a new history row

### 015 — API role grants

Migration `20260715101500_api_role_grants.sql` grants `authenticated` / `anon` table privileges required for PostgREST clients. RLS policies still enforce row scope; without these grants clients receive `permission denied for table`.

## Canonical mobile normalization

`public.normalize_mobile(text)` stores/compares Indian mobiles as **E.164 `+91XXXXXXXXXX`**:

| Input | Canonical |
|-------|-----------|
| `9876543210` | `+919876543210` |
| `+91 98765 43210` | `+919876543210` |
| `919876543210` | `+919876543210` |
| `09876543210` | `+919876543210` |

Unsupported formats raise `check_violation`.

## Known limitations before Phase 3

- Customer app still imports `@/services/mock` — no Supabase wiring
- `database.generated.ts` is CLI-generated and committed after successful `pnpm db:types`
- Polygon/geofence serviceability matching is schema-only (no runtime matcher)
- OTP activation service is not implemented — shop invitation → auth link flow is database-level only
- No launch catalogue seeds; empty catalogue remains valid
- No payment gateway or SMS integration

## What Phase 3 will do

- Implement Supabase-backed service adapters in `@groaurum/api-client`
- Replace mock adapter behind feature flag
- Wire customer screens to real services (not in Phase 2.5)

## Validation checklist

```bash
pnpm typecheck
pnpm lint
pnpm test              # unit + migration file tests (no live DB)
pnpm test:db           # requires Docker + local Supabase
pnpm db:reset          # clean migration replay
pnpm --filter @groaurum/customer build
```
