-- Align assisted-order line pricing with self-serve resolve_sku_order_line_total.
--
-- Before: place_assisted_order / salesman_replace_assisted_order_lines used
--   resolve_effective_sku_trade_price(sku)  -- 1-arg → qty=1, ignores outer tiers
-- After: same as place_customer_order:
--   line_total := resolve_sku_order_line_total(sku, qty)
--   unit     := round(line_total / qty, 4)
--
-- Does not reprice existing orders, change resolvers, schema, or self-serve.

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
  v_challenge_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_admin() THEN
    SELECT service_area_id INTO v_shop_area
    FROM public.shops
    WHERE id = p_shop_id AND deleted_at IS NULL;
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

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for SKU %', v_sku_id;
    END IF;

    v_line_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
    v_price := round(v_line_total / v_qty, 4);

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

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  INSERT INTO public.orders (
    shop_id, service_area_id, source, created_by_profile_id,
    status, subtotal, adjustments, total
  )
  VALUES (
    p_shop_id, p_service_area_id, 'SALESMAN_ASSISTED', v_uid,
    'DRAFT_ASSISTED', v_subtotal, 0, v_subtotal
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_line_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
    v_price := round(v_line_total / v_qty, 4);

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_sku.product_id;

    INSERT INTO public.order_lines (
      order_id, sku_id, quantity, agreed_unit_price, line_total,
      product_name_snapshot, sku_code_snapshot, sku_name_snapshot,
      specification_snapshot, selling_unit_snapshot
    )
    VALUES (
      v_order_id, v_sku_id, v_qty, v_price, v_line_total,
      COALESCE(v_product_name, v_sku.name), v_sku.sku_code, v_sku.name,
      v_sku.specification, v_sku.selling_unit
    );
  END LOOP;

  -- Do NOT reserve stock before customer approval.
  UPDATE public.orders
  SET status = 'AWAITING_CUSTOMER_CONFIRMATION', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid,
      CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END,
      NULL, 'DRAFT_ASSISTED',
      COALESCE(p_notes, 'Assisted order created')),
    (v_order_id, v_uid,
      CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END,
      'DRAFT_ASSISTED', 'AWAITING_CUSTOMER_CONFIRMATION',
      'Awaiting customer approval — stock not reserved');

  v_challenge_id := public._issue_order_confirmation_challenge(
    v_order_id,
    'order_approval_requested'
  );

  PERFORM public.write_audit_log(
    'order.assisted_awaiting_confirmation',
    'order',
    v_order_id,
    jsonb_build_object('shopId', p_shop_id, 'challengeId', v_challenge_id, 'subtotal', v_subtotal),
    v_uid,
    CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END
  );

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.place_assisted_order(uuid, uuid, jsonb, text) IS
  'Assisted order: prices via resolve_sku_order_line_total (same as self-serve), AWAITING_CUSTOMER_CONFIRMATION, challenge + notification. No stock reserve.';

CREATE OR REPLACE FUNCTION public.salesman_replace_assisted_order_lines(
  p_order_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_line jsonb;
  v_sku public.skus%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_price numeric;
  v_qty numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  IF v_order.source <> 'SALESMAN_ASSISTED' THEN
    RAISE EXCEPTION 'Only assisted orders can be edited here';
  END IF;

  IF v_order.status <> 'AWAITING_CUSTOMER_CONFIRMATION' THEN
    RAISE EXCEPTION 'Assisted order must be awaiting confirmation to edit (status: %)', v_order.status;
  END IF;

  DELETE FROM public.order_lines WHERE order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_sku FROM public.skus WHERE id = (v_line->>'skuId')::uuid AND deleted_at IS NULL AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU not found: %', v_line->>'skuId'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_sku.product_id;

    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF v_qty < v_sku.moq THEN
      RAISE EXCEPTION 'Quantity for % below MOQ %', v_sku.sku_code, v_sku.moq;
    END IF;
    IF mod(v_qty, v_sku.quantity_step) <> 0 THEN
      RAISE EXCEPTION 'Quantity for % must be in steps of %', v_sku.sku_code, v_sku.quantity_step;
    END IF;

    v_line_total := public.resolve_sku_order_line_total(v_sku.id, v_qty);
    v_price := round(v_line_total / v_qty, 4);

    INSERT INTO public.order_lines (
      order_id, sku_id,
      product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
      specification_snapshot, selling_unit_snapshot,
      quantity, agreed_unit_price, line_total
    )
    VALUES (
      p_order_id, v_sku.id,
      coalesce(v_product.name, 'Product'),
      v_sku.name, v_sku.sku_code, v_sku.specification, v_sku.selling_unit,
      v_qty, v_price, v_line_total
    );

    v_subtotal := v_subtotal + v_line_total;
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = greatest(v_subtotal + coalesce(adjustments, 0), 0),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, v_uid, 'SALESMAN', NULL, 'AWAITING_CUSTOMER_CONFIRMATION',
    format('Salesman updated lines · %s line(s) · total %s', v_count, v_order.total)
  );

  PERFORM public.reissue_order_approval_challenge(p_order_id);

  PERFORM public.write_audit_log(
    'order.lines_replaced_salesman',
    'order',
    p_order_id,
    jsonb_build_object('lineCount', v_count, 'subtotal', v_subtotal),
    v_uid,
    'SALESMAN'::public.staff_role
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'lineCount', v_count,
    'subtotal', v_order.subtotal,
    'total', v_order.total,
    'reapprovalRequired', true
  );
END;
$$;

COMMENT ON FUNCTION public.salesman_replace_assisted_order_lines(uuid, jsonb) IS
  'Replace awaiting assisted order lines using resolve_sku_order_line_total (same as self-serve); reissues approval challenge.';
