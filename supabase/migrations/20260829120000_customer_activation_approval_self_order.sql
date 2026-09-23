-- Customer activation harden + self-serve authoritative pricing +
-- assisted order AWAITING approval (no pre-approval stock reserve).
-- Reuses: shops, shop_invitations, shop_auth_links, orders, order_confirmation_challenges,
-- notification_outbox, sku_prices, stock_reservations. No new domain tables.

-- ---------------------------------------------------------------------------
-- 1. Effective trade price (global sku_prices only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_effective_sku_trade_price(p_sku_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
BEGIN
  SELECT sp.trade_price
  INTO v_price
  FROM public.sku_prices sp
  WHERE sp.sku_id = p_sku_id
    AND sp.effective_from <= now()
    AND (sp.effective_to IS NULL OR sp.effective_to > now())
  ORDER BY sp.effective_from DESC, sp.created_at DESC
  LIMIT 1;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'No effective trade price for SKU %', p_sku_id;
  END IF;
  RETURN v_price;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_sku_trade_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_sku_trade_price(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Inventory helpers (trusted callers only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reserve_order_inventory(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.order_lines%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_sku_code text;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  FOR v_line IN
    SELECT * FROM public.order_lines WHERE order_id = p_order_id
  LOOP
    SELECT sku_code INTO v_sku_code FROM public.skus WHERE id = v_line.sku_id;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_line.sku_id
    ORDER BY available_quantity DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory for SKU %', COALESCE(v_sku_code, v_line.sku_id::text);
    END IF;

    IF v_line.quantity > v_balance.available_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for % (available %)',
        COALESCE(v_sku_code, v_line.sku_id::text),
        v_balance.available_quantity;
    END IF;

    INSERT INTO public.stock_reservations (
      order_id, sku_id, operational_location_id, quantity, status
    )
    VALUES (
      p_order_id,
      v_line.sku_id,
      v_balance.operational_location_id,
      v_line.quantity,
      'RESERVED'
    );

    UPDATE public.inventory_balances
    SET reserved_quantity = reserved_quantity + v_line.quantity,
        updated_at = now()
    WHERE id = v_balance.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._release_order_inventory(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.stock_reservations%ROWTYPE;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  FOR v_res IN
    SELECT *
    FROM public.stock_reservations
    WHERE order_id = p_order_id
      AND status IN ('PENDING', 'RESERVED')
    FOR UPDATE
  LOOP
    UPDATE public.inventory_balances
    SET reserved_quantity = GREATEST(reserved_quantity - v_res.quantity, 0),
        updated_at = now()
    WHERE sku_id = v_res.sku_id
      AND operational_location_id = v_res.operational_location_id;

    UPDATE public.stock_reservations
    SET status = 'RELEASED',
        updated_at = now()
    WHERE id = v_res.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Shop notification enqueue (honest queue; no fake delivery)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._enqueue_shop_notification(
  p_shop_id uuid,
  p_template_key text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_channel public.notification_channel DEFAULT 'WHATSAPP'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mobile text;
  v_id uuid;
  v_payload jsonb;
BEGIN
  SELECT mobile INTO v_mobile
  FROM public.shop_contacts
  WHERE shop_id = p_shop_id AND is_primary
  LIMIT 1;

  IF v_mobile IS NULL THEN
    SELECT mobile INTO v_mobile
    FROM public.shop_invitations
    WHERE shop_id = p_shop_id
    ORDER BY sent_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  IF v_mobile IS NULL THEN
    SELECT p.mobile INTO v_mobile
    FROM public.shop_auth_links sal
    JOIN public.profiles p ON p.id = sal.auth_user_id
    WHERE sal.shop_id = p_shop_id
    LIMIT 1;
  END IF;

  IF v_mobile IS NULL OR btrim(v_mobile) = '' THEN
    v_mobile := format('shop:%s:unconfigured', p_shop_id);
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
    'shopId', p_shop_id,
    'providerDelivery', 'queued',
    'channelPreferred', p_channel::text
  );

  INSERT INTO public.notification_outbox (
    channel, template_key, recipient, payload, related_entity_type, related_entity_id, status
  )
  VALUES (
    p_channel,
    btrim(p_template_key),
    btrim(v_mobile),
    v_payload,
    p_related_entity_type,
    p_related_entity_id,
    'PENDING'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Issue / reissue confirmation challenge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._issue_order_confirmation_challenge(
  p_order_id uuid,
  p_template_key text DEFAULT 'order_approval_requested'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_challenge_id uuid;
  v_token text;
  v_expires timestamptz;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE public.order_confirmation_challenges
  SET status = 'EXPIRED',
      updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('PENDING', 'CUSTOMER_CONFIRMED', 'CUSTOMER_REQUESTED_CHANGES');

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + interval '24 hours';

  INSERT INTO public.order_confirmation_challenges (
    order_id, token, otp_hash, expires_at, status
  )
  VALUES (
    p_order_id, v_token, NULL, v_expires, 'PENDING'
  )
  RETURNING id INTO v_challenge_id;

  PERFORM public._enqueue_shop_notification(
    v_order.shop_id,
    p_template_key,
    jsonb_build_object(
      'orderId', p_order_id,
      'challengeId', v_challenge_id,
      'token', v_token,
      'expiresAt', v_expires,
      'approvalPath', format('/order-approval/%s', v_token)
    ),
    'order',
    p_order_id,
    'WHATSAPP'
  );

  RETURN v_challenge_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. place_customer_order — server prices; auto CONFIRMED → STOCK_RESERVED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_customer_order(
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

  IF NOT public.profile_has_role('CUSTOMER') THEN
    RAISE EXCEPTION 'Customer role required';
  END IF;

  IF p_shop_id NOT IN (SELECT public.customer_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not linked to this account';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    -- Ignore client agreedUnitPrice / totals — resolve from sku_prices.
    v_price := public.resolve_effective_sku_trade_price(v_sku_id);

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
    shop_id, service_area_id, source, created_by_profile_id,
    status, subtotal, adjustments, total
  )
  VALUES (
    p_shop_id, p_service_area_id, 'CUSTOMER_SELF_SERVE', v_uid,
    'DRAFT_ASSISTED', v_subtotal, 0, v_subtotal
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := public.resolve_effective_sku_trade_price(v_sku_id);
    v_line_total := round(v_qty * v_price, 2);

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_sku.product_id;

    INSERT INTO public.order_lines (
      order_id, sku_id, quantity, agreed_unit_price, line_total,
      product_name_snapshot, sku_code_snapshot, sku_name_snapshot,
      specification_snapshot, selling_unit_snapshot
    )
    VALUES (
      v_order_id, v_sku_id, v_qty, v_price, v_line_total,
      COALESCE(v_product_name, v_sku.name), v_sku.sku_code, v_sku.name,
      v_sku.specification, v_sku.selling_unit
    );
  END LOOP;

  UPDATE public.orders
  SET status = 'CONFIRMED', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid, 'CUSTOMER', NULL, 'DRAFT_ASSISTED',
      COALESCE(p_notes, 'Customer self-serve order created')),
    (v_order_id, v_uid, 'CUSTOMER', 'DRAFT_ASSISTED', 'CONFIRMED',
      'Self-serve order auto-confirmed');

  PERFORM public._reserve_order_inventory(v_order_id);

  UPDATE public.orders
  SET status = 'STOCK_RESERVED', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES (v_order_id, v_uid, 'CUSTOMER', 'CONFIRMED', 'STOCK_RESERVED', 'Inventory reserved');

  PERFORM public.write_audit_log(
    'order.customer_self_serve_placed',
    'order',
    v_order_id,
    jsonb_build_object('shopId', p_shop_id, 'subtotal', v_subtotal),
    v_uid,
    'CUSTOMER'::public.staff_role
  );

  PERFORM public._enqueue_shop_notification(
    p_shop_id,
    'order_confirmed',
    jsonb_build_object('orderId', v_order_id, 'source', 'CUSTOMER_SELF_SERVE'),
    'order',
    v_order_id,
    'WHATSAPP'
  );

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.place_customer_order(uuid, uuid, jsonb, text) IS
  'Self-serve place: server resolves sku_prices, auto-confirms, reserves stock. Ignores client prices.';

-- ---------------------------------------------------------------------------
-- 6. place_assisted_order — AWAITING_CUSTOMER_CONFIRMATION, no reserve
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
  v_shop_area uuid;
  v_challenge_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_admin() THEN
    SELECT service_area_id INTO v_shop_area
    FROM public.shops
    WHERE id = p_shop_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shop not found';
    END IF;
    IF v_shop_area IS DISTINCT FROM p_service_area_id THEN
      RAISE EXCEPTION 'Service area does not match shop';
    END IF;
  ELSIF public.profile_has_role('SALESMAN') THEN
    IF p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
      RAISE EXCEPTION 'Shop is not assigned to this salesman';
    END IF;
  ELSE
    RAISE EXCEPTION 'Salesman or admin role required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one order line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := public.resolve_effective_sku_trade_price(v_sku_id);

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
    shop_id, service_area_id, source, created_by_profile_id,
    status, subtotal, adjustments, total
  )
  VALUES (
    p_shop_id, p_service_area_id, 'SALESMAN_ASSISTED', v_uid,
    'DRAFT_ASSISTED', v_subtotal, 0, v_subtotal
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku_id := (v_line->>'skuId')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := public.resolve_effective_sku_trade_price(v_sku_id);
    v_line_total := round(v_qty * v_price, 2);

    SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
    SELECT name INTO v_product_name FROM public.products WHERE id = v_sku.product_id;

    INSERT INTO public.order_lines (
      order_id, sku_id, quantity, agreed_unit_price, line_total,
      product_name_snapshot, sku_code_snapshot, sku_name_snapshot,
      specification_snapshot, selling_unit_snapshot
    )
    VALUES (
      v_order_id, v_sku_id, v_qty, v_price, v_line_total,
      COALESCE(v_product_name, v_sku.name), v_sku.sku_code, v_sku.name,
      v_sku.specification, v_sku.selling_unit
    );
  END LOOP;

  -- Do NOT reserve stock before customer approval.
  UPDATE public.orders
  SET status = 'AWAITING_CUSTOMER_CONFIRMATION', updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES
    (v_order_id, v_uid,
      CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END,
      NULL, 'DRAFT_ASSISTED',
      COALESCE(p_notes, 'Assisted order created')),
    (v_order_id, v_uid,
      CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END,
      'DRAFT_ASSISTED', 'AWAITING_CUSTOMER_CONFIRMATION',
      'Awaiting customer approval — stock not reserved');

  v_challenge_id := public._issue_order_confirmation_challenge(
    v_order_id,
    'order_approval_requested'
  );

  PERFORM public.write_audit_log(
    'order.assisted_awaiting_confirmation',
    'order',
    v_order_id,
    jsonb_build_object('shopId', p_shop_id, 'challengeId', v_challenge_id, 'subtotal', v_subtotal),
    v_uid,
    CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END
  );

  RETURN v_order_id;
END;
$$;

COMMENT ON FUNCTION public.place_assisted_order(uuid, uuid, jsonb, text) IS
  'Assisted order: server prices, stops at AWAITING_CUSTOMER_CONFIRMATION, challenge + notification. No stock reserve.';

-- ---------------------------------------------------------------------------
-- 7. Customer approve (token + shop auth) → CONFIRMED → reserve → STOCK_RESERVED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_approve_assisted_order(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_challenge public.order_confirmation_challenges%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('CUSTOMER') THEN
    RAISE EXCEPTION 'Customer role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_challenge
  FROM public.order_confirmation_challenges
  WHERE token = btrim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found';
  END IF;

  IF v_challenge.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Approval request is not pending (status: %)', v_challenge.status;
  END IF;

  IF v_challenge.expires_at <= now() THEN
    UPDATE public.order_confirmation_challenges
    SET status = 'EXPIRED', updated_at = now()
    WHERE id = v_challenge.id;
    RAISE EXCEPTION 'Approval request expired';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_challenge.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.shop_id NOT IN (SELECT public.customer_shop_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF v_order.status <> 'AWAITING_CUSTOMER_CONFIRMATION' THEN
    RAISE EXCEPTION 'Order is not awaiting confirmation (status: %)', v_order.status;
  END IF;

  UPDATE public.order_confirmation_challenges
  SET status = 'CUSTOMER_CONFIRMED',
      confirmed_at = now(),
      updated_at = now()
  WHERE id = v_challenge.id;

  UPDATE public.orders
  SET status = 'CONFIRMED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES (
    v_order.id, v_uid, 'CUSTOMER',
    'AWAITING_CUSTOMER_CONFIRMATION', 'CONFIRMED',
    'Customer approved assisted order'
  );

  PERFORM public._reserve_order_inventory(v_order.id);

  UPDATE public.orders
  SET status = 'STOCK_RESERVED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES (
    v_order.id, v_uid, 'CUSTOMER',
    'CONFIRMED', 'STOCK_RESERVED',
    'Inventory reserved after customer approval'
  );

  PERFORM public.write_audit_log(
    'order.customer_approved',
    'order',
    v_order.id,
    jsonb_build_object('challengeId', v_challenge.id, 'tokenUsed', true),
    v_uid,
    'CUSTOMER'::public.staff_role
  );

  PERFORM public._enqueue_shop_notification(
    v_order.shop_id,
    'order_confirmed',
    jsonb_build_object('orderId', v_order.id, 'source', 'SALESMAN_ASSISTED'),
    'order',
    v_order.id,
    'WHATSAPP'
  );

  RETURN v_order.id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_approve_assisted_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_approve_assisted_order(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Customer request changes (no stock reserve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_request_order_changes(
  p_token text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_challenge public.order_confirmation_challenges%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.profile_has_role('CUSTOMER') THEN
    RAISE EXCEPTION 'Customer role required';
  END IF;

  IF char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'A change request reason is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_challenge
  FROM public.order_confirmation_challenges
  WHERE token = btrim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found';
  END IF;

  IF v_challenge.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Approval request is not pending';
  END IF;

  IF v_challenge.expires_at <= now() THEN
    UPDATE public.order_confirmation_challenges
    SET status = 'EXPIRED', updated_at = now()
    WHERE id = v_challenge.id;
    RAISE EXCEPTION 'Approval request expired';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_challenge.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.shop_id NOT IN (SELECT public.customer_shop_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF v_order.status <> 'AWAITING_CUSTOMER_CONFIRMATION' THEN
    RAISE EXCEPTION 'Order is not awaiting confirmation';
  END IF;

  UPDATE public.order_confirmation_challenges
  SET status = 'CUSTOMER_REQUESTED_CHANGES',
      updated_at = now()
  WHERE id = v_challenge.id;

  -- Stay on AWAITING; informational event (from_status NULL avoids same-status CHECK).
  INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
  VALUES (
    v_order.id, v_uid, 'CUSTOMER',
    NULL, 'AWAITING_CUSTOMER_CONFIRMATION',
    format('Customer requested changes: %s', left(v_reason, 500))
  );

  PERFORM public.write_audit_log(
    'order.customer_requested_changes',
    'order',
    v_order.id,
    jsonb_build_object('challengeId', v_challenge.id, 'reason', left(v_reason, 500)),
    v_uid,
    'CUSTOMER'::public.staff_role
  );

  PERFORM public._enqueue_shop_notification(
    v_order.shop_id,
    'customer_requested_changes',
    jsonb_build_object(
      'orderId', v_order.id,
      'challengeId', v_challenge.id,
      'reason', left(v_reason, 500)
    ),
    'order',
    v_order.id,
    'WHATSAPP'
  );

  RETURN v_order.id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_request_order_changes(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_request_order_changes(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Reissue challenge after edits / request-changes (admin or assigned salesman)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reissue_order_approval_challenge(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_challenge_id uuid;
  v_idx integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF public.is_admin() THEN
    NULL;
  ELSIF public.profile_has_role('SALESMAN')
        AND v_order.shop_id IN (SELECT public.salesman_shop_ids()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized to reissue approval';
  END IF;

  v_idx := public.order_status_happy_path_index(v_order.status);
  IF v_idx < 0 OR v_idx >= 4 THEN
    RAISE EXCEPTION 'Cannot reissue approval after packing (status: %)', v_order.status;
  END IF;

  IF v_order.source <> 'SALESMAN_ASSISTED' THEN
    RAISE EXCEPTION 'Only assisted orders use customer approval challenges';
  END IF;

  -- Release any stock if order had progressed past confirmation.
  IF v_order.status IN ('CONFIRMED', 'STOCK_RESERVED') THEN
    PERFORM public._release_order_inventory(p_order_id);
  END IF;

  IF v_order.status IS DISTINCT FROM 'AWAITING_CUSTOMER_CONFIRMATION' THEN
    UPDATE public.orders
    SET status = 'AWAITING_CUSTOMER_CONFIRMATION', updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
    VALUES (
      p_order_id, v_uid,
      CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END,
      v_order.status, 'AWAITING_CUSTOMER_CONFIRMATION',
      'Order returned to customer approval after changes'
    );
  END IF;

  v_challenge_id := public._issue_order_confirmation_challenge(
    p_order_id,
    'order_reapproval_requested'
  );

  PERFORM public.write_audit_log(
    'order.approval_reissued',
    'order',
    p_order_id,
    jsonb_build_object('challengeId', v_challenge_id),
    v_uid,
    CASE WHEN public.is_admin() THEN 'ADMIN'::public.staff_role ELSE 'SALESMAN'::public.staff_role END
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'challengeId', v_challenge_id,
    'status', 'AWAITING_CUSTOMER_CONFIRMATION'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reissue_order_approval_challenge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reissue_order_approval_challenge(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. admin_replace_order_lines — authoritative prices + invalidate approval
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_replace_order_lines(
  p_order_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_idx integer;
  v_line jsonb;
  v_sku public.skus%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_price numeric;
  v_qty numeric;
  v_subtotal numeric := 0;
  v_count int := 0;
  v_was_assisted boolean;
  v_needs_reapproval boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_idx := public.order_status_happy_path_index(v_order.status);
  IF v_idx < 0 OR v_idx >= 4 THEN
    RAISE EXCEPTION 'Order can no longer be edited after packing (current: %)', v_order.status;
  END IF;
  IF v_order.sale_id IS NOT NULL THEN
    RAISE EXCEPTION 'Converted orders cannot be edited';
  END IF;

  v_was_assisted := v_order.source = 'SALESMAN_ASSISTED';
  v_needs_reapproval := v_was_assisted AND v_idx >= 1 AND v_idx < 4;

  -- Only release stock when assisted orders must return to customer approval.
  -- Self-serve edits keep existing reservation accounting (admin re-packs separately).
  IF v_needs_reapproval AND v_order.status = 'STOCK_RESERVED' THEN
    PERFORM public._release_order_inventory(p_order_id);
  END IF;

  DELETE FROM public.order_lines WHERE order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_sku FROM public.skus WHERE id = (v_line->>'skuId')::uuid AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU not found: %', v_line->>'skuId'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_sku.product_id;

    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    -- Always resolve authoritative price (ignore client unitPrice for commercial truth).
    v_price := public.resolve_effective_sku_trade_price(v_sku.id);

    INSERT INTO public.order_lines (
      order_id, sku_id,
      product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
      specification_snapshot, selling_unit_snapshot,
      quantity, agreed_unit_price, line_total
    )
    VALUES (
      p_order_id, v_sku.id,
      coalesce(v_product.name, 'Product'),
      v_sku.name,
      v_sku.sku_code,
      v_sku.specification,
      v_sku.selling_unit,
      v_qty, v_price, round(v_qty * v_price, 2)
    );

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = greatest(v_subtotal + coalesce(adjustments, 0), 0),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, v_uid, 'ADMIN', NULL, v_order.status,
    format('Order lines updated · %s line(s) · total %s', v_count, v_order.total)
  );

  IF v_needs_reapproval THEN
    PERFORM public.reissue_order_approval_challenge(p_order_id);
  END IF;

  PERFORM public.write_audit_log(
    'order.lines_replaced_admin',
    'order',
    p_order_id,
    jsonb_build_object(
      'lineCount', v_count,
      'subtotal', v_subtotal,
      'total', v_order.total,
      'reapproval', v_needs_reapproval
    ),
    v_uid,
    'ADMIN'::public.staff_role
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'lineCount', v_count,
    'subtotal', v_order.subtotal,
    'total', v_order.total,
    'reapprovalRequired', v_needs_reapproval
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Salesman line replace for awaiting assisted orders
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salesman_replace_assisted_order_lines(
  p_order_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_line jsonb;
  v_sku public.skus%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_price numeric;
  v_qty numeric;
  v_subtotal numeric := 0;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.profile_has_role('SALESMAN') THEN
    RAISE EXCEPTION 'Salesman role required';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to this salesman';
  END IF;

  IF v_order.source <> 'SALESMAN_ASSISTED' THEN
    RAISE EXCEPTION 'Only assisted orders can be edited here';
  END IF;

  IF v_order.status <> 'AWAITING_CUSTOMER_CONFIRMATION' THEN
    RAISE EXCEPTION 'Assisted order must be awaiting confirmation to edit (status: %)', v_order.status;
  END IF;

  DELETE FROM public.order_lines WHERE order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_sku FROM public.skus WHERE id = (v_line->>'skuId')::uuid AND deleted_at IS NULL AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU not found: %', v_line->>'skuId'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_sku.product_id;

    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    IF v_qty < v_sku.moq THEN
      RAISE EXCEPTION 'Quantity for % below MOQ %', v_sku.sku_code, v_sku.moq;
    END IF;
    IF mod(v_qty, v_sku.quantity_step) <> 0 THEN
      RAISE EXCEPTION 'Quantity for % must be in steps of %', v_sku.sku_code, v_sku.quantity_step;
    END IF;

    v_price := public.resolve_effective_sku_trade_price(v_sku.id);

    INSERT INTO public.order_lines (
      order_id, sku_id,
      product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
      specification_snapshot, selling_unit_snapshot,
      quantity, agreed_unit_price, line_total
    )
    VALUES (
      p_order_id, v_sku.id,
      coalesce(v_product.name, 'Product'),
      v_sku.name, v_sku.sku_code, v_sku.specification, v_sku.selling_unit,
      v_qty, v_price, round(v_qty * v_price, 2)
    );

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = greatest(v_subtotal + coalesce(adjustments, 0), 0),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, v_uid, 'SALESMAN', NULL, 'AWAITING_CUSTOMER_CONFIRMATION',
    format('Salesman updated lines · %s line(s) · total %s', v_count, v_order.total)
  );

  PERFORM public.reissue_order_approval_challenge(p_order_id);

  PERFORM public.write_audit_log(
    'order.lines_replaced_salesman',
    'order',
    p_order_id,
    jsonb_build_object('lineCount', v_count, 'subtotal', v_subtotal),
    v_uid,
    'SALESMAN'::public.staff_role
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'lineCount', v_count,
    'subtotal', v_order.subtotal,
    'total', v_order.total,
    'reapprovalRequired', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_replace_assisted_order_lines(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_replace_assisted_order_lines(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. Activation: enqueue notification on invitation create
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
  v_outbox_id uuid;
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

  INSERT INTO public.notification_outbox (
    channel, template_key, recipient, payload, related_entity_type, related_entity_id, status
  )
  VALUES (
    'WHATSAPP',
    'customer_activation',
    v_mobile,
    jsonb_build_object(
      'shopId', p_shop_id,
      'invitationId', v_inv_id,
      'token', v_token,
      'expiresAt', v_expires,
      'providerDelivery', 'queued',
      'activationPath', format('/activate?token=%s', v_token)
    ),
    'shop_invitation',
    v_inv_id,
    'PENDING'
  )
  RETURNING id INTO v_outbox_id;

  PERFORM public.write_audit_log(
    'shop.invitation_created',
    'shop',
    p_shop_id,
    jsonb_build_object('invitationId', v_inv_id, 'outboxId', v_outbox_id),
    v_uid,
    'SALESMAN'::public.staff_role
  );

  RETURN jsonb_build_object(
    'invitationId', v_inv_id,
    'shopId', p_shop_id,
    'mobile', v_mobile,
    'token', v_token,
    'expiresAt', v_expires,
    'notificationOutboxId', v_outbox_id,
    'notificationStatus', 'PENDING'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Expire challenges (no auto-cancel, no stock reserve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_expire_order_confirmation_challenges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_expired int := 0;
  r RECORD;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('expire_order_confirmation_challenges', 'RUNNING')
  RETURNING id INTO v_run_id;

  FOR r IN
    SELECT c.*, o.shop_id
    FROM public.order_confirmation_challenges c
    JOIN public.orders o ON o.id = c.order_id
    WHERE c.status = 'PENDING'
      AND c.expires_at <= now()
    FOR UPDATE OF c
  LOOP
    UPDATE public.order_confirmation_challenges
    SET status = 'EXPIRED', updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.order_events (order_id, actor_profile_id, actor_role, from_status, to_status, note)
    VALUES (
      r.order_id, NULL, NULL, NULL, 'AWAITING_CUSTOMER_CONFIRMATION',
      'Customer approval challenge expired — stock not reserved'
    );

    PERFORM public._enqueue_shop_notification(
      r.shop_id,
      'order_approval_expired',
      jsonb_build_object('orderId', r.order_id, 'challengeId', r.id),
      'order',
      r.order_id,
      'WHATSAPP'
    );

    v_expired := v_expired + 1;
  END LOOP;

  UPDATE public.job_runs
  SET status = 'SUCCESS',
      finished_at = now(),
      processed_count = v_expired,
      detail = jsonb_build_object('expired', v_expired)
  WHERE id = v_run_id;

  RETURN jsonb_build_object('jobRunId', v_run_id, 'expired', v_expired);
END;
$$;

REVOKE ALL ON FUNCTION public.job_expire_order_confirmation_challenges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_expire_order_confirmation_challenges() TO service_role;

-- Reminders for challenges expiring within 4 hours (once per challenge)
CREATE OR REPLACE FUNCTION public.job_remind_order_approvals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_sent int := 0;
  r RECORD;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('remind_order_approvals', 'RUNNING')
  RETURNING id INTO v_run_id;

  FOR r IN
    SELECT c.id AS challenge_id, c.order_id, c.expires_at, o.shop_id, c.token
    FROM public.order_confirmation_challenges c
    JOIN public.orders o ON o.id = c.order_id
    WHERE c.status = 'PENDING'
      AND c.expires_at > now()
      AND c.expires_at <= now() + interval '4 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_outbox n
        WHERE n.template_key = 'order_approval_reminder'
          AND n.related_entity_id = c.id
      )
  LOOP
    PERFORM public._enqueue_shop_notification(
      r.shop_id,
      'order_approval_reminder',
      jsonb_build_object(
        'orderId', r.order_id,
        'challengeId', r.challenge_id,
        'token', r.token,
        'expiresAt', r.expires_at,
        'approvalPath', format('/order-approval/%s', r.token)
      ),
      'order_confirmation_challenge',
      r.challenge_id,
      'WHATSAPP'
    );
    v_sent := v_sent + 1;
  END LOOP;

  UPDATE public.job_runs
  SET status = 'SUCCESS',
      finished_at = now(),
      processed_count = v_sent,
      detail = jsonb_build_object('remindersQueued', v_sent)
  WHERE id = v_run_id;

  RETURN jsonb_build_object('jobRunId', v_run_id, 'remindersQueued', v_sent);
END;
$$;

REVOKE ALL ON FUNCTION public.job_remind_order_approvals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_remind_order_approvals() TO service_role;

-- ---------------------------------------------------------------------------
-- 14. Honest drain: never mark SENT when provider is stub/unconfigured
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_drain_notification_outbox(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_sent int := 0;
  v_failed int := 0;
  r RECORD;
BEGIN
  INSERT INTO public.job_runs (job_name, status)
  VALUES ('drain_notification_outbox', 'RUNNING')
  RETURNING id INTO v_run_id;

  FOR r IN
    SELECT * FROM public.job_claim_notification_batch(p_limit)
  LOOP
    BEGIN
      -- Provider-independent queue: leave failed with clear reason until real provider succeeds.
      PERFORM public.mark_notification_failed(
        r.id,
        format('provider_unconfigured:%s — notification remains queued for later delivery', r.channel::text)
      );
      v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.mark_notification_failed(r.id, SQLERRM);
      v_failed := v_failed + 1;
    END;
  END LOOP;

  UPDATE public.job_runs
  SET status = CASE WHEN v_failed > 0 AND v_sent = 0 THEN 'PARTIAL'
                    WHEN v_failed > 0 THEN 'PARTIAL'
                    ELSE 'SUCCESS' END,
      finished_at = now(),
      processed_count = v_sent + v_failed,
      error_count = v_failed,
      detail = jsonb_build_object(
        'sent', v_sent,
        'failed', v_failed,
        'note', 'Drain does not fake provider delivery; use send-notification edge with real keys'
      )
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'jobRunId', v_run_id,
    'sent', v_sent,
    'failed', v_failed
  );
END;
$$;

COMMENT ON FUNCTION public.job_drain_notification_outbox(integer) IS
  'Claims pending outbox rows; marks provider_unconfigured failure — never fakes SENT.';

-- ---------------------------------------------------------------------------
-- 15. Customer approval preview (token + shop auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_approval_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_challenge public.order_confirmation_challenges%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_lines jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_challenge
  FROM public.order_confirmation_challenges
  WHERE token = btrim(p_token);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_challenge.order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_order.shop_id NOT IN (SELECT public.customer_shop_ids())
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_order.shop_id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ol.id,
      'skuId', ol.sku_id,
      'productName', ol.product_name_snapshot,
      'skuName', ol.sku_name_snapshot,
      'skuCode', ol.sku_code_snapshot,
      'sellingUnit', ol.selling_unit_snapshot,
      'quantity', ol.quantity,
      'unitPrice', ol.agreed_unit_price,
      'lineTotal', ol.line_total
    ) ORDER BY ol.created_at
  ), '[]'::jsonb)
  INTO v_lines
  FROM public.order_lines ol
  WHERE ol.order_id = v_order.id;

  RETURN jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', v_challenge.id,
      'orderId', v_challenge.order_id,
      'token', v_challenge.token,
      'status', v_challenge.status,
      'expiresAt', v_challenge.expires_at,
      'confirmedAt', v_challenge.confirmed_at
    ),
    'order', jsonb_build_object(
      'id', v_order.id,
      'shopId', v_order.shop_id,
      'status', v_order.status,
      'source', v_order.source,
      'subtotal', v_order.subtotal,
      'adjustments', v_order.adjustments,
      'total', v_order.total,
      'currency', v_order.currency,
      'expectedDeliveryAt', v_order.expected_delivery_at,
      'createdAt', v_order.created_at
    ),
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'tradeName', v_shop.trade_name,
      'deliveryAddressLine', v_shop.delivery_address_line,
      'deliveryCity', v_shop.delivery_city,
      'deliveryState', v_shop.delivery_state,
      'deliveryPinCode', v_shop.delivery_pin_code
    ),
    'lines', v_lines,
    'expired', v_challenge.expires_at <= now() OR v_challenge.status = 'EXPIRED',
    'canAct', v_challenge.status = 'PENDING'
      AND v_challenge.expires_at > now()
      AND v_order.status = 'AWAITING_CUSTOMER_CONFIRMATION'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_approval_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_approval_by_token(text) TO authenticated;
