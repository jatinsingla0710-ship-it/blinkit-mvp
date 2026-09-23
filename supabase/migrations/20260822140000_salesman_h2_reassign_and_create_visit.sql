-- Salesman H2: atomic shop salesman reassignment + admin create sales visit.
-- Uses existing shop_salesman_assignments (history via effective_to) and sales_visits.
-- No new domain tables. Admin-only (is_admin()).

CREATE OR REPLACE FUNCTION public.admin_reassign_shop_salesman(
  p_shop_id uuid,
  p_new_salesman_profile_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop public.shops%ROWTYPE;
  v_salesman public.profiles%ROWTYPE;
  v_active public.shop_salesman_assignments%ROWTYPE;
  v_closed int := 0;
  v_reason text;
  v_assignment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_shop_id IS NULL OR p_new_salesman_profile_id IS NULL THEN
    RAISE EXCEPTION 'Shop id and new salesman profile id are required';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    v_reason := 'Reassigned by Admin';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF v_shop.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Shop is deleted';
  END IF;

  SELECT * INTO v_salesman
  FROM public.profiles
  WHERE id = p_new_salesman_profile_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salesman profile not found';
  END IF;
  IF NOT ('SALESMAN' = ANY (v_salesman.roles)) THEN
    RAISE EXCEPTION 'Profile is not a SALESMAN';
  END IF;
  IF v_salesman.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Salesman profile is inactive';
  END IF;

  SELECT * INTO v_active
  FROM public.shop_salesman_assignments
  WHERE shop_id = p_shop_id
    AND effective_to IS NULL
  FOR UPDATE;

  IF FOUND
     AND v_active.salesman_profile_id = p_new_salesman_profile_id THEN
    -- Keep denormalized column in sync if drifted.
    UPDATE public.shops
    SET assigned_salesman_profile_id = p_new_salesman_profile_id,
        updated_at = now()
    WHERE id = p_shop_id
      AND assigned_salesman_profile_id IS DISTINCT FROM p_new_salesman_profile_id;

    RETURN jsonb_build_object(
      'shopId', p_shop_id,
      'salesmanProfileId', p_new_salesman_profile_id,
      'assignmentId', v_active.id,
      'alreadyAssigned', true,
      'closedAssignmentCount', 0
    );
  END IF;

  UPDATE public.shop_salesman_assignments
  SET effective_to = now(),
      updated_at = now()
  WHERE shop_id = p_shop_id
    AND effective_to IS NULL;
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  INSERT INTO public.shop_salesman_assignments (
    shop_id,
    salesman_profile_id,
    assigned_by_profile_id,
    reason,
    effective_from
  )
  VALUES (
    p_shop_id,
    p_new_salesman_profile_id,
    v_uid,
    v_reason,
    now()
  )
  RETURNING id INTO v_assignment_id;

  -- Defensive sync (trigger also updates shops.assigned_salesman_profile_id).
  UPDATE public.shops
  SET assigned_salesman_profile_id = p_new_salesman_profile_id,
      updated_at = now()
  WHERE id = p_shop_id;

  PERFORM public.write_audit_log(
    'shop.salesman_reassigned_admin',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'newSalesmanProfileId', p_new_salesman_profile_id,
      'assignmentId', v_assignment_id,
      'closedAssignmentCount', v_closed,
      'reason', v_reason
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'shopId', p_shop_id,
    'salesmanProfileId', p_new_salesman_profile_id,
    'assignmentId', v_assignment_id,
    'alreadyAssigned', false,
    'closedAssignmentCount', v_closed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_shop_salesman(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reassign_shop_salesman(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_reassign_shop_salesman(uuid, uuid, text) IS
  'Salesman H2: atomically close active shop_salesman_assignments and open a new one; syncs shops.assigned_salesman_profile_id.';

-- Minimal admin create visit (PLANNED). No GPS / planner product.
CREATE OR REPLACE FUNCTION public.admin_create_sales_visit(
  p_salesman_profile_id uuid,
  p_shop_id uuid,
  p_planned_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_salesman public.profiles%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_visit_id uuid;
  v_planned timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_salesman_profile_id IS NULL OR p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Salesman profile id and shop id are required';
  END IF;

  v_planned := COALESCE(p_planned_at, now());

  SELECT * INTO v_salesman FROM public.profiles WHERE id = p_salesman_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salesman profile not found';
  END IF;
  IF NOT ('SALESMAN' = ANY (v_salesman.roles)) THEN
    RAISE EXCEPTION 'Profile is not a SALESMAN';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND OR v_shop.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF NOT (
    v_shop.assigned_salesman_profile_id = p_salesman_profile_id
    OR EXISTS (
      SELECT 1
      FROM public.shop_salesman_assignments ssa
      WHERE ssa.shop_id = p_shop_id
        AND ssa.salesman_profile_id = p_salesman_profile_id
        AND ssa.effective_to IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  INSERT INTO public.sales_visits (
    salesman_profile_id,
    shop_id,
    planned_at,
    status,
    notes
  )
  VALUES (
    p_salesman_profile_id,
    p_shop_id,
    v_planned,
    'PLANNED',
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_visit_id;

  PERFORM public.write_audit_log(
    'sales_visit.created_admin',
    'sales_visit',
    v_visit_id,
    jsonb_build_object(
      'salesmanProfileId', p_salesman_profile_id,
      'shopId', p_shop_id,
      'plannedAt', v_planned
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'visitId', v_visit_id,
    'salesmanProfileId', p_salesman_profile_id,
    'shopId', p_shop_id,
    'plannedAt', v_planned,
    'status', 'PLANNED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_sales_visit(uuid, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_sales_visit(uuid, uuid, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.admin_create_sales_visit(uuid, uuid, timestamptz, text) IS
  'Salesman H2: admin creates a PLANNED sales_visits row for an assigned shop; no GPS/maps/planner.';
