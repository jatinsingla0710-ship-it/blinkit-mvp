-- Phase 5B — Product + Inventory backend / data fixes.
-- Adds SKU MRP, barcode, min_stock_quantity; opening-stock RPC; optional adjust cost;
-- damage write-off RPC; clarifies archive/deactivate column semantics.
-- Preserves SKU → sku_prices → inventory_balances/movements + WAC architecture.
-- Does NOT create accounting journals for opening inventory (deferred).

-- ─── 1) SKU commercial / stock-threshold fields ───────────────────────────────

ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS mrp numeric(12, 2),
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS min_stock_quantity numeric(12, 3);

ALTER TABLE public.skus
  DROP CONSTRAINT IF EXISTS skus_mrp_non_negative,
  DROP CONSTRAINT IF EXISTS skus_min_stock_quantity_non_negative;

ALTER TABLE public.skus
  ADD CONSTRAINT skus_mrp_non_negative
    CHECK (mrp IS NULL OR mrp >= 0),
  ADD CONSTRAINT skus_min_stock_quantity_non_negative
    CHECK (min_stock_quantity IS NULL OR min_stock_quantity >= 0);

COMMENT ON COLUMN public.skus.mrp IS
  'Maximum retail price (optional). Does not replace trade_price or purchase cost.';
COMMENT ON COLUMN public.skus.barcode IS
  'Normalized barcode/GTIN (optional). Unique among active, non-deleted SKUs. Does not replace sku_code.';
COMMENT ON COLUMN public.skus.min_stock_quantity IS
  'Persisted reorder/minimum threshold in selling units. NULL or 0 = not configured (no fake low-stock heuristic).';

COMMENT ON COLUMN public.products.is_active IS
  'ACTIVE vs INACTIVE/DRAFT: true = published/orderable when otherwise ready; false = inactive/draft (not orderable). Soft-delete (deleted_at) means ARCHIVED.';
COMMENT ON COLUMN public.products.deleted_at IS
  'ARCHIVED when set. Soft-delete removes from normal catalogue views; historical sales/order lines remain.';
COMMENT ON COLUMN public.skus.is_active IS
  'ACTIVE vs INACTIVE/DRAFT for this SKU. Soft-delete (deleted_at) means ARCHIVED.';
COMMENT ON COLUMN public.skus.deleted_at IS
  'ARCHIVED when set. Soft-delete removes from normal catalogue views; historical sales remain.';

CREATE OR REPLACE FUNCTION public.normalize_sku_barcode()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.barcode IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.barcode := nullif(lower(btrim(NEW.barcode)), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skus_normalize_barcode ON public.skus;
CREATE TRIGGER trg_skus_normalize_barcode
  BEFORE INSERT OR UPDATE OF barcode ON public.skus
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_sku_barcode();

-- Unique among sellable SKUs (active + not soft-deleted). Archived/inactive free the barcode.
DROP INDEX IF EXISTS public.skus_barcode_active_unique;
CREATE UNIQUE INDEX skus_barcode_active_unique
  ON public.skus (barcode)
  WHERE barcode IS NOT NULL
    AND deleted_at IS NULL
    AND is_active = true;

-- ─── 2) Movement idempotency helper column ────────────────────────────────────

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS client_request_id text;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_client_request_id_length;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_client_request_id_length
    CHECK (
      client_request_id IS NULL
      OR char_length(btrim(client_request_id)) BETWEEN 8 AND 128
    );

DROP INDEX IF EXISTS public.inventory_movements_actor_client_request_unique;
CREATE UNIQUE INDEX inventory_movements_actor_client_request_unique
  ON public.inventory_movements (actor_profile_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- One primary opening-stock RECEIPT per SKU × warehouse.
DROP INDEX IF EXISTS public.inventory_movements_opening_stock_one_per_sku_location;
CREATE UNIQUE INDEX inventory_movements_opening_stock_one_per_sku_location
  ON public.inventory_movements (sku_id, operational_location_id)
  WHERE reference_type = 'opening_stock'
    AND movement_type = 'RECEIPT'::public.inventory_movement_type;

COMMENT ON COLUMN public.inventory_movements.client_request_id IS
  'Optional idempotency key (8–128 chars) scoped by actor_profile_id.';

-- ─── 3) admin_adjust_inventory_balance — optional inbound unit_cost ───────────

DROP FUNCTION IF EXISTS public.admin_adjust_inventory_balance(uuid, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.admin_adjust_inventory_balance(
  p_balance_id uuid,
  p_new_on_hand_quantity numeric,
  p_reason text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL
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

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

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
    actor_profile_id,
    unit_cost
  )
  VALUES (
    v_balance.sku_id,
    v_balance.operational_location_id,
    'ADMIN_ADJUSTMENT',
    v_delta,
    COALESCE(v_reason, 'Admin adjustment'),
    v_actor,
    v_unit_cost
  );

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_inventory_balance(uuid, numeric, text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory_balance(uuid, numeric, text, uuid, numeric)
  TO authenticated;

COMMENT ON FUNCTION public.admin_adjust_inventory_balance(uuid, numeric, text, uuid, numeric) IS
  'Trusted Admin inventory adjustment. Optional p_unit_cost applies only on inbound deltas for WAC. Outbound uses existing WAC. Existing 4-arg callers remain compatible via DEFAULT NULL.';

-- ─── 4) admin_set_sku_opening_stock ───────────────────────────────────────────

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

  -- Idempotent replay via client_request_id
  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.inventory_movements
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
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

  SELECT * INTO v_opening
  FROM public.inventory_movements
  WHERE sku_id = p_sku_id
    AND operational_location_id = p_operational_location_id
    AND reference_type = 'opening_stock'
    AND movement_type = 'RECEIPT'::public.inventory_movement_type
  LIMIT 1;

  IF FOUND THEN
    -- Opening already recorded. Same quantity (+ cost) → semantic idempotency.
    -- Intentional correction must use admin_adjust_inventory_balance (existing primitive).
    IF v_opening.quantity_delta = p_quantity
       AND (
         (p_unit_cost IS NULL AND v_opening.unit_cost IS NULL)
         OR v_opening.unit_cost IS NOT DISTINCT FROM p_unit_cost
       )
    THEN
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

  -- Zero quantity: no meaningless movement (inventory value remains unset).
  IF p_quantity = 0 THEN
    INSERT INTO public.inventory_balances (
      sku_id, operational_location_id, on_hand_quantity, reserved_quantity
    )
    VALUES (p_sku_id, p_operational_location_id, 0, 0)
    ON CONFLICT (sku_id, operational_location_id) DO NOTHING;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = p_sku_id
      AND operational_location_id = p_operational_location_id;

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

REVOKE ALL ON FUNCTION public.admin_set_sku_opening_stock(
  uuid, uuid, numeric, date, numeric, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_sku_opening_stock(
  uuid, uuid, numeric, date, numeric, text, text, uuid
) TO authenticated;

COMMENT ON FUNCTION public.admin_set_sku_opening_stock(
  uuid, uuid, numeric, date, numeric, text, text, uuid
) IS
  'Admin opening stock on existing inventory ledger (RECEIPT + WAC). Idempotent via client_request_id / same qty. Zero qty skips movement. No accounting journal (deferred). Corrections use admin_adjust_inventory_balance.';

-- ─── 5) admin_record_sku_damage ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_record_sku_damage(
  p_sku_id uuid,
  p_operational_location_id uuid,
  p_quantity numeric,
  p_reason text,
  p_actor_profile_id uuid DEFAULT NULL,
  p_client_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor_profile_id, auth.uid());
  v_request_id text := nullif(btrim(coalesce(p_client_request_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_balance public.inventory_balances%ROWTYPE;
  v_existing public.inventory_movements%ROWTYPE;
  v_movement_id uuid;
  v_new_on_hand numeric(12, 3);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_sku_id IS NULL OR p_operational_location_id IS NULL THEN
    RAISE EXCEPTION 'SKU and warehouse are required' USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Damage quantity must be a positive number'
      USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Damage reason is required' USING ERRCODE = '22023';
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

  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.inventory_movements
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE sku_id = p_sku_id
        AND operational_location_id = p_operational_location_id;

      RETURN jsonb_build_object(
        'skuId', p_sku_id,
        'operationalLocationId', p_operational_location_id,
        'quantity', p_quantity,
        'movementId', v_existing.id,
        'balanceId', v_balance.id,
        'onHandQuantity', coalesce(v_balance.on_hand_quantity, 0),
        'idempotentReplay', true
      );
    END IF;
  END IF;

  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE sku_id = p_sku_id
    AND operational_location_id = p_operational_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance not found' USING ERRCODE = 'P0002';
  END IF;

  v_new_on_hand := v_balance.on_hand_quantity - p_quantity;

  IF v_new_on_hand < v_balance.reserved_quantity THEN
    RAISE EXCEPTION
      'Cannot damage stock below reserved quantity (%) for this warehouse',
      v_balance.reserved_quantity
      USING ERRCODE = '22023';
  END IF;

  IF v_new_on_hand < 0 THEN
    RAISE EXCEPTION 'Damage quantity exceeds on-hand stock' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory_balances
  SET on_hand_quantity = v_new_on_hand,
      updated_at = now()
  WHERE id = v_balance.id
  RETURNING * INTO v_balance;

  INSERT INTO public.inventory_movements (
    sku_id,
    operational_location_id,
    movement_type,
    quantity_delta,
    reason,
    actor_profile_id,
    client_request_id
  )
  VALUES (
    p_sku_id,
    p_operational_location_id,
    'DAMAGE'::public.inventory_movement_type,
    -p_quantity,
    v_reason,
    v_actor,
    v_request_id
  )
  RETURNING id INTO v_movement_id;

  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE id = v_balance.id;

  RETURN jsonb_build_object(
    'skuId', p_sku_id,
    'operationalLocationId', p_operational_location_id,
    'quantity', p_quantity,
    'movementId', v_movement_id,
    'balanceId', v_balance.id,
    'onHandQuantity', v_balance.on_hand_quantity,
    'averageUnitCost', v_balance.average_unit_cost,
    'stockValue', v_balance.stock_value,
    'idempotentReplay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_sku_damage(
  uuid, uuid, numeric, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_sku_damage(
  uuid, uuid, numeric, text, uuid, text
) TO authenticated;

COMMENT ON FUNCTION public.admin_record_sku_damage(
  uuid, uuid, numeric, text, uuid, text
) IS
  'Admin damage write-off on existing inventory ledger (DAMAGE movement). Decreases on-hand; preserves audit trail. No customer/accounting side effects.';
