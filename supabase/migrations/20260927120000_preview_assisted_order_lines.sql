-- Sales PWA Phase 2: read-only server-priced cart preview for assisted orders.
--
-- Prices every line with the same resolver and the same rounding that
-- place_assisted_order uses when it writes order_lines, and runs the same
-- orderability / MOQ / step / stock checks. Problems are reported per line
-- instead of raised so the cart can highlight them.
--
-- Read-only: no orders, order_lines, events, challenges, reservations,
-- inventory changes, commission entries, payments or audit rows.

CREATE OR REPLACE FUNCTION public.preview_assisted_order_lines(p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_line jsonb;
  v_sku_id uuid;
  v_qty numeric;
  v_sku public.skus%ROWTYPE;
  v_line_total numeric;
  v_unit numeric;
  v_available numeric;
  v_code text;
  v_message text;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_out jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_all_valid boolean := true;
  v_item_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_admin() OR public.profile_has_role('SALESMAN')) THEN
    RAISE EXCEPTION 'Salesman or admin role required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  IF jsonb_array_length(p_lines) > 200 THEN
    RAISE EXCEPTION 'Too many order lines (max 200)';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_code := NULL;
    v_message := NULL;
    v_line_total := NULL;
    v_unit := NULL;
    v_available := NULL;

    SELECT * INTO v_sku FROM public.skus
    WHERE id = v_sku_id AND deleted_at IS NULL AND is_active;

    IF v_sku_id = ANY (v_seen) THEN
      v_code := 'DUPLICATE_SKU';
      v_message := 'This product is already in the order';
    ELSIF v_qty IS NULL OR v_qty <= 0 THEN
      v_code := 'INVALID_QUANTITY';
      v_message := 'Quantity must be more than zero';
    ELSIF NOT FOUND THEN
      v_code := 'NOT_ORDERABLE';
      v_message := 'This product is no longer available to order';
    ELSIF v_qty < v_sku.moq THEN
      v_code := 'BELOW_MOQ';
      v_message := format('Minimum order is %s', v_sku.moq);
    ELSIF mod(v_qty, v_sku.quantity_step) <> 0 THEN
      v_code := 'INVALID_STEP';
      v_message := format('Quantity must be in steps of %s', v_sku.quantity_step);
    END IF;

    IF v_code IS NULL THEN
      BEGIN
        v_line_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
        -- Same rounding path as the order_lines insert: round(total/qty, 4) cast to numeric(12,2).
        v_unit := round(round(v_line_total / v_qty, 4), 2);
      EXCEPTION WHEN OTHERS THEN
        v_line_total := NULL;
        v_code := 'NO_PRICE';
        v_message := 'No current price for this product';
      END;
    END IF;

    -- order_lines_line_total_matches requires line_total = round(qty * unit, 2);
    -- place_assisted_order rejects quantities whose total does not split evenly per pack.
    IF v_code IS NULL AND round(v_qty * v_unit, 2) <> v_line_total THEN
      v_code := 'PRICE_SPLIT';
      v_message := 'This quantity cannot be priced per pack exactly. Try a different quantity (for example full bags only).';
    END IF;

    IF v_code IS NULL THEN
      SELECT ib.available_quantity INTO v_available
      FROM public.inventory_balances ib
      WHERE ib.sku_id = v_sku_id
      ORDER BY ib.available_quantity DESC
      LIMIT 1;

      IF NOT FOUND THEN
        v_available := 0;
        v_code := 'NO_INVENTORY';
        v_message := 'Out of stock';
      ELSIF v_qty > v_available THEN
        v_code := 'INSUFFICIENT_STOCK';
        v_message := format('Only %s available', v_available);
      END IF;
    END IF;

    IF v_sku_id IS NOT NULL THEN
      v_seen := array_append(v_seen, v_sku_id);
    END IF;

    IF v_code IS NOT NULL THEN
      v_all_valid := false;
    END IF;

    IF v_line_total IS NOT NULL THEN
      v_subtotal := v_subtotal + v_line_total;
      v_item_count := v_item_count + 1;
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'skuId', v_sku_id,
      'quantity', v_qty,
      'unitPrice', v_unit,
      'lineTotal', v_line_total,
      'availableQuantity', v_available,
      'ok', v_code IS NULL,
      'errorCode', v_code,
      'message', v_message
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'lines', v_out,
    'itemCount', v_item_count,
    'subtotal', round(v_subtotal, 2),
    'total', round(v_subtotal, 2),
    'currency', 'INR',
    'allValid', v_all_valid,
    'pricedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_assisted_order_lines(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_assisted_order_lines(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_assisted_order_lines(jsonb) IS
  'Sales Phase 2: read-only cart preview. Same resolver, rounding and checks as place_assisted_order; writes nothing.';
