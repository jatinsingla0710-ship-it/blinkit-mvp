-- 1) Safe category ensure (lookup-first, handles concurrent duplicate name inserts)
-- 2) Outer-unit quantity discount tiers (₹ off per Bag/Box/Carton when buying more outers)

-- ---------------------------------------------------------------------------
-- admin_ensure_category — reuse existing category by normalized name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ensure_category(
  p_name text,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(p_name);
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF v_name IS NULL OR char_length(v_name) = 0 THEN
    RAISE EXCEPTION 'Category name is required';
  END IF;

  SELECT id INTO v_id
  FROM public.categories
  WHERE lower(btrim(name)) = lower(v_name)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF p_is_active THEN
      UPDATE public.categories SET is_active = true WHERE id = v_id AND NOT is_active;
    END IF;
    RETURN v_id;
  END IF;

  BEGIN
    INSERT INTO public.categories (name, is_active)
    VALUES (v_name, COALESCE(p_is_active, true))
    RETURNING id INTO v_id;
    RETURN v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id
    FROM public.categories
    WHERE lower(btrim(name)) = lower(v_name)
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_id IS NULL THEN
      RAISE;
    END IF;
    RETURN v_id;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ensure_category(text, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_ensure_category(text, boolean) IS
  'Admin: return existing category id by normalized name, or insert safely.';

-- ---------------------------------------------------------------------------
-- Outer quantity discount tiers (discount ₹ per outer unit at min quantity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sku_outer_discount_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus(id),
  min_outer_quantity integer NOT NULL,
  discount_per_outer_unit numeric(12, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'INR',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  recorded_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_outer_discount_tiers_min_qty_positive CHECK (min_outer_quantity > 0),
  CONSTRAINT sku_outer_discount_tiers_discount_non_negative CHECK (discount_per_outer_unit >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS sku_outer_discount_tiers_open_min_unique
  ON public.sku_outer_discount_tiers (sku_id, min_outer_quantity)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS sku_outer_discount_tiers_sku_open_idx
  ON public.sku_outer_discount_tiers (sku_id, min_outer_quantity DESC)
  WHERE effective_to IS NULL;

COMMENT ON TABLE public.sku_outer_discount_tiers IS
  'Quantity discount on outer selling units (Bag/Box/Carton). discount_per_outer_unit × outer count.';

ALTER TABLE public.sku_outer_discount_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sku_outer_discount_tiers_select_authenticated
  ON public.sku_outer_discount_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY sku_outer_discount_tiers_admin_insert
  ON public.sku_outer_discount_tiers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.sku_outer_discount_tiers TO authenticated;
GRANT ALL ON public.sku_outer_discount_tiers TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_sku_outer_discount_tiers_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sku_outer_discount_tiers is append-only';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sku_id IS DISTINCT FROM OLD.sku_id
      OR NEW.min_outer_quantity IS DISTINCT FROM OLD.min_outer_quantity
      OR NEW.discount_per_outer_unit IS DISTINCT FROM OLD.discount_per_outer_unit
      OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
    THEN
      RAISE EXCEPTION 'sku_outer_discount_tiers commercial fields are append-only';
    END IF;
    IF NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
      IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Closing tiers requires groaurum.trusted_server_action=true';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sku_outer_discount_tiers_append ON public.sku_outer_discount_tiers;
CREATE TRIGGER trg_sku_outer_discount_tiers_append
  BEFORE UPDATE ON public.sku_outer_discount_tiers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sku_outer_discount_tiers_append_only();

DROP TRIGGER IF EXISTS trg_sku_outer_discount_tiers_no_delete ON public.sku_outer_discount_tiers;
CREATE TRIGGER trg_sku_outer_discount_tiers_no_delete
  BEFORE DELETE ON public.sku_outer_discount_tiers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sku_outer_discount_tiers_append_only();

CREATE OR REPLACE FUNCTION public.admin_set_sku_outer_discount_tiers(
  p_sku_id uuid,
  p_tiers jsonb,
  p_recorded_by_profile_id uuid DEFAULT NULL
)
RETURNS SETOF public.sku_outer_discount_tiers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_recorded_by uuid := COALESCE(p_recorded_by_profile_id, auth.uid());
  v_tier jsonb;
  v_min_qty integer;
  v_discount numeric;
  v_row public.sku_outer_discount_tiers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.skus WHERE id = p_sku_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;
  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' THEN
    RAISE EXCEPTION 'p_tiers must be a JSON array';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  UPDATE public.sku_outer_discount_tiers
  SET effective_to = v_now
  WHERE sku_id = p_sku_id AND effective_to IS NULL;

  FOR v_tier IN SELECT * FROM jsonb_array_elements(p_tiers)
  LOOP
    v_min_qty := (v_tier->>'minOuterQuantity')::integer;
    v_discount := (v_tier->>'discountPerOuterUnit')::numeric;
    IF v_min_qty IS NULL OR v_min_qty <= 0 THEN
      CONTINUE;
    END IF;
    IF v_discount IS NULL OR v_discount < 0 THEN
      RAISE EXCEPTION 'Discount per outer unit must be non-negative';
    END IF;
    INSERT INTO public.sku_outer_discount_tiers (
      sku_id, min_outer_quantity, discount_per_outer_unit, currency,
      effective_from, recorded_by_profile_id
    )
    VALUES (p_sku_id, v_min_qty, v_discount, 'INR', v_now, v_recorded_by)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_sku_outer_discount_tiers(uuid, jsonb, uuid) TO authenticated;

-- Best open tier: highest min_outer_quantity <= outer unit count
CREATE OR REPLACE FUNCTION public.resolve_outer_qty_discount_per_unit(
  p_sku_id uuid,
  p_outer_quantity integer
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT t.discount_per_outer_unit
      FROM public.sku_outer_discount_tiers t
      WHERE t.sku_id = p_sku_id
        AND t.effective_from <= now()
        AND (t.effective_to IS NULL OR t.effective_to > now())
        AND t.min_outer_quantity <= GREATEST(p_outer_quantity, 0)
      ORDER BY t.min_outer_quantity DESC, t.effective_from DESC, t.created_at DESC
      LIMIT 1
    ),
    0::numeric
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_outer_qty_discount_per_unit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_outer_qty_discount_per_unit(uuid, integer) TO authenticated, service_role;

-- Line total: base outer/pack split at list prices, minus outer qty tier discount
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
  v_container_regular numeric;
  v_ppo integer;
  v_containers integer;
  v_loose numeric;
  v_subtotal numeric;
  v_discount_per_outer numeric;
  v_qty_discount numeric;
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

  v_ppo := v_sku.packs_per_carton;
  IF v_ppo IS NULL OR v_ppo <= 0 THEN
    RETURN round(v_qty * v_pack_regular, 2);
  END IF;

  v_container_regular := public.resolve_sku_container_regular_price(p_sku_id);
  v_containers := floor(v_qty / v_ppo)::integer;
  v_loose := v_qty - (v_containers * v_ppo);

  v_subtotal := round(
    (v_containers * v_container_regular) + (v_loose * v_pack_regular),
    2
  );

  v_discount_per_outer := public.resolve_outer_qty_discount_per_unit(p_sku_id, v_containers);
  v_qty_discount := round(v_containers * v_discount_per_outer, 2);

  IF v_qty_discount > v_subtotal THEN
    RAISE EXCEPTION 'Quantity discount exceeds line subtotal';
  END IF;

  RETURN round(v_subtotal - v_qty_discount, 2);
END;
$$;
