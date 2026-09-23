-- Product packaging persistence (outer_type) + quantity-based price tiers.
-- Extends existing sku_prices / inventory_balances — no parallel inventory or pricing systems.

-- ---------------------------------------------------------------------------
-- 1. Persist outer packaging type on SKUs (Admin UI already models this)
-- ---------------------------------------------------------------------------
ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS outer_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skus_outer_type_check'
  ) THEN
    ALTER TABLE public.skus
      ADD CONSTRAINT skus_outer_type_check
      CHECK (
        outer_type IS NULL
        OR outer_type IN ('box', 'carton', 'case', 'crate', 'bundle', 'bag')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.skus.outer_type IS
  'Master/outer packaging label (box, carton, bag, …). packs_per_carton = pieces per outer.';

-- ---------------------------------------------------------------------------
-- 2. Quantity price tiers (append-only, keyed to sku_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sku_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus(id),
  min_quantity numeric(12, 3) NOT NULL,
  unit_price numeric(12, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'INR',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  recorded_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_price_tiers_min_qty_positive CHECK (min_quantity > 0),
  CONSTRAINT sku_price_tiers_unit_price_non_negative CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS sku_price_tiers_sku_open_idx
  ON public.sku_price_tiers (sku_id, min_quantity DESC)
  WHERE effective_to IS NULL;

COMMENT ON TABLE public.sku_price_tiers IS
  'Quantity-based unit prices per SKU. Base trade price remains in sku_prices; tiers override when min_quantity <= order qty.';

-- Append-only guard (close rows via trusted RPC only)
CREATE OR REPLACE FUNCTION public.enforce_sku_price_tiers_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Table sku_price_tiers is append-only; DELETE is not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.sku_id IS DISTINCT FROM OLD.sku_id
      OR NEW.min_quantity IS DISTINCT FROM OLD.min_quantity
      OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
      OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
    THEN
      RAISE EXCEPTION 'sku_price_tiers commercial fields are append-only; insert a new row instead'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
      IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Closing sku_price_tiers rows requires groaurum.trusted_server_action=true'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sku_price_tiers_append_only ON public.sku_price_tiers;
CREATE TRIGGER trg_sku_price_tiers_append_only
  BEFORE UPDATE ON public.sku_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sku_price_tiers_append_only();

DROP TRIGGER IF EXISTS trg_sku_price_tiers_prevent_delete ON public.sku_price_tiers;
CREATE TRIGGER trg_sku_price_tiers_prevent_delete
  BEFORE DELETE ON public.sku_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sku_price_tiers_append_only();

ALTER TABLE public.sku_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sku_price_tiers_select_authenticated
  ON public.sku_price_tiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY sku_price_tiers_admin_insert
  ON public.sku_price_tiers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.sku_price_tiers TO authenticated;
GRANT ALL ON public.sku_price_tiers TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Effective trade price with optional quantity tier
-- ---------------------------------------------------------------------------
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
  v_price numeric;
  v_qty numeric := COALESCE(p_quantity, 1);
BEGIN
  IF v_qty IS NULL OR v_qty <= 0 THEN
    v_qty := 1;
  END IF;

  -- Best open tier: highest min_quantity still <= order quantity
  SELECT st.unit_price
  INTO v_price
  FROM public.sku_price_tiers st
  WHERE st.sku_id = p_sku_id
    AND st.effective_from <= now()
    AND (st.effective_to IS NULL OR st.effective_to > now())
    AND st.min_quantity <= v_qty
  ORDER BY st.min_quantity DESC, st.effective_from DESC, st.created_at DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- Fallback: base sku_prices trade price
  SELECT sp.trade_price
  INTO v_price
  FROM public.sku_prices sp
  WHERE sp.sku_id = p_sku_id
    AND sp.effective_from <= now()
    AND (sp.effective_to IS NULL OR sp.effective_to > now())
  ORDER BY sp.effective_from DESC, sp.created_at DESC
  LIMIT 1;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'No effective trade price for SKU %', p_sku_id;
  END IF;
  RETURN v_price;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_sku_trade_price(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_sku_trade_price(uuid, numeric) TO authenticated, service_role;

-- Keep single-arg overload for backward compatibility
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

-- ---------------------------------------------------------------------------
-- 4. Admin RPC: replace open quantity tiers for a SKU
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_sku_price_tiers(
  p_sku_id uuid,
  p_tiers jsonb,
  p_recorded_by_profile_id uuid DEFAULT NULL
)
RETURNS SETOF public.sku_price_tiers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_recorded_by uuid := COALESCE(p_recorded_by_profile_id, auth.uid());
  v_tier jsonb;
  v_min_qty numeric;
  v_unit_price numeric;
  v_row public.sku_price_tiers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.skus WHERE id = p_sku_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;

  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' THEN
    RAISE EXCEPTION 'p_tiers must be a JSON array';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Close all open tiers
  UPDATE public.sku_price_tiers
  SET effective_to = v_now
  WHERE sku_id = p_sku_id
    AND effective_to IS NULL;

  -- Insert new tiers (skip min_quantity = 1 — that is the base sku_prices row)
  FOR v_tier IN SELECT * FROM jsonb_array_elements(p_tiers)
  LOOP
    v_min_qty := (v_tier->>'minQuantity')::numeric;
    v_unit_price := (v_tier->>'unitPrice')::numeric;

    IF v_min_qty IS NULL OR v_min_qty <= 1 THEN
      CONTINUE;
    END IF;
    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Tier unit price must be non-negative';
    END IF;

    INSERT INTO public.sku_price_tiers (
      sku_id, min_quantity, unit_price, currency, effective_from, recorded_by_profile_id
    )
    VALUES (
      p_sku_id, v_min_qty, v_unit_price, 'INR', v_now, v_recorded_by
    )
    RETURNING * INTO v_row;

    RETURN NEXT v_row;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_sku_price_tiers(uuid, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_set_sku_price_tiers(uuid, jsonb, uuid) IS
  'Trusted Admin: close open sku_price_tiers and insert new quantity tiers. Base price (qty 1) stays in sku_prices.';

-- ---------------------------------------------------------------------------
-- 5. Order RPCs: quantity-aware pricing (patch resolve calls only)
-- ---------------------------------------------------------------------------
-- place_customer_order — pass order quantity to tier resolver
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
    v_price := public.resolve_effective_sku_trade_price(v_sku_id, v_qty);

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
    v_price := public.resolve_effective_sku_trade_price(v_sku_id, v_qty);
    v_line_total := round(v_qty * v_price, 2);

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
