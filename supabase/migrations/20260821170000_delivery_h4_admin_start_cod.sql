-- Delivery H4: allow Admin to start routes, mark stops in progress, and collect COD
-- using the same Sprint 8 RPCs (validation preserved). Delivery executives unchanged.

-- ---------------------------------------------------------------------------
-- delivery_start_route
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(p_route_id);
  END IF;

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

COMMENT ON FUNCTION public.delivery_start_route(uuid) IS
  'Sprint 8 + Delivery H4: start route; callable by assigned DELIVERY or is_admin().';

-- ---------------------------------------------------------------------------
-- delivery_mark_stop_in_progress
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_mark_stop_in_progress(p_stop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop public.route_stops%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
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

  IF v_stop.status NOT IN ('PENDING', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Stop cannot move to in progress from %', v_stop.status;
  END IF;

  UPDATE public.route_stops
  SET status = 'IN_PROGRESS',
      updated_at = now()
  WHERE id = p_stop_id;

  RETURN p_stop_id;
END;
$$;

COMMENT ON FUNCTION public.delivery_mark_stop_in_progress(uuid) IS
  'Sprint 8 + Delivery H4: mark stop in progress; DELIVERY owner or is_admin().';

-- ---------------------------------------------------------------------------
-- delivery_collect_cod — admin may collect for any order on a route
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
  v_actor_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT rs.route_id INTO v_route_id
  FROM public.route_stops rs
  WHERE rs.order_id = p_order_id
  LIMIT 1;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Order is not on a delivery route';
  END IF;

  IF public.is_admin() THEN
    v_actor_role := 'ADMIN';
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY';
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
      v_payment.id, NULL, 'PAID', v_uid, v_actor_role, 'COD collected on delivery'
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
      v_payment.id, v_from, 'PAID', v_uid, v_actor_role, 'COD collected on delivery'
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

COMMENT ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) IS
  'Sprint 8 + Delivery H4: collect COD; assigned DELIVERY or is_admin().';
