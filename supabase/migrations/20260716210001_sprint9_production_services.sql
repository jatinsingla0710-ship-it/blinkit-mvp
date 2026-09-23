-- Sprint 9: Production services foundation
-- Payments (online intent + webhook apply), notification outbox, job runners,
-- reservation expiry, invitation expiry, audit helpers, application logs.

-- ---------------------------------------------------------------------------
-- 1. Stock reservation timeout
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_reservations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS stock_reservations_expires_idx
  ON public.stock_reservations (expires_at)
  WHERE status IN ('PENDING', 'RESERVED') AND expires_at IS NOT NULL;

COMMENT ON COLUMN public.stock_reservations.expires_at IS
  'Sprint 9: reservation auto-release deadline for background expire job.';

CREATE OR REPLACE FUNCTION public.trg_stock_reservations_default_expires()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('PENDING', 'RESERVED') AND NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '2 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_reservations_default_expires ON public.stock_reservations;
CREATE TRIGGER trg_stock_reservations_default_expires
  BEFORE INSERT OR UPDATE OF status ON public.stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stock_reservations_default_expires();

UPDATE public.stock_reservations
SET expires_at = created_at + interval '2 hours'
WHERE status IN ('PENDING', 'RESERVED')
  AND expires_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Notification outbox (central queue)
-- ---------------------------------------------------------------------------
CREATE TYPE public.notification_channel AS ENUM (
  'SMS',
  'WHATSAPP',
  'PUSH',
  'EMAIL'
);

CREATE TYPE public.notification_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.notification_channel NOT NULL,
  template_key text NOT NULL,
  recipient text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id text,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_outbox_template_not_blank CHECK (char_length(btrim(template_key)) > 0),
  CONSTRAINT notification_outbox_recipient_not_blank CHECK (char_length(btrim(recipient)) > 0),
  CONSTRAINT notification_outbox_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT notification_outbox_attempts_non_negative CHECK (attempts >= 0)
);

CREATE INDEX notification_outbox_pending_idx
  ON public.notification_outbox (status, next_attempt_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE TRIGGER trg_notification_outbox_set_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_outbox_admin_select
  ON public.notification_outbox
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role('ADMIN'));

-- ---------------------------------------------------------------------------
-- 3. Background job run log
-- ---------------------------------------------------------------------------
CREATE TABLE public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  detail jsonb,
  CONSTRAINT job_runs_job_name_not_blank CHECK (char_length(btrim(job_name)) > 0),
  CONSTRAINT job_runs_status_allowed CHECK (
    status IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')
  )
);

CREATE INDEX job_runs_job_started_idx ON public.job_runs (job_name, started_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY job_runs_admin_select
  ON public.job_runs
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role('ADMIN'));

-- ---------------------------------------------------------------------------
-- 4. Application / error / performance logs (append-only ops telemetry)
-- ---------------------------------------------------------------------------
CREATE TABLE public.application_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  source text NOT NULL,
  message text NOT NULL,
  context jsonb,
  rpc_name text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_logs_level_allowed CHECK (
    level IN ('debug', 'info', 'warn', 'error', 'perf')
  ),
  CONSTRAINT application_logs_message_not_blank CHECK (char_length(btrim(message)) > 0)
);

CREATE INDEX application_logs_created_idx ON public.application_logs (created_at DESC);
CREATE INDEX application_logs_level_idx ON public.application_logs (level, created_at DESC);
CREATE INDEX application_logs_rpc_idx ON public.application_logs (rpc_name, created_at DESC)
  WHERE rpc_name IS NOT NULL;

ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY application_logs_admin_select
  ON public.application_logs
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role('ADMIN'));

-- ---------------------------------------------------------------------------
-- 5. Audit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_actor_role public.staff_role DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_role public.staff_role;
BEGIN
  v_actor := COALESCE(p_actor_profile_id, auth.uid());
  v_role := p_actor_role;
  IF v_role IS NULL AND v_actor IS NOT NULL THEN
    SELECT roles[1] INTO v_role FROM public.profiles WHERE id = v_actor;
  END IF;

  INSERT INTO public.audit_logs (
    actor_profile_id, actor_role, action, entity_type, entity_id, payload
  )
  VALUES (
    v_actor,
    v_role,
    btrim(p_action),
    btrim(p_entity_type),
    p_entity_id,
    CASE WHEN p_payload IS NULL OR jsonb_typeof(p_payload) = 'object' THEN p_payload ELSE jsonb_build_object('value', p_payload) END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, uuid, public.staff_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, jsonb, uuid, public.staff_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_application_event(
  p_level text,
  p_source text,
  p_message text,
  p_context jsonb DEFAULT NULL,
  p_rpc_name text DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.application_logs (level, source, message, context, rpc_name, duration_ms)
  VALUES (p_level, p_source, p_message, p_context, p_rpc_name, p_duration_ms)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_application_event(text, text, text, jsonb, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_application_event(text, text, text, jsonb, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Enqueue notification
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
BEGIN
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

REVOKE ALL ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(
  public.notification_channel, text, text, jsonb, text, uuid
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Online payment intent (Razorpay prep — local row + provider_reference stub)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_online_payment_intent(
  p_order_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR',
  p_provider_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_existing public.payments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_read_order(p_order_id) THEN
    RAISE EXCEPTION 'Order not accessible';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_existing FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'PAID' THEN
      RAISE EXCEPTION 'Order already paid';
    END IF;
    UPDATE public.payments
    SET status = 'PAYMENT_PENDING',
        method_intent = 'PAY_ONLINE_NOW',
        amount = p_amount,
        currency = upper(COALESCE(p_currency, 'INR')),
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_events (payment_id, from_status, to_status, actor_profile_id, note)
    VALUES (v_payment_id, v_existing.status, 'PAYMENT_PENDING', v_uid, 'Online payment intent created');
  ELSE
    INSERT INTO public.payments (
      order_id, status, method_intent, amount, currency, provider_reference
    )
    VALUES (
      p_order_id,
      'PAYMENT_PENDING',
      'PAY_ONLINE_NOW',
      p_amount,
      upper(COALESCE(p_currency, 'INR')),
      p_provider_reference
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_events (payment_id, from_status, to_status, actor_profile_id, note)
    VALUES (v_payment_id, NULL, 'PAYMENT_PENDING', v_uid, 'Online payment intent created');

    UPDATE public.orders
    SET payment_id = v_payment_id,
        updated_at = now()
    WHERE id = p_order_id;
  END IF;

  PERFORM public.write_audit_log(
    'payment.intent_created',
    'payment',
    v_payment_id,
    jsonb_build_object('orderId', p_order_id, 'amount', p_amount, 'providerReference', p_provider_reference),
    v_uid,
    NULL
  );

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_payment_intent(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_online_payment_intent(uuid, numeric, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Razorpay webhook apply (idempotent by provider_reference + event id in payload)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_reference text,
  p_status text,
  p_amount numeric DEFAULT NULL,
  p_raw jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
  v_to public.payment_status;
  v_audit_id uuid;
BEGIN
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = '' THEN
    RAISE EXCEPTION 'provider_reference required';
  END IF;

  -- Idempotency: if we already audited this event, return existing payment
  SELECT entity_id INTO v_audit_id
  FROM public.audit_logs
  WHERE action = 'payment.webhook_applied'
    AND payload->>'providerEventId' = p_provider_event_id
  LIMIT 1;
  IF v_audit_id IS NOT NULL THEN
    RETURN v_audit_id;
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for provider_reference %', p_provider_reference;
  END IF;

  v_from := v_payment.status;
  IF lower(p_status) IN ('paid', 'captured', 'authorized') THEN
    v_to := 'PAID';
  ELSIF lower(p_status) IN ('failed', 'cancelled') THEN
    v_to := 'FAILED';
  ELSE
    RAISE EXCEPTION 'Unsupported webhook status %', p_status;
  END IF;

  IF v_from = v_to THEN
    PERFORM public.write_audit_log(
      'payment.webhook_applied',
      'payment',
      v_payment.id,
      jsonb_build_object(
        'provider', p_provider,
        'providerEventId', p_provider_event_id,
        'status', p_status,
        'idempotent', true
      ),
      NULL,
      'ADMIN'
    );
    RETURN v_payment.id;
  END IF;

  UPDATE public.payments
  SET status = v_to,
      collection_method = CASE WHEN v_to = 'PAID' THEN 'ONLINE_GATEWAY'::public.payment_collection_method ELSE collection_method END,
      paid_at = CASE WHEN v_to = 'PAID' THEN now() ELSE paid_at END,
      amount = COALESCE(p_amount, amount),
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (payment_id, from_status, to_status, actor_role, note)
  VALUES (
    v_payment.id,
    v_from,
    v_to,
    'ADMIN',
    format('%s webhook: %s', p_provider, p_status)
  );

  PERFORM public.write_audit_log(
    'payment.webhook_applied',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'provider', p_provider,
      'providerEventId', p_provider_event_id,
      'status', p_status,
      'raw', p_raw
    ),
    NULL,
    'ADMIN'
  );

  PERFORM public.log_application_event(
    'info',
    'payments.webhook',
    format('Applied %s webhook %s -> %s', p_provider, v_from, v_to),
    jsonb_build_object('paymentId', v_payment.id, 'providerEventId', p_provider_event_id),
    'apply_payment_webhook_event',
    NULL
  );

  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_webhook_event(text, text, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_webhook_event(text, text, text, text, numeric, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. Expire stock reservations job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_expire_stock_reservations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_count int := 0;
  r RECORD;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('expire_stock_reservations', 'RUNNING')
  RETURNING id INTO v_run_id;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  FOR r IN
    SELECT *
    FROM public.stock_reservations
    WHERE status IN ('PENDING', 'RESERVED')
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.stock_reservations
    SET status = 'RELEASED',
        updated_at = now()
    WHERE id = r.id;

    UPDATE public.inventory_balances
    SET reserved_quantity = GREATEST(reserved_quantity - r.quantity, 0),
        updated_at = now()
    WHERE sku_id = r.sku_id
      AND operational_location_id = r.operational_location_id;

    PERFORM public.write_audit_log(
      'inventory.reservation_expired',
      'stock_reservation',
      r.id,
      jsonb_build_object('orderId', r.order_id, 'skuId', r.sku_id, 'quantity', r.quantity),
      NULL,
      'ADMIN'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.job_runs
  SET status = 'SUCCESS',
      finished_at = now(),
      processed_count = v_count,
      detail = jsonb_build_object('released', v_count)
  WHERE id = v_run_id;

  RETURN jsonb_build_object('jobRunId', v_run_id, 'released', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.job_expire_stock_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_expire_stock_reservations() TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Expire invitations job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_expire_shop_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_count int;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('expire_shop_invitations', 'RUNNING')
  RETURNING id INTO v_run_id;

  UPDATE public.shop_invitations
  SET status = 'EXPIRED'
  WHERE status = 'PENDING'
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.job_runs
  SET status = 'SUCCESS',
      finished_at = now(),
      processed_count = v_count,
      detail = jsonb_build_object('expired', v_count)
  WHERE id = v_run_id;

  RETURN jsonb_build_object('jobRunId', v_run_id, 'expired', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.job_expire_shop_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_expire_shop_invitations() TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Notification retry claim batch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_claim_notification_batch(p_limit integer DEFAULT 20)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.notification_outbox
    WHERE status IN ('PENDING', 'FAILED')
      AND attempts < max_attempts
      AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  )
  UPDATE public.notification_outbox n
  SET status = 'PROCESSING',
      attempts = attempts + 1,
      updated_at = now()
  FROM cte
  WHERE n.id = cte.id
  RETURNING n.*;
END;
$$;

REVOKE ALL ON FUNCTION public.job_claim_notification_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_claim_notification_batch(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_sent(
  p_id uuid,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_outbox
  SET status = 'SENT',
      provider_message_id = p_provider_message_id,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_failed(
  p_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts int;
  v_max int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM public.notification_outbox WHERE id = p_id;

  UPDATE public.notification_outbox
  SET status = CASE WHEN v_attempts >= v_max THEN 'FAILED' ELSE 'PENDING' END,
      last_error = left(COALESCE(p_error, 'unknown'), 2000),
      next_attempt_at = now() + (interval '1 minute' * LEAST(power(2, GREATEST(v_attempts - 1, 0)), 60)),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_sent(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_failed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_failed(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 12. Audit triggers: price changes, settings, inventory movements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_sku_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.write_audit_log(
    CASE WHEN TG_OP = 'INSERT' THEN 'pricing.created' ELSE 'pricing.updated' END,
    'sku_price',
    NEW.id,
    jsonb_build_object(
      'skuId', NEW.sku_id,
      'tradePrice', NEW.trade_price,
      'effectiveFrom', NEW.effective_from,
      'effectiveTo', NEW.effective_to
    ),
    auth.uid(),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sku_price_change ON public.sku_prices;
CREATE TRIGGER trg_audit_sku_price_change
  AFTER INSERT OR UPDATE ON public.sku_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_sku_price_change();

CREATE OR REPLACE FUNCTION public.trg_audit_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.write_audit_log(
    'settings.updated',
    'settings',
    NEW.id,
    jsonb_build_object('key', NEW.setting_key),
    auth.uid(),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_settings_change ON public.settings;
CREATE TRIGGER trg_audit_settings_change
  AFTER UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_settings_change();

CREATE OR REPLACE FUNCTION public.trg_audit_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.write_audit_log(
    'inventory.adjusted',
    'inventory_movement',
    NEW.id,
    jsonb_build_object(
      'skuId', NEW.sku_id,
      'movementType', NEW.movement_type,
      'quantityDelta', NEW.quantity_delta,
      'reason', NEW.reason
    ),
    NEW.actor_profile_id,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_audit_inventory_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_inventory_movement();

CREATE OR REPLACE FUNCTION public.trg_audit_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.write_audit_log(
      'order.status_changed',
      'order',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status),
      auth.uid(),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_status ON public.orders;
CREATE TRIGGER trg_audit_order_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_order_status();

COMMENT ON TABLE public.notification_outbox IS
  'Sprint 9: central notification queue for SMS/WhatsApp/Push/Email workers.';
COMMENT ON TABLE public.job_runs IS
  'Sprint 9: background job execution history.';
COMMENT ON TABLE public.application_logs IS
  'Sprint 9: application/error/performance/RPC telemetry.';
COMMENT ON FUNCTION public.apply_payment_webhook_event IS
  'Sprint 9: idempotent Razorpay (or other) webhook payment status apply.';
COMMENT ON FUNCTION public.create_online_payment_intent IS
  'Sprint 9: create/update PAYMENT_PENDING online intent before Razorpay checkout.';
