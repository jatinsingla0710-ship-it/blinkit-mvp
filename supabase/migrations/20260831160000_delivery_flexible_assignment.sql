-- Delivery ops simplification: optional company vehicle, resilient time slots,
-- structured auto-assign gaps. Reuses delivery_routes / route_stops / H5 RPCs.

CREATE OR REPLACE FUNCTION public._delivery_ensure_active_time_slots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_time_slots WHERE is_active) THEN
    RETURN;
  END IF;

  INSERT INTO public.delivery_time_slots (label, start_time, end_time, sort_order)
  SELECT v.label, v.start_time::time, v.end_time::time, v.sort_order
  FROM (VALUES
    ('Morning (9–11)', '09:00', '11:00', 10),
    ('Midday (11–1)', '11:00', '13:00', 20),
    ('Afternoon (2–4)', '14:00', '16:00', 30),
    ('Evening (4–6)', '16:00', '18:00', 40)
  ) AS v(label, start_time, end_time, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.delivery_time_slots s
    WHERE lower(btrim(s.label)) = lower(btrim(v.label))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._delivery_resolve_time_slot(p_time_slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public._delivery_ensure_active_time_slots();

  IF p_time_slot_id IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.delivery_time_slots
    WHERE id = p_time_slot_id AND is_active;
    IF FOUND THEN
      RETURN v_id;
    END IF;
  END IF;

  SELECT id INTO v_id
  FROM public.delivery_time_slots
  WHERE is_active
  ORDER BY sort_order
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active delivery time slots';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_schedule_and_assign_delivery(
  p_order_ids uuid[],
  p_delivery_profile_id uuid,
  p_vehicle_id uuid,
  p_delivery_date date,
  p_time_slot_id uuid,
  p_route_id uuid DEFAULT NULL,
  p_service_area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route public.delivery_routes%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_order_id uuid;
  v_area uuid;
  v_resolved_slot_id uuid;
  v_slot_label text;
  v_existing_stop public.route_stops%ROWTYPE;
  v_stop_id uuid;
  v_next_seq integer;
  v_created_route boolean := false;
  v_reused_route boolean := false;
  v_assigned int := 0;
  v_driver_name text;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_order_ids IS NULL OR coalesce(array_length(p_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one order is required';
  END IF;
  IF p_delivery_date IS NULL THEN RAISE EXCEPTION 'Delivery date is required'; END IF;

  v_resolved_slot_id := public._delivery_resolve_time_slot(p_time_slot_id);
  SELECT label INTO v_slot_label
  FROM public.delivery_time_slots
  WHERE id = v_resolved_slot_id;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_ids[1] FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_area := coalesce(p_service_area_id, v_order.service_area_id);
  IF v_area IS NULL THEN RAISE EXCEPTION 'Order has no service area'; END IF;

  IF p_route_id IS NOT NULL THEN
    SELECT * INTO v_route FROM public.delivery_routes
    WHERE id = p_route_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
    IF v_route.status IN ('COMPLETED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Cannot assign to a % route', v_route.status;
    END IF;
    IF v_route.service_area_id IS DISTINCT FROM v_area THEN
      RAISE EXCEPTION 'Route service area does not match orders';
    END IF;
    IF v_route.route_date IS DISTINCT FROM p_delivery_date THEN
      RAISE EXCEPTION 'Route date does not match delivery date';
    END IF;
    PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, v_route.id);
    IF p_vehicle_id IS NOT NULL THEN
      PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, v_route.id);
    END IF;
    v_reused_route := true;
  ELSE
    SELECT * INTO v_route
    FROM public.delivery_routes
    WHERE deleted_at IS NULL
      AND service_area_id = v_area
      AND route_date = p_delivery_date
      AND assigned_delivery_profile_id = p_delivery_profile_id
      AND status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, v_route.id);
      IF p_vehicle_id IS NOT NULL THEN
        PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, v_route.id);
      END IF;
      v_reused_route := true;
    ELSE
      PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, NULL);
      IF p_vehicle_id IS NOT NULL THEN
        PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, NULL);
      END IF;

      INSERT INTO public.delivery_routes (
        service_area_id, route_date, assigned_delivery_profile_id,
        vehicle_id, time_slot_id, status
      )
      VALUES (
        v_area, p_delivery_date, p_delivery_profile_id,
        p_vehicle_id, v_resolved_slot_id, 'PLANNED'
      )
      RETURNING * INTO v_route;
      v_created_route := true;
    END IF;
  END IF;

  UPDATE public.delivery_routes
  SET assigned_delivery_profile_id = p_delivery_profile_id,
      vehicle_id = p_vehicle_id,
      time_slot_id = v_resolved_slot_id,
      route_date = p_delivery_date,
      status = CASE
        WHEN status IN ('DRAFT', 'PLANNED') THEN 'PLANNED'::public.delivery_route_status
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_route.id
  RETURNING * INTO v_route;

  IF p_vehicle_id IS NOT NULL THEN
    UPDATE public.vehicles
    SET status = CASE
          WHEN status = 'ON_ROUTE' THEN status
          ELSE 'ASSIGNED'::public.vehicle_status
        END,
        assigned_delivery_profile_id = p_delivery_profile_id,
        updated_at = now()
    WHERE id = p_vehicle_id;

    INSERT INTO public.vehicle_assignment_history (
      vehicle_id, delivery_profile_id, route_id, from_status, to_status, note, recorded_by_profile_id
    )
    VALUES (
      p_vehicle_id, p_delivery_profile_id, v_route.id, 'AVAILABLE', 'ASSIGNED',
      'Assigned to delivery trip', v_uid
    );
  END IF;

  INSERT INTO public.delivery_employment (profile_id, employment_status, operational_status)
  VALUES (p_delivery_profile_id, 'ACTIVE', 'AVAILABLE')
  ON CONFLICT (profile_id) DO NOTHING;

  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', v_order_id; END IF;
    IF v_order.service_area_id IS DISTINCT FROM v_area THEN
      RAISE EXCEPTION 'All orders must share the same service area';
    END IF;

    IF public.order_status_happy_path_index(v_order.status) < 5
       AND v_order.status IS DISTINCT FROM 'ASSIGNED_TO_ROUTE'
       AND v_order.status IS DISTINCT FROM 'OUT_FOR_DELIVERY'
       AND v_order.status IS DISTINCT FROM 'DELIVERED'
    THEN
      RAISE EXCEPTION
        'Order must be packed (Ready for Dispatch) before scheduling (current: %)',
        v_order.status;
    END IF;

    SELECT * INTO v_existing_stop
    FROM public.route_stops WHERE order_id = v_order_id LIMIT 1;

    IF FOUND THEN
      IF v_existing_stop.route_id = v_route.id THEN
        v_stop_id := v_existing_stop.id;
      ELSE
        RAISE EXCEPTION 'Order % is already assigned to another route', v_order_id;
      END IF;
    ELSE
      SELECT coalesce(max(sequence), 0) + 1 INTO v_next_seq
      FROM public.route_stops WHERE route_id = v_route.id;

      INSERT INTO public.route_stops (route_id, order_id, sequence, status)
      VALUES (v_route.id, v_order_id, v_next_seq, 'PENDING')
      RETURNING id INTO v_stop_id;
    END IF;

    INSERT INTO public.delivery_schedule_events (
      order_id, route_id, route_stop_id, kind, delivery_date, time_slot_id,
      delivery_profile_id, vehicle_id, recorded_by_profile_id
    )
    VALUES (
      v_order_id, v_route.id, v_stop_id, 'SCHEDULED', p_delivery_date, v_resolved_slot_id,
      p_delivery_profile_id, p_vehicle_id, v_uid
    );

    IF v_order.status = 'READY_FOR_DISPATCH' THEN
      PERFORM public.admin_advance_order_to(
        v_order_id,
        'ASSIGNED_TO_ROUTE',
        format('Scheduled for %s · %s', p_delivery_date::text, v_slot_label)
      );
    END IF;

    SELECT display_name INTO v_driver_name FROM public.profiles WHERE id = p_delivery_profile_id;
    v_msg := format(
      'Your order is scheduled for delivery on %s (%s).',
      to_char(p_delivery_date, 'DD Mon YYYY'),
      v_slot_label
    );
    PERFORM public._delivery_record_notification(
      v_order_id,
      'DELIVERY_SCHEDULED',
      v_msg,
      jsonb_build_object(
        'deliveryDate', p_delivery_date,
        'timeSlot', v_slot_label,
        'routeId', v_route.id
      )
    );

    v_assigned := v_assigned + 1;
  END LOOP;

  PERFORM public.write_audit_log(
    'delivery.scheduled_assigned_admin',
    'delivery_route',
    v_route.id,
    jsonb_build_object(
      'orderIds', to_jsonb(p_order_ids),
      'deliveryProfileId', p_delivery_profile_id,
      'vehicleId', p_vehicle_id,
      'deliveryDate', p_delivery_date,
      'timeSlotId', v_resolved_slot_id,
      'createdRoute', v_created_route,
      'reusedRoute', v_reused_route,
      'assignedCount', v_assigned,
      'usesOwnVehicle', p_vehicle_id IS NULL
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'routeId', v_route.id,
    'createdRoute', v_created_route,
    'reusedRoute', v_reused_route,
    'assignedCount', v_assigned,
    'deliveryDate', p_delivery_date,
    'timeSlotId', v_resolved_slot_id,
    'deliveryProfileId', p_delivery_profile_id,
    'vehicleId', p_vehicle_id,
    'usesOwnVehicle', p_vehicle_id IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.admin_schedule_and_assign_delivery IS
  'Delivery H5: schedule + assign. Company vehicle optional (NULL = driver own vehicle). Time slot auto-resolved.';

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
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', 'No service area',
      'needsAttention', true,
      'missingResources', '["service_area"]'::jsonb
    );
  END IF;

  v_slot_id := public._delivery_resolve_time_slot(NULL);

  v_rec := public.admin_recommend_delivery_assignment(v_order.service_area_id, v_today);
  v_driver := nullif(v_rec->>'deliveryProfileId', '')::uuid;
  v_vehicle := nullif(v_rec->>'vehicleId', '')::uuid;
  v_route := nullif(v_rec->>'existingRouteId', '')::uuid;

  IF v_driver IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — no available delivery boy'
    );
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', 'No available delivery boy',
      'needsAttention', true,
      'missingResources', jsonb_build_array('drivers')
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
    RETURN coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'assigned', true,
      'usesOwnVehicle', v_vehicle IS NULL
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), NULL, NULL, v_order.status,
      format('NEEDS_ATTENTION: Automatic delivery assignment failed — %s', SQLERRM)
    );
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', SQLERRM,
      'needsAttention', true,
      'missingResources', '["manual_assign"]'::jsonb
    );
  END;
END;
$$;

COMMENT ON FUNCTION public.try_auto_assign_delivery(uuid) IS
  'Best-effort auto assign after pack. Driver required; company vehicle optional.';
