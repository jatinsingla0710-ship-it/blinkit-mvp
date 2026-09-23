# Phase 2 Sprint 7 — Live Salesman PWA

Vite + React field PWA at `apps/sales-pwa`, wired to Supabase with `@groaurum/auth`, `@groaurum/ui`, and `createSupabaseSalesmanService`.

## Auth

- Provider: `VITE_AUTH_PROVIDER=supabase`
- Audience: `sales_pwa`
- Role: `SALESMAN` / `salesman`
- Dev: `salesman1@groaurum.local` / `password123`

## RPCs

| RPC | Purpose |
|-----|---------|
| `salesman_create_retailer` | Shop + primary contact + assignment |
| `salesman_create_invitation` | Invitation token for customer app |
| `place_assisted_order` | MOQ/stock validate, reserve, OTP challenge placeholder |

## Visits

Table `sales_visits` with statuses `PLANNED`, `PENDING`, `VISITED`, `MISSED`.

## Placeholders

- SMS for invitation / assisted-order OTP
- OTP verify UX
- Offline service worker beyond `manifest.json`
- Collections / maps

## Run

```bash
pnpm dev:sales
```
