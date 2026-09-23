-- Pack → auto-assign 23514 regression fix
--
-- Root cause: try_auto_assign_delivery inserted order_events with
-- from_status = to_status = READY_FOR_DISPATCH for NEEDS_ATTENTION notes,
-- violating order_events_status_changed (same class of bug as 20260827210000).
--
-- admin_pack_order called try_auto_assign_delivery in the same transaction after
-- advancing to READY_FOR_DISPATCH; when auto-assign could not complete, the
-- invalid INSERT aborted the whole pack RPC.
--
-- Fix: informational NEEDS_ATTENTION events use from_status NULL (23514 pattern).
-- admin_pack_order is idempotent when already packed (READY_FOR_DISPATCH+).
-- Do NOT drop/weaken order_events_status_changed.

CREATE OR REPLACE FUNCTION public.try_auto_assign_delivery(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_rec jsonb;
  v_slot_id uuid;
  v_driver uuid;
  v_vehicle uuid;
  v_route uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('assigned', false, 'reason', 'Order not found');
  END IF;

  IF v_order.status IS DISTINCT FROM 'READY_FOR_DISPATCH' THEN
    RETURN jsonb_build_object('assigned', false, 'reason', 'Not ready for dispatch');
  END IF;

  IF EXISTS (SELECT 1 FROM public.route_stops WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('assigned', true, 'alreadyAssigned', true);
  END IF;

  IF v_order.service_area_id IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — order has no service area'
    );
    RETURN jsonb_build_object('assigned', false, 'reason', 'No service area', 'needsAttention', true);
  END IF;

  SELECT id INTO v_slot_id
  FROM public.delivery_time_slots
  WHERE is_active
  ORDER BY sort_order
  LIMIT 1;

  IF v_slot_id IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — no time slots configured'
    );
    RETURN jsonb_build_object('assigned', false, 'reason', 'No time slots', 'needsAttention', true);
  END IF;

  v_rec := public.admin_recommend_delivery_assignment(v_order.service_area_id, v_today);
  v_driver := nullif(v_rec->>'deliveryProfileId', '')::uuid;
  v_vehicle := nullif(v_rec->>'vehicleId', '')::uuid;
  v_route := nullif(v_rec->>'existingRouteId', '')::uuid;

  IF v_driver IS NULL OR v_vehicle IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — no available driver/vehicle'
    );
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', 'No available driver/vehicle',
      'needsAttention', true
    );
  END IF;

  BEGIN
    v_result := public.admin_schedule_and_assign_delivery(
      ARRAY[p_order_id]::uuid[],
      v_driver,
      v_vehicle,
      v_today,
      v_slot_id,
      v_route,
      v_order.service_area_id
    );
    RETURN coalesce(v_result, '{}'::jsonb) || jsonb_build_object('assigned', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      format('NEEDS_ATTENTION: Automatic delivery assignment failed — %s', SQLERRM)
    );
    RETURN jsonb_build_object('assigned', false, 'reason', SQLERRM, 'needsAttention', true);
  END;
END;
$$;

COMMENT ON FUNCTION public.try_auto_assign_delivery(uuid) IS
  'Best-effort auto schedule/assign after pack. Informational NEEDS_ATTENTION events use from_status NULL (23514 fix).';

CREATE OR REPLACE FUNCTION public.admin_pack_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_assign jsonb;
  v_ready_idx constant integer := 5; -- READY_FOR_DISPATCH happy-path index
  v_already_packed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF public.order_status_happy_path_index(v_order.status) >= v_ready_idx THEN
    v_already_packed := true;
  ELSE
    PERFORM public.admin_advance_order_to(
      p_order_id, 'READY_FOR_DISPATCH', 'Packed · ready for delivery'
    );
  END IF;

  v_assign := public.try_auto_assign_delivery(p_order_id);

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'status', 'READY_FOR_DISPATCH',
    'alreadyPacked', v_already_packed,
    'autoAssign', v_assign
  );
END;
$$;

COMMENT ON FUNCTION public.admin_pack_order IS
  'Advances to READY_FOR_DISPATCH (idempotent if already packed), then tries H5 auto schedule/assign. Auto-assign failure does not fail pack.';
