-- P0: admin_advance_order_to must create a real reservation before writing STOCK_RESERVED.
--
-- Before: advancing through/to STOCK_RESERVED only updated orders.status + order_events
-- with note 'Inventory reserved', without calling _reserve_order_inventory.
--
-- After: when the walk is about to enter STOCK_RESERVED, ensure active stock_reservations
-- exist (reuse _reserve_order_inventory). Fail the whole transaction if stock is
-- insufficient so status never sticks at a fake STOCK_RESERVED.
--
-- Does not change packing/payment/delivery/pricing RPCs or inventory schema.

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
  v_has_active_reservation boolean;
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

    -- STOCK_RESERVED requires a real active reservation in the same transaction.
    IF v_next = 'STOCK_RESERVED'::public.order_status THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.stock_reservations sr
        WHERE sr.order_id = p_order_id
          AND sr.status IN (
            'PENDING'::public.stock_reservation_status,
            'RESERVED'::public.stock_reservation_status
          )
      ) INTO v_has_active_reservation;

      IF NOT v_has_active_reservation THEN
        PERFORM public._reserve_order_inventory(p_order_id);
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.stock_reservations sr
        WHERE sr.order_id = p_order_id
          AND sr.status IN (
            'PENDING'::public.stock_reservation_status,
            'RESERVED'::public.stock_reservation_status
          )
      ) INTO v_has_active_reservation;

      IF NOT v_has_active_reservation THEN
        RAISE EXCEPTION
          'Cannot mark STOCK_RESERVED without an active inventory reservation';
      END IF;
    END IF;

    v_step_note := CASE
      WHEN v_i = v_to_idx AND p_note IS NOT NULL THEN p_note
      WHEN v_next = 'STOCK_RESERVED' THEN 'Inventory reserved'
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

COMMENT ON FUNCTION public.admin_advance_order_to(uuid, public.order_status, text) IS
  'Admin multi-step status advance. Entering STOCK_RESERVED always ensures a real stock_reservations row via _reserve_order_inventory (idempotent if already reserved).';
