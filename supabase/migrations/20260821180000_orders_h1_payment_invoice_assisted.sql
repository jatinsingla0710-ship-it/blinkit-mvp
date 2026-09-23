-- Orders H1: payment ensure-on-mark, invoice print without status change,
-- admin-capable place_assisted_order, honest STOCK_RESERVED advance notes.

-- ---------------------------------------------------------------------------
-- admin_mark_payment_received — create payment row when missing (trusted)
-- Mirrors delivery_collect_cod insert-if-missing; uses order.total (no invented amount).
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
  v_order public.orders%ROWTYPE;
  v_method_intent public.payment_method_intent;
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

  v_method_intent := CASE
    WHEN p_collection_method = 'ONLINE_GATEWAY' THEN 'PAY_ONLINE_NOW'::public.payment_method_intent
    ELSE 'PAY_ON_DELIVERY'::public.payment_method_intent
  END;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency, paid_at
    )
    VALUES (
      p_order_id,
      'PAID',
      v_method_intent,
      p_collection_method,
      v_order.total,
      COALESCE(v_order.currency, 'INR'),
      now()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      NULL,
      'PAID',
      v_uid,
      'ADMIN',
      COALESCE(p_note, 'Payment received (created by admin)')
    );

    UPDATE public.orders
    SET payment_id = v_payment.id,
        updated_at = now()
    WHERE id = p_order_id
      AND payment_id IS NULL;

    PERFORM public.write_audit_log(
      'payment.marked_paid_admin',
      'payment',
      v_payment.id,
      jsonb_build_object(
        'orderId', p_order_id,
        'from', NULL,
        'created', true,
        'collectionMethod', p_collection_method,
        'note', p_note
      ),
      v_uid,
      'ADMIN'
    );

    RETURN v_payment.id;
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
      'created', false,
      'collectionMethod', p_collection_method,
      'note', p_note
    ),
    v_uid,
    'ADMIN'
  );

  RETURN v_payment.id;
END;
$$;

COMMENT ON FUNCTION public.admin_mark_payment_received(uuid, public.payment_collection_method, text) IS
  'Orders H1: mark payment PAID; creates payments row from order.total when missing.';

-- ---------------------------------------------------------------------------
-- admin_record_invoice_printed — audit event only (no status / stock change)
-- order_events CHECK allows from_status NULL with to_status = current.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_record_invoice_printed(
  p_order_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.order_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotent: if an invoice-printed note already exists, no-op.
  IF EXISTS (
    SELECT 1
    FROM public.order_events
    WHERE order_id = p_order_id
      AND note ILIKE '%invoice%printed%'
  ) THEN
    RETURN p_order_id;
  END IF;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id,
    v_uid,
    'ADMIN',
    NULL,
    v_status,
    COALESCE(p_note, 'Invoice printed')
  );

  PERFORM public.write_audit_log(
    'order.invoice_printed',
    'order',
    p_order_id,
    jsonb_build_object('status', v_status, 'note', p_note),
    v_uid,
    'ADMIN'
  );

  RETURN p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_invoice_printed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_invoice_printed(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_record_invoice_printed(uuid, text) IS
  'Orders H1: record invoice print without changing order status or reserving stock.';

-- ---------------------------------------------------------------------------
-- place_assisted_order — allow is_admin() (same MOQ / stock / reserve / challenge)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_assisted_order(
  p_shop_id uuid,
  p_service_area_id uuid,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_line jsonb;
  v_sku_id uuid;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_sku public.skus%ROWTYPE;
  v_product_name text;
  v_line_total numeric;
  v_balance public.inventory_balances%ROWTYPE;
  v_available numeric;
  v_shop_area uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_admin() THEN
    SELECT service_area_id INTO v_shop_area
    FROM public.shops
    WHERE id = p_shop_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shop not found';
    END IF;
    IF v_shop_area IS DISTINCT FROM p_service_area_id THEN
      RAISE EXCEPTION 'Service area does not match shop';
    END IF;
  ELSIF public.profile_has_role('SALESMAN') THEN
    IF p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
      RAISE EXCEPTION 'Shop is not assigned to this salesman';
    END IF;
  ELSE
    RAISE EXCEPTION 'Salesman or admin role required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'agreedUnitPrice')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for SKU %', v_sku_id;
    END IF;

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id AND deleted_at IS NULL AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SKU % not orderable', v_sku_id;
    END IF;

    IF v_qty < v_sku.moq THEN
      RAISE EXCEPTION 'Quantity for % below MOQ %', v_sku.sku_code, v_sku.moq;
    END IF;

    IF mod(v_qty, v_sku.quantity_step) <> 0 THEN
      RAISE EXCEPTION 'Quantity for % must be in steps of %', v_sku.sku_code, v_sku.quantity_step;
    END IF;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_sku_id
    ORDER BY available_quantity DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory for SKU %', v_sku.sku_code;
    END IF;

    v_available := v_balance.available_quantity;
    IF v_qty > v_available THEN
      RAISE EXCEPTION 'Insufficient stock for % (available %)', v_sku.sku_code, v_available;
    END IF;

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  END LOOP;

  INSERT INTO public.orders (
    shop_id,
    service_area_id,
    source,
    created_by_profile_id,
    status,
    subtotal,
    adjustments,
    total
  )
  VALUES (
    p_shop_id,
    p_service_area_id,
    'SALESMAN_ASSISTED',
    v_uid,
    'DRAFT_ASSISTED',
    v_subtotal,
    0,
    v_subtotal
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'agreedUnitPrice')::numeric;
    v_line_total := round(v_qty * v_price, 2);

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_sku.product_id;

    INSERT INTO public.order_lines (
      order_id,
      sku_id,
      quantity,
      agreed_unit_price,
      line_total,
      product_name_snapshot,
      sku_code_snapshot,
      sku_name_snapshot,
      specification_snapshot,
      selling_unit_snapshot
    )
    VALUES (
      v_order_id,
      v_sku_id,
      v_qty,
      v_price,
      v_line_total,
      COALESCE(v_product_name, v_sku.name),
      v_sku.sku_code,
      v_sku.name,
      v_sku.specification,
      v_sku.selling_unit
    );

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_sku_id
    ORDER BY available_quantity DESC
    LIMIT 1
    FOR UPDATE;

    INSERT INTO public.stock_reservations (
      order_id,
      sku_id,
      operational_location_id,
      quantity,
      status
    )
    VALUES (
      v_order_id,
      v_sku_id,
      v_balance.operational_location_id,
      v_qty,
      'RESERVED'
    );

    UPDATE public.inventory_balances
    SET reserved_quantity = reserved_quantity + v_qty,
        updated_at = now()
    WHERE id = v_balance.id;
  END LOOP;

  UPDATE public.orders
  SET status = 'STOCK_RESERVED',
      updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid, NULL, 'DRAFT_ASSISTED', COALESCE(p_notes, 'Assisted order created')),
    (v_order_id, v_uid, 'DRAFT_ASSISTED', 'STOCK_RESERVED', 'Inventory reserved');

  INSERT INTO public.order_confirmation_challenges (
    order_id,
    token,
    otp_hash,
    expires_at
  )
  VALUES (
    v_order_id,
    encode(extensions.gen_random_bytes(16), 'hex'),
    encode(extensions.digest('000000', 'sha256'), 'hex'),
    now() + interval '24 hours'
  );

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.place_assisted_order(uuid, uuid, jsonb, text) IS
  'Sprint 7 + Orders H1: assisted order MOQ/stock/reserve/challenge; SALESMAN (assigned shop) or is_admin().';

-- ---------------------------------------------------------------------------
-- admin_advance_order_to — honest STOCK_RESERVED step note (not invoice)
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
  'Admin multi-step status advance. STOCK_RESERVED note is inventory reserved (Orders H1).';
