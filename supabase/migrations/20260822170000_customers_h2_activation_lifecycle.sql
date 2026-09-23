-- Customers H2: invitation accept → ACTIVATED; sync FIRST_ORDER / REPEAT from orders.
-- Preserves accept_shop_invitation validation (auth, pending, expiry, mobile match).

CREATE OR REPLACE FUNCTION public.accept_shop_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.shop_invitations%ROWTYPE;
  v_mobile text;
  v_shop public.shops%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv
  FROM public.shop_invitations
  WHERE token = btrim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Invitation is not pending';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  SELECT mobile INTO v_mobile FROM public.profiles WHERE id = v_uid;
  IF v_mobile IS NULL OR public.normalize_mobile(v_mobile) <> public.normalize_mobile(v_inv.mobile) THEN
    RAISE EXCEPTION 'Invitation mobile does not match profile mobile';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_inv.shop_id FOR UPDATE;
  IF NOT FOUND OR v_shop.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  -- Ensure CUSTOMER role on profile
  UPDATE public.profiles
  SET roles = CASE
        WHEN roles @> ARRAY['CUSTOMER']::public.staff_role[] THEN roles
        ELSE array_append(roles, 'CUSTOMER'::public.staff_role)
      END,
      is_active = true,
      updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.shop_auth_links (shop_id, auth_user_id)
  VALUES (v_inv.shop_id, v_uid)
  ON CONFLICT (auth_user_id) DO UPDATE
    SET shop_id = EXCLUDED.shop_id,
        linked_at = now();

  UPDATE public.shop_invitations
  SET status = 'ACCEPTED'
  WHERE id = v_inv.id;

  -- Atomic with accept: LEAD/INVITED → ACTIVATED. Never activate on failed checks above.
  -- Do not demote FIRST_ORDER / REPEAT_CUSTOMER / INACTIVE.
  UPDATE public.shops
  SET lifecycle_status = CASE
        WHEN lifecycle_status IN (
          'LEAD'::public.shop_lifecycle_status,
          'INVITED'::public.shop_lifecycle_status
        ) THEN 'ACTIVATED'::public.shop_lifecycle_status
        ELSE lifecycle_status
      END,
      updated_at = now()
  WHERE id = v_inv.shop_id;

  PERFORM public.write_audit_log(
    'shop.invitation_accepted',
    'shop',
    v_inv.shop_id,
    jsonb_build_object(
      'invitationId', v_inv.id,
      'authUserId', v_uid,
      'lifecycleAfter', 'ACTIVATED'
    ),
    v_uid,
    'CUSTOMER'
  );

  RETURN v_inv.shop_id;
END;
$$;

COMMENT ON FUNCTION public.accept_shop_invitation(text) IS
  'Customers H2: accept invite + link auth; sets shops.lifecycle_status to ACTIVATED when LEAD/INVITED.';

-- Advance FIRST_ORDER / REPEAT_CUSTOMER from real order counts (existing enum only).
CREATE OR REPLACE FUNCTION public.sync_shop_lifecycle_from_orders(p_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_life public.shop_lifecycle_status;
  v_next public.shop_lifecycle_status;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN;
  END IF;

  SELECT lifecycle_status INTO v_life
  FROM public.shops
  WHERE id = p_shop_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only advance shops that are already activated (or further). Never skip ACTIVATED.
  IF v_life NOT IN (
    'ACTIVATED'::public.shop_lifecycle_status,
    'FIRST_ORDER'::public.shop_lifecycle_status,
    'REPEAT_CUSTOMER'::public.shop_lifecycle_status
  ) THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.orders o
  WHERE o.shop_id = p_shop_id
    AND o.status IS DISTINCT FROM 'CANCELLED';

  IF v_count >= 2 THEN
    v_next := 'REPEAT_CUSTOMER'::public.shop_lifecycle_status;
  ELSIF v_count = 1 THEN
    v_next := 'FIRST_ORDER'::public.shop_lifecycle_status;
  ELSE
    RETURN;
  END IF;

  IF v_next IS DISTINCT FROM v_life THEN
    UPDATE public.shops
    SET lifecycle_status = v_next,
        updated_at = now()
    WHERE id = p_shop_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_orders_sync_shop_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_shop_lifecycle_from_orders(NEW.shop_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_after_insert_sync_lifecycle ON public.orders;
CREATE TRIGGER trg_orders_after_insert_sync_lifecycle
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_sync_shop_lifecycle();

COMMENT ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) IS
  'Customers H2: ACTIVATED + 1 order → FIRST_ORDER; 2+ → REPEAT_CUSTOMER. No new columns.';
