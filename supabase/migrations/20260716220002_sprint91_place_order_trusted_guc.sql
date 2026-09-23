-- Sprint 9.1 follow-up: place_customer_order must set trusted GUC
-- before updating order status to STOCK_RESERVED.

CREATE OR REPLACE FUNCTION public.place_customer_order(
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('CUSTOMER') THEN
    RAISE EXCEPTION 'Customer role required';
  END IF;

  IF p_shop_id NOT IN (SELECT public.customer_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not linked to this account';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

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
    'CUSTOMER_SELF_SERVE',
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
    (v_order_id, v_uid, NULL, 'DRAFT_ASSISTED', COALESCE(p_notes, 'Customer self-serve order created')),
    (v_order_id, v_uid, 'DRAFT_ASSISTED', 'STOCK_RESERVED', 'Inventory reserved');

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.place_customer_order(uuid, uuid, jsonb, text) IS
  'Sprint 6/9.1: self-serve order with trusted GUC for status transition + stock reservation.';
