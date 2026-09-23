-- Track Customer App link shares separately from OTP activation (shop_auth_links).
-- WhatsApp/app link sharing does NOT activate the customer.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS last_app_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_app_link_sent_by_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.shops.last_app_link_sent_at IS
  'When admin/salesman last shared the Customer App link (WhatsApp etc). Not activation.';

CREATE OR REPLACE FUNCTION public.record_customer_app_link_sent(p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = p_shop_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF public.is_admin() THEN
    NULL;
  ELSIF public.profile_has_role('SALESMAN')
    AND p_shop_id IN (SELECT public.salesman_shop_ids()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized to record app link for this shop';
  END IF;

  UPDATE public.shops
  SET
    last_app_link_sent_at = now(),
    last_app_link_sent_by_profile_id = v_uid,
    updated_at = now()
  WHERE id = p_shop_id;

  PERFORM public.write_audit_log(
    'shop.app_link_sent',
    'shop',
    p_shop_id,
    jsonb_build_object('sentByProfileId', v_uid),
    v_uid,
    CASE WHEN public.is_admin() THEN 'ADMIN' ELSE 'SALESMAN' END::public.staff_role
  );

  RETURN jsonb_build_object(
    'shopId', p_shop_id,
    'sentAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_app_link_sent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_app_link_sent(uuid) TO authenticated;

COMMENT ON FUNCTION public.record_customer_app_link_sent(uuid) IS
  'Records that admin/salesman shared the Customer App link. Does not activate digital access.';
