-- Delivery H3: Admin may call stop complete/fail RPCs (same validation as PWA).
-- Adds admin_assign_order_to_route so Delivery UI can attach an order to the
-- selected route (admin_assign_order_delivery only picks "today's" area route).

-- ---------------------------------------------------------------------------
-- delivery_complete_stop — allow is_admin() while keeping payment/OFD rules
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stop not found';
  END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  IF p_collect_cod_amount IS NOT NULL THEN
    PERFORM public.delivery_collect_cod(v_stop.order_id, p_collect_cod_amount, 'CASH_ON_DELIVERY');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = v_stop.order_id;
  IF NOT FOUND OR v_payment.status <> 'PAID' THEN
    IF FOUND AND v_payment.method_intent = 'PAY_ON_DELIVERY' THEN
      RAISE EXCEPTION 'Collect COD before marking delivered';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment record required before delivery confirmation';
    END IF;
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY' THEN
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

COMMENT ON FUNCTION public.delivery_complete_stop IS
  'Sprint 8 + Delivery H3: confirm delivery; callable by assigned DELIVERY or is_admin().';

-- ---------------------------------------------------------------------------
-- delivery_fail_stop — allow is_admin()
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stop not found';
  END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

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

COMMENT ON FUNCTION public.delivery_fail_stop IS
  'Sprint 8 + Delivery H3: fail stop; callable by assigned DELIVERY or is_admin().';

-- ---------------------------------------------------------------------------
-- Admin: attach READY_FOR_DISPATCH order to a specific selected route
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_order_to_route(
  p_order_id uuid,
  p_route_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_route public.delivery_routes%ROWTYPE;
  v_existing_stop public.route_stops%ROWTYPE;
  v_stop_id uuid;
  v_next_seq integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT * INTO v_route FROM public.delivery_routes WHERE id = p_route_id FOR UPDATE;
  IF NOT FOUND OR v_route.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  IF v_route.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot assign orders to a % route', v_route.status;
  END IF;
  IF v_route.assigned_delivery_profile_id IS NULL THEN
    RAISE EXCEPTION 'Assign a driver to this route before adding orders';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.service_area_id IS NULL THEN
    RAISE EXCEPTION 'Order has no service area';
  END IF;
  IF v_order.service_area_id IS DISTINCT FROM v_route.service_area_id THEN
    RAISE EXCEPTION 'Order service area does not match this route';
  END IF;

  IF public.order_status_happy_path_index(v_order.status) < 5
     AND v_order.status IS DISTINCT FROM 'ASSIGNED_TO_ROUTE'
     AND v_order.status IS DISTINCT FROM 'OUT_FOR_DELIVERY'
     AND v_order.status IS DISTINCT FROM 'DELIVERED'
  THEN
    RAISE EXCEPTION
      'Order must be packed (Ready for Dispatch) before assigning to a route (current: %)',
      v_order.status;
  END IF;

  SELECT * INTO v_existing_stop
  FROM public.route_stops
  WHERE order_id = p_order_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_stop.route_id = p_route_id THEN
      RETURN p_order_id;
    END IF;
    RAISE EXCEPTION 'Order is already assigned to another route';
  END IF;

  SELECT COALESCE(max(sequence), 0) + 1
  INTO v_next_seq
  FROM public.route_stops
  WHERE route_id = p_route_id;

  INSERT INTO public.route_stops (route_id, order_id, sequence, status)
  VALUES (p_route_id, p_order_id, v_next_seq, 'PENDING')
  RETURNING id INTO v_stop_id;

  IF v_route.status = 'DRAFT' THEN
    UPDATE public.delivery_routes
    SET status = 'PLANNED',
        updated_at = now()
    WHERE id = p_route_id;
  END IF;

  IF v_order.status = 'READY_FOR_DISPATCH' THEN
    PERFORM public.admin_advance_order_to(
      p_order_id,
      'ASSIGNED_TO_ROUTE',
      format('Assigned to route %s', p_route_id)
    );
  ELSE
    PERFORM public.write_audit_log(
      'order.delivery_assigned_to_route_admin',
      'order',
      p_order_id,
      jsonb_build_object(
        'routeId', p_route_id,
        'stopId', v_stop_id,
        'status', v_order.status
      ),
      v_uid,
      'ADMIN'
    );
  END IF;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_order_to_route(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_order_to_route(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_assign_order_to_route(uuid, uuid) IS
  'Delivery H3: Admin attaches a packed order to a specific selected delivery route.';
