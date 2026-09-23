# Phase 3 Sprint 9 — Production Services

Infrastructure for launch. No new business UI modules.

## Payments (Razorpay)

| Piece | Location |
|-------|----------|
| Create intent RPC | `create_online_payment_intent` |
| Webhook apply RPC | `apply_payment_webhook_event` (idempotent) |
| Edge create | `supabase/functions/razorpay-create-order` |
| Edge webhook | `supabase/functions/razorpay-webhook` |
| Client facade | `createSupabasePaymentService` |
| COD | Existing Sprint 8 `delivery_collect_cod` |

Env secrets (edge): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Without secrets, create-order runs in **stub mode** (local-ready).

## Notifications

| Channel | Queue | Worker |
|---------|-------|--------|
| SMS / WhatsApp / Push / Email | `notification_outbox` | `send-notification` edge |

Enqueue: `enqueue_notification` RPC / `NotificationService.enqueue`.

## Realtime

`createSupabaseRealtimeBus` in `@groaurum/data` — postgres_changes for orders, inventory, delivery. Wired into admin domain repos subscribe().

## Background jobs

| Job | RPC | Edge |
|-----|-----|------|
| Reservation timeout | `job_expire_stock_reservations` | `expire-reservations` |
| Invitation expiry | `job_expire_shop_invitations` | `expire-invitations` |
| Notification retry | `job_claim_notification_batch` | `send-notification` |

`stock_reservations.expires_at` defaults to +2h.

## Monitoring

- Table: `application_logs` (+ `log_application_event`)
- Client: `createAppLogger` in `@groaurum/api-client`
- Job history: `job_runs`

## Audit

- Helper: `write_audit_log`
- Triggers: sku_prices, settings, inventory_movements, order status
- Webhook/payment intent writes audit rows

## Remaining gaps (launch)

- Live Razorpay credentials + checkout UI hookup
- Live SMS/WhatsApp/FCM/email provider keys
- Scheduled cron (Supabase cron / external) for job edges
- External APM (Sentry) optional next
- Admin read UIs for outbox/logs (not required for Sprint 9)
