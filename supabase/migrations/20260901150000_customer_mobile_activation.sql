-- Customer mobile OTP activation: ensure profile from auth phone, link to shop by verified mobile.
-- Separates digital access (shop_auth_links) from business operations (shops.is_active).

CREATE OR REPLACE FUNCTION public.ensure_customer_profile_from_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_display text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT phone, email INTO v_phone, v_email
  FROM auth.users
  WHERE id = v_uid;

  IF v_phone IS NULL OR btrim(v_phone) = '' THEN
    RAISE EXCEPTION 'Verified phone number required on auth account';
  END IF;

  v_phone := public.normalize_mobile(v_phone);
  v_display := coalesce(
    nullif(btrim(v_email), ''),
    'Customer ' || right(regexp_replace(v_phone, '\D', '', 'g'), 4)
  );

  INSERT INTO public.profiles (id, display_name, mobile, roles, is_active)
  VALUES (
    v_uid,
    v_display,
    v_phone,
    ARRAY['CUSTOMER']::public.staff_role[],
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    mobile = EXCLUDED.mobile,
    roles = CASE
      WHEN public.profiles.roles @> ARRAY['CUSTOMER']::public.staff_role[] THEN public.profiles.roles
      ELSE array_append(public.profiles.roles, 'CUSTOMER'::public.staff_role)
    END,
    is_active = true,
    updated_at = now();

  RETURN jsonb_build_object('profileId', v_uid, 'mobile', v_phone);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_customer_profile_from_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_customer_profile_from_auth() TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_link_verified_mobile(p_shop_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mobile text;
  v_existing_shop uuid;
  v_candidates jsonb := '[]'::jsonb;
  v_count int := 0;
  v_target uuid;
  v_inv public.shop_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_customer_profile_from_auth();

  SELECT mobile INTO v_mobile FROM public.profiles WHERE id = v_uid;
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Customer profile mobile is required';
  END IF;

  SELECT shop_id INTO v_existing_shop
  FROM public.shop_auth_links
  WHERE auth_user_id = v_uid;

  IF v_existing_shop IS NOT NULL THEN
    RETURN jsonb_build_object(
      'linked', true,
      'shopId', v_existing_shop,
      'alreadyLinked', true
    );
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'shopId', sh.id,
      'shopName', sh.trade_name
    ) ORDER BY sh.trade_name
  ), '[]'::jsonb), count(*)::int
  INTO v_candidates, v_count
  FROM public.shops sh
  JOIN public.shop_contacts sc
    ON sc.shop_id = sh.id AND sc.is_primary = true
  WHERE sh.deleted_at IS NULL
    AND sh.is_active = true
    AND public.normalize_mobile(sc.mobile) = public.normalize_mobile(v_mobile)
    AND NOT EXISTS (
      SELECT 1 FROM public.shop_auth_links sal
      WHERE sal.shop_id = sh.id
    );

  IF p_shop_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.shops sh
      JOIN public.shop_contacts sc
        ON sc.shop_id = sh.id AND sc.is_primary = true
      WHERE sh.id = p_shop_id
        AND sh.deleted_at IS NULL
        AND sh.is_active = true
        AND public.normalize_mobile(sc.mobile) = public.normalize_mobile(v_mobile)
        AND NOT EXISTS (
          SELECT 1 FROM public.shop_auth_links sal WHERE sal.shop_id = sh.id
        )
    ) THEN
      RAISE EXCEPTION 'Selected business is not available for this verified mobile number';
    END IF;
    v_target := p_shop_id;
  ELSIF v_count = 1 THEN
    v_target := (v_candidates->0->>'shopId')::uuid;
  ELSIF v_count = 0 THEN
    RETURN jsonb_build_object(
      'linked', false,
      'reason', 'no_matching_shop',
      'choices', '[]'::jsonb
    );
  ELSE
    RETURN jsonb_build_object(
      'linked', false,
      'reason', 'multiple_shops',
      'choices', v_candidates
    );
  END IF;

  INSERT INTO public.shop_auth_links (shop_id, auth_user_id)
  VALUES (v_target, v_uid);

  SELECT * INTO v_inv
  FROM public.shop_invitations
  WHERE shop_id = v_target
    AND status = 'PENDING'::public.shop_invitation_status
    AND public.normalize_mobile(mobile) = public.normalize_mobile(v_mobile)
  ORDER BY sent_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.shop_invitations
    SET status = 'ACCEPTED'::public.shop_invitation_status
    WHERE id = v_inv.id;
  END IF;

  UPDATE public.shops
  SET lifecycle_status = CASE
        WHEN lifecycle_status IN (
          'LEAD'::public.shop_lifecycle_status,
          'INVITED'::public.shop_lifecycle_status
        ) THEN 'ACTIVATED'::public.shop_lifecycle_status
        ELSE lifecycle_status
      END,
      updated_at = now()
  WHERE id = v_target;

  PERFORM public.write_audit_log(
    'shop.mobile_activation_linked',
    'shop',
    v_target,
    jsonb_build_object('authUserId', v_uid, 'mobile', v_mobile),
    v_uid,
    'CUSTOMER'
  );

  RETURN jsonb_build_object(
    'linked', true,
    'shopId', v_target,
    'alreadyLinked', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_link_verified_mobile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_link_verified_mobile(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_customer_profile_from_auth() IS
  'Upsert profiles row from verified auth.users.phone after customer OTP login.';

COMMENT ON FUNCTION public.customer_link_verified_mobile(uuid) IS
  'Link authenticated customer to shop when verified mobile matches primary contact. Supports multi-shop selection via p_shop_id.';
