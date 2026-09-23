-- P0 security: stop authenticated clients from directly enqueueing notifications.
--
-- Before:
--   enqueue_notification — GRANT EXECUTE TO authenticated + service_role
--     (sprint91 only checks role membership; any CUSTOMER/SALESMAN/DELIVERY/ADMIN
--      could insert arbitrary outbox rows to any recipient)
--   _enqueue_shop_notification — no REVOKE (PUBLIC EXECUTE by default)
--     → any authenticated user could enqueue shop WhatsApp/SMS using shop contacts
--   _delivery_record_notification — no REVOKE (PUBLIC EXECUTE by default)
--
-- After: same internal-helper pattern as try_auto_convert / sync_shop_lifecycle.
--   - _enqueue_shop_notification: owner / SECURITY DEFINER callers only
--   - _delivery_record_notification: owner / SECURITY DEFINER callers only
--   - enqueue_notification: service_role only (send-notification edge) + owner callers
--
-- Legitimate callers (unchanged bodies):
--   place_customer_order / place_assisted / challenges / jobs → _enqueue_shop_notification
--   delivery_complete_stop / assign / fail / etc. → _delivery_record_notification
--     → enqueue_notification (when provider configured)
--   send-notification edge → enqueue_notification via service_role
--
-- Does NOT change templates, WhatsApp stubs, activation, or order logic — grants only.

REVOKE ALL ON FUNCTION public._enqueue_shop_notification(
  uuid, text, jsonb, text, uuid, public.notification_channel
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._enqueue_shop_notification(
  uuid, text, jsonb, text, uuid, public.notification_channel
) FROM anon;
REVOKE ALL ON FUNCTION public._enqueue_shop_notification(
  uuid, text, jsonb, text, uuid, public.notification_channel
) FROM authenticated;
REVOKE ALL ON FUNCTION public._enqueue_shop_notification(
  uuid, text, jsonb, text, uuid, public.notification_channel
) FROM service_role;

REVOKE ALL ON FUNCTION public._delivery_record_notification(
  uuid, public.delivery_notification_event_kind, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._delivery_record_notification(
  uuid, public.delivery_notification_event_kind, text, jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public._delivery_record_notification(
  uuid, public.delivery_notification_event_kind, text, jsonb
) FROM authenticated;
REVOKE ALL ON FUNCTION public._delivery_record_notification(
  uuid, public.delivery_notification_event_kind, text, jsonb
) FROM service_role;

REVOKE ALL ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) FROM authenticated;

-- Edge worker (send-notification) uses service_role.
GRANT EXECUTE ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) TO service_role;

COMMENT ON FUNCTION public._enqueue_shop_notification(
  uuid, text, jsonb, text, uuid, public.notification_channel
) IS
  'Internal: resolve shop mobile and insert notification_outbox. Not executable by authenticated clients; called from trusted SECURITY DEFINER workflows.';

COMMENT ON FUNCTION public._delivery_record_notification(
  uuid, public.delivery_notification_event_kind, text, jsonb
) IS
  'Internal: delivery notification event (+ optional outbox when provider configured). Not executable by authenticated clients.';

COMMENT ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) IS
  'Insert notification_outbox row. Callable by service_role (edge worker) and SECURITY DEFINER internals; not by authenticated clients.';
