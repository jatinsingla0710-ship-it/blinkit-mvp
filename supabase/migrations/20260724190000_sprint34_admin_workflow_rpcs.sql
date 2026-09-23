-- Sprint 3.4.1: Admin trusted workflow RPCs for order status / delivery assignment / payment.
-- Client must not UPDATE orders.status (or payment trusted fields) directly.
-- These SECURITY DEFINER functions set groaurum.trusted_server_action=true.

-- ---------------------------------------------------------------------------
-- Happy-path index helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_status_happy_path_index(
  p_status public.order_status
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'DRAFT_ASSISTED' THEN 0
    WHEN 'AWAITING_CUSTOMER_CONFIRMATION' THEN 1
    WHEN 'CONFIRMED' THEN 2
    WHEN 'STOCK_RESERVED' THEN 3
    WHEN 'PROCESSING' THEN 4
    WHEN 'READY_FOR_DISPATCH' THEN 5
    WHEN 'ASSIGNED_TO_ROUTE' THEN 6
    WHEN 'OUT_FOR_DELIVERY' THEN 7
    WHEN 'DELIVERED' THEN 8
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.order_status_from_happy_path_index(
  p_index integer
)
RETURNS public.order_status
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_index
    WHEN 0 THEN 'DRAFT_ASSISTED'::public.order_status
    WHEN 1 THEN 'AWAITING_CUSTOMER_CONFIRMATION'::public.order_status
    WHEN 2 THEN 'CONFIRMED'::public.order_status
    WHEN 3 THEN 'STOCK_RESERVED'::public.order_status
    WHEN 4 THEN 'PROCESSING'::public.order_status
    WHEN 5 THEN 'READY_FOR_DISPATCH'::public.order_status
    WHEN 6 THEN 'ASSIGNED_TO_ROUTE'::public.order_status
    WHEN 7 THEN 'OUT_FOR_DELIVERY'::public.order_status
    WHEN 8 THEN 'DELIVERED'::public.order_status
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Advance order to a target status (walks intermediate happy-path steps)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_advance_order_to(
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
  v_cur public.order_status;
  v_next public.order_status;
  v_from_idx integer;
  v_to_idx integer;
  v_i integer;
  v_step_note text;
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
    PERFORM public.write_audit_log(
      'order.workflow_noop',
      'order',
      p_order_id,
      jsonb_build_object('status', v_from, 'note', p_note),
      v_uid,
      'ADMIN'
    );
    RETURN p_order_id;
  END IF;

  v_from_idx := public.order_status_happy_path_index(v_from);
  v_to_idx := public.order_status_happy_path_index(p_to_status);

  IF v_from_idx < 0 OR v_to_idx < 0 THEN
    RAISE EXCEPTION 'Unsupported workflow transition from % to %', v_from, p_to_status;
  END IF;

  IF v_to_idx < v_from_idx THEN
    RAISE EXCEPTION 'Cannot move order backwards from % to %', v_from, p_to_status;
  END IF;

  v_cur := v_from;
  FOR v_i IN (v_from_idx + 1)..v_to_idx LOOP
    v_next := public.order_status_from_happy_path_index(v_i);
    IF v_next IS NULL THEN
      RAISE EXCEPTION 'Invalid happy-path index %', v_i;
    END IF;

    v_step_note := CASE
      WHEN v_i = v_to_idx AND p_note IS NOT NULL THEN p_note
      WHEN v_next = 'STOCK_RESERVED' THEN 'Invoice printed'
      WHEN v_next = 'PROCESSING' THEN 'Packed'
      WHEN v_next = 'READY_FOR_DISPATCH' THEN 'Ready for dispatch'
      WHEN v_next = 'ASSIGNED_TO_ROUTE' THEN 'Assigned to delivery'
      WHEN v_next = 'OUT_FOR_DELIVERY' THEN 'Out for delivery'
      WHEN v_next = 'DELIVERED' THEN 'Delivered'
      ELSE format('Status %s -> %s', v_cur, v_next)
    END;

    UPDATE public.orders
    SET status = v_next,
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    )
    VALUES (
      p_order_id, v_uid, 'ADMIN', v_cur, v_next, v_step_note
    );

    PERFORM public.write_audit_log(
      'order.status_changed_admin',
      'order',
      p_order_id,
      jsonb_build_object('from', v_cur, 'to', v_next, 'note', v_step_note),
      v_uid,
      'ADMIN'
    );

    v_cur := v_next;
  END LOOP;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_advance_order_to(uuid, public.order_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_advance_order_to(uuid, public.order_status, text) TO authenticated;

COMMENT ON FUNCTION public.admin_advance_order_to IS
  'Admin trusted multi-step order status advance along the happy path. Sets groaurum.trusted_server_action.';

-- ---------------------------------------------------------------------------
-- Assign delivery boy + advance to ASSIGNED_TO_ROUTE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_order_delivery(
  p_order_id uuid,
  p_delivery_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_route_id uuid;
  v_stop_id uuid;
  v_next_seq integer;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_roles public.staff_role[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT roles INTO v_roles FROM public.profiles WHERE id = p_delivery_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery profile not found';
  END IF;
  IF NOT ('DELIVERY' = ANY (v_roles)) THEN
    RAISE EXCEPTION 'Profile is not a delivery staff member';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.service_area_id IS NULL THEN
    RAISE EXCEPTION 'Order has no service area';
  END IF;

  IF public.order_status_happy_path_index(v_order.status) < 5
     AND v_order.status IS DISTINCT FROM 'ASSIGNED_TO_ROUTE'
     AND v_order.status IS DISTINCT FROM 'OUT_FOR_DELIVERY'
     AND v_order.status IS DISTINCT FROM 'DELIVERED'
  THEN
    RAISE EXCEPTION
      'Order must be packed (Ready for Dispatch) before assigning a delivery boy (current: %)',
      v_order.status;
  END IF;

  -- Ensure route stop exists (create today's route if needed)
  SELECT rs.id, rs.route_id
  INTO v_stop_id, v_route_id
  FROM public.route_stops rs
  WHERE rs.order_id = p_order_id
  LIMIT 1;

  IF v_route_id IS NOT NULL THEN
    UPDATE public.delivery_routes
    SET assigned_delivery_profile_id = p_delivery_profile_id,
        status = CASE
          WHEN status IN ('DRAFT', 'PLANNED') THEN 'PLANNED'::public.delivery_route_status
          ELSE status
        END,
        updated_at = now()
    WHERE id = v_route_id;
  ELSE
    SELECT dr.id
    INTO v_route_id
    FROM public.delivery_routes dr
    WHERE dr.service_area_id = v_order.service_area_id
      AND dr.route_date = v_today
      AND dr.status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS')
    ORDER BY dr.created_at DESC
    LIMIT 1;

    IF v_route_id IS NULL THEN
      INSERT INTO public.delivery_routes (
        service_area_id, route_date, assigned_delivery_profile_id, status
      )
      VALUES (
        v_order.service_area_id, v_today, p_delivery_profile_id, 'PLANNED'
      )
      RETURNING id INTO v_route_id;
    ELSE
      UPDATE public.delivery_routes
      SET assigned_delivery_profile_id = p_delivery_profile_id,
          updated_at = now()
      WHERE id = v_route_id;
    END IF;

    SELECT COALESCE(max(sequence), 0) + 1
    INTO v_next_seq
    FROM public.route_stops
    WHERE route_id = v_route_id;

    INSERT INTO public.route_stops (route_id, order_id, sequence, status)
    VALUES (v_route_id, p_order_id, v_next_seq, 'PENDING')
    RETURNING id INTO v_stop_id;
  END IF;

  IF v_order.status = 'READY_FOR_DISPATCH' THEN
    PERFORM public.admin_advance_order_to(
      p_order_id,
      'ASSIGNED_TO_ROUTE',
      format('Assigned to delivery person %s', p_delivery_profile_id)
    );
  ELSE
    PERFORM public.write_audit_log(
      'order.delivery_reassigned_admin',
      'order',
      p_order_id,
      jsonb_build_object(
        'deliveryProfileId', p_delivery_profile_id,
        'routeId', v_route_id,
        'status', v_order.status
      ),
      v_uid,
      'ADMIN'
    );
  END IF;

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_order_delivery(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_order_delivery(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_assign_order_delivery IS
  'Admin trusted delivery assignment: route/stop + order status ASSIGNED_TO_ROUTE.';

-- ---------------------------------------------------------------------------
-- Mark payment received (required before DELIVERED / Convert to Sale)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_payment_received(
  p_order_id uuid,
  p_collection_method public.payment_collection_method DEFAULT 'CASH_ON_DELIVERY',
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found for order';
  END IF;

  IF v_payment.status = 'PAID' THEN
    RETURN v_payment.id;
  END IF;

  v_from := v_payment.status;

  UPDATE public.payments
  SET status = 'PAID',
      collection_method = p_collection_method,
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (
    payment_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_payment.id,
    v_from,
    'PAID',
    v_uid,
    'ADMIN',
    COALESCE(p_note, 'Payment received')
  );

  -- Link payment on order if missing (trusted field)
  UPDATE public.orders
  SET payment_id = COALESCE(payment_id, v_payment.id),
      updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.write_audit_log(
    'payment.marked_paid_admin',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'orderId', p_order_id,
      'from', v_from,
      'collectionMethod', p_collection_method,
      'note', p_note
    ),
    v_uid,
    'ADMIN'
  );

  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_payment_received(uuid, public.payment_collection_method, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_payment_received(uuid, public.payment_collection_method, text) TO authenticated;

COMMENT ON FUNCTION public.admin_mark_payment_received IS
  'Admin trusted payment PAID transition. Required before DELIVERED invariant.';
