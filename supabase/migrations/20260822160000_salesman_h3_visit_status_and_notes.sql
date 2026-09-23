-- Salesman H3: admin update sales_visit status (PLANNED/PENDING → VISITED|MISSED).
-- Auth user creation stays in edge function provision-salesman (service role).

CREATE OR REPLACE FUNCTION public.admin_update_sales_visit_status(
  p_visit_id uuid,
  p_status public.sales_visit_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visit public.sales_visits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_visit_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'Visit id and status are required';
  END IF;

  IF p_status NOT IN ('VISITED', 'MISSED') THEN
    RAISE EXCEPTION 'Admin may only set VISITED or MISSED';
  END IF;

  SELECT * INTO v_visit
  FROM public.sales_visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;

  IF v_visit.status NOT IN ('PLANNED', 'PENDING') THEN
    RAISE EXCEPTION 'Visit is not open (current: %)', v_visit.status;
  END IF;

  UPDATE public.sales_visits
  SET
    status = p_status,
    visited_at = CASE
      WHEN p_status = 'VISITED' THEN COALESCE(visited_at, now())
      ELSE visited_at
    END,
    updated_at = now()
  WHERE id = p_visit_id
  RETURNING * INTO v_visit;

  PERFORM public.write_audit_log(
    'sales_visit.status_updated_admin',
    'sales_visit',
    p_visit_id,
    jsonb_build_object(
      'status', p_status,
      'salesmanProfileId', v_visit.salesman_profile_id,
      'shopId', v_visit.shop_id
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'visitId', v_visit.id,
    'status', v_visit.status,
    'visitedAt', v_visit.visited_at,
    'salesmanProfileId', v_visit.salesman_profile_id,
    'shopId', v_visit.shop_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_sales_visit_status(uuid, public.sales_visit_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_sales_visit_status(uuid, public.sales_visit_status) TO authenticated;

COMMENT ON FUNCTION public.admin_update_sales_visit_status(uuid, public.sales_visit_status) IS
  'Salesman H3: admin marks PLANNED/PENDING sales_visits as VISITED (sets visited_at) or MISSED.';
