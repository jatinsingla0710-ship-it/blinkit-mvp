-- Sales PWA: allow assigned salesmen to save shop GPS on existing shops.delivery_lat/lng.
-- No schema changes — columns already exist on public.shops.
-- Extends salesman_create_retailer with optional lat/lng (backward-compatible defaults).

-- ─── A. Extend salesman_create_retailer ──────────────────────────────────────
-- DROP old signature: CREATE OR REPLACE cannot add parameters to an existing overload.

DROP FUNCTION IF EXISTS public.salesman_create_retailer(
  text, text, text, text, text, text, text, uuid, text
);

CREATE OR REPLACE FUNCTION public.salesman_create_retailer(
  p_trade_name text,
  p_primary_contact_name text,
  p_primary_contact_mobile text,
  p_delivery_address_line text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_pin_code text,
  p_service_area_id uuid DEFAULT NULL,
  p_legal_name text DEFAULT NULL,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop_id uuid;
  v_mobile text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;

  IF (p_delivery_lat IS NULL) <> (p_delivery_lng IS NULL) THEN
    RAISE EXCEPTION 'delivery_lat and delivery_lng must both be set or both null';
  END IF;
  IF p_delivery_lat IS NOT NULL AND (p_delivery_lat < -90 OR p_delivery_lat > 90) THEN
    RAISE EXCEPTION 'delivery_lat out of range';
  END IF;
  IF p_delivery_lng IS NOT NULL AND (p_delivery_lng < -180 OR p_delivery_lng > 180) THEN
    RAISE EXCEPTION 'delivery_lng out of range';
  END IF;

  v_mobile := public.normalize_mobile(p_primary_contact_mobile);

  INSERT INTO public.shops (
    trade_name,
    legal_name,
    lifecycle_status,
    service_area_id,
    assigned_salesman_profile_id,
    delivery_address_line,
    delivery_city,
    delivery_state,
    delivery_pin_code,
    delivery_lat,
    delivery_lng
  )
  VALUES (
    btrim(p_trade_name),
    NULLIF(btrim(COALESCE(p_legal_name, '')), ''),
    'LEAD',
    p_service_area_id,
    v_uid,
    btrim(p_delivery_address_line),
    btrim(p_delivery_city),
    btrim(p_delivery_state),
    p_delivery_pin_code,
    p_delivery_lat,
    p_delivery_lng
  )
  RETURNING id INTO v_shop_id;

  INSERT INTO public.shop_contacts (
    shop_id, name, mobile, is_primary
  )
  VALUES (
    v_shop_id,
    btrim(p_primary_contact_name),
    v_mobile,
    true
  );

  INSERT INTO public.shop_salesman_assignments (
    shop_id,
    salesman_profile_id,
    assigned_by_profile_id,
    reason
  )
  VALUES (
    v_shop_id,
    v_uid,
    v_uid,
    'Created by salesman via Sales PWA'
  );

  RETURN v_shop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_create_retailer(
  text, text, text, text, text, text, text, uuid, text, double precision, double precision
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_create_retailer(
  text, text, text, text, text, text, text, uuid, text, double precision, double precision
) TO authenticated;

COMMENT ON FUNCTION public.salesman_create_retailer IS
  'Salesman creates shop + primary contact + assignment; optional delivery_lat/lng on shops.';

-- ─── B. Update GPS on an assigned shop ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.salesman_set_shop_delivery_location(
  p_shop_id uuid,
  p_delivery_lat double precision,
  p_delivery_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop public.shops%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;

  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop id is required';
  END IF;

  IF p_delivery_lat IS NULL OR p_delivery_lng IS NULL THEN
    RAISE EXCEPTION 'delivery_lat and delivery_lng are required';
  END IF;
  IF p_delivery_lat < -90 OR p_delivery_lat > 90 THEN
    RAISE EXCEPTION 'delivery_lat out of range';
  END IF;
  IF p_delivery_lng < -180 OR p_delivery_lng > 180 THEN
    RAISE EXCEPTION 'delivery_lng out of range';
  END IF;

  IF p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  UPDATE public.shops
  SET
    delivery_lat = p_delivery_lat,
    delivery_lng = p_delivery_lng,
    updated_at = now()
  WHERE id = p_shop_id
    AND deleted_at IS NULL
  RETURNING * INTO v_shop;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  PERFORM public.write_audit_log(
    'shop.delivery_location_set',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'deliveryLat', v_shop.delivery_lat,
      'deliveryLng', v_shop.delivery_lng
    ),
    v_uid,
    'SALESMAN'
  );

  RETURN jsonb_build_object(
    'shopId', v_shop.id,
    'deliveryLat', v_shop.delivery_lat,
    'deliveryLng', v_shop.delivery_lng
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_set_shop_delivery_location(
  uuid, double precision, double precision
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_set_shop_delivery_location(
  uuid, double precision, double precision
) TO authenticated;

COMMENT ON FUNCTION public.salesman_set_shop_delivery_location IS
  'Assigned salesman sets shops.delivery_lat/lng (shop GPS, not visit check-in).';
