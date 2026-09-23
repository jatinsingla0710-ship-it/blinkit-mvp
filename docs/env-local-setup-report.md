# Environment files report — local development setup
# Generated: Phase env.local creation pass
# Scope: create .env.local (and .env.test.local) only; no app code or .env.example changes

## 1. Files created / overwritten

| Path | Source template | Action |
|------|-----------------|--------|
| `.env.local` | `.env.example` (+ shared keys for verify scripts) | Created |
| `.env.test.local` | `.env.test.example` | Created (vars only in test example; needed for local db tests) |
| `apps/admin-web/.env.local` | `apps/admin-web/.env.example` | Created/overwritten |
| `apps/sales-pwa/.env.local` | `apps/sales-pwa/.env.example` | Created/overwritten |
| `apps/delivery-pwa/.env.local` | `apps/delivery-pwa/.env.example` | Created/overwritten |
| `apps/customer/.env.local` | `apps/customer/.env.example` | Created (Expo; example mentions `.env`) |
| `supabase/.env.local` | *No example* — derived from `supabase/functions` + verify scripts | Created |

Note: Existing `apps/customer/.env` was left untouched (not renamed). Prefer `.env.local` going forward; Expo loads both.

---

## 2. Variables copied into each file

### `.env.local`
- `GROAURUM_APP_ENV=development`
- `GROAURUM_AUTH_PROVIDER=mock`
- Commented: `GROAURUM_SUPABASE_URL`, `GROAURUM_SUPABASE_ANON_KEY` (FILL placeholders)
- Added for scripts: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`

### `.env.test.local`
- `GROAURUM_DB_TEST_ALLOWED=true`
- `SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`
- `SUPABASE_URL=http://127.0.0.1:54421`
- `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (FILL)

### `apps/admin-web/.env.local`
- `VITE_APP_ENV`, `VITE_AUTH_PROVIDER`, `VITE_AUTH_MOCK_ROLE`
- `VITE_AUTH_DEV_EMAIL`, `VITE_AUTH_DEV_PASSWORD`
- `VITE_DATA_ADAPTER`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Comments preserved for `VITE_ALLOWED_ORIGINS` and server-only secrets

### `apps/sales-pwa/.env.local`
- `VITE_APP_ENV`, `VITE_AUTH_PROVIDER`, `VITE_AUTH_MOCK_ROLE`
- `VITE_AUTH_DEV_EMAIL`, `VITE_AUTH_DEV_PASSWORD`
- `VITE_DATA_ADAPTER`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### `apps/delivery-pwa/.env.local`
- Same Vite keys as sales (delivery seed email/role)

### `apps/customer/.env.local`
- `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_AUTH_PROVIDER`
- `EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER`
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Seed login comments preserved

### `supabase/.env.local`
- `APP_ENV`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`, `ALLOWED_ORIGINS`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `SMS_PROVIDER_API_KEY`, `WHATSAPP_PROVIDER_API_KEY`, `EMAIL_PROVIDER_API_KEY`, `FCM_SERVER_KEY`

---

## 3. Variables that still require manual values (`<FILL_…>`)

| Variable | Where | How to obtain |
|----------|-------|---------------|
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | root, apps, supabase, test | `pnpm exec supabase status -o env` → `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | root, supabase, test | `pnpm exec supabase status -o env` → `SERVICE_ROLE_KEY` |
| `CRON_SECRET` | supabase | Generate a long random string for local edge jobs |
| `RAZORPAY_KEY_ID` | supabase | Razorpay dashboard (optional in development) |
| `RAZORPAY_KEY_SECRET` | supabase | Razorpay dashboard (optional in development) |
| `RAZORPAY_WEBHOOK_SECRET` | supabase | Razorpay webhook settings (required to exercise webhook) |
| `SMS_PROVIDER_API_KEY` | supabase | Provider console (optional locally) |
| `WHATSAPP_PROVIDER_API_KEY` | supabase | Provider console (optional locally) |
| `EMAIL_PROVIDER_API_KEY` | supabase | Provider console (optional locally) |
| `FCM_SERVER_KEY` | supabase | Firebase console (optional locally) |
| `GROAURUM_SUPABASE_URL` / `GROAURUM_SUPABASE_ANON_KEY` | root (commented) | Only if using root GROAURUM_* auth path |

Non-secret local defaults left as-is: `http://127.0.0.1:54421`, local DB URL, seeded `*@groaurum.local` / `password123`.

---

## 4. Duplicate variables across apps

| Conceptual value | Keys (duplicates) | Apps |
|------------------|-------------------|------|
| App env | `VITE_APP_ENV` / `EXPO_PUBLIC_APP_ENV` / `GROAURUM_APP_ENV` / `APP_ENV` | All Vite apps + customer + root + supabase |
| Auth provider | `VITE_AUTH_PROVIDER` / `EXPO_PUBLIC_AUTH_PROVIDER` / `GROAURUM_AUTH_PROVIDER` | Admin, sales, delivery, customer, root |
| Supabase URL | `VITE_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` / `GROAURUM_SUPABASE_URL` | All clients + root + supabase + test |
| Anon key | `VITE_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` / `GROAURUM_SUPABASE_ANON_KEY` | Same |
| Data adapter | `VITE_DATA_ADAPTER` / `EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER` | Admin/sales/delivery vs customer |
| Dev credentials | `VITE_AUTH_DEV_EMAIL` / `VITE_AUTH_DEV_PASSWORD` | Admin, sales, delivery (different emails) |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` | root, supabase, `.env.test.local` only (never Vite/Expo) |
| DB URL | `SUPABASE_DB_URL` | root + `.env.test.local` |

---

## 5. Variables that appear unused (in app runtime; may still be docs/script)

| Variable | Notes |
|----------|-------|
| `GROAURUM_APP_ENV` / `GROAURUM_AUTH_PROVIDER` / `GROAURUM_SUPABASE_*` | Parsed by `@groaurum/auth` as fallback; root apps primarily use VITE_/EXPO_PUBLIC_ |
| `VITE_ALLOWED_ORIGINS` | Mentioned in admin example + provider config; not set by default (commented) |
| `CORS_ALLOWED_ORIGINS` | Alias in edge CORS; not in templates |
| `VITE_RAZORPAY_KEY_ID` / `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Allowed by provider config; no client UI wired yet; correctly absent from app templates |
| `SERVICE_ROLE_KEY` (alias) | Accepted by verify scripts as fallback name; not written to files |
| `SUPABASE_SERVICE_KEY` | Legacy alias in verify script only |
| `SUPABASE_FUNCTIONS_URL` / `EDGE_FUNCTIONS_BASE` | Optional overrides in verify script; not templated |
| `EXPO_PUBLIC_AUTH_MOCK_ROLE` | Parsed by auth package; customer example does not set it |

---

## 6. Referenced in code but missing from `.env.example` templates

| Variable | Referenced by | Template gap |
|----------|---------------|--------------|
| `CRON_SECRET` | Edge functions, provider config, verify scripts | Mentioned only in comments in app examples; present in `supabase/.env.local` |
| `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` | Edge + provider config | Comments only in app examples; present in `supabase/.env.local` |
| `SMS_PROVIDER_API_KEY`, `WHATSAPP_PROVIDER_API_KEY`, `EMAIL_PROVIDER_API_KEY`, `FCM_SERVER_KEY` | Edge send-notification / provider config | Comments only; present in `supabase/.env.local` |
| `ALLOWED_ORIGINS` / `CORS_ALLOWED_ORIGINS` | Edge CORS | Not in app `.env.example`; present in `supabase/.env.local` |
| `APP_ENV` | Edge providers / razorpay-create-order | Not in root/app examples; present in `supabase/.env.local` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Edge shared client, db-tests, verify scripts | Only in `.env.test.example` (+ now root/supabase locals) |
| `SUPABASE_DB_URL` | db-tests / check-db-prerequisites | Only in `.env.test.example` (+ now root/test locals) |
| `GROAURUM_DB_TEST_ALLOWED` | db-tests | Only in `.env.test.example` (+ `.env.test.local`) |
| `EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER` | Customer app | In customer example (covered) |
| `VITE_DATA_ADAPTER` | Admin/sales/delivery | In Vite examples (covered) |

**Intentionally not added to client `.env.local` files:** any `*_SECRET`, service-role, or provider API keys (must stay server/edge only).

---

## 7. Fill order (recommended)

1. Start local Supabase: `pnpm db:start`
2. Copy `ANON_KEY` and `SERVICE_ROLE_KEY` from `pnpm exec supabase status -o env` into every `<FILL_SUPABASE_ANON_KEY>` / `<FILL_SERVICE_ROLE_KEY>`
3. Set a local `CRON_SECRET` in `supabase/.env.local` before exercising job edges
4. Leave Razorpay/SMS/etc. as FILL until you need those providers

---

## 8. Gitignore

`.gitignore` already includes `.env` and `.env*.local` — these files will not be committed.
