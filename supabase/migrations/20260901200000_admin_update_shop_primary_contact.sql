-- Admin: safely update primary shop contact (name, mobile, email).
-- Does not modify auth.users or shop_auth_links — activated customers keep
-- existing login until they verify the new number via OTP.

CREATE OR REPLACE FUNCTION public.admin_update_shop_primary_contact(
  p_shop_id uuid,
  p_name text,
  p_mobile text,
  p_email text DEFAULT NULL,
  p_acknowledge_activated_change boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contact public.shop_contacts%ROWTYPE;
  v_norm_mobile text;
  v_linked_mobile text;
  v_has_auth_link boolean;
  v_mobile_changed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop id is required';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Contact name is required';
  END IF;

  IF p_mobile IS NULL OR btrim(p_mobile) = '' THEN
    RAISE EXCEPTION 'Mobile number is required';
  END IF;

  v_norm_mobile := public.normalize_mobile(p_mobile);

  IF NOT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = p_shop_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  SELECT * INTO v_contact
  FROM public.shop_contacts
  WHERE shop_id = p_shop_id AND is_primary = true
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Primary contact not found for shop';
  END IF;

  v_mobile_changed :=
    public.normalize_mobile(v_contact.mobile) IS DISTINCT FROM v_norm_mobile;

  SELECT EXISTS (
    SELECT 1 FROM public.shop_auth_links sal
    WHERE sal.shop_id = p_shop_id
  ) INTO v_has_auth_link;

  IF v_has_auth_link THEN
    SELECT p.mobile INTO v_linked_mobile
    FROM public.shop_auth_links sal
    JOIN public.profiles p ON p.id = sal.auth_user_id
    WHERE sal.shop_id = p_shop_id
    LIMIT 1;

    IF v_mobile_changed AND NOT p_acknowledge_activated_change THEN
      RAISE EXCEPTION
        'Customer has digital access. Acknowledge that changing the contact mobile may require the customer to verify the new number before it becomes their login number.';
    END IF;
  END IF;

  UPDATE public.shop_contacts
  SET
    name = btrim(p_name),
    mobile = v_norm_mobile,
    email = NULLIF(btrim(COALESCE(p_email, '')), ''),
    updated_at = now()
  WHERE id = v_contact.id;

  -- Expire pending legacy invitations tied to old mobile.
  UPDATE public.shop_invitations
  SET status = 'EXPIRED', updated_at = now()
  WHERE shop_id = p_shop_id
    AND status = 'PENDING';

  UPDATE public.shops
  SET updated_at = now()
  WHERE id = p_shop_id;

  PERFORM public.write_audit_log(
    'shop.primary_contact_updated',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'contactId', v_contact.id,
      'mobileChanged', v_mobile_changed,
      'hasAuthLink', v_has_auth_link,
      'linkedLoginMobile', v_linked_mobile,
      'newContactMobile', v_norm_mobile
    ),
    v_uid,
    'ADMIN'::public.staff_role
  );

  RETURN jsonb_build_object(
    'shopId', p_shop_id,
    'contactMobile', v_norm_mobile,
    'linkedLoginMobile', v_linked_mobile,
    'hasDigitalAccess', v_has_auth_link,
    'mobileChanged', v_mobile_changed,
    'contactMatchesLogin',
      CASE
        WHEN v_linked_mobile IS NULL THEN true
        ELSE public.normalize_mobile(v_linked_mobile) = v_norm_mobile
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_shop_primary_contact(uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_shop_primary_contact(uuid, text, text, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_update_shop_primary_contact(uuid, text, text, text, boolean) IS
  'Admin updates primary shop contact. Does not change auth.users.phone or shop_auth_links.';
