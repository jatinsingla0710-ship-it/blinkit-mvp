# Phase 3: Customer Supabase Data Adapters

Phase 3 connects the customer Expo app to Supabase-backed **read / auth / shop / serviceability / catalogue** adapters while preserving the legacy mock adapter behind an explicit flag.

**Prior commits:** `ca2967b` (Phase 2.5 live DB proof)

Local ports (this repo): API `54421`, DB `54422` — remapped from the default `54321`/`54322` block to avoid Windows Hyper-V reserved ranges on some hosts. See `supabase/config.toml`.

## Adapter selection

Set explicitly:

```bash
EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock|supabase
```

| Mode | Behavior |
|------|----------|
| `mock` (default) | Legacy MVP: dark-store location picker + in-memory catalogue. Runnable without Supabase. |
| `supabase` | Real anon client + RLS. Empty catalogue stays empty. No mock product fallback. |

Invalid values fail validation at startup/config parse. Mode is logged in development: `[groaurum] customer data adapter mode: …`

## Public Supabase client (Expo)

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from pnpm db:status>
```

| Allowed in Expo | Forbidden in Expo |
|-----------------|-------------------|
| API URL (`http://127.0.0.1:54421`) | `postgresql://…` DB URL/password |
| Anon / publishable key | Service-role / secret keys |

Anon credentials are public by design; **RLS** enforces row access. Typed client: `createGroAurumSupabaseClient` in `@groaurum/api-client`.

See `apps/customer/.env.example`.

## Auth session foundation

- Restores session on startup (`getSession`)
- Subscribes via `onAuthStateChange`
- Sign-out clears React Query customer caches
- **Local/dev path:** `signInWithEmailPassword` against local Auth users
- Phone OTP request/verify throw clear “not configured” errors (no fake SMS)
- Assisted-order confirmation OTP is **not** implemented here

## Linked shop resolution

`resolveCustomerSession()` phases:

| Phase | Meaning |
|-------|---------|
| `AUTH_LOADING` | Session loading |
| `UNAUTHENTICATED` | No session |
| `AUTHENTICATED_NO_SHOP_LINK` | Auth OK, no `shop_auth_links` row — **does not create a shop** |
| `LINKED_SHOP_LOADING` | Resolving link |
| `LINKED_SHOP_READY` | Shop + contacts loaded |
| `LINKED_SHOP_INACTIVE_OR_BLOCKED` | `is_active=false` or lifecycle `INACTIVE_OR_FOLLOW_UP` |
| `ERROR` | Load failure |

Invitation activation / link creation remains a later trusted workflow.

## Serviceability

Pure evaluator: `evaluateServiceabilityRules` (PIN_CODE + ADMIN_AREA).

| Status | When |
|--------|------|
| `SERVICEABLE` | Active area + active matching rule |
| `NOT_SERVICEABLE` | No match / inactive area or rule |
| `INSUFFICIENT_ADDRESS_DATA` | No PIN / admin area |
| `UNSUPPORTED_RULE_TYPE` | Only POLYGON rules present |
| `ERROR` | Unexpected failure |

**Multiple matches:** lowest `displayOrder`, then name. Inactive areas/rules never grant serviceability. No dark-store radius logic in Supabase mode.

## Catalogue

Reads: `categories` → `products` → `skus` → `sku_prices`.

- Active-only chain (inactive category hides products/SKUs)
- Current price via `selectEffectiveSkuPrice` (`effective_from <= now < effective_to` or open row)
- SKU without current price is **not** orderable / not exposed
- Empty DB → empty UI (no demo products)
- Malformed SKU rows skipped when mappable; backend errors remain errors

## Customer query integration

Screens use `@/services/customer-catalogue` + `useCatalogueScope()`:

- Query keys include `['customer', …, scopeId]` where scopeId is store id (mock) or shop id (supabase)
- Sign-out removes customer query caches
- Loading / empty / error are distinct

## Flow gating

`CustomerFlowGate` wraps the app:

Mock: location → catalogue (legacy)  
Supabase: auth → shop link → serviceability → catalogue

Minimal panels for unauthenticated, no shop link, inactive shop, not serviceable, backend error, empty catalogue.

## Legacy dark-store isolation

In Supabase mode:

- `findNearestStore` / store radius **does not** gate catalogue
- `/location` redirects away
- Location store ignores geo matching

Mock mode retains dark-store code under `services/mock/geo.ts` (documented legacy).

## Test fixtures

`supabase/fixtures/phase3_dev_fixtures.sql` — **test/dev only**, not launch catalogue, not wired as `seed.sql`.

## Phase 3 limitations (updated Sprint 6)

| Area | Status after Sprint 6 |
|------|------------------------|
| Catalogue / shop / serviceability reads | Live |
| Auth session restore | Live |
| Email/password + invitation accept | Live |
| Phone OTP | Implemented against Supabase Auth; needs SMS provider in production |
| Customer self-serve order + stock reserve | Live via `place_customer_order` RPC |
| Orders list / timeline | Live |
| Account / addresses / logout | Live |
| Promotions / invoice / payment gateway | Online intent + Razorpay webhook architecture (Sprint 9); Checkout UI still thin |
| Notifications | Outbox + worker (Sprint 9); provider keys still required for live SMS/WA/email/push |

Still out of scope / deferred:

- Production SMS provider for phone OTP
- Assisted-order confirmation OTP
- Payment gateway / invoice generation
- Customer UI redesign / TradeFlow
- Sales/Delivery/Admin features in the customer app
- Production Gurugram catalogue seeds

## Commands

```bash
# mock
# EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock
pnpm dev:customer

# supabase (local) — defaults in apps/customer/.env.example
pnpm db:start
pnpm dev:customer
```
