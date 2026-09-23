-- Sprint 9.2: trusted Admin pricing RPCs.
-- Required because sku_prices is append-only and direct UPDATEs to effective_to
-- are rejected unless groaurum.trusted_server_action=true inside a trusted server action.

CREATE OR REPLACE FUNCTION public.admin_close_sku_price(
  p_price_id uuid,
  p_effective_to timestamptz DEFAULT now()
)
RETURNS public.sku_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price public.sku_prices%ROWTYPE;
  v_effective_to timestamptz := COALESCE(p_effective_to, now());
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT *
  INTO v_price
  FROM public.sku_prices
  WHERE id = p_price_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU price not found';
  END IF;

  IF v_price.effective_to IS NOT NULL THEN
    RAISE EXCEPTION 'SKU price is already closed';
  END IF;

  IF v_effective_to <= v_price.effective_from THEN
    RAISE EXCEPTION 'Close timestamp must be later than effective_from';
  END IF;

  UPDATE public.sku_prices
  SET effective_to = v_effective_to
  WHERE id = p_price_id
  RETURNING * INTO v_price;

  RETURN v_price;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_close_sku_price(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.admin_close_sku_price(uuid, timestamptz) IS
  'Trusted Admin close for an open sku_prices row. Only effective_to may change.';

CREATE OR REPLACE FUNCTION public.admin_schedule_sku_price(
  p_sku_id uuid,
  p_trade_price numeric,
  p_currency char(3) DEFAULT 'INR',
  p_effective_from timestamptz DEFAULT now(),
  p_recorded_by_profile_id uuid DEFAULT NULL
)
RETURNS public.sku_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open public.sku_prices%ROWTYPE;
  v_created public.sku_prices%ROWTYPE;
  v_effective_from timestamptz := COALESCE(p_effective_from, now());
  v_recorded_by uuid := COALESCE(p_recorded_by_profile_id, auth.uid());
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT *
  INTO v_open
  FROM public.sku_prices
  WHERE sku_id = p_sku_id
    AND effective_to IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_effective_from <= v_open.effective_from THEN
      RAISE EXCEPTION 'Replacement price must start after the current open price effective_from';
    END IF;

    UPDATE public.sku_prices
    SET effective_to = v_effective_from
    WHERE id = v_open.id;
  END IF;

  INSERT INTO public.sku_prices (
    sku_id,
    trade_price,
    currency,
    effective_from,
    recorded_by_profile_id
  )
  VALUES (
    p_sku_id,
    p_trade_price,
    upper(COALESCE(p_currency, 'INR')),
    v_effective_from,
    v_recorded_by
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_schedule_sku_price(uuid, numeric, char(3), timestamptz, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_schedule_sku_price(uuid, numeric, char(3), timestamptz, uuid) IS
  'Trusted Admin create/replace for sku_prices. Closes the prior open row at the new effective_from and inserts a new row.';
