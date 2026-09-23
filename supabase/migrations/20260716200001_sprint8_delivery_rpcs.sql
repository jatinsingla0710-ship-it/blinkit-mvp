-- Sprint 8: Delivery PWA — confirmation placeholders + trusted delivery RPCs.
-- Sets groaurum.trusted_server_action for order/payment status updates.

ALTER TABLE public.delivery_attempts
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS photo_captured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_captured boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.delivery_attempts.photo_captured IS
  'Sprint 8 placeholder: true when driver affirms photo capture (no blob storage yet).';
COMMENT ON COLUMN public.delivery_attempts.signature_captured IS
  'Sprint 8 placeholder: true when driver affirms customer signature (no blob storage yet).';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_delivery_owns_route(p_route_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.profile_has_role('DELIVERY') THEN
    RAISE EXCEPTION 'Delivery role required';
  END IF;
  IF p_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
    RAISE EXCEPTION 'Route is not assigned to this delivery executive';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Start route: PLANNED/DRAFT -> IN_PROGRESS; orders -> OUT_FOR_DELIVERY
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_start_route(p_route_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.delivery_route_status;
  r RECORD;
BEGIN
  PERFORM public.assert_delivery_owns_route(p_route_id);
  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT status INTO v_status FROM public.delivery_routes WHERE id = p_route_id;
  IF v_status NOT IN ('DRAFT', 'PLANNED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Route cannot be started from status %', v_status;
  END IF;

  UPDATE public.delivery_routes
  SET status = 'IN_PROGRESS',
      updated_at = now()
  WHERE id = p_route_id;

  FOR r IN
    SELECT rs.id AS stop_id, rs.order_id, o.status AS order_status
    FROM public.route_stops rs
    JOIN public.orders o ON o.id = rs.order_id
    WHERE rs.route_id = p_route_id
      AND rs.status IN ('PENDING', 'IN_PROGRESS')
  LOOP
    IF r.order_status IN ('ASSIGNED_TO_ROUTE', 'READY_FOR_DISPATCH', 'PROCESSING', 'CONFIRMED', 'STOCK_RESERVED') THEN
      UPDATE public.orders
      SET status = 'OUT_FOR_DELIVERY',
          updated_at = now()
      WHERE id = r.order_id;

      INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
      VALUES (r.order_id, v_uid, r.order_status, 'OUT_FOR_DELIVERY', 'Route started — out for delivery');
    END IF;
  END LOOP;

  RETURN p_route_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_start_route(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_start_route(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Mark stop in progress (Loaded / arriving)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_mark_stop_in_progress(p_stop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route_id uuid;
BEGIN
  SELECT route_id INTO v_route_id FROM public.route_stops WHERE id = p_stop_id;
  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Stop not found';
  END IF;
  PERFORM public.assert_delivery_owns_route(v_route_id);

  UPDATE public.route_stops
  SET status = 'IN_PROGRESS',
      updated_at = now()
  WHERE id = p_stop_id
    AND status IN ('PENDING', 'IN_PROGRESS');

  RETURN p_stop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_mark_stop_in_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_mark_stop_in_progress(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Collect COD for an order on assigned route
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_collect_cod(
  p_order_id uuid,
  p_collected_amount numeric,
  p_collection_method public.payment_collection_method DEFAULT 'CASH_ON_DELIVERY'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route_id uuid;
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.profile_has_role('DELIVERY') THEN
    RAISE EXCEPTION 'Delivery role required';
  END IF;

  SELECT rs.route_id INTO v_route_id
  FROM public.route_stops rs
  WHERE rs.order_id = p_order_id
  LIMIT 1;

  IF v_route_id IS NULL OR v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
    RAISE EXCEPTION 'Order is not on an assigned delivery route';
  END IF;

  IF p_collected_amount IS NULL OR p_collected_amount < 0 THEN
    RAISE EXCEPTION 'Invalid collected amount';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency, paid_at
    )
    VALUES (
      p_order_id,
      'PAID',
      'PAY_ON_DELIVERY',
      p_collection_method,
      p_collected_amount,
      'INR',
      now()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id, NULL, 'PAID', v_uid, 'DELIVERY', 'COD collected on delivery'
    );
  ELSE
    IF v_payment.status = 'PAID' THEN
      RETURN v_payment.id;
    END IF;
    v_from := v_payment.status;
    UPDATE public.payments
    SET status = 'PAID',
        collection_method = p_collection_method,
        amount = p_collected_amount,
        paid_at = now(),
        updated_at = now()
    WHERE id = v_payment.id;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id, v_from, 'PAID', v_uid, 'DELIVERY', 'COD collected on delivery'
    );
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id,
      updated_at = now()
  WHERE id = p_order_id
    AND payment_id IS NULL;

  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) TO authenticated;

-- ---------------------------------------------------------------------------
-- Complete stop (delivered) with confirmation placeholders
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_complete_stop(
  p_stop_id uuid,
  p_notes text DEFAULT NULL,
  p_photo_captured boolean DEFAULT false,
  p_signature_captured boolean DEFAULT false,
  p_collect_cod_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_from public.order_status;
BEGIN
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stop not found';
  END IF;
  PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  IF p_collect_cod_amount IS NOT NULL THEN
    PERFORM public.delivery_collect_cod(v_stop.order_id, p_collect_cod_amount, 'CASH_ON_DELIVERY');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = v_stop.order_id;
  IF NOT FOUND OR v_payment.status <> 'PAID' THEN
    -- Online prepaid orders may already be paid; COD must be collected first.
    IF FOUND AND v_payment.method_intent = 'PAY_ON_DELIVERY' THEN
      RAISE EXCEPTION 'Collect COD before marking delivered';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment record required before delivery confirmation';
    END IF;
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY' THEN
    -- Allow completing if start_route already set OFD, otherwise force transition
    IF v_order.status IN ('ASSIGNED_TO_ROUTE', 'READY_FOR_DISPATCH') THEN
      UPDATE public.orders SET status = 'OUT_FOR_DELIVERY', updated_at = now() WHERE id = v_order.id;
      INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
      VALUES (v_order.id, v_uid, v_from, 'OUT_FOR_DELIVERY', 'Auto out-for-delivery before complete');
      v_from := 'OUT_FOR_DELIVERY';
    ELSIF v_order.status <> 'OUT_FOR_DELIVERY' THEN
      RAISE EXCEPTION 'Order must be OUT_FOR_DELIVERY to complete (current %)', v_order.status;
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'DELIVERED',
      updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (v_order.id, v_uid, 'OUT_FOR_DELIVERY', 'DELIVERED', COALESCE(p_notes, 'Delivered'));

  INSERT INTO public.delivery_attempts (
    route_stop_id, order_id, succeeded, failure_reason, failure_note,
    delivery_notes, photo_captured, signature_captured
  )
  VALUES (
    p_stop_id, v_order.id, true, NULL, NULL,
    p_notes, COALESCE(p_photo_captured, false), COALESCE(p_signature_captured, false)
  );

  UPDATE public.route_stops
  SET status = 'COMPLETED',
      updated_at = now()
  WHERE id = p_stop_id;

  RETURN p_stop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_complete_stop(uuid, text, boolean, boolean, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_complete_stop(uuid, text, boolean, boolean, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- Fail stop
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_fail_stop(
  p_stop_id uuid,
  p_failure_reason public.delivery_failure_reason,
  p_notes text DEFAULT NULL,
  p_photo_captured boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_from public.order_status;
BEGIN
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stop not found';
  END IF;
  PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  UPDATE public.orders
  SET status = 'DELIVERY_FAILED',
      updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (v_order.id, v_uid, v_from, 'DELIVERY_FAILED', COALESCE(p_notes, p_failure_reason::text));

  INSERT INTO public.delivery_attempts (
    route_stop_id, order_id, succeeded, failure_reason, failure_note,
    delivery_notes, photo_captured, signature_captured
  )
  VALUES (
    p_stop_id, v_order.id, false, p_failure_reason, p_notes,
    p_notes, COALESCE(p_photo_captured, false), false
  );

  UPDATE public.route_stops
  SET status = 'FAILED',
      updated_at = now()
  WHERE id = p_stop_id;

  RETURN p_stop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_fail_stop(uuid, public.delivery_failure_reason, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_fail_stop(uuid, public.delivery_failure_reason, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Complete route + summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_complete_route(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
  v_completed int;
  v_failed int;
  v_cod_expected numeric := 0;
  v_cod_collected numeric := 0;
BEGIN
  PERFORM public.assert_delivery_owns_route(p_route_id);
  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT
    count(*) FILTER (WHERE status IN ('PENDING', 'IN_PROGRESS')),
    count(*) FILTER (WHERE status = 'COMPLETED'),
    count(*) FILTER (WHERE status = 'FAILED')
  INTO v_pending, v_completed, v_failed
  FROM public.route_stops
  WHERE route_id = p_route_id;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Cannot close route: % stop(s) still open', v_pending;
  END IF;

  SELECT
    COALESCE(sum(p.amount) FILTER (
      WHERE p.method_intent = 'PAY_ON_DELIVERY' OR p.collection_method IN (
        'CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY'
      )
    ), 0),
    COALESCE(sum(p.amount) FILTER (WHERE p.status = 'PAID'), 0)
  INTO v_cod_expected, v_cod_collected
  FROM public.route_stops rs
  LEFT JOIN public.payments p ON p.order_id = rs.order_id
  WHERE rs.route_id = p_route_id;

  UPDATE public.delivery_routes
  SET status = 'COMPLETED',
      updated_at = now()
  WHERE id = p_route_id;

  RETURN jsonb_build_object(
    'routeId', p_route_id,
    'completedDeliveries', v_completed,
    'failedDeliveries', v_failed,
    'codExpected', v_cod_expected,
    'codCollected', v_cod_collected,
    'codPending', GREATEST(v_cod_expected - v_cod_collected, 0),
    'closedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_complete_route(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_complete_route(uuid) TO authenticated;

COMMENT ON FUNCTION public.delivery_start_route(uuid) IS
  'Sprint 8: start assigned route and mark stop orders OUT_FOR_DELIVERY.';
COMMENT ON FUNCTION public.delivery_complete_stop IS
  'Sprint 8: confirm delivery with notes/photo/signature placeholders; optional COD collect.';
COMMENT ON FUNCTION public.delivery_fail_stop IS
  'Sprint 8: record failed delivery attempt and mark stop/order failed.';
COMMENT ON FUNCTION public.delivery_collect_cod IS
  'Sprint 8: mark COD payment PAID for an order on the assigned route.';
COMMENT ON FUNCTION public.delivery_complete_route(uuid) IS
  'Sprint 8: close route when all stops done; return COD reconciliation summary.';
