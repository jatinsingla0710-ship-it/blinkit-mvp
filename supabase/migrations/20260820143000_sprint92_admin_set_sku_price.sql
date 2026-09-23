-- Sprint 9.2 follow-up: simple Admin current-price write path.
-- Replaces scheduling-oriented Admin UX with Set/Update Price at "now".
-- Also recreates the prior trusted pricing RPCs so a single apply fixes
-- environments that never received 20260820121500_sprint92_pricing_admin_rpcs.sql.

-- ---------------------------------------------------------------------------
-- admin_close_sku_price (recreate for environments missing Sprint 92)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- admin_set_sku_price — primary Admin Set/Update Price RPC (effective now)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_sku_price(
  p_sku_id uuid,
  p_trade_price numeric,
  p_currency char(3) DEFAULT 'INR',
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
  v_now timestamptz := now();
  v_recorded_by uuid := COALESCE(p_recorded_by_profile_id, auth.uid());
  v_close_at timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_trade_price IS NULL OR p_trade_price < 0 THEN
    RAISE EXCEPTION 'Trade price must be a non-negative number';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.skus
    WHERE id = p_sku_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SKU not found';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT *
  INTO v_open
  FROM public.sku_prices
  WHERE sku_id = p_sku_id
    AND effective_to IS NULL
  FOR UPDATE;

  IF FOUND THEN
    -- Close prior open row strictly before the new effective_from.
    -- If the prior row started at/after now (clock skew / same-second),
    -- close at prior.effective_from + 1 microsecond and start the new row then.
    IF v_now <= v_open.effective_from THEN
      v_close_at := v_open.effective_from + interval '1 microsecond';
    ELSE
      v_close_at := v_now;
    END IF;

    UPDATE public.sku_prices
    SET effective_to = v_close_at
    WHERE id = v_open.id;

    v_now := v_close_at;
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
    v_now,
    v_recorded_by
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_sku_price(uuid, numeric, char(3), uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_set_sku_price(uuid, numeric, char(3), uuid) IS
  'Trusted Admin Set/Update Price. Atomically closes any open sku_prices row and inserts a new live row at now(). Append-only history preserved.';

-- ---------------------------------------------------------------------------
-- Keep admin_schedule_sku_price available for any legacy callers / older tests.
-- New Admin ERP path must use admin_set_sku_price.
-- ---------------------------------------------------------------------------
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
  'Legacy trusted schedule RPC. Prefer admin_set_sku_price for Admin ERP Set/Update Price.';
