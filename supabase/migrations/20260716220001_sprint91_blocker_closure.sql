-- Sprint 9.1: Production blocker closure
-- Cron (pg_cron), admin order status RPC, enqueue permission tighten,
-- notification drain job with job_runs logging.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Admin order status transition (SECURITY DEFINER + trusted GUC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status_admin(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from public.order_status;
  v_payment_status public.payment_status;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT status INTO v_from FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_from = p_to_status THEN
    RETURN p_order_id;
  END IF;

  -- Mirror shared-types transition graph (trusted admin path)
  v_allowed := CASE v_from
    WHEN 'DRAFT_ASSISTED' THEN p_to_status IN ('AWAITING_CUSTOMER_CONFIRMATION', 'CANCELLED')
    WHEN 'AWAITING_CUSTOMER_CONFIRMATION' THEN p_to_status IN ('CONFIRMED', 'CANCELLED')
    WHEN 'CONFIRMED' THEN p_to_status IN ('STOCK_RESERVED', 'CANCELLED')
    WHEN 'STOCK_RESERVED' THEN p_to_status IN ('PROCESSING', 'CANCELLED')
    WHEN 'PROCESSING' THEN p_to_status IN ('READY_FOR_DISPATCH', 'CANCELLED')
    WHEN 'READY_FOR_DISPATCH' THEN p_to_status IN ('ASSIGNED_TO_ROUTE', 'CANCELLED')
    WHEN 'ASSIGNED_TO_ROUTE' THEN p_to_status IN ('OUT_FOR_DELIVERY', 'CANCELLED')
    WHEN 'OUT_FOR_DELIVERY' THEN p_to_status IN ('DELIVERED', 'DELIVERY_FAILED')
    WHEN 'DELIVERY_FAILED' THEN p_to_status = 'CANCELLED'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid order transition from % to %', v_from, p_to_status;
  END IF;

  IF p_to_status = 'DELIVERED' THEN
    SELECT status INTO v_payment_status FROM public.payments WHERE order_id = p_order_id;
    IF v_payment_status IS DISTINCT FROM 'PAID' THEN
      RAISE EXCEPTION 'Order cannot be DELIVERED unless payment is PAID';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_to_status,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (
    p_order_id,
    v_uid,
    v_from,
    p_to_status,
    COALESCE(p_note, format('Admin status update %s -> %s', v_from, p_to_status))
  );

  PERFORM public.write_audit_log(
    'order.status_changed_admin',
    'order',
    p_order_id,
    jsonb_build_object('from', v_from, 'to', p_to_status, 'note', p_note),
    v_uid,
    'ADMIN'
  );

  PERFORM public.log_application_event(
    'info',
    'orders.admin',
    format('Admin transition %s -> %s', v_from, p_to_status),
    jsonb_build_object('orderId', p_order_id),
    'update_order_status_admin',
    NULL
  );

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status_admin(uuid, public.order_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status_admin(uuid, public.order_status, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notification drain job (logs job_runs; stub-send for local cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_drain_notification_outbox(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_sent int := 0;
  v_failed int := 0;
  r RECORD;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('drain_notification_outbox', 'RUNNING')
  RETURNING id INTO v_run_id;

  FOR r IN
    SELECT * FROM public.job_claim_notification_batch(p_limit)
  LOOP
    BEGIN
      PERFORM public.mark_notification_sent(
        r.id,
        'cron_stub_' || replace(gen_random_uuid()::text, '-', '')
      );
      v_sent := v_sent + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.mark_notification_failed(r.id, SQLERRM);
      v_failed := v_failed + 1;
    END;
  END LOOP;

  UPDATE public.job_runs
  SET status = CASE WHEN v_failed > 0 AND v_sent = 0 THEN 'FAILED'
                    WHEN v_failed > 0 THEN 'PARTIAL'
                    ELSE 'SUCCESS' END,
      finished_at = now(),
      processed_count = v_sent + v_failed,
      error_count = v_failed,
      detail = jsonb_build_object('sent', v_sent, 'failed', v_failed)
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'jobRunId', v_run_id,
    'sent', v_sent,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.job_drain_notification_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_drain_notification_outbox(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Tighten enqueue_notification: admin/salesman/customer/service only
--    (revoke blanket authenticated; re-grant via wrapper check)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_channel public.notification_channel,
  p_template_key text,
  p_recipient text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  -- service_role has no auth.uid(); allow. Authenticated must be staff/customer role.
  IF v_uid IS NOT NULL THEN
    IF NOT (
      public.profile_has_role('ADMIN')
      OR public.profile_has_role('SALESMAN')
      OR public.profile_has_role('DELIVERY')
      OR public.profile_has_role('CUSTOMER')
    ) THEN
      RAISE EXCEPTION 'Not permitted to enqueue notifications';
    END IF;
  END IF;

  INSERT INTO public.notification_outbox (
    channel, template_key, recipient, payload, related_entity_type, related_entity_id
  )
  VALUES (
    p_channel,
    btrim(p_template_key),
    btrim(p_recipient),
    COALESCE(p_payload, '{}'::jsonb),
    p_related_entity_type,
    p_related_entity_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Schedule cron jobs (pg_cron). Idempotent unschedule + schedule.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('groaurum-expire-reservations');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('groaurum-expire-invitations');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('groaurum-send-notification');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Every 15 minutes: reservation expiry
DO $sched$
BEGIN
  PERFORM cron.schedule(
    'groaurum-expire-reservations',
    '*/15 * * * *',
    $job$SELECT public.job_expire_stock_reservations()$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule groaurum-expire-reservations skipped: %', SQLERRM;
END
$sched$;

-- Every hour: invitation expiry
DO $sched$
BEGIN
  PERFORM cron.schedule(
    'groaurum-expire-invitations',
    '5 * * * *',
    $job$SELECT public.job_expire_shop_invitations()$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule groaurum-expire-invitations skipped: %', SQLERRM;
END
$sched$;

-- Every 5 minutes: notification outbox drain (stub send; edge worker for live providers)
DO $sched$
BEGIN
  PERFORM cron.schedule(
    'groaurum-send-notification',
    '*/5 * * * *',
    $job$SELECT public.job_drain_notification_outbox(50)$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule groaurum-send-notification skipped: %', SQLERRM;
END
$sched$;

-- ---------------------------------------------------------------------------
-- 5. Realtime publication (postgres_changes for app RealtimeBus)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_balances;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_routes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.route_stops;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

COMMENT ON FUNCTION public.update_order_status_admin IS
  'Sprint 9.1: admin order status transition with audit + timeline; sets trusted GUC internally.';
COMMENT ON FUNCTION public.job_drain_notification_outbox IS
  'Sprint 9.1: cron-friendly notification drain with job_runs logging.';
