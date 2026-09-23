# GroAurum Edge Functions — secrets & security (Sprint 9.1)

Never commit production secrets. Set via:

```bash
supabase secrets set CRON_SECRET=...
supabase secrets set RAZORPAY_KEY_ID=...
supabase secrets set RAZORPAY_KEY_SECRET=...
supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
supabase secrets set ALLOWED_ORIGINS=https://admin.example.com,https://sales.example.com
# optional notification providers
supabase secrets set SMS_PROVIDER_API_KEY=...
supabase secrets set WHATSAPP_PROVIDER_API_KEY=...
supabase secrets set EMAIL_PROVIDER_API_KEY=...
supabase secrets set FCM_SERVER_KEY=...
supabase secrets set APP_ENV=production
```

## Auth model

| Function | Gateway JWT | App auth |
|----------|-------------|----------|
| `razorpay-create-order` | `verify_jwt=true` | Caller `Authorization` Bearer required |
| `provision-salesman` | `verify_jwt=true` | Caller JWT + `is_admin()`; service role only inside function |
| `razorpay-webhook` | `verify_jwt=false` | HMAC `X-Razorpay-Signature` **required** |
| `expire-reservations` | `verify_jwt=false` | `X-Cron-Secret` = `CRON_SECRET` |
| `expire-invitations` | `verify_jwt=false` | `X-Cron-Secret` = `CRON_SECRET` |
| `send-notification` | `verify_jwt=false` | `X-Cron-Secret` = `CRON_SECRET` |

## Cron

Database schedules (pg_cron) in migration `20260716220001_sprint91_blocker_closure.sql`:

- `groaurum-expire-reservations` → `job_expire_stock_reservations()` every 15m
- `groaurum-expire-invitations` → `job_expire_shop_invitations()` hourly
- `groaurum-send-notification` → `job_drain_notification_outbox(50)` every 5m

Hosted environments may also invoke edge workers with `X-Cron-Secret` via pg_net / external scheduler.

## Local without live provider secrets

- Razorpay create-order stubs only when `APP_ENV=development`
- Webhook rejects if `RAZORPAY_WEBHOOK_SECRET` is missing
- Job edges refuse if `CRON_SECRET` is missing
