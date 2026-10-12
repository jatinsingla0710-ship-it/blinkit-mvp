-- Phase 5G.1 — opening-stock inflation guard.
-- Reject positive opening when on-hand already exists without an opening_stock
-- RECEIPT (e.g. after purchase receive or admin adjustment).
-- Preserves idempotent replay, duplicate-opening rejection, WAC trigger,
-- append-only ledger, and zero-qty balance init (still no movement / no
-- persisted client_request_id — inventing a marker would change hasOpeningStock
-- and idempotency semantics).

CREATE OR REPLACE FUNCTION public.admin_set_sku_opening_stock(
  p_sku_id uuid,
  p_operational_location_id uuid,
  p_quantity numeric,
  p_as_of_date date,
  p_unit_cost numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_client_request_id text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor_profile_id, auth.uid());
  v_request_id text := nullif(btrim(coalesce(p_client_request_id, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_balance public.inventory_balances%ROWTYPE;
  v_existing public.inventory_movements%ROWTYPE;
  v_opening public.inventory_movements%ROWTYPE;
  v_movement_id uuid;
  v_as_of timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_sku_id IS NULL OR p_operational_location_id IS NULL THEN
    RAISE EXCEPTION 'SKU and warehouse are required' USING ERRCODE = '22023';
  END IF;

  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'Opening stock as-of date is required' USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 0 THEN
    RAISE EXCEPTION 'Opening quantity must be a non-negative number'
      USING ERRCODE = '22023';
  END IF;

  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost must be non-negative' USING ERRCODE = '22023';
  END IF;

  IF v_request_id IS NOT NULL AND char_length(v_request_id) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'client_request_id must be 8–128 characters'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.skus
    WHERE id = p_sku_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SKU not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.operational_locations
    WHERE id = p_operational_location_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  v_as_of := p_as_of_date::timestamptz;

  -- Idempotent replay via client_request_id (scoped by actor)
  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.inventory_movements
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.movement_type IS DISTINCT FROM 'RECEIPT'::public.inventory_movement_type
         OR coalesce(v_existing.reference_type, '') IS DISTINCT FROM 'opening_stock'
         OR v_existing.sku_id IS DISTINCT FROM p_sku_id
         OR v_existing.operational_location_id IS DISTINCT FROM p_operational_location_id
      THEN
        RAISE EXCEPTION
          'client_request_id already used for a different inventory operation'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing.quantity_delta IS DISTINCT FROM p_quantity::numeric(12, 3) THEN
        RAISE EXCEPTION
          'client_request_id already used with a different opening quantity'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing.unit_cost IS DISTINCT FROM p_unit_cost THEN
        RAISE EXCEPTION
          'client_request_id already used with a different unit cost'
          USING ERRCODE = '23505';
      END IF;

      IF date_trunc('day', v_existing.created_at)
         IS DISTINCT FROM date_trunc('day', p_as_of_date::timestamptz)
      THEN
        RAISE EXCEPTION
          'client_request_id already used with a different as-of date'
          USING ERRCODE = '23505';
      END IF;

      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE sku_id = p_sku_id
        AND operational_location_id = p_operational_location_id;

      RETURN jsonb_build_object(
        'skuId', p_sku_id,
        'operationalLocationId', p_operational_location_id,
        'quantity', p_quantity,
        'asOfDate', p_as_of_date,
        'unitCost', p_unit_cost,
        'movementId', v_existing.id,
        'balanceId', v_balance.id,
        'onHandQuantity', coalesce(v_balance.on_hand_quantity, 0),
        'averageUnitCost', v_balance.average_unit_cost,
        'stockValue', coalesce(v_balance.stock_value, 0),
        'idempotentReplay', true,
        'created', false
      );
    END IF;
  END IF;

  -- Ensure balance row exists, then lock SKU × location for atomic guard + write.
  INSERT INTO public.inventory_balances (
    sku_id, operational_location_id, on_hand_quantity, reserved_quantity
  )
  VALUES (p_sku_id, p_operational_location_id, 0, 0)
  ON CONFLICT (sku_id, operational_location_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE sku_id = p_sku_id
    AND operational_location_id = p_operational_location_id
  FOR UPDATE;

  SELECT * INTO v_opening
  FROM public.inventory_movements
  WHERE sku_id = p_sku_id
    AND operational_location_id = p_operational_location_id
    AND reference_type = 'opening_stock'
    AND movement_type = 'RECEIPT'::public.inventory_movement_type
  LIMIT 1;

  IF FOUND THEN
    IF v_opening.quantity_delta = p_quantity
       AND (
         (p_unit_cost IS NULL AND v_opening.unit_cost IS NULL)
         OR v_opening.unit_cost IS NOT DISTINCT FROM p_unit_cost
       )
    THEN
      RETURN jsonb_build_object(
        'skuId', p_sku_id,
        'operationalLocationId', p_operational_location_id,
        'quantity', p_quantity,
        'asOfDate', p_as_of_date,
        'unitCost', p_unit_cost,
        'movementId', v_opening.id,
        'balanceId', v_balance.id,
        'onHandQuantity', coalesce(v_balance.on_hand_quantity, 0),
        'averageUnitCost', v_balance.average_unit_cost,
        'stockValue', coalesce(v_balance.stock_value, 0),
        'idempotentReplay', true,
        'created', false
      );
    END IF;

    RAISE EXCEPTION
      'Opening stock already set for this SKU and warehouse; use admin_adjust_inventory_balance to correct'
      USING ERRCODE = '23505';
  END IF;

  -- Inflation guard: stock already recorded by another path (purchase, adjust, …).
  IF coalesce(v_balance.on_hand_quantity, 0) > 0 THEN
    RAISE EXCEPTION
      'Stock already exists for this SKU and warehouse without opening stock; use admin_adjust_inventory_balance to correct'
      USING ERRCODE = '23505';
  END IF;

  -- Zero quantity: initialize balance only (no movement, no client_request_id row).
  IF p_quantity = 0 THEN
    RETURN jsonb_build_object(
      'skuId', p_sku_id,
      'operationalLocationId', p_operational_location_id,
      'quantity', 0,
      'asOfDate', p_as_of_date,
      'unitCost', p_unit_cost,
      'movementId', NULL,
      'balanceId', v_balance.id,
      'onHandQuantity', coalesce(v_balance.on_hand_quantity, 0),
      'averageUnitCost', v_balance.average_unit_cost,
      'stockValue', coalesce(v_balance.stock_value, 0),
      'idempotentReplay', false,
      'created', false
    );
  END IF;

  UPDATE public.inventory_balances
  SET on_hand_quantity = on_hand_quantity + p_quantity,
      updated_at = now()
  WHERE id = v_balance.id
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
    client_request_id,
    created_at
  )
  VALUES (
    p_sku_id,
    p_operational_location_id,
    'RECEIPT'::public.inventory_movement_type,
    p_quantity,
    COALESCE(v_note, 'Opening stock'),
    'opening_stock',
    p_sku_id,
    v_actor,
    p_unit_cost,
    v_request_id,
    v_as_of
  )
  RETURNING id INTO v_movement_id;

  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE id = v_balance.id;

  RETURN jsonb_build_object(
    'skuId', p_sku_id,
    'operationalLocationId', p_operational_location_id,
    'quantity', p_quantity,
    'asOfDate', p_as_of_date,
    'unitCost', p_unit_cost,
    'movementId', v_movement_id,
    'balanceId', v_balance.id,
    'onHandQuantity', v_balance.on_hand_quantity,
    'averageUnitCost', v_balance.average_unit_cost,
    'stockValue', v_balance.stock_value,
    'idempotentReplay', false,
    'created', true
  );
END;
$$;

COMMENT ON FUNCTION public.admin_set_sku_opening_stock(
  uuid, uuid, numeric, date, numeric, text, text, uuid
) IS
  'Admin opening stock on existing inventory ledger (RECEIPT + WAC). '
  'Idempotent via client_request_id / same qty+cost. Zero qty skips movement. '
  'INFLATION GUARD: rejects when on-hand > 0 without an opening_stock RECEIPT '
  '(purchase/adjust stock must use admin_adjust_inventory_balance). '
  'CORRECTION POLICY: never rewrite or duplicate the original opening RECEIPT. '
  'After opening is set, stock discrepancies must use admin_adjust_inventory_balance '
  '(append-only ADMIN_ADJUSTMENT). No accounting journal (deferred). '
  'Optional p_client_request_id is idempotent per actor for the same sku/location/'
  'quantity/unit_cost/as-of; reuse with different parameters is rejected. '
  'as-of date is stored as inventory_movements.created_at (historical business date; '
  'wall-clock insert time is not separately retained). '
  'Zero-qty init still creates no movement and does not persist client_request_id.';
