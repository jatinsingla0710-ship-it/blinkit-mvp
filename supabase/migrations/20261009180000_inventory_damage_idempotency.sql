-- Phase 5F.4 — harden admin_record_sku_damage client_request_id idempotency.
-- Same logical request (sku, location, quantity, reason) may replay.
-- Reuse with different parameters is rejected (aligns with admin_adjust).

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
      IF v_existing.movement_type IS DISTINCT FROM 'DAMAGE'::public.inventory_movement_type
         OR v_existing.sku_id IS DISTINCT FROM p_sku_id
         OR v_existing.operational_location_id IS DISTINCT FROM p_operational_location_id
      THEN
        RAISE EXCEPTION
          'client_request_id already used for a different inventory operation'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing.quantity_delta IS DISTINCT FROM (-p_quantity)::numeric(12, 3) THEN
        RAISE EXCEPTION
          'client_request_id already used with a different damage quantity'
          USING ERRCODE = '23505';
      END IF;

      IF nullif(btrim(coalesce(v_existing.reason, '')), '') IS DISTINCT FROM v_reason THEN
        RAISE EXCEPTION
          'client_request_id already used with a different damage reason'
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
        'movementId', v_existing.id,
        'balanceId', v_balance.id,
        'onHandQuantity', coalesce(v_balance.on_hand_quantity, 0),
        'averageUnitCost', v_balance.average_unit_cost,
        'stockValue', coalesce(v_balance.stock_value, 0),
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

COMMENT ON FUNCTION public.admin_record_sku_damage(
  uuid, uuid, numeric, text, uuid, text
) IS
  'Admin DAMAGE write-off. Decreases on_hand (never below reserved), inserts DAMAGE '
  'movement, WAC via inventory_movements_apply_wac. No sale/payment/customer ledger. '
  'Optional p_client_request_id is idempotent per actor for the same sku/location/'
  'quantity/reason; reuse with different parameters is rejected.';
