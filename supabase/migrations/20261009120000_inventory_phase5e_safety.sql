-- Phase 5E — Inventory backend safety fixes.
-- 1) Narrow customer inventory read to available qty projection (RPC).
-- 2) client_request_id idempotency on admin_adjust_inventory_balance.
-- 3) Document opening-stock correction policy (COMMENT).
-- Preserves balances/movements/WAC; no FIFO; no UI changes.

-- ─── 1) Customer / staff available-stock projection (no warehouse/cost leakage) ─

CREATE OR REPLACE FUNCTION public.list_sku_available_quantity(
  p_sku_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  sku_id uuid,
  available_quantity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.profile_has_role('SALESMAN')
    OR public.profile_has_role('DELIVERY')
    OR public.profile_has_role('CUSTOMER')
  ) THEN
    RAISE EXCEPTION 'Not authorized to read stock availability'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ib.sku_id,
    coalesce(sum(ib.available_quantity), 0)::numeric(12, 3) AS available_quantity
  FROM public.inventory_balances ib
  WHERE p_sku_ids IS NULL
     OR ib.sku_id = ANY (p_sku_ids)
  GROUP BY ib.sku_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_sku_available_quantity(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_sku_available_quantity(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.list_sku_available_quantity(uuid[]) IS
  'Phase 5E: returns aggregated available_quantity per SKU for catalogue/cart. '
  'Does not expose warehouse ids, on_hand, reserved, WAC, or stock_value. '
  'Authorized for admin, salesman, delivery, and customer roles only.';

-- Customers no longer SELECT inventory_balances rows (warehouse/cost leakage).
-- Catalogue uses list_sku_available_quantity. Staff keep select_staff policy.
DROP POLICY IF EXISTS inventory_balances_select_customer ON public.inventory_balances;

-- ─── 2) admin_adjust_inventory_balance — client_request_id idempotency ────────

DROP FUNCTION IF EXISTS public.admin_adjust_inventory_balance(uuid, numeric, text, uuid, numeric);

CREATE OR REPLACE FUNCTION public.admin_adjust_inventory_balance(
  p_balance_id uuid,
  p_new_on_hand_quantity numeric,
  p_reason text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL,
  p_client_request_id text DEFAULT NULL
)
RETURNS public.inventory_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.inventory_balances%ROWTYPE;
  v_delta numeric(12, 3);
  v_actor uuid := COALESCE(p_actor_profile_id, auth.uid());
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_unit_cost numeric(14, 4);
  v_request_id text := nullif(btrim(coalesce(p_client_request_id, '')), '');
  v_existing public.inventory_movements%ROWTYPE;
  v_ref_type text;
  v_stored_target numeric(12, 3);
  v_stored_unit numeric(14, 4);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_balance_id IS NULL THEN
    RAISE EXCEPTION 'Inventory balance id is required';
  END IF;

  IF p_new_on_hand_quantity IS NULL OR p_new_on_hand_quantity < 0 THEN
    RAISE EXCEPTION 'On-hand quantity must be a non-negative number';
  END IF;

  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost must be non-negative' USING ERRCODE = '22023';
  END IF;

  IF v_request_id IS NOT NULL AND char_length(v_request_id) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'client_request_id must be 8–128 characters'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Idempotent replay via client_request_id (scoped by actor)
  IF v_request_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.inventory_movements
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.movement_type IS DISTINCT FROM 'ADMIN_ADJUSTMENT'::public.inventory_movement_type
         OR v_existing.reference_id IS DISTINCT FROM p_balance_id
         OR coalesce(v_existing.reference_type, '') NOT LIKE 'admin_adjust_target:%'
      THEN
        RAISE EXCEPTION
          'client_request_id already used for a different inventory operation'
          USING ERRCODE = '23505';
      END IF;

      v_stored_target := nullif(
        split_part(v_existing.reference_type, ':', 2),
        ''
      )::numeric(12, 3);

      IF v_stored_target IS DISTINCT FROM p_new_on_hand_quantity THEN
        RAISE EXCEPTION
          'client_request_id already used with a different on-hand target'
          USING ERRCODE = '23505';
      END IF;

      -- Inbound adjustments may carry unit_cost; outbound stores NULL.
      v_stored_unit := v_existing.unit_cost;
      IF v_existing.quantity_delta > 0 THEN
        IF v_stored_unit IS DISTINCT FROM p_unit_cost THEN
          RAISE EXCEPTION
            'client_request_id already used with a different unit cost'
            USING ERRCODE = '23505';
        END IF;
      ELSIF p_unit_cost IS NOT NULL THEN
        -- Outbound ignore cost; reject only if caller insists on a different inbound cost story
        NULL;
      END IF;

      SELECT *
      INTO v_balance
      FROM public.inventory_balances
      WHERE id = p_balance_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory balance not found';
      END IF;

      RETURN v_balance;
    END IF;
  END IF;

  SELECT *
  INTO v_balance
  FROM public.inventory_balances
  WHERE id = p_balance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.skus
    WHERE id = v_balance.sku_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operational_locations
    WHERE id = v_balance.operational_location_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Operational location not found';
  END IF;

  IF p_new_on_hand_quantity < v_balance.reserved_quantity THEN
    RAISE EXCEPTION
      'Cannot set on-hand (%) below reserved stock (%) for this warehouse',
      p_new_on_hand_quantity,
      v_balance.reserved_quantity;
  END IF;

  v_delta := p_new_on_hand_quantity - v_balance.on_hand_quantity;

  IF v_delta = 0 THEN
    RETURN v_balance;
  END IF;

  -- Inbound adjustments may carry cost; outbound ignores provided cost (WAC issues).
  v_unit_cost := CASE WHEN v_delta > 0 THEN p_unit_cost ELSE NULL END;
  v_ref_type := 'admin_adjust_target:' || trim_scale(p_new_on_hand_quantity)::text;

  UPDATE public.inventory_balances
  SET on_hand_quantity = p_new_on_hand_quantity
  WHERE id = p_balance_id
  RETURNING * INTO v_balance;

  INSERT INTO public.inventory_movements (
    sku_id,
    operational_location_id,
    movement_type,
    quantity_delta,
    reason,
    reference_type,
    reference_id,
    actor_profile_id,
    unit_cost,
    client_request_id
  )
  VALUES (
    v_balance.sku_id,
    v_balance.operational_location_id,
    'ADMIN_ADJUSTMENT',
    v_delta,
    COALESCE(v_reason, 'Admin adjustment'),
    v_ref_type,
    p_balance_id,
    v_actor,
    v_unit_cost,
    v_request_id
  );

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_inventory_balance(
  uuid, numeric, text, uuid, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory_balance(
  uuid, numeric, text, uuid, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.admin_adjust_inventory_balance(
  uuid, numeric, text, uuid, numeric, text
) IS
  'Trusted Admin inventory adjustment. Optional p_unit_cost applies only on inbound '
  'deltas for WAC (omit = do not invent cost). Outbound uses existing WAC via trigger. '
  'Optional p_client_request_id (8–128) is idempotent per actor; reuse with different '
  'target/cost/balance is rejected. FOR UPDATE + reserved-stock protection preserved. '
  'Prior 5-arg callers remain compatible via DEFAULT NULL on p_client_request_id.';

-- ─── 3) Opening stock correction policy (documentation only) ─────────────────

COMMENT ON FUNCTION public.admin_set_sku_opening_stock(
  uuid, uuid, numeric, date, numeric, text, text, uuid
) IS
  'Admin opening stock on existing inventory ledger (RECEIPT + WAC). '
  'Idempotent via client_request_id / same qty+cost. Zero qty skips movement. '
  'CORRECTION POLICY: never rewrite or duplicate the original opening RECEIPT. '
  'After opening is set, stock discrepancies must use admin_adjust_inventory_balance '
  '(append-only ADMIN_ADJUSTMENT). No accounting journal (deferred).';
