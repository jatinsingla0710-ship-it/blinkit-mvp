-- Sprint 7: Salesman PWA — visits table + trusted RPCs for retailer create,
-- invitation, and assisted order placement (MOQ / stock / reserve).

CREATE TYPE public.sales_visit_status AS ENUM (
  'PLANNED',
  'VISITED',
  'PENDING',
  'MISSED'
);

CREATE TABLE public.sales_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  planned_at timestamptz NOT NULL DEFAULT now(),
  status public.sales_visit_status NOT NULL DEFAULT 'PLANNED',
  notes text,
  visited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_visits_visited_at_when_visited CHECK (
    (status = 'VISITED' AND visited_at IS NOT NULL)
    OR (status <> 'VISITED')
  )
);

CREATE INDEX sales_visits_salesman_planned_idx
  ON public.sales_visits (salesman_profile_id, planned_at DESC);

CREATE INDEX sales_visits_shop_idx
  ON public.sales_visits (shop_id);

CREATE INDEX sales_visits_status_idx
  ON public.sales_visits (status);

CREATE TRIGGER trg_sales_visits_set_updated_at
  BEFORE UPDATE ON public.sales_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_visits FORCE ROW LEVEL SECURITY;

CREATE POLICY sales_visits_select_scoped
  ON public.sales_visits
  FOR SELECT
  TO authenticated
  USING (
    public.profile_has_role('ADMIN')
    OR (
      public.profile_has_role('SALESMAN')
      AND salesman_profile_id = auth.uid()
      AND shop_id IN (SELECT public.salesman_shop_ids())
    )
  );

CREATE POLICY sales_visits_salesman_insert
  ON public.sales_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_role('SALESMAN')
    AND salesman_profile_id = auth.uid()
    AND shop_id IN (SELECT public.salesman_shop_ids())
  );

CREATE POLICY sales_visits_salesman_update
  ON public.sales_visits
  FOR UPDATE
  TO authenticated
  USING (
    public.profile_has_role('SALESMAN')
    AND salesman_profile_id = auth.uid()
  )
  WITH CHECK (
    public.profile_has_role('SALESMAN')
    AND salesman_profile_id = auth.uid()
    AND shop_id IN (SELECT public.salesman_shop_ids())
  );

CREATE POLICY sales_visits_admin_write
  ON public.sales_visits
  FOR ALL
  TO authenticated
  USING (public.profile_has_role('ADMIN'))
  WITH CHECK (public.profile_has_role('ADMIN'));

-- ---------------------------------------------------------------------------
-- Create retailer (shop + primary contact + assignment) for authenticated salesman
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salesman_create_retailer(
  p_trade_name text,
  p_primary_contact_name text,
  p_primary_contact_mobile text,
  p_delivery_address_line text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_pin_code text,
  p_service_area_id uuid DEFAULT NULL,
  p_legal_name text DEFAULT NULL
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
    delivery_pin_code
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
    p_delivery_pin_code
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
  text, text, text, text, text, text, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_create_retailer(
  text, text, text, text, text, text, text, uuid, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Generate invitation for an assigned shop
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salesman_create_invitation(
  p_shop_id uuid,
  p_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mobile text;
  v_token text;
  v_inv_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;

  IF p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  IF p_mobile IS NOT NULL AND btrim(p_mobile) <> '' THEN
    v_mobile := public.normalize_mobile(p_mobile);
  ELSE
    SELECT mobile INTO v_mobile
    FROM public.shop_contacts
    WHERE shop_id = p_shop_id AND is_primary
    LIMIT 1;
  END IF;

  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'No mobile available for invitation';
  END IF;

  -- Expire prior pending invites for this shop
  UPDATE public.shop_invitations
  SET status = 'EXPIRED'
  WHERE shop_id = p_shop_id
    AND status = 'PENDING';

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + interval '14 days';

  INSERT INTO public.shop_invitations (shop_id, mobile, token, status, expires_at)
  VALUES (p_shop_id, v_mobile, v_token, 'PENDING', v_expires)
  RETURNING id INTO v_inv_id;

  UPDATE public.shops
  SET lifecycle_status = CASE
        WHEN lifecycle_status = 'LEAD' THEN 'INVITED'::public.shop_lifecycle_status
        ELSE lifecycle_status
      END,
      updated_at = now()
  WHERE id = p_shop_id;

  RETURN jsonb_build_object(
    'invitationId', v_inv_id,
    'shopId', p_shop_id,
    'mobile', v_mobile,
    'token', v_token,
    'expiresAt', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_create_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_create_invitation(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Place assisted order on behalf of retailer (MOQ + stock + reserve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_assisted_order(
  p_shop_id uuid,
  p_service_area_id uuid,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_line jsonb;
  v_sku_id uuid;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_sku public.skus%ROWTYPE;
  v_product_name text;
  v_line_total numeric;
  v_balance public.inventory_balances%ROWTYPE;
  v_available numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;

  IF p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'agreedUnitPrice')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for SKU %', v_sku_id;
    END IF;

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id AND deleted_at IS NULL AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SKU % not orderable', v_sku_id;
    END IF;

    IF v_qty < v_sku.moq THEN
      RAISE EXCEPTION 'Quantity for % below MOQ %', v_sku.sku_code, v_sku.moq;
    END IF;

    IF mod(v_qty, v_sku.quantity_step) <> 0 THEN
      RAISE EXCEPTION 'Quantity for % must be in steps of %', v_sku.sku_code, v_sku.quantity_step;
    END IF;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_sku_id
    ORDER BY available_quantity DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory for SKU %', v_sku.sku_code;
    END IF;

    v_available := v_balance.available_quantity;
    IF v_qty > v_available THEN
      RAISE EXCEPTION 'Insufficient stock for % (available %)', v_sku.sku_code, v_available;
    END IF;

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  END LOOP;

  INSERT INTO public.orders (
    shop_id,
    service_area_id,
    source,
    created_by_profile_id,
    status,
    subtotal,
    adjustments,
    total
  )
  VALUES (
    p_shop_id,
    p_service_area_id,
    'SALESMAN_ASSISTED',
    v_uid,
    'DRAFT_ASSISTED',
    v_subtotal,
    0,
    v_subtotal
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'agreedUnitPrice')::numeric;
    v_line_total := round(v_qty * v_price, 2);

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_sku.product_id;

    INSERT INTO public.order_lines (
      order_id,
      sku_id,
      quantity,
      agreed_unit_price,
      line_total,
      product_name_snapshot,
      sku_code_snapshot,
      sku_name_snapshot,
      specification_snapshot,
      selling_unit_snapshot
    )
    VALUES (
      v_order_id,
      v_sku_id,
      v_qty,
      v_price,
      v_line_total,
      COALESCE(v_product_name, v_sku.name),
      v_sku.sku_code,
      v_sku.name,
      v_sku.specification,
      v_sku.selling_unit
    );

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_sku_id
    ORDER BY available_quantity DESC
    LIMIT 1
    FOR UPDATE;

    INSERT INTO public.stock_reservations (
      order_id,
      sku_id,
      operational_location_id,
      quantity,
      status
    )
    VALUES (
      v_order_id,
      v_sku_id,
      v_balance.operational_location_id,
      v_qty,
      'RESERVED'
    );

    UPDATE public.inventory_balances
    SET reserved_quantity = reserved_quantity + v_qty,
        updated_at = now()
    WHERE id = v_balance.id;
  END LOOP;

  UPDATE public.orders
  SET status = 'STOCK_RESERVED',
      updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid, NULL, 'DRAFT_ASSISTED', COALESCE(p_notes, 'Assisted order created by salesman')),
    (v_order_id, v_uid, 'DRAFT_ASSISTED', 'STOCK_RESERVED', 'Inventory reserved');

  -- Placeholder confirmation challenge (OTP workflow deferred; token recorded for audit)
  INSERT INTO public.order_confirmation_challenges (
    order_id,
    token,
    otp_hash,
    expires_at
  )
  VALUES (
    v_order_id,
    encode(extensions.gen_random_bytes(16), 'hex'),
    encode(extensions.digest('000000', 'sha256'), 'hex'),
    now() + interval '24 hours'
  );

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_assisted_order(uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_assisted_order(uuid, uuid, jsonb, text) TO authenticated;

COMMENT ON TABLE public.sales_visits IS
  'Sprint 7: field visit tracking for salesman PWA (planned / visited / pending / missed).';
COMMENT ON FUNCTION public.salesman_create_retailer IS
  'Sprint 7: salesman creates retailer shop + primary contact + assignment.';
COMMENT ON FUNCTION public.salesman_create_invitation IS
  'Sprint 7: salesman generates shop invitation token for customer onboarding.';
COMMENT ON FUNCTION public.place_assisted_order IS
  'Sprint 7: assisted order with MOQ/stock validation, reserve, and OTP challenge placeholder.';
