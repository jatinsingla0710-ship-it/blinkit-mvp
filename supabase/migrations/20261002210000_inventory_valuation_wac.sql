-- Phase 4 — Inventory valuation (Weighted Average Cost).
-- Adds cost basis on balances + movements; maintains WAC on every stock movement.
-- Does NOT post COGS to P&L (Phase 5). Does NOT create double-entry journals (Phase 6).

-- ─── Schema ──────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS average_unit_cost numeric(14, 4),
  ADD COLUMN IF NOT EXISTS stock_value numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_balances
  DROP CONSTRAINT IF EXISTS inventory_balances_average_unit_cost_non_negative,
  DROP CONSTRAINT IF EXISTS inventory_balances_stock_value_non_negative;

ALTER TABLE public.inventory_balances
  ADD CONSTRAINT inventory_balances_average_unit_cost_non_negative
    CHECK (average_unit_cost IS NULL OR average_unit_cost >= 0),
  ADD CONSTRAINT inventory_balances_stock_value_non_negative
    CHECK (stock_value >= 0);

COMMENT ON COLUMN public.inventory_balances.average_unit_cost IS
  'Weighted average unit cost (WAC) for this SKU × warehouse. NULL when no cost basis.';
COMMENT ON COLUMN public.inventory_balances.stock_value IS
  'On-hand stock value at WAC: round(on_hand_quantity * average_unit_cost, 2).';

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14, 4);

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_unit_cost_non_negative;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_unit_cost_non_negative
    CHECK (unit_cost IS NULL OR unit_cost >= 0);

COMMENT ON COLUMN public.inventory_movements.unit_cost IS
  'Unit cost applied on this movement. Receipts use purchase cost; issues use WAC at time of issue.';

-- ─── WAC trigger (runs after qty is updated, before/with movement insert) ─────

CREATE OR REPLACE FUNCTION public.inventory_movements_apply_wac()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_old_qty numeric(12, 3);
  v_new_qty numeric(12, 3);
  v_delta numeric(12, 3);
  v_unit_cost numeric(14, 4);
  v_old_value numeric(14, 2);
  v_new_value numeric(14, 2);
  v_new_avg numeric(14, 4);
BEGIN
  v_delta := NEW.quantity_delta;

  SELECT *
  INTO v_bal
  FROM public.inventory_balances
  WHERE sku_id = NEW.sku_id
    AND operational_location_id = NEW.operational_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Callers update on_hand before inserting the movement.
  v_new_qty := v_bal.on_hand_quantity;
  v_old_qty := v_new_qty - v_delta;
  v_old_value := coalesce(v_bal.stock_value, 0);

  IF v_delta > 0 THEN
    v_unit_cost := NEW.unit_cost;
    IF v_unit_cost IS NULL THEN
      v_unit_cost := v_bal.average_unit_cost;
    END IF;

    IF v_unit_cost IS NULL THEN
      -- Inbound with no cost basis: quantity rises, value stays (honest gap).
      RETURN NEW;
    END IF;

    NEW.unit_cost := v_unit_cost;
    v_new_value := round(v_old_value + (v_delta * v_unit_cost), 2);

    IF v_new_qty > 0 THEN
      v_new_avg := round(v_new_value / v_new_qty, 4);
    ELSE
      v_new_avg := NULL;
      v_new_value := 0;
    END IF;
  ELSE
    v_unit_cost := coalesce(NEW.unit_cost, v_bal.average_unit_cost);
    IF v_unit_cost IS NOT NULL THEN
      NEW.unit_cost := v_unit_cost;
    END IF;

    IF v_new_qty <= 0 THEN
      v_new_avg := NULL;
      v_new_value := 0;
    ELSIF v_bal.average_unit_cost IS NULL THEN
      -- Outbound with no cost basis: leave value as-is.
      RETURN NEW;
    ELSE
      v_new_avg := v_bal.average_unit_cost;
      v_new_value := round(v_new_qty * v_new_avg, 2);
    END IF;
  END IF;

  UPDATE public.inventory_balances
  SET
    average_unit_cost = v_new_avg,
    stock_value = v_new_value,
    updated_at = now()
  WHERE id = v_bal.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_movements_apply_wac ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_apply_wac
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_movements_apply_wac();

COMMENT ON FUNCTION public.inventory_movements_apply_wac() IS
  'Phase 4 WAC: receipts blend purchase unit_cost into average_unit_cost/stock_value; '
  'issues reduce stock_value at current average and stamp movement.unit_cost.';

-- ─── Purchase receive writes unit_cost on RECEIPT movements ───────────────────

CREATE OR REPLACE FUNCTION public.admin_receive_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases;
  v_item public.purchase_items%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_actor uuid := auth.uid();
  v_movements integer := 0;
  v_qty_total numeric(12, 3) := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can receive purchases' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_purchase.status = 'RECEIVED'::public.purchase_status THEN
    RETURN jsonb_build_object(
      'purchaseId', v_purchase.id,
      'status', v_purchase.status,
      'alreadyReceived', true,
      'movementCount', 0,
      'totalQuantity', 0
    );
  END IF;

  IF v_purchase.status <> 'DRAFT'::public.purchase_status THEN
    RAISE EXCEPTION 'Only draft purchases can be received'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_items pi WHERE pi.purchase_id = p_purchase_id
  ) THEN
    RAISE EXCEPTION 'Purchase has no items' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operational_locations ol
    WHERE ol.id = v_purchase.operational_location_id
      AND ol.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id
    ORDER BY created_at ASC, id ASC
  LOOP
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_item.sku_id
      AND operational_location_id = v_purchase.operational_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.inventory_balances (
        sku_id,
        operational_location_id,
        on_hand_quantity,
        reserved_quantity,
        average_unit_cost,
        stock_value
      )
      VALUES (
        v_item.sku_id,
        v_purchase.operational_location_id,
        0,
        0,
        NULL,
        0
      )
      RETURNING * INTO v_balance;

      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE id = v_balance.id
      FOR UPDATE;
    END IF;

    UPDATE public.inventory_balances
    SET on_hand_quantity = on_hand_quantity + v_item.quantity
    WHERE id = v_balance.id
    RETURNING * INTO v_balance;

    INSERT INTO public.inventory_movements (
      sku_id,
      operational_location_id,
      movement_type,
      quantity_delta,
      unit_cost,
      reason,
      reference_type,
      reference_id,
      actor_profile_id
    )
    VALUES (
      v_item.sku_id,
      v_purchase.operational_location_id,
      'RECEIPT'::public.inventory_movement_type,
      v_item.quantity,
      v_item.unit_cost,
      format(
        'Purchase bill %s · cost %s',
        v_purchase.bill_number,
        v_item.unit_cost::text
      ),
      'purchase_item',
      v_item.id,
      v_actor
    );

    v_movements := v_movements + 1;
    v_qty_total := v_qty_total + v_item.quantity;
  END LOOP;

  UPDATE public.purchases
  SET
    status = 'RECEIVED'::public.purchase_status,
    received_at = now(),
    received_by_profile_id = v_actor
  WHERE id = p_purchase_id
  RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'purchaseId', v_purchase.id,
    'status', v_purchase.status,
    'alreadyReceived', false,
    'movementCount', v_movements,
    'totalQuantity', v_qty_total,
    'receivedAt', v_purchase.received_at
  );
END;
$$;

COMMENT ON FUNCTION public.admin_receive_purchase IS
  'Marks DRAFT purchase RECEIVED, writes RECEIPT movements with unit_cost, and '
  'updates WAC stock valuation via inventory_movements_apply_wac. Idempotent on retry.';

-- ─── Opening seed from last received purchase cost (per SKU × warehouse) ─────

UPDATE public.inventory_balances b
SET
  average_unit_cost = seed.unit_cost,
  stock_value = round(b.on_hand_quantity * seed.unit_cost, 2),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (pi.sku_id, p.operational_location_id)
    pi.sku_id,
    p.operational_location_id,
    pi.unit_cost
  FROM public.purchase_items pi
  INNER JOIN public.purchases p ON p.id = pi.purchase_id
  WHERE p.status = 'RECEIVED'::public.purchase_status
  ORDER BY
    pi.sku_id,
    p.operational_location_id,
    p.received_at DESC NULLS LAST,
    p.updated_at DESC,
    pi.created_at DESC
) seed
WHERE b.sku_id = seed.sku_id
  AND b.operational_location_id = seed.operational_location_id
  AND b.on_hand_quantity > 0
  AND b.average_unit_cost IS NULL;
