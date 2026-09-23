-- Pack-level and container-level discounts on SKUs (independent configuration).
-- Regular list price remains append-only in sku_prices; discounts are mutable SKU config.

ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS pack_discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pack_discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS container_price_mode text NOT NULL DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS container_custom_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS container_discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS container_discount_value numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_pack_discount_type_check') THEN
    ALTER TABLE public.skus
      ADD CONSTRAINT skus_pack_discount_type_check
      CHECK (pack_discount_type IN ('none', 'percent', 'fixed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_container_discount_type_check') THEN
    ALTER TABLE public.skus
      ADD CONSTRAINT skus_container_discount_type_check
      CHECK (container_discount_type IN ('none', 'percent', 'fixed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_container_price_mode_check') THEN
    ALTER TABLE public.skus
      ADD CONSTRAINT skus_container_price_mode_check
      CHECK (container_price_mode IN ('calculated', 'custom'));
  END IF;
END $$;

COMMENT ON COLUMN public.skus.pack_discount_type IS 'Discount on individual selling pack: none, percent, fixed.';
COMMENT ON COLUMN public.skus.container_price_mode IS 'calculated = packs_per_carton × regular pack price; custom = container_custom_price.';

-- Base trade price from sku_prices only (no quantity tiers).
CREATE OR REPLACE FUNCTION public.resolve_sku_base_trade_price(p_sku_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.trade_price
  FROM public.sku_prices sp
  WHERE sp.sku_id = p_sku_id
    AND sp.effective_from <= now()
    AND (sp.effective_to IS NULL OR sp.effective_to > now())
  ORDER BY sp.effective_from DESC, sp.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_sku_base_trade_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sku_base_trade_price(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_sku_discount(
  p_regular_price numeric,
  p_discount_type text,
  p_discount_value numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_discount numeric;
BEGIN
  IF p_regular_price IS NULL OR p_regular_price < 0 THEN
    RAISE EXCEPTION 'Regular price must be non-negative';
  END IF;
  IF p_discount_type IS NULL OR p_discount_type = 'none' THEN
    RETURN round(p_regular_price, 2);
  END IF;
  IF p_discount_value IS NULL OR p_discount_value < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;
  IF p_discount_type = 'percent' THEN
    IF p_discount_value > 100 THEN
      RAISE EXCEPTION 'Percentage discount cannot exceed 100%%';
    END IF;
    v_discount := round(p_regular_price * p_discount_value / 100, 2);
  ELSIF p_discount_type = 'fixed' THEN
    IF p_discount_value > p_regular_price THEN
      RAISE EXCEPTION 'Fixed discount cannot exceed regular price';
    END IF;
    v_discount := round(p_discount_value, 2);
  ELSE
    RAISE EXCEPTION 'Unknown discount type %', p_discount_type;
  END IF;
  RETURN round(GREATEST(0, p_regular_price - v_discount), 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_sku_container_regular_price(
  p_sku_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku public.skus%ROWTYPE;
  v_pack_regular numeric;
BEGIN
  SELECT * INTO v_sku FROM public.skus WHERE id = p_sku_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;
  IF v_sku.packs_per_carton IS NULL OR v_sku.packs_per_carton <= 0 THEN
    RETURN NULL;
  END IF;
  v_pack_regular := public.resolve_sku_base_trade_price(p_sku_id);
  IF v_pack_regular IS NULL THEN
    RAISE EXCEPTION 'No base trade price for SKU %', p_sku_id;
  END IF;
  IF v_sku.container_price_mode = 'custom' THEN
    IF v_sku.container_custom_price IS NULL OR v_sku.container_custom_price < 0 THEN
      RAISE EXCEPTION 'Custom container price is invalid for SKU %', p_sku_id;
    END IF;
    RETURN round(v_sku.container_custom_price, 2);
  END IF;
  RETURN round(v_pack_regular * v_sku.packs_per_carton, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_sku_container_regular_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sku_container_regular_price(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_sku_order_line_total(
  p_sku_id uuid,
  p_quantity numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku public.skus%ROWTYPE;
  v_qty numeric;
  v_pack_regular numeric;
  v_pack_final numeric;
  v_container_regular numeric;
  v_container_final numeric;
  v_ppo integer;
  v_containers integer;
  v_loose numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  v_qty := p_quantity;

  SELECT * INTO v_sku FROM public.skus WHERE id = p_sku_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;

  v_pack_regular := public.resolve_sku_base_trade_price(p_sku_id);
  IF v_pack_regular IS NULL THEN
    RAISE EXCEPTION 'No base trade price for SKU %', p_sku_id;
  END IF;

  v_pack_final := public.apply_sku_discount(
    v_pack_regular,
    v_sku.pack_discount_type,
    v_sku.pack_discount_value
  );

  v_ppo := v_sku.packs_per_carton;
  IF v_ppo IS NULL OR v_ppo <= 0 THEN
    RETURN round(v_qty * v_pack_final, 2);
  END IF;

  v_container_regular := public.resolve_sku_container_regular_price(p_sku_id);
  v_container_final := public.apply_sku_discount(
    v_container_regular,
    v_sku.container_discount_type,
    v_sku.container_discount_value
  );

  v_containers := floor(v_qty / v_ppo)::integer;
  v_loose := v_qty - (v_containers * v_ppo);

  RETURN round(
    (v_containers * v_container_final) + (v_loose * v_pack_final),
    2
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_sku_order_line_total(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sku_order_line_total(uuid, numeric) TO authenticated, service_role;

-- Display unit price: pack final for qty 1; effective average for larger qty.
CREATE OR REPLACE FUNCTION public.resolve_effective_sku_trade_price(
  p_sku_id uuid,
  p_quantity numeric DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty numeric := COALESCE(p_quantity, 1);
  v_line_total numeric;
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN
    v_qty := 1;
  END IF;

  v_line_total := public.resolve_sku_order_line_total(p_sku_id, v_qty);
  RETURN round(v_line_total / v_qty, 4);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_sku_trade_price(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_sku_trade_price(uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_effective_sku_trade_price(p_sku_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resolve_effective_sku_trade_price(p_sku_id, 1::numeric);
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_sku_trade_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_sku_trade_price(uuid) TO authenticated, service_role;

-- Patch place_customer_order to use line totals (snapshots preserve history).
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
  v_line_total numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_sku public.skus%ROWTYPE;
  v_product_name text;
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
    v_line_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
    v_price := round(v_line_total / v_qty, 4);

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

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  INSERT INTO public.orders (
    shop_id, service_area_id, source, created_by_profile_id,
    status, subtotal, adjustments, total
  )
  VALUES (
    p_shop_id, p_service_area_id, 'CUSTOMER_SELF_SERVE', v_uid,
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

  UPDATE public.orders
  SET status = 'CONFIRMED', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid, 'CUSTOMER', NULL, 'DRAFT_ASSISTED',
      COALESCE(p_notes, 'Customer self-serve order created')),
    (v_order_id, v_uid, 'CUSTOMER', 'DRAFT_ASSISTED', 'CONFIRMED',
      'Self-serve order auto-confirmed');

  PERFORM public._reserve_order_inventory(v_order_id);

  UPDATE public.orders
  SET status = 'STOCK_RESERVED', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES (v_order_id, v_uid, 'CUSTOMER', 'CONFIRMED', 'STOCK_RESERVED', 'Inventory reserved');

  PERFORM public.write_audit_log(
    'order.customer_self_serve_placed',
    'order',
    v_order_id,
    jsonb_build_object('shopId', p_shop_id, 'subtotal', v_subtotal),
    v_uid,
    'CUSTOMER'::public.staff_role
  );

  PERFORM public._enqueue_shop_notification(
    p_shop_id,
    'order_confirmed',
    jsonb_build_object('orderId', v_order_id, 'source', 'CUSTOMER_SELF_SERVE'),
    'order',
    v_order_id,
    'WHATSAPP'
  );

  RETURN v_order_id;
END;
$$;
