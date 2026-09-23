-- Admin-only earning model + SKU commission term changes.
-- Does not accrue, reverse, or alter existing ledger rows.

CREATE OR REPLACE FUNCTION public.admin_set_salesman_earning_model(
  p_profile_id uuid,
  p_earning_model public.salesman_earning_model
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.salesman_employment%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Valid SALESMAN profile is required';
  END IF;
  IF p_earning_model IS NULL THEN
    RAISE EXCEPTION 'earning_model is required';
  END IF;

  INSERT INTO public.salesman_employment (profile_id, earning_model)
  VALUES (p_profile_id, p_earning_model)
  ON CONFLICT (profile_id) DO UPDATE
  SET
    earning_model = EXCLUDED.earning_model,
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.earning_model_set',
    'salesman_employment',
    p_profile_id,
    jsonb_build_object('earningModel', v_row.earning_model),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'profileId', v_row.profile_id,
    'earningModel', v_row.earning_model
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_salesman_earning_model(
  uuid, public.salesman_earning_model
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_salesman_earning_model(
  uuid, public.salesman_earning_model
) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_set_salesman_earning_model IS
  'Admin sets salesman_employment.earning_model only. Does not change salary terms or commission ledger.';

CREATE OR REPLACE FUNCTION public.admin_set_sku_commission_term(
  p_sku_id uuid,
  p_fixed_amount_per_unit numeric,
  p_effective_from date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := COALESCE(p_effective_from, CURRENT_DATE);
  v_row public.sku_commission_terms%ROWTYPE;
  v_closed integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_sku_id IS NULL THEN
    RAISE EXCEPTION 'SKU is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.skus s
    WHERE s.id = p_sku_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;
  IF p_fixed_amount_per_unit IS NULL OR p_fixed_amount_per_unit < 0 THEN
    RAISE EXCEPTION 'fixed_amount_per_unit must be >= 0';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sku_commission_terms t
    WHERE t.sku_id = p_sku_id
      AND t.effective_to IS NULL
      AND t.effective_from >= v_from
  ) THEN
    RAISE EXCEPTION
      'An open commission term already starts on or after %', v_from;
  END IF;

  UPDATE public.sku_commission_terms
  SET effective_to = v_from - 1
  WHERE sku_id = p_sku_id
    AND effective_to IS NULL
    AND effective_from < v_from;
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  INSERT INTO public.sku_commission_terms (
    sku_id,
    fixed_amount_per_unit,
    effective_from,
    effective_to,
    created_by_profile_id
  )
  VALUES (
    p_sku_id,
    p_fixed_amount_per_unit,
    v_from,
    NULL,
    v_uid
  )
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'sku.commission_term_set',
    'sku_commission_terms',
    v_row.id,
    jsonb_build_object(
      'skuId', p_sku_id,
      'fixedAmountPerUnit', v_row.fixed_amount_per_unit,
      'effectiveFrom', v_row.effective_from,
      'closedOpenTerms', v_closed
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'skuId', v_row.sku_id,
    'fixedAmountPerUnit', v_row.fixed_amount_per_unit,
    'effectiveFrom', v_row.effective_from,
    'effectiveTo', v_row.effective_to,
    'closedOpenTerms', v_closed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_sku_commission_term(
  uuid, numeric, date
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_sku_commission_term(
  uuid, numeric, date
) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_set_sku_commission_term IS
  'Admin appends a SKU commission term and closes the prior open term. Does not rewrite history or salesman_commission_entries.';
