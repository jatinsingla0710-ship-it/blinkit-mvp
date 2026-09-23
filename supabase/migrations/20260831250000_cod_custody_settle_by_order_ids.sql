-- COD custody settle/confirm by order_id selection (not amount matching).
-- Root cause: admin_settle_delivery_cod greedily applied only full WITH_DRIVER
-- rows where row.amount <= p_amount. Entering an aggregate or any amount smaller
-- than every open collection raised:
--   "No matching WITH_DRIVER COD custody found for this amount"
-- Schema: delivery_cod_custody.order_id is PK — one full collection per order.
-- Partial split of a single custody row is NOT supported; select whole rows only.

-- ─── Manager receives selected collections from Delivery Boy ─────────────────
CREATE OR REPLACE FUNCTION public.admin_settle_delivery_cod_selected(
  p_delivery_profile_id uuid,
  p_order_ids uuid[],
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
  v_ids uuid[];
  v_expected int;
  v_locked int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_delivery_profile_id IS NULL THEN
    RAISE EXCEPTION 'Delivery profile is required';
  END IF;

  SELECT array_agg(x ORDER BY x)
  INTO v_ids
  FROM (
    SELECT DISTINCT x
    FROM unnest(coalesce(p_order_ids, ARRAY[]::uuid[])) AS x
    WHERE x IS NOT NULL
  ) d;

  v_expected := coalesce(cardinality(v_ids), 0);
  IF v_expected = 0 THEN
    RAISE EXCEPTION 'Select at least one COD collection to receive';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Lock selected rows first (no aggregate + FOR UPDATE).
  v_locked := 0;
  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE order_id = ANY (v_ids)
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    IF v_row.delivery_profile_id IS DISTINCT FROM p_delivery_profile_id
       OR v_row.status IS DISTINCT FROM 'WITH_DRIVER'::public.delivery_cod_custody_status THEN
      RAISE EXCEPTION
        'One or more selected collections are missing, already settled, or belong to another delivery boy';
    END IF;
    v_locked := v_locked + 1;
  END LOOP;

  IF v_locked <> v_expected THEN
    RAISE EXCEPTION
      'One or more selected collections are missing, already settled, or belong to another delivery boy';
  END IF;

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, stage, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id,
    (
      SELECT coalesce(sum(c.amount), 0)
      FROM public.delivery_cod_custody c
      WHERE c.order_id = ANY (v_ids)
    ),
    nullif(btrim(p_reference), ''),
    nullif(btrim(p_note), ''),
    'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
    'FROM_DRIVER',
    v_uid
  )
  RETURNING id INTO v_settlement_id;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE order_id = ANY (v_ids)
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.delivery_cod_custody
    SET status = 'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
        settlement_id = v_settlement_id,
        updated_at = now()
    WHERE order_id = v_row.order_id
      AND status = 'WITH_DRIVER'::public.delivery_cod_custody_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Duplicate receive blocked for order %', v_row.order_id;
    END IF;

    PERFORM public._record_cod_custody_event(
      v_row.order_id, v_row.payment_id, v_row.delivery_profile_id,
      v_settlement_id,
      'WITH_DRIVER'::public.delivery_cod_custody_status,
      'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
      v_row.amount, v_uid, coalesce(p_note, 'Received from delivery boy')
    );

    v_applied := v_applied + v_row.amount;
    v_orders := array_append(v_orders, v_row.order_id);
  END LOOP;

  IF v_applied <= 0 THEN
    RAISE EXCEPTION 'No WITH_DRIVER COD custody updated for selection';
  END IF;

  UPDATE public.delivery_cod_settlements
  SET amount = v_applied
  WHERE id = v_settlement_id;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders),
    'toStatus', 'RECEIVED_BY_MANAGER',
    'stage', 'FROM_DRIVER'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_settle_delivery_cod_selected(uuid, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_settle_delivery_cod_selected(uuid, uuid[], text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_settle_delivery_cod_selected(uuid, uuid[], text, text) IS
  'Manager receives selected WITH_DRIVER custody rows by order_id. No amount matching.';

-- ─── Owner confirms selected manager-held collections ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_confirm_owner_cod_receipt_selected(
  p_delivery_profile_id uuid,
  p_order_ids uuid[],
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
  v_ids uuid[];
  v_expected int;
  v_locked int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_delivery_profile_id IS NULL THEN
    RAISE EXCEPTION 'Delivery profile is required';
  END IF;

  SELECT array_agg(x ORDER BY x)
  INTO v_ids
  FROM (
    SELECT DISTINCT x
    FROM unnest(coalesce(p_order_ids, ARRAY[]::uuid[])) AS x
    WHERE x IS NOT NULL
  ) d;

  v_expected := coalesce(cardinality(v_ids), 0);
  IF v_expected = 0 THEN
    RAISE EXCEPTION 'Select at least one COD collection to confirm';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  v_locked := 0;
  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE order_id = ANY (v_ids)
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    IF v_row.delivery_profile_id IS DISTINCT FROM p_delivery_profile_id
       OR v_row.status IS DISTINCT FROM 'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status THEN
      RAISE EXCEPTION
        'One or more selected collections are missing, not with manager, or belong to another delivery boy';
    END IF;
    v_locked := v_locked + 1;
  END LOOP;

  IF v_locked <> v_expected THEN
    RAISE EXCEPTION
      'One or more selected collections are missing, not with manager, or belong to another delivery boy';
  END IF;

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, stage, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id,
    (
      SELECT coalesce(sum(c.amount), 0)
      FROM public.delivery_cod_custody c
      WHERE c.order_id = ANY (v_ids)
    ),
    nullif(btrim(p_reference), ''),
    nullif(btrim(p_note), ''),
    'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
    'TO_OWNER',
    v_uid
  )
  RETURNING id INTO v_settlement_id;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE order_id = ANY (v_ids)
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    UPDATE public.delivery_cod_custody
    SET status = 'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
        settlement_id = v_settlement_id,
        updated_at = now()
    WHERE order_id = v_row.order_id
      AND status = 'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Duplicate owner confirm blocked for order %', v_row.order_id;
    END IF;

    PERFORM public._record_cod_custody_event(
      v_row.order_id, v_row.payment_id, v_row.delivery_profile_id,
      v_settlement_id,
      'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
      'RECEIVED_BY_OWNER'::public.delivery_cod_custody_status,
      v_row.amount, v_uid, coalesce(p_note, 'Confirmed by owner / company')
    );

    v_applied := v_applied + v_row.amount;
    v_orders := array_append(v_orders, v_row.order_id);
  END LOOP;

  IF v_applied <= 0 THEN
    RAISE EXCEPTION 'No RECEIVED_BY_MANAGER COD custody updated for selection';
  END IF;

  UPDATE public.delivery_cod_settlements
  SET amount = v_applied
  WHERE id = v_settlement_id;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders),
    'toStatus', 'RECEIVED_BY_OWNER',
    'stage', 'TO_OWNER'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_owner_cod_receipt_selected(uuid, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_owner_cod_receipt_selected(uuid, uuid[], text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_confirm_owner_cod_receipt_selected(uuid, uuid[], text, text) IS
  'Owner confirms selected RECEIVED_BY_MANAGER custody rows by order_id. No amount matching.';

-- Harden legacy amount RPCs: clearer error; still FIFO full-rows only (compat).
CREATE OR REPLACE FUNCTION public.admin_settle_delivery_cod(
  p_delivery_profile_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_remaining numeric;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
  v_open_count int;
  v_min_open numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT count(*)::int, min(c.amount)
  INTO v_open_count, v_min_open
  FROM public.delivery_cod_custody c
  WHERE c.delivery_profile_id = p_delivery_profile_id
    AND c.status = 'WITH_DRIVER'::public.delivery_cod_custody_status;

  IF coalesce(v_open_count, 0) = 0 THEN
    RAISE EXCEPTION 'No WITH_DRIVER COD custody found for this delivery boy';
  END IF;

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, stage, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id, p_amount,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
    'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
    'FROM_DRIVER',
    v_uid
  )
  RETURNING id INTO v_settlement_id;

  v_remaining := p_amount;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE delivery_profile_id = p_delivery_profile_id
      AND status = 'WITH_DRIVER'::public.delivery_cod_custody_status
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_row.amount <= v_remaining THEN
      UPDATE public.delivery_cod_custody
      SET status = 'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
          settlement_id = v_settlement_id,
          updated_at = now()
      WHERE order_id = v_row.order_id
        AND status = 'WITH_DRIVER'::public.delivery_cod_custody_status;

      IF FOUND THEN
        PERFORM public._record_cod_custody_event(
          v_row.order_id, v_row.payment_id, v_row.delivery_profile_id,
          v_settlement_id,
          'WITH_DRIVER'::public.delivery_cod_custody_status,
          'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status,
          v_row.amount, v_uid, coalesce(p_note, 'Received from delivery boy')
        );
        v_remaining := v_remaining - v_row.amount;
        v_applied := v_applied + v_row.amount;
        v_orders := array_append(v_orders, v_row.order_id);
      END IF;
    END IF;
  END LOOP;

  IF v_applied = 0 THEN
    RAISE EXCEPTION
      'Amount ₹% is less than every open collection (smallest ₹%). Select collections by order instead of matching an amount.',
      p_amount, v_min_open;
  END IF;

  IF v_applied < p_amount THEN
    UPDATE public.delivery_cod_settlements
    SET amount = v_applied,
        note = coalesce(note || ' · ', '') || format('Applied %s of requested %s', v_applied, p_amount)
    WHERE id = v_settlement_id;
  END IF;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders),
    'toStatus', 'RECEIVED_BY_MANAGER',
    'stage', 'FROM_DRIVER'
  );
END;
$$;

COMMENT ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) IS
  'Legacy amount FIFO settle. Prefer admin_settle_delivery_cod_selected (order_ids).';
