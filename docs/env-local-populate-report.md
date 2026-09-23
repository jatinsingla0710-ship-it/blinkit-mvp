# Populate .env.local — Supabase values report

**Date:** 2026-07-18  
**Action:** Filled Supabase anon + service-role keys from local `pnpm exec supabase status -o env` (not guessed).  
**Unchanged:** Razorpay / SMS / WhatsApp / Email / FCM / `CRON_SECRET` placeholders.

---

## 1. Where to obtain each value

| Value | Local (this repo) | Hosted Supabase Dashboard |
|-------|-------------------|---------------------------|
| API / Project URL | `pnpm exec supabase status -o env` → `API_URL` (local default `http://127.0.0.1:54421`) | **Project Settings → API → Project URL** |
| Anon / publishable key | `status -o env` → `ANON_KEY` | **Project Settings → API → Project API keys → `anon` `public`** |
| Service role key | `status -o env` → `SERVICE_ROLE_KEY` | **Project Settings → API → Project API keys → `service_role` `secret`** |
| DB URL | Local: `postgresql://postgres:postgres@127.0.0.1:54422/postgres` (from `config.toml` / status `DB_URL`) | **Project Settings → Database → Connection string** (URI). Not needed in Vite/Expo apps. |
| `CRON_SECRET` | You choose a long random secret; set the same value in edge env / `supabase secrets set CRON_SECRET=...` | Not in Dashboard API keys — ops-generated |
| Razorpay / SMS / WA / Email / FCM | Provider dashboards | Not from Supabase |

**Do not** put `service_role` into any `VITE_*` or `EXPO_PUBLIC_*` variable.

Helper used (does not print secrets): `node scripts/populate_env_locals_from_supabase.mjs`

---

## 2. Checklist — variable → files → Dashboard source

| Variable | Required in these files | Source |
|----------|-------------------------|--------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` | root `.env.local`, `.env.test.local`, admin/sales/delivery/customer, `supabase/.env.local` | Dashboard **API → Project URL** (local already set to `http://127.0.0.1:54421`) |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same set | Dashboard **API → anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | root `.env.local`, `.env.test.local`, `supabase/.env.local` only | Dashboard **API → service_role secret** |
| `SUPABASE_DB_URL` | root `.env.local`, `.env.test.local` | Dashboard **Database → Connection string** (local URI already set) |
| `GROAURUM_SUPABASE_URL` / `GROAURUM_SUPABASE_ANON_KEY` | root `.env.local` (still **commented**) | Same as URL / anon — only if you switch root `GROAURUM_AUTH_PROVIDER=supabase` |
| `CRON_SECRET` | `supabase/.env.local` | Not Dashboard — generate + `supabase secrets set` |
| `RAZORPAY_*` | `supabase/.env.local` | Razorpay Dashboard |
| `SMS_PROVIDER_API_KEY` | `supabase/.env.local` | SMS provider |
| `WHATSAPP_PROVIDER_API_KEY` | `supabase/.env.local` | WhatsApp provider |
| `EMAIL_PROVIDER_API_KEY` | `supabase/.env.local` | Email provider |
| `FCM_SERVER_KEY` | `supabase/.env.local` | Firebase Console |

---

## 3. Files updated this pass

| File | Supabase fields filled |
|------|------------------------|
| `.env.local` | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `.env.test.local` | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/admin-web/.env.local` | `VITE_SUPABASE_ANON_KEY` |
| `apps/sales-pwa/.env.local` | `VITE_SUPABASE_ANON_KEY` |
| `apps/delivery-pwa/.env.local` | `VITE_SUPABASE_ANON_KEY` |
| `apps/customer/.env.local` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `supabase/.env.local` | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

URLs were already correct local defaults (not placeholders). Key lengths confirmed from status: anon ~153 chars, service_role ~164 chars (values not logged).

---

## 4. Remaining placeholders

| Placeholder | File(s) | Mandatory before apps run? | Safe to leave for now? |
|-------------|---------|----------------------------|-------------------------|
| `<FILL_CRON_SECRET>` | `supabase/.env.local` | **No** for Admin/Sales/Delivery/Customer UI | **Yes** — only needed to authorize edge job functions |
| `<FILL_RAZORPAY_KEY_ID>` | `supabase/.env.local` | **No** (dev stubs online pay) | **Yes** |
| `<FILL_RAZORPAY_KEY_SECRET>` | `supabase/.env.local` | **No** | **Yes** |
| `<FILL_RAZORPAY_WEBHOOK_SECRET>` | `supabase/.env.local` | **No** unless testing webhooks | **Yes** |
| `<FILL_SMS_PROVIDER_API_KEY>` | `supabase/.env.local` | **No** | **Yes** |
| `<FILL_WHATSAPP_PROVIDER_API_KEY>` | `supabase/.env.local` | **No** | **Yes** |
| `<FILL_EMAIL_PROVIDER_API_KEY>` | `supabase/.env.local` | **No** | **Yes** |
| `<FILL_FCM_SERVER_KEY>` | `supabase/.env.local` | **No** | **Yes** |
| Commented `<FILL_SUPABASE_URL>` / `<FILL_SUPABASE_ANON_KEY>` under `GROAURUM_*` | `.env.local` | **No** (apps use VITE_/EXPO_PUBLIC_) | **Yes** — leave commented |

### Mandatory for apps to run (local)

Already filled / set:

- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (admin, sales, delivery)
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (customer)
- Local Supabase must be running (`pnpm db:start`)

Service role is **not** required for the four client apps; it is required for verify scripts / edge / db-tests (now filled in root, test, supabase locals).

---

## 5. Notes

- No application code modified.
- Provider placeholders left unchanged per instructions.
- If you rotate local Supabase (full reset of Docker volumes), re-run: `node scripts/populate_env_locals_from_supabase.mjs`
- Hosted pilot: replace URL + keys from **Dashboard → Project Settings → API**, never commit `.env.local`.
