-- Orders H3: admin_cancel_order — trusted cancel with reservation release,
-- open route-stop cleanup, challenge expiry, and audit. No payment refunds.
-- Also: OUT_FOR_DELIVERY may cancel (after failing open stops).

CREATE OR REPLACE FUNCTION public.admin_cancel_order(
  p_order_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_from public.order_status;
  v_stop public.route_stops%ROWTYPE;
  v_res public.stock_reservations%ROWTYPE;
  v_released int := 0;
  v_stops_failed int := 0;
  v_challenges int := 0;
  v_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'CANCELLED' THEN
    RETURN jsonb_build_object(
      'orderId', p_order_id,
      'status', 'CANCELLED',
      'alreadyCancelled', true,
      'reservationsReleased', 0,
      'stopsFailed', 0
    );
  END IF;

  IF v_order.sale_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot cancel an order that has been converted to a sale';
  END IF;

  IF v_order.status = 'DELIVERED' THEN
    RAISE EXCEPTION 'Cannot cancel a delivered order';
  END IF;

  -- Allowed cancel sources (extends single-step graph to include OUT_FOR_DELIVERY)
  IF v_order.status NOT IN (
    'DRAFT_ASSISTED',
    'AWAITING_CUSTOMER_CONFIRMATION',
    'CONFIRMED',
    'STOCK_RESERVED',
    'PROCESSING',
    'READY_FOR_DISPATCH',
    'ASSIGNED_TO_ROUTE',
    'OUT_FOR_DELIVERY',
    'DELIVERY_FAILED'
  ) THEN
    RAISE EXCEPTION 'Cannot cancel order from status %', v_order.status;
  END IF;

  v_from := v_order.status;
  v_note := COALESCE(p_note, 'Order cancelled by admin');

  -- Fail open route stops (do not leave open stops blocking route close)
  FOR v_stop IN
    SELECT *
    FROM public.route_stops
    WHERE order_id = p_order_id
      AND status IN ('PENDING', 'IN_PROGRESS')
    FOR UPDATE
  LOOP
    INSERT INTO public.delivery_attempts (
      route_stop_id, order_id, succeeded, failure_reason, failure_note,
      delivery_notes, photo_captured, signature_captured
    )
    VALUES (
      v_stop.id,
      p_order_id,
      false,
      'OTHER',
      v_note,
      v_note,
      false,
      false
    );

    UPDATE public.route_stops
    SET status = 'FAILED',
        updated_at = now()
    WHERE id = v_stop.id;

    v_stops_failed := v_stops_failed + 1;
  END LOOP;

  -- Release active reservations and restore reserved_quantity
  FOR v_res IN
    SELECT *
    FROM public.stock_reservations
    WHERE order_id = p_order_id
      AND status IN ('PENDING', 'RESERVED')
    FOR UPDATE
  LOOP
    UPDATE public.stock_reservations
    SET status = 'RELEASED',
        updated_at = now()
    WHERE id = v_res.id;

    UPDATE public.inventory_balances
    SET reserved_quantity = GREATEST(reserved_quantity - v_res.quantity, 0),
        updated_at = now()
    WHERE sku_id = v_res.sku_id
      AND operational_location_id = v_res.operational_location_id;

    PERFORM public.write_audit_log(
      'inventory.reservation_released',
      'stock_reservation',
      v_res.id,
      jsonb_build_object(
        'orderId', p_order_id,
        'skuId', v_res.sku_id,
        'quantity', v_res.quantity,
        'reason', 'order_cancelled'
      ),
      v_uid,
      'ADMIN'
    );

    v_released := v_released + 1;
  END LOOP;

  -- Expire pending confirmation challenges (no invented challenge status)
  UPDATE public.order_confirmation_challenges
  SET status = 'EXPIRED',
      updated_at = now()
  WHERE order_id = p_order_id
    AND status = 'PENDING';
  GET DIAGNOSTICS v_challenges = ROW_COUNT;

  -- Payments are left unchanged (no auto-refund)

  UPDATE public.orders
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, v_uid, 'ADMIN', v_from, 'CANCELLED', v_note
  );

  PERFORM public.write_audit_log(
    'order.cancelled_admin',
    'order',
    p_order_id,
    jsonb_build_object(
      'from', v_from,
      'to', 'CANCELLED',
      'note', v_note,
      'reservationsReleased', v_released,
      'stopsFailed', v_stops_failed,
      'challengesExpired', v_challenges
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'status', 'CANCELLED',
    'alreadyCancelled', false,
    'fromStatus', v_from,
    'reservationsReleased', v_released,
    'stopsFailed', v_stops_failed,
    'challengesExpired', v_challenges
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_cancel_order(uuid, text) IS
  'Orders H3: cancel order; releases reservations, fails open stops, expires challenges; no payment refund; blocks delivered/converted.';
