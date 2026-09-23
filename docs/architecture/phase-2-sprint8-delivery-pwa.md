# Phase 2 Sprint 8 — Live Delivery PWA

Vite + React field PWA at `apps/delivery-pwa`, wired to Supabase with `@groaurum/auth`, `@groaurum/ui`, and `createSupabaseDeliveryService`.

## Auth

- Provider: `VITE_AUTH_PROVIDER=supabase`
- Audience: `delivery_pwa`
- Role: `DELIVERY` / `delivery_executive`
- Dev: `delivery1@groaurum.local` / `password123`

## RPCs

| RPC | Purpose |
|-----|---------|
| `delivery_start_route` | PLANNED → IN_PROGRESS; orders → OUT_FOR_DELIVERY |
| `delivery_mark_stop_in_progress` | Stop PENDING → IN_PROGRESS |
| `delivery_collect_cod` | Mark COD payment PAID |
| `delivery_complete_stop` | Delivered + attempt notes/photo/signature flags |
| `delivery_fail_stop` | Failed attempt + order DELIVERY_FAILED |
| `delivery_complete_route` | Close route + COD reconciliation summary |

## Placeholders

- Photo / signature file capture
- Native navigation
- Returned / RTO
- Offline service worker

## Run

```bash
pnpm dev:delivery
```
