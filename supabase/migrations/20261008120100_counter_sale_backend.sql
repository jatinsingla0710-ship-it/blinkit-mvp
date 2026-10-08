-- RichlyBook 2.0 Phase 2: Counter sale backend (schema + RPCs).
-- Extends existing orders/payments/sales spine. Does NOT fork sales.
-- Wholesale assisted-order pricing/lifecycle remains unchanged.
-- Depends on 20261008120000_order_source_counter_sale.sql (COUNTER_SALE enum).

-- ─── 1) Walk-in shop flag ─────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS shops_one_walk_in_idx
  ON public.shops ((true))
  WHERE is_walk_in = true AND deleted_at IS NULL;

COMMENT ON COLUMN public.shops.is_walk_in IS
  'System Walk-in / cash party shop for counter sales. At most one active row.';

-- ─── 3) order_lines: catalogue + custom ───────────────────────────────────────

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS line_kind text NOT NULL DEFAULT 'CATALOGUE';

ALTER TABLE public.order_lines
  DROP CONSTRAINT IF EXISTS order_lines_line_kind_check;

ALTER TABLE public.order_lines
  ADD CONSTRAINT order_lines_line_kind_check
  CHECK (line_kind IN ('CATALOGUE', 'CUSTOM'));

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS line_discount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.order_lines
  DROP CONSTRAINT IF EXISTS order_lines_line_discount_non_negative;

ALTER TABLE public.order_lines
  ADD CONSTRAINT order_lines_line_discount_non_negative
  CHECK (line_discount >= 0);

-- Allow null sku_id for CUSTOM lines.
ALTER TABLE public.order_lines
  ALTER COLUMN sku_id DROP NOT NULL;

ALTER TABLE public.order_lines
  DROP CONSTRAINT IF EXISTS order_lines_line_kind_sku_consistency;

ALTER TABLE public.order_lines
  ADD CONSTRAINT order_lines_line_kind_sku_consistency
  CHECK (
    (line_kind = 'CATALOGUE' AND sku_id IS NOT NULL)
    OR (
      line_kind = 'CUSTOM'
      AND sku_id IS NULL
      AND char_length(btrim(product_name_snapshot)) > 0
      AND char_length(btrim(selling_unit_snapshot)) > 0
    )
  );

ALTER TABLE public.order_lines
  DROP CONSTRAINT IF EXISTS order_lines_line_total_matches;

ALTER TABLE public.order_lines
  ADD CONSTRAINT order_lines_line_total_matches
  CHECK (
    line_total = round(quantity * agreed_unit_price - line_discount, 2)
  );

DROP INDEX IF EXISTS public.order_lines_unique_sku_per_order;

CREATE UNIQUE INDEX IF NOT EXISTS order_lines_unique_sku_per_order
  ON public.order_lines (order_id, sku_id)
  WHERE sku_id IS NOT NULL;

COMMENT ON COLUMN public.order_lines.line_kind IS
  'CATALOGUE requires sku_id; CUSTOM is a one-time line with null sku_id (no inventory).';

-- ─── 4) Idempotency for counter finalize ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.counter_sale_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  client_request_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counter_sale_idempotency_request_not_blank CHECK (
    char_length(btrim(client_request_id)) BETWEEN 8 AND 128
  ),
  CONSTRAINT counter_sale_idempotency_actor_request_unique
    UNIQUE (actor_profile_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS counter_sale_idempotency_order_idx
  ON public.counter_sale_idempotency (order_id);

ALTER TABLE public.counter_sale_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_sale_idempotency FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counter_sale_idempotency_admin_all ON public.counter_sale_idempotency;
CREATE POLICY counter_sale_idempotency_admin_all
  ON public.counter_sale_idempotency
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.counter_sale_idempotency TO authenticated;
GRANT ALL ON public.counter_sale_idempotency TO service_role;

COMMENT ON TABLE public.counter_sale_idempotency IS
  'Protects admin_complete_counter_sale against double-submit; scoped per actor + client_request_id.';

-- ─── 5) Inventory helpers: skip CUSTOM / null sku lines ───────────────────────

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
    SELECT *
    FROM public.order_lines
    WHERE order_id = p_order_id
      AND sku_id IS NOT NULL
      AND coalesce(line_kind, 'CATALOGUE') = 'CATALOGUE'
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

COMMENT ON FUNCTION public._reserve_order_inventory(uuid) IS
  'Reserves inventory for CATALOGUE order lines only. CUSTOM / null sku_id lines are skipped.';

CREATE OR REPLACE FUNCTION public._consume_reserved_inventory_for_order(
  p_order_id uuid,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.stock_reservations%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_consumed integer := 0;
  v_total_qty numeric(12, 3) := 0;
  v_catalogue_count integer := 0;
  v_active_res_count integer := 0;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  SELECT count(*)::integer
  INTO v_catalogue_count
  FROM public.order_lines
  WHERE order_id = p_order_id
    AND sku_id IS NOT NULL
    AND coalesce(line_kind, 'CATALOGUE') = 'CATALOGUE';

  -- Custom-only (or empty catalogue) orders: nothing to consume.
  IF v_catalogue_count = 0 THEN
    RETURN jsonb_build_object(
      'alreadyConsumed', false,
      'consumedReservationCount', 0,
      'totalQuantity', 0,
      'skippedCustomOnly', true
    );
  END IF;

  SELECT count(*)::integer
  INTO v_active_res_count
  FROM public.stock_reservations
  WHERE order_id = p_order_id
    AND status IN ('PENDING', 'RESERVED');

  IF v_active_res_count = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.stock_reservations sr
      WHERE sr.order_id = p_order_id
        AND sr.status = 'FULFILLED'
    ) AND EXISTS (
      SELECT 1
      FROM public.inventory_movements im
      WHERE im.reference_type = 'order'
        AND im.reference_id = p_order_id
        AND im.movement_type = 'ORDER_DISPATCH'
    ) THEN
      RETURN jsonb_build_object(
        'alreadyConsumed', true,
        'consumedReservationCount', 0,
        'totalQuantity', 0
      );
    END IF;

    RAISE EXCEPTION
      'Cannot fulfill inventory: no active stock reservations for order %. Reserve inventory before Convert to Sale.',
      p_order_id;
  END IF;

  FOR v_res IN
    SELECT *
    FROM public.stock_reservations
    WHERE order_id = p_order_id
      AND status IN ('PENDING', 'RESERVED')
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    SELECT *
    INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_res.sku_id
      AND operational_location_id = v_res.operational_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Cannot fulfill reservation %: inventory balance missing for SKU % at location %',
        v_res.id,
        v_res.sku_id,
        v_res.operational_location_id;
    END IF;

    IF v_balance.on_hand_quantity < v_res.quantity THEN
      RAISE EXCEPTION
        'Cannot fulfill reservation %: on-hand (%) is less than reserved qty (%) at location %',
        v_res.id,
        v_balance.on_hand_quantity,
        v_res.quantity,
        v_res.operational_location_id;
    END IF;

    IF v_balance.reserved_quantity < v_res.quantity THEN
      RAISE EXCEPTION
        'Cannot fulfill reservation %: reserved balance (%) is less than reservation qty (%) at location %',
        v_res.id,
        v_balance.reserved_quantity,
        v_res.quantity,
        v_res.operational_location_id;
    END IF;

    UPDATE public.inventory_balances
    SET on_hand_quantity = on_hand_quantity - v_res.quantity,
        reserved_quantity = reserved_quantity - v_res.quantity,
        updated_at = now()
    WHERE id = v_balance.id;

    INSERT INTO public.inventory_movements (
      sku_id,
      operational_location_id,
      movement_type,
      quantity_delta,
      reason,
      reference_type,
      reference_id,
      actor_profile_id
    )
    VALUES (
      v_res.sku_id,
      v_res.operational_location_id,
      'ORDER_DISPATCH',
      -v_res.quantity,
      format('Order fulfilled / sale convert · reservation %s', v_res.id),
      'order',
      p_order_id,
      p_actor_profile_id
    );

    UPDATE public.stock_reservations
    SET status = 'FULFILLED', updated_at = now()
    WHERE id = v_res.id;

    v_consumed := v_consumed + 1;
    v_total_qty := v_total_qty + v_res.quantity;
  END LOOP;

  RETURN jsonb_build_object(
    'alreadyConsumed', false,
    'consumedReservationCount', v_consumed,
    'totalQuantity', v_total_qty
  );
END;
$$;

COMMENT ON FUNCTION public._consume_reserved_inventory_for_order(uuid, uuid) IS
  'Consumes PENDING/RESERVED reservations for catalogue lines. Custom-only orders no-op. Idempotent when already dispatched.';

-- ─── 6) Walk-in shop helper ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._ensure_walk_in_shop(p_service_area_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_area uuid := p_service_area_id;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  SELECT id INTO v_shop_id
  FROM public.shops
  WHERE is_walk_in = true
    AND deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_area IS NOT NULL AND (
      SELECT service_area_id FROM public.shops WHERE id = v_shop_id
    ) IS DISTINCT FROM v_area THEN
      UPDATE public.shops
      SET service_area_id = v_area, updated_at = now()
      WHERE id = v_shop_id;
    END IF;
    RETURN v_shop_id;
  END IF;

  IF v_area IS NULL THEN
    SELECT id INTO v_area
    FROM public.service_areas
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_area IS NULL THEN
    RAISE EXCEPTION 'Walk-in shop requires an active service area';
  END IF;

  INSERT INTO public.shops (
    trade_name,
    legal_name,
    lifecycle_status,
    service_area_id,
    delivery_address_line,
    delivery_city,
    delivery_state,
    delivery_pin_code,
    is_active,
    is_walk_in
  )
  VALUES (
    'Walk-in Customer',
    'Walk-in Customer',
    'ACTIVATED',
    v_area,
    'Counter',
    '—',
    '—',
    '000000',
    true,
    true
  )
  RETURNING id INTO v_shop_id;

  INSERT INTO public.shop_contacts (shop_id, name, mobile, is_primary)
  VALUES (
    v_shop_id,
    'Walk-in',
    public.normalize_mobile('9999999999'),
    true
  );

  RETURN v_shop_id;
END;
$$;

REVOKE ALL ON FUNCTION public._ensure_walk_in_shop(uuid) FROM PUBLIC;

COMMENT ON FUNCTION public._ensure_walk_in_shop(uuid) IS
  'Gets or creates the single system Walk-in shop for counter sales.';

-- ─── 7) Method mapping helper ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._counter_collection_bucket(p_method text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_m text := upper(btrim(coalesce(p_method, '')));
BEGIN
  IF v_m IN ('CASH', 'CASH_ON_DELIVERY', 'CASH_COUNTER') THEN
    RETURN 'cash';
  END IF;
  IF v_m IN (
    'UPI', 'UPI_ON_DELIVERY', 'UPI_COUNTER',
    'BANK', 'ONLINE_GATEWAY', 'CARD_ON_DELIVERY', 'OTHER', 'CARD'
  ) THEN
    RETURN 'online';
  END IF;
  RAISE EXCEPTION 'Unsupported collection method %', p_method
    USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public._counter_collection_method(p_method text)
RETURNS public.payment_collection_method
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_m text := upper(btrim(coalesce(p_method, '')));
BEGIN
  IF v_m IN ('CASH', 'CASH_ON_DELIVERY', 'CASH_COUNTER') THEN
    RETURN 'CASH_ON_DELIVERY'::public.payment_collection_method;
  END IF;
  IF v_m IN ('UPI', 'UPI_ON_DELIVERY', 'UPI_COUNTER') THEN
    RETURN 'UPI_ON_DELIVERY'::public.payment_collection_method;
  END IF;
  IF v_m IN ('ONLINE_GATEWAY') THEN
    RETURN 'ONLINE_GATEWAY'::public.payment_collection_method;
  END IF;
  IF v_m IN ('CARD', 'CARD_ON_DELIVERY') THEN
    RETURN 'CARD_ON_DELIVERY'::public.payment_collection_method;
  END IF;
  IF v_m IN ('BANK', 'OTHER') THEN
    RETURN 'OTHER'::public.payment_collection_method;
  END IF;
  RAISE EXCEPTION 'Unsupported collection method %', p_method
    USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public._counter_collection_bucket(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._counter_collection_method(text) FROM PUBLIC;

-- ─── 8) admin_record_order_collection ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_record_order_collection(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_amount numeric(12, 2);
  v_remaining numeric(12, 2);
  v_cash numeric(12, 2);
  v_online numeric(12, 2);
  v_delta_cash numeric(12, 2) := 0;
  v_delta_online numeric(12, 2) := 0;
  v_from public.payment_status;
  v_new_status public.payment_status;
  v_bucket text;
  v_collection_method public.payment_collection_method;
  v_lines jsonb;
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  v_amount := round(coalesce(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Collection amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  v_bucket := public._counter_collection_bucket(p_method);
  v_collection_method := public._counter_collection_method(p_method);

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id,
      'UNPAID'::public.payment_status,
      'PAY_ON_DELIVERY'::public.payment_method_intent,
      NULL,
      round(coalesce(v_order.total, 0), 2),
      coalesce(v_order.currency, 'INR'),
      NULL,
      0,
      0
    )
    RETURNING * INTO v_payment;

    UPDATE public.orders
    SET payment_id = v_payment.id, updated_at = now()
    WHERE id = p_order_id
      AND payment_id IS NULL;
  END IF;

  IF v_payment.status = 'REFUNDED'::public.payment_status THEN
    RAISE EXCEPTION 'Cannot collect against a refunded payment';
  END IF;

  -- Keep payment.amount aligned with order total.
  IF round(coalesce(v_payment.amount, 0), 2) IS DISTINCT FROM round(coalesce(v_order.total, 0), 2) THEN
    UPDATE public.payments
    SET amount = round(coalesce(v_order.total, 0), 2),
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  END IF;

  v_cash := coalesce(v_payment.cash_collected_amount, 0);
  v_online := coalesce(v_payment.online_collected_amount, 0);
  v_remaining := round(v_payment.amount - v_cash - v_online, 2);

  IF v_amount > v_remaining THEN
    RAISE EXCEPTION 'Collection ₹% exceeds remaining due ₹%', v_amount, v_remaining
      USING ERRCODE = '22023';
  END IF;

  IF v_bucket = 'cash' THEN
    v_delta_cash := v_amount;
    v_cash := round(v_cash + v_amount, 2);
  ELSE
    v_delta_online := v_amount;
    v_online := round(v_online + v_amount, 2);
  END IF;

  v_remaining := round(v_payment.amount - v_cash - v_online, 2);
  v_from := v_payment.status;
  v_new_status := CASE
    WHEN v_remaining <= 0 THEN 'PAID'::public.payment_status
    WHEN v_cash > 0 OR v_online > 0 THEN 'PAYMENT_PENDING'::public.payment_status
    ELSE 'UNPAID'::public.payment_status
  END;

  UPDATE public.payments
  SET status = v_new_status,
      cash_collected_amount = v_cash,
      online_collected_amount = v_online,
      collection_method = CASE
        WHEN v_new_status = 'PAID'::public.payment_status THEN v_collection_method
        ELSE coalesce(collection_method, v_collection_method)
      END,
      paid_at = CASE
        WHEN v_new_status = 'PAID'::public.payment_status THEN coalesce(paid_at, now())
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- payment_events requires from_status IS DISTINCT FROM to_status.
  -- Additive partials may keep PAYMENT_PENDING → use NULL from_status then.
  INSERT INTO public.payment_events (
    payment_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_payment.id,
    CASE
      WHEN v_from IS DISTINCT FROM v_new_status THEN v_from
      ELSE NULL
    END,
    v_new_status,
    v_uid,
    'ADMIN'::public.staff_role,
    coalesce(
      nullif(btrim(p_note), ''),
      format(
        'Collection ₹%s via %s · remaining ₹%s',
        v_amount,
        upper(btrim(p_method)),
        v_remaining
      )
    )
  )
  RETURNING id INTO v_event_id;

  -- Keep sales_payments in sync when a sale already exists.
  IF v_order.sale_id IS NOT NULL THEN
    UPDATE public.sales_payments
    SET amount = round(v_cash + v_online, 2),
        status = CASE
          WHEN v_new_status = 'PAID'::public.payment_status THEN 'PAID'
          WHEN v_cash + v_online > 0 THEN 'PARTIAL'
          ELSE 'UNPAID'
        END,
        collected_at = CASE
          WHEN v_cash + v_online > 0 THEN coalesce(collected_at, now())
          ELSE collected_at
        END
    WHERE sale_id = v_order.sale_id;
  END IF;

  -- Counter sales: promote to DELIVERED once fully paid (invariant-safe).
  IF v_new_status = 'PAID'::public.payment_status
     AND v_order.source = 'COUNTER_SALE'::public.order_source
     AND v_order.status IS DISTINCT FROM 'DELIVERED'::public.order_status THEN
    UPDATE public.orders
    SET status = 'DELIVERED'::public.order_status,
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (
      order_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      p_order_id,
      v_order.status,
      'DELIVERED'::public.order_status,
      v_uid,
      'ADMIN'::public.staff_role,
      'Counter sale fully collected'
    );
  END IF;

  -- Post collection journal for this delta only (idempotent per payment_event).
  v_lines := '[]'::jsonb;
  IF v_delta_cash > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'debit', v_delta_cash, 'credit', 0)
    );
  END IF;
  IF v_delta_online > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1010', 'debit', v_delta_online, 'credit', 0)
    );
  END IF;
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object(
      'account_code', '1100',
      'debit', 0,
      'credit', v_amount
    )
  );

  PERFORM public._accounting_post_journal(
    now()::date,
    'collection_event',
    v_event_id,
    format('Collection order %s', p_order_id),
    v_lines,
    v_uid
  );

  PERFORM public.write_audit_log(
    'payment.collection_recorded_admin',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'orderId', p_order_id,
      'amount', v_amount,
      'method', upper(btrim(p_method)),
      'status', v_new_status,
      'remaining', v_remaining
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'paymentId', v_payment.id,
    'orderId', p_order_id,
    'amountCollected', v_amount,
    'cashCollected', v_cash,
    'onlineCollected', v_online,
    'amountDue', v_remaining,
    'paymentStatus', v_new_status,
    'method', upper(btrim(p_method))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_order_collection(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_order_collection(uuid, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_record_order_collection(uuid, numeric, text, text) IS
  'Admin: record additive cash/UPI/bank collection against an order. Supports partial pay; preserves one payment row per order.';

-- ─── 9) admin_complete_counter_sale ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_complete_counter_sale(
  p_shop jsonb,
  p_lines jsonb,
  p_payment jsonb,
  p_bill_discount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_client_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop_id uuid;
  v_service_area_id uuid;
  v_order_id uuid;
  v_payment_id uuid;
  v_sale_id uuid;
  v_invoice text;
  v_line jsonb;
  v_kind text;
  v_sku_id uuid;
  v_qty numeric(12, 3);
  v_unit numeric(12, 2);
  v_line_discount numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_bill_discount numeric(12, 2);
  v_adjustments numeric(12, 2);
  v_total numeric(12, 2);
  v_amount_paid numeric(12, 2);
  v_amount_due numeric(12, 2);
  v_method text;
  v_sku public.skus%ROWTYPE;
  v_product_name text;
  v_resolved_total numeric(12, 2);
  v_consume jsonb;
  v_pay_status public.payment_status;
  v_cash numeric(12, 2) := 0;
  v_online numeric(12, 2) := 0;
  v_collection_method public.payment_collection_method;
  v_bucket text;
  v_sale_pay_status text;
  v_result jsonb;
  v_existing jsonb;
  v_request_id text;
  v_qc jsonb;
  v_trade_name text;
  v_mobile text;
  v_journal_lines jsonb;
  v_cogs numeric(14, 2);
  v_item_count integer := 0;
  v_order_line_id uuid;
  v_event_id uuid;
  v_sku_code_snap text;
  v_sku_name_snap text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  v_request_id := nullif(btrim(p_client_request_id), '');
  IF v_request_id IS NOT NULL THEN
    IF char_length(v_request_id) < 8 OR char_length(v_request_id) > 128 THEN
      RAISE EXCEPTION 'client_request_id must be 8–128 characters'
        USING ERRCODE = '22023';
    END IF;

    SELECT result INTO v_existing
    FROM public.counter_sale_idempotency
    WHERE actor_profile_id = v_uid
      AND client_request_id = v_request_id;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotentReplay', true);
    END IF;
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one sale line is required'
      USING ERRCODE = '22023';
  END IF;

  v_bill_discount := round(coalesce(p_bill_discount, 0)::numeric, 2);
  IF v_bill_discount < 0 THEN
    RAISE EXCEPTION 'Bill discount cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  v_amount_paid := round(coalesce((p_payment ->> 'amountPaid')::numeric, 0), 2);
  IF v_amount_paid < 0 THEN
    RAISE EXCEPTION 'amountPaid cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  v_method := upper(btrim(coalesce(p_payment ->> 'method', 'CASH')));
  IF v_amount_paid > 0 THEN
    v_bucket := public._counter_collection_bucket(v_method);
    v_collection_method := public._counter_collection_method(v_method);
  END IF;

  -- Resolve shop: existing | walkIn | quickCreate
  IF p_shop IS NULL OR jsonb_typeof(p_shop) <> 'object' THEN
    RAISE EXCEPTION 'shop payload is required'
      USING ERRCODE = '22023';
  END IF;

  IF (p_shop ? 'shopId') AND nullif(btrim(p_shop ->> 'shopId'), '') IS NOT NULL THEN
    v_shop_id := (p_shop ->> 'shopId')::uuid;
    SELECT id, service_area_id
    INTO v_shop_id, v_service_area_id
    FROM public.shops
    WHERE id = v_shop_id
      AND deleted_at IS NULL
      AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shop not found or inactive';
    END IF;
    IF v_service_area_id IS NULL THEN
      RAISE EXCEPTION 'Shop has no service area';
    END IF;

  ELSIF coalesce((p_shop ->> 'walkIn')::boolean, false) IS TRUE THEN
    v_service_area_id := nullif(btrim(p_shop ->> 'serviceAreaId'), '')::uuid;
    v_shop_id := public._ensure_walk_in_shop(v_service_area_id);
    SELECT service_area_id INTO v_service_area_id
    FROM public.shops WHERE id = v_shop_id;

  ELSIF p_shop ? 'quickCreate' THEN
    v_qc := p_shop -> 'quickCreate';
    v_trade_name := nullif(btrim(v_qc ->> 'tradeName'), '');
    v_mobile := nullif(btrim(v_qc ->> 'mobile'), '');
    v_service_area_id := nullif(btrim(v_qc ->> 'serviceAreaId'), '')::uuid;

    IF v_trade_name IS NULL THEN
      RAISE EXCEPTION 'quickCreate.tradeName is required';
    END IF;
    IF v_mobile IS NULL THEN
      RAISE EXCEPTION 'quickCreate.mobile is required';
    END IF;
    IF v_service_area_id IS NULL THEN
      SELECT id INTO v_service_area_id
      FROM public.service_areas
      WHERE is_active = true
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    IF v_service_area_id IS NULL THEN
      RAISE EXCEPTION 'quickCreate requires an active service area';
    END IF;

    INSERT INTO public.shops (
      trade_name,
      legal_name,
      lifecycle_status,
      service_area_id,
      delivery_address_line,
      delivery_city,
      delivery_state,
      delivery_pin_code,
      is_active,
      is_walk_in,
      gstin
    )
    VALUES (
      v_trade_name,
      nullif(btrim(v_qc ->> 'legalName'), ''),
      'ACTIVATED',
      v_service_area_id,
      coalesce(nullif(btrim(v_qc ->> 'addressLine'), ''), '—'),
      coalesce(nullif(btrim(v_qc ->> 'city'), ''), '—'),
      coalesce(nullif(btrim(v_qc ->> 'state'), ''), '—'),
      coalesce(nullif(btrim(v_qc ->> 'pinCode'), ''), '000000'),
      true,
      false,
      nullif(btrim(v_qc ->> 'gstin'), '')
    )
    RETURNING id INTO v_shop_id;

    INSERT INTO public.shop_contacts (shop_id, name, mobile, is_primary)
    VALUES (
      v_shop_id,
      coalesce(nullif(btrim(v_qc ->> 'ownerName'), ''), v_trade_name),
      public.normalize_mobile(v_mobile),
      true
    );
  ELSE
    RAISE EXCEPTION 'shop must include shopId, walkIn, or quickCreate'
      USING ERRCODE = '22023';
  END IF;

  -- Validate lines + compute subtotal (server authoritative).
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_kind := upper(btrim(coalesce(v_line ->> 'kind', v_line ->> 'lineKind', 'CATALOGUE')));
    v_qty := (v_line ->> 'quantity')::numeric;
    v_line_discount := round(coalesce((v_line ->> 'discount')::numeric, 0), 2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each line requires quantity > 0';
    END IF;
    IF v_line_discount < 0 THEN
      RAISE EXCEPTION 'Line discount cannot be negative';
    END IF;

    IF v_kind = 'CATALOGUE' THEN
      v_sku_id := (v_line ->> 'skuId')::uuid;
      IF v_sku_id IS NULL THEN
        RAISE EXCEPTION 'Catalogue line requires skuId';
      END IF;

      SELECT * INTO v_sku
      FROM public.skus
      WHERE id = v_sku_id AND deleted_at IS NULL AND is_active;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SKU % is not orderable', v_sku_id;
      END IF;

      IF v_line ? 'unitPrice' AND nullif(btrim(v_line ->> 'unitPrice'), '') IS NOT NULL THEN
        v_unit := round((v_line ->> 'unitPrice')::numeric, 2);
        IF v_unit < 0 THEN
          RAISE EXCEPTION 'Catalogue unitPrice cannot be negative';
        END IF;
        v_line_total := round(v_qty * v_unit - v_line_discount, 2);
      ELSE
        v_resolved_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
        v_unit := round(v_resolved_total / v_qty, 2);
        v_line_total := round(v_qty * v_unit - v_line_discount, 2);
      END IF;

      IF v_line_total < 0 THEN
        RAISE EXCEPTION 'Line total cannot be negative';
      END IF;

    ELSIF v_kind = 'CUSTOM' THEN
      IF nullif(btrim(v_line ->> 'name'), '') IS NULL THEN
        RAISE EXCEPTION 'Custom line requires name';
      END IF;
      IF nullif(btrim(v_line ->> 'unit'), '') IS NULL THEN
        RAISE EXCEPTION 'Custom line requires unit';
      END IF;
      IF v_line ->> 'unitPrice' IS NULL THEN
        RAISE EXCEPTION 'Custom line requires unitPrice';
      END IF;
      v_unit := round((v_line ->> 'unitPrice')::numeric, 2);
      IF v_unit < 0 THEN
        RAISE EXCEPTION 'Custom unitPrice cannot be negative';
      END IF;
      v_line_total := round(v_qty * v_unit - v_line_discount, 2);
      IF v_line_total < 0 THEN
        RAISE EXCEPTION 'Line total cannot be negative';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown line kind %', v_kind;
    END IF;

    v_subtotal := round(v_subtotal + v_line_total, 2);
  END LOOP;

  IF v_bill_discount > v_subtotal THEN
    RAISE EXCEPTION 'Bill discount cannot exceed subtotal';
  END IF;

  v_adjustments := round(-v_bill_discount, 2);
  v_total := round(v_subtotal + v_adjustments, 2);

  IF v_amount_paid > v_total THEN
    RAISE EXCEPTION 'amountPaid ₹% exceeds total ₹%', v_amount_paid, v_total;
  END IF;

  v_amount_due := round(v_total - v_amount_paid, 2);

  -- Create order. DELIVERED requires PAID (business invariant), so start at
  -- PROCESSING; promote to DELIVERED only after a fully paid payment is linked.
  INSERT INTO public.orders (
    shop_id,
    service_area_id,
    created_by_profile_id,
    source,
    status,
    subtotal,
    adjustments,
    total,
    currency
  )
  VALUES (
    v_shop_id,
    v_service_area_id,
    v_uid,
    'COUNTER_SALE'::public.order_source,
    'PROCESSING'::public.order_status,
    v_subtotal,
    v_adjustments,
    v_total,
    'INR'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_events (
    order_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_order_id,
    NULL,
    'PROCESSING'::public.order_status,
    v_uid,
    'ADMIN'::public.staff_role,
    coalesce(nullif(btrim(p_notes), ''), 'Counter sale finalized')
  );

  -- Persist lines (second pass — validated above).
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_kind := upper(btrim(coalesce(v_line ->> 'kind', v_line ->> 'lineKind', 'CATALOGUE')));
    v_qty := (v_line ->> 'quantity')::numeric;
    v_line_discount := round(coalesce((v_line ->> 'discount')::numeric, 0), 2);

    IF v_kind = 'CATALOGUE' THEN
      v_sku_id := (v_line ->> 'skuId')::uuid;
      SELECT * INTO v_sku FROM public.skus WHERE id = v_sku_id;
      SELECT p.name INTO v_product_name
      FROM public.products p
      WHERE p.id = v_sku.product_id;

      IF v_line ? 'unitPrice' AND nullif(btrim(v_line ->> 'unitPrice'), '') IS NOT NULL THEN
        v_unit := round((v_line ->> 'unitPrice')::numeric, 2);
      ELSE
        v_resolved_total := public.resolve_sku_order_line_total(v_sku_id, v_qty);
        v_unit := round(v_resolved_total / v_qty, 2);
      END IF;
      v_line_total := round(v_qty * v_unit - v_line_discount, 2);

      INSERT INTO public.order_lines (
        order_id, line_kind, sku_id,
        product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
        specification_snapshot, selling_unit_snapshot,
        quantity, agreed_unit_price, line_discount, line_total
      )
      VALUES (
        v_order_id, 'CATALOGUE', v_sku_id,
        coalesce(v_product_name, v_sku.name),
        v_sku.name,
        v_sku.sku_code,
        NULL,
        coalesce(v_sku.selling_unit, 'UNIT'),
        v_qty, v_unit, v_line_discount, v_line_total
      );

    ELSE
      v_unit := round((v_line ->> 'unitPrice')::numeric, 2);
      v_line_total := round(v_qty * v_unit - v_line_discount, 2);
      v_product_name := btrim(v_line ->> 'name');

      INSERT INTO public.order_lines (
        order_id, line_kind, sku_id,
        product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
        specification_snapshot, selling_unit_snapshot,
        quantity, agreed_unit_price, line_discount, line_total
      )
      VALUES (
        v_order_id, 'CUSTOM', NULL,
        v_product_name,
        v_product_name,
        'CUSTOM',
        NULL,
        btrim(v_line ->> 'unit'),
        v_qty, v_unit, v_line_discount, v_line_total
      );
    END IF;

    v_item_count := v_item_count + 1;
  END LOOP;

  -- Reserve then consume catalogue stock (CUSTOM skipped by helpers).
  PERFORM public._reserve_order_inventory(v_order_id);
  v_consume := public._consume_reserved_inventory_for_order(v_order_id, v_uid);

  -- Payment row + optional initial collection.
  IF v_amount_paid > 0 THEN
    IF v_bucket = 'cash' THEN
      v_cash := v_amount_paid;
    ELSE
      v_online := v_amount_paid;
    END IF;
  END IF;

  v_pay_status := CASE
    WHEN v_amount_due <= 0 THEN 'PAID'::public.payment_status
    WHEN v_amount_paid > 0 THEN 'PAYMENT_PENDING'::public.payment_status
    ELSE 'UNPAID'::public.payment_status
  END;

  INSERT INTO public.payments (
    order_id, status, method_intent, collection_method, amount, currency,
    paid_at, cash_collected_amount, online_collected_amount
  )
  VALUES (
    v_order_id,
    v_pay_status,
    'PAY_ON_DELIVERY'::public.payment_method_intent,
    CASE
      WHEN v_pay_status = 'PAID'::public.payment_status THEN v_collection_method
      WHEN v_amount_paid > 0 THEN v_collection_method
      ELSE NULL
    END,
    v_total,
    'INR',
    CASE WHEN v_pay_status = 'PAID'::public.payment_status THEN now() ELSE NULL END,
    v_cash,
    v_online
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.orders
  SET payment_id = v_payment_id, updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.payment_events (
    payment_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_payment_id,
    NULL,
    v_pay_status,
    v_uid,
    'ADMIN'::public.staff_role,
    format(
      'Counter sale · paid ₹%s via %s · due ₹%s',
      v_amount_paid,
      CASE WHEN v_amount_paid > 0 THEN v_method ELSE 'CREDIT' END,
      v_amount_due
    )
  )
  RETURNING id INTO v_event_id;

  IF v_pay_status = 'PAID'::public.payment_status THEN
    UPDATE public.orders
    SET status = 'DELIVERED'::public.order_status,
        updated_at = now()
    WHERE id = v_order_id;

    INSERT INTO public.order_events (
      order_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_order_id,
      'PROCESSING'::public.order_status,
      'DELIVERED'::public.order_status,
      v_uid,
      'ADMIN'::public.staff_role,
      'Counter sale fully paid'
    );
  END IF;

  -- Invoice + sale.
  v_invoice := 'INV-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8));

  UPDATE public.orders
  SET invoice_number = v_invoice, updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.sales (
    order_id, invoice_number, status, subtotal, discount, total, currency,
    converted_by_profile_id, converted_at
  )
  VALUES (
    v_order_id, v_invoice, 'COMPLETED',
    v_subtotal, v_bill_discount, v_total, 'INR',
    v_uid, now()
  )
  RETURNING id INTO v_sale_id;

  FOR v_order_line_id, v_sku_id, v_product_name, v_sku_code_snap, v_sku_name_snap,
      v_qty, v_unit, v_line_discount, v_line_total IN
    SELECT
      ol.id,
      ol.sku_id,
      ol.product_name_snapshot,
      ol.sku_code_snapshot,
      ol.sku_name_snapshot,
      ol.quantity,
      ol.agreed_unit_price,
      ol.line_discount,
      ol.line_total
    FROM public.order_lines ol
    WHERE ol.order_id = v_order_id
    ORDER BY ol.created_at ASC
  LOOP
    INSERT INTO public.sale_items (
      sale_id, order_line_id, sku_id, product_name, sku_code, sku_name,
      quantity, unit_price, discount, line_total
    )
    VALUES (
      v_sale_id,
      v_order_line_id,
      v_sku_id,
      v_product_name,
      coalesce(v_sku_code_snap, 'CUSTOM'),
      coalesce(v_sku_name_snap, v_product_name),
      v_qty,
      v_unit,
      v_line_discount,
      v_line_total
    );
  END LOOP;

  v_sale_pay_status := CASE
    WHEN v_pay_status = 'PAID'::public.payment_status THEN 'PAID'
    WHEN v_amount_paid > 0 THEN 'PARTIAL'
    ELSE 'UNPAID'
  END;

  INSERT INTO public.sales_payments (
    sale_id, payment_id, status, amount, collected_at
  )
  VALUES (
    v_sale_id,
    v_payment_id,
    v_sale_pay_status,
    round(v_cash + v_online, 2),
    CASE WHEN v_amount_paid > 0 THEN now() ELSE NULL END
  );

  UPDATE public.orders
  SET sale_id = v_sale_id, updated_at = now()
  WHERE id = v_order_id;

  -- Sale journal (full invoice) + COGS if dispatch costs exist.
  v_journal_lines := jsonb_build_array(
    jsonb_build_object('account_code', '1100', 'debit', v_total, 'credit', 0),
    jsonb_build_object('account_code', '4000', 'debit', 0, 'credit', v_total)
  );

  SELECT coalesce(sum(abs(im.quantity_delta) * im.unit_cost), 0)
  INTO v_cogs
  FROM public.inventory_movements im
  WHERE im.reference_type = 'order'
    AND im.reference_id = v_order_id
    AND im.movement_type = 'ORDER_DISPATCH'
    AND im.unit_cost IS NOT NULL;

  IF v_cogs > 0 THEN
    v_journal_lines := v_journal_lines || jsonb_build_array(
      jsonb_build_object('account_code', '5000', 'debit', round(v_cogs, 2), 'credit', 0),
      jsonb_build_object('account_code', '1200', 'debit', 0, 'credit', round(v_cogs, 2))
    );
  END IF;

  IF v_total > 0 THEN
    PERFORM public._accounting_post_journal(
      now()::date,
      'sale',
      v_sale_id,
      format('Sale %s', v_invoice),
      v_journal_lines,
      v_uid
    );
  END IF;

  -- Collection journal for initial amount paid (delta; idempotent per payment_event).
  IF v_amount_paid > 0 THEN
    v_journal_lines := '[]'::jsonb;
    IF v_cash > 0 THEN
      v_journal_lines := v_journal_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'debit', v_cash, 'credit', 0)
      );
    END IF;
    IF v_online > 0 THEN
      v_journal_lines := v_journal_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1010', 'debit', v_online, 'credit', 0)
      );
    END IF;
    v_journal_lines := v_journal_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '1100',
        'debit', 0,
        'credit', v_amount_paid
      )
    );

    PERFORM public._accounting_post_journal(
      now()::date,
      'collection_event',
      v_event_id,
      format('Collection %s', v_invoice),
      v_journal_lines,
      v_uid
    );
  END IF;

  v_result := jsonb_build_object(
    'orderId', v_order_id,
    'saleId', v_sale_id,
    'paymentId', v_payment_id,
    'invoiceNumber', v_invoice,
    'shopId', v_shop_id,
    'subtotal', v_subtotal,
    'discount', v_bill_discount,
    'total', v_total,
    'amountPaid', v_amount_paid,
    'amountDue', v_amount_due,
    'paymentStatus', v_pay_status,
    'itemCount', v_item_count,
    'inventoryConsume', v_consume,
    'idempotentReplay', false
  );

  IF v_request_id IS NOT NULL THEN
    INSERT INTO public.counter_sale_idempotency (
      actor_profile_id, client_request_id, order_id, sale_id, result
    )
    VALUES (v_uid, v_request_id, v_order_id, v_sale_id, v_result);
  END IF;

  PERFORM public.write_audit_log(
    'order.counter_sale_completed',
    'order',
    v_order_id,
    v_result,
    v_uid,
    'ADMIN'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_counter_sale(jsonb, jsonb, jsonb, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_complete_counter_sale(jsonb, jsonb, jsonb, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_complete_counter_sale(jsonb, jsonb, jsonb, numeric, text, text) IS
  'Atomic counter sale: shop resolve, catalogue+custom lines, stock for catalogue only, partial/credit payment, sale+invoice, journals. Wholesale assisted flow unchanged.';
