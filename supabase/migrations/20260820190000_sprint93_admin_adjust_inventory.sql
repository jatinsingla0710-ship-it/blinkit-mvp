-- Inventory H3: atomic Admin on-hand adjustment via trusted RPC.
-- Balance update + ADMIN_ADJUSTMENT movement happen in one transaction.

CREATE OR REPLACE FUNCTION public.admin_adjust_inventory_balance(
  p_balance_id uuid,
  p_new_on_hand_quantity numeric,
  p_reason text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
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
    actor_profile_id
  )
  VALUES (
    v_balance.sku_id,
    v_balance.operational_location_id,
    'ADMIN_ADJUSTMENT',
    v_delta,
    COALESCE(v_reason, 'Admin adjustment'),
    v_actor
  );

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory_balance(
  uuid,
  numeric,
  text,
  uuid
) TO authenticated;

COMMENT ON FUNCTION public.admin_adjust_inventory_balance(uuid, numeric, text, uuid) IS
  'Trusted Admin inventory adjustment. Atomically updates inventory_balances.on_hand_quantity and inserts an ADMIN_ADJUSTMENT movement when delta <> 0. Rejects on-hand below reserved.';
