-- Order lifecycle automation: invoice-on-order, pack + auto-assign, auto sale convert.
-- Reuses existing order_status enum (no PACKING/INVOICE_* statuses).
-- Reuses admin_schedule_and_assign_delivery + admin_convert core logic.

-- ─── Order invoice columns (pre-sale document; not stock) ────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_number text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_unique
  ON public.orders (lower(btrim(invoice_number)))
  WHERE invoice_number IS NOT NULL;

COMMENT ON COLUMN public.orders.invoice_number IS
  'Pre-sale invoice document number. Created by admin_create_order_invoice; reused on convert when present.';

-- ─── Allow trusted line edits until packing starts (index < PROCESSING=4) ─────

CREATE OR REPLACE FUNCTION public.enforce_confirmed_order_line_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_status public.order_status;
  v_idx integer;
BEGIN
  SELECT o.status
  INTO v_order_status
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  v_idx := public.order_status_happy_path_index(v_order_status);

  -- Trusted admin edit RPC may mutate lines before PROCESSING / READY_FOR_DISPATCH.
  IF current_setting('groaurum.trusted_server_action', true) = 'true'
     AND v_idx >= 0
     AND v_idx < 4
  THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF public.is_order_confirmed_or_later(v_order_status) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete order line for confirmed order %', OLD.order_id
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF TG_OP = 'UPDATE' AND (
      OLD.sku_id IS DISTINCT FROM NEW.sku_id
      OR OLD.product_name_snapshot IS DISTINCT FROM NEW.product_name_snapshot
      OR OLD.sku_name_snapshot IS DISTINCT FROM NEW.sku_name_snapshot
      OR OLD.sku_code_snapshot IS DISTINCT FROM NEW.sku_code_snapshot
      OR OLD.specification_snapshot IS DISTINCT FROM NEW.specification_snapshot
      OR OLD.selling_unit_snapshot IS DISTINCT FROM NEW.selling_unit_snapshot
      OR OLD.quantity IS DISTINCT FROM NEW.quantity
      OR OLD.agreed_unit_price IS DISTINCT FROM NEW.agreed_unit_price
      OR OLD.line_total IS DISTINCT FROM NEW.line_total
    ) THEN
      RAISE EXCEPTION 'Commercial snapshot fields are immutable after order confirmation (order %)',
        NEW.order_id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Core convert (no role check) — used by admin RPC + auto path ────────────

CREATE OR REPLACE FUNCTION public._convert_order_to_sale_core(
  p_order_id uuid,
  p_actor_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_sale_id uuid;
  v_invoice text;
  v_discount numeric(12, 2);
  v_line RECORD;
  v_item_count integer := 0;
BEGIN
  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_order.sale_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'saleId', v_sale.id,
        'invoiceNumber', v_sale.invoice_number,
        'convertedAt', v_sale.converted_at,
        'orderId', p_order_id,
        'alreadyConverted', true
      );
    END IF;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE order_id = p_order_id;
  IF FOUND THEN
    UPDATE public.orders
    SET sale_id = v_sale.id, updated_at = now()
    WHERE id = p_order_id AND sale_id IS NULL;
    RETURN jsonb_build_object(
      'saleId', v_sale.id,
      'invoiceNumber', v_sale.invoice_number,
      'convertedAt', v_sale.converted_at,
      'orderId', p_order_id,
      'alreadyConverted', true
    );
  END IF;

  IF v_order.status IS DISTINCT FROM 'DELIVERED' THEN
    RAISE EXCEPTION 'Convert to Sale requires Delivered status (current: %)', v_order.status;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record required before Convert to Sale';
  END IF;
  IF v_payment.status IS DISTINCT FROM 'PAID' THEN
    RAISE EXCEPTION 'Convert to Sale requires Payment Received (PAID)';
  END IF;

  v_discount := CASE
    WHEN v_order.adjustments < 0 THEN abs(v_order.adjustments)
    ELSE 0
  END;

  v_invoice := coalesce(
    nullif(btrim(v_order.invoice_number), ''),
    'INV-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8))
  );

  INSERT INTO public.sales (
    order_id, invoice_number, status, subtotal, discount, total, currency,
    converted_by_profile_id, converted_at
  )
  VALUES (
    p_order_id, v_invoice, 'COMPLETED',
    v_order.subtotal, v_discount, v_order.total, coalesce(v_order.currency, 'INR'),
    p_actor_profile_id, now()
  )
  RETURNING * INTO v_sale;

  v_sale_id := v_sale.id;

  FOR v_line IN
    SELECT * FROM public.order_lines WHERE order_id = p_order_id ORDER BY created_at ASC
  LOOP
    INSERT INTO public.sale_items (
      sale_id, order_line_id, sku_id, product_name, sku_code, sku_name,
      quantity, unit_price, discount, line_total
    )
    VALUES (
      v_sale_id, v_line.id, v_line.sku_id,
      coalesce(v_line.product_name_snapshot, v_line.sku_name_snapshot, 'Item'),
      coalesce(v_line.sku_code_snapshot, '—'),
      coalesce(v_line.sku_name_snapshot, '—'),
      v_line.quantity, v_line.agreed_unit_price, 0,
      coalesce(v_line.line_total, round(v_line.quantity * v_line.agreed_unit_price, 2))
    );
    v_item_count := v_item_count + 1;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Order has no lines to convert';
  END IF;

  INSERT INTO public.sales_payments (
    sale_id, payment_id, status, amount, collected_at
  )
  VALUES (
    v_sale_id, v_payment.id, 'PAID', v_payment.amount, coalesce(v_payment.paid_at, now())
  );

  UPDATE public.orders
  SET sale_id = v_sale_id, updated_at = now()
  WHERE id = p_order_id;

  -- Mark reservations fulfilled when present (no inventing movements)
  UPDATE public.stock_reservations
  SET status = 'FULFILLED', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('PENDING', 'RESERVED');

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, p_actor_profile_id, 'ADMIN',
    'DELIVERED', 'DELIVERED',
    format('Sale created · %s', v_invoice)
  );

  PERFORM public.write_audit_log(
    'order.converted_to_sale',
    'order',
    p_order_id,
    jsonb_build_object(
      'saleId', v_sale_id,
      'invoiceNumber', v_invoice,
      'itemCount', v_item_count,
      'auto', p_actor_profile_id IS DISTINCT FROM auth.uid() OR NOT public.is_admin()
    ),
    p_actor_profile_id,
    CASE WHEN public.is_admin() THEN 'ADMIN' ELSE 'DELIVERY' END
  );

  RETURN jsonb_build_object(
    'saleId', v_sale_id,
    'invoiceNumber', v_invoice,
    'convertedAt', v_sale.converted_at,
    'orderId', p_order_id,
    'alreadyConverted', false,
    'itemCount', v_item_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_convert_order_to_sale(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  RETURN public._convert_order_to_sale_core(p_order_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.try_auto_convert_order_to_sale(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment_status public.payment_status;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('converted', false, 'reason', 'Order not found');
  END IF;
  IF v_order.sale_id IS NOT NULL THEN
    RETURN jsonb_build_object('converted', true, 'alreadyConverted', true, 'saleId', v_order.sale_id);
  END IF;
  IF v_order.status IS DISTINCT FROM 'DELIVERED' THEN
    RETURN jsonb_build_object('converted', false, 'reason', 'Not delivered');
  END IF;

  SELECT status INTO v_payment_status FROM public.payments WHERE order_id = p_order_id;
  IF v_payment_status IS DISTINCT FROM 'PAID' THEN
    RETURN jsonb_build_object('converted', false, 'reason', 'Payment not PAID');
  END IF;

  BEGIN
    v_result := public._convert_order_to_sale_core(p_order_id, coalesce(auth.uid(), v_order.created_by_profile_id));
    RETURN v_result || jsonb_build_object('converted', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    )
    VALUES (
      p_order_id, auth.uid(), NULL, v_order.status, v_order.status,
      format('NEEDS_ATTENTION: Sale conversion failed — %s', SQLERRM)
    );
    RETURN jsonb_build_object('converted', false, 'reason', SQLERRM, 'needsAttention', true);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.try_auto_convert_order_to_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_auto_convert_order_to_sale(uuid) TO authenticated;

-- ─── Create invoice (document only — no stock) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_order_invoice(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_invoice text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status IN ('CANCELLED', 'DELIVERY_FAILED') THEN
    RAISE EXCEPTION 'Cannot create invoice for % order', v_order.status;
  END IF;

  IF public.order_status_happy_path_index(v_order.status) < 2 THEN
    RAISE EXCEPTION 'Confirm the order before creating an invoice (current: %)', v_order.status;
  END IF;

  IF v_order.invoice_number IS NOT NULL THEN
    RETURN jsonb_build_object(
      'orderId', p_order_id,
      'invoiceNumber', v_order.invoice_number,
      'invoiceCreatedAt', v_order.invoice_created_at,
      'alreadyCreated', true
    );
  END IF;

  v_invoice := 'INV-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8));

  UPDATE public.orders
  SET invoice_number = v_invoice,
      invoice_created_at = now(),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id, v_uid, 'ADMIN', NULL, v_order.status,
    format('Invoice created · %s', v_invoice)
  );

  PERFORM public.write_audit_log(
    'order.invoice_created',
    'order',
    p_order_id,
    jsonb_build_object('invoiceNumber', v_invoice),
    v_uid,
    'ADMIN'
  );

  -- Honest: invoice availability is order_events + audit only until SMS provider maps a dedicated template.
  -- Do not claim a delivery notification kind for invoices.

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'invoiceNumber', v_invoice,
    'invoiceCreatedAt', v_order.invoice_created_at,
    'alreadyCreated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_order_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_order_invoice(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_create_order_invoice IS
  'Creates pre-sale invoice number on order. Does not reserve stock or change status.';

-- ─── Auto-assign after pack ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.try_auto_assign_delivery(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_rec jsonb;
  v_slot_id uuid;
  v_driver uuid;
  v_vehicle uuid;
  v_route uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('assigned', false, 'reason', 'Order not found');
  END IF;

  IF v_order.status IS DISTINCT FROM 'READY_FOR_DISPATCH' THEN
    RETURN jsonb_build_object('assigned', false, 'reason', 'Not ready for dispatch');
  END IF;

  IF EXISTS (SELECT 1 FROM public.route_stops WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('assigned', true, 'alreadyAssigned', true);
  END IF;

  IF v_order.service_area_id IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), v_order.status, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — order has no service area'
    );
    RETURN jsonb_build_object('assigned', false, 'reason', 'No service area', 'needsAttention', true);
  END IF;

  SELECT id INTO v_slot_id
  FROM public.delivery_time_slots
  WHERE is_active
  ORDER BY sort_order
  LIMIT 1;

  IF v_slot_id IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), v_order.status, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — no time slots configured'
    );
    RETURN jsonb_build_object('assigned', false, 'reason', 'No time slots', 'needsAttention', true);
  END IF;

  v_rec := public.admin_recommend_delivery_assignment(v_order.service_area_id, v_today);
  v_driver := nullif(v_rec->>'deliveryProfileId', '')::uuid;
  v_vehicle := nullif(v_rec->>'vehicleId', '')::uuid;
  v_route := nullif(v_rec->>'existingRouteId', '')::uuid;

  IF v_driver IS NULL OR v_vehicle IS NULL THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), v_order.status, v_order.status,
      'NEEDS_ATTENTION: Automatic delivery assignment failed — no available driver/vehicle'
    );
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', 'No available driver/vehicle',
      'needsAttention', true
    );
  END IF;

  BEGIN
    v_result := public.admin_schedule_and_assign_delivery(
      ARRAY[p_order_id]::uuid[],
      v_driver,
      v_vehicle,
      v_today,
      v_slot_id,
      v_route,
      v_order.service_area_id
    );
    RETURN coalesce(v_result, '{}'::jsonb) || jsonb_build_object('assigned', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.order_events (
      order_id, actor_profile_id, from_status, to_status, note
    ) VALUES (
      p_order_id, auth.uid(), v_order.status, v_order.status,
      format('NEEDS_ATTENTION: Automatic delivery assignment failed — %s', SQLERRM)
    );
    RETURN jsonb_build_object('assigned', false, 'reason', SQLERRM, 'needsAttention', true);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.try_auto_assign_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_auto_assign_delivery(uuid) TO authenticated;

-- ─── Pack order (PROCESSING → READY) + auto-assign ───────────────────────────

CREATE OR REPLACE FUNCTION public.admin_start_packing(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  RETURN public.admin_advance_order_to(p_order_id, 'PROCESSING', 'Packing started');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_start_packing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_start_packing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_pack_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assign jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM public.admin_advance_order_to(
    p_order_id, 'READY_FOR_DISPATCH', 'Packed · ready for delivery'
  );

  v_assign := public.try_auto_assign_delivery(p_order_id);

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'status', 'READY_FOR_DISPATCH',
    'autoAssign', v_assign
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pack_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_pack_order(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_pack_order IS
  'Advances to READY_FOR_DISPATCH then attempts H5 auto schedule/assign. Idempotent assign if already on route.';

-- ─── Replace lines before packing (trusted) ──────────────────────────────────

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

  DELETE FROM public.order_lines WHERE order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_sku FROM public.skus WHERE id = (v_line->>'skuId')::uuid AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'SKU not found: %', v_line->>'skuId'; END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_sku.product_id;

    v_qty := (v_line->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    v_price := coalesce(
      nullif(v_line->>'unitPrice', '')::numeric,
      (
        SELECT sp.trade_price FROM public.sku_prices sp
        WHERE sp.sku_id = v_sku.id AND sp.effective_to IS NULL
        ORDER BY sp.effective_from DESC LIMIT 1
      ),
      0
    );

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
    p_order_id, v_uid, 'ADMIN', v_order.status, v_order.status,
    format('Order lines updated · %s line(s) · total %s', v_count, v_order.total)
  );

  PERFORM public.write_audit_log(
    'order.lines_replaced_admin',
    'order',
    p_order_id,
    jsonb_build_object('lineCount', v_count, 'subtotal', v_subtotal, 'total', v_order.total),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'lineCount', v_count,
    'subtotal', v_order.subtotal,
    'total', v_order.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_order_lines(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_order_lines(uuid, jsonb) TO authenticated;

-- ─── Needs attention rollup ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_orders_needing_attention(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.priority, x.updated_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      o.id AS order_id,
      o.status,
      o.total,
      o.updated_at,
      sh.trade_name AS shop_name,
      CASE
        WHEN o.status = 'DELIVERY_FAILED' THEN 'delivery_failed'
        WHEN o.status = 'READY_FOR_DISPATCH'
          AND NOT EXISTS (SELECT 1 FROM public.route_stops rs WHERE rs.order_id = o.id)
          THEN 'assignment_pending'
        WHEN o.status = 'DELIVERED'
          AND o.sale_id IS NULL
          AND EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status = 'PAID')
          THEN 'sale_conversion_pending'
        WHEN EXISTS (
          SELECT 1 FROM public.order_events oe
          WHERE oe.order_id = o.id
            AND oe.note ILIKE 'NEEDS_ATTENTION:%'
            AND oe.created_at > now() - interval '7 days'
        ) THEN 'exception_flag'
        WHEN EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.order_id = o.id AND p.status = 'FAILED'
        ) THEN 'payment_failed'
        ELSE 'other'
      END AS reason_code,
      CASE
        WHEN o.status = 'DELIVERY_FAILED' THEN 1
        WHEN EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status = 'FAILED') THEN 2
        WHEN o.status = 'DELIVERED' AND o.sale_id IS NULL THEN 3
        WHEN o.status = 'READY_FOR_DISPATCH' THEN 4
        ELSE 5
      END AS priority
    FROM public.orders o
    JOIN public.shops sh ON sh.id = o.shop_id
    WHERE o.status IS DISTINCT FROM 'CANCELLED'
      AND (
        o.status = 'DELIVERY_FAILED'
        OR (o.status = 'READY_FOR_DISPATCH'
            AND NOT EXISTS (SELECT 1 FROM public.route_stops rs WHERE rs.order_id = o.id))
        OR (o.status = 'DELIVERED' AND o.sale_id IS NULL
            AND EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status = 'PAID'))
        OR EXISTS (
          SELECT 1 FROM public.order_events oe
          WHERE oe.order_id = o.id AND oe.note ILIKE 'NEEDS_ATTENTION:%'
            AND oe.created_at > now() - interval '7 days'
        )
        OR EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.order_id = o.id AND p.status = 'FAILED'
        )
      )
    LIMIT greatest(coalesce(p_limit, 50), 1)
  ) x;

  RETURN jsonb_build_object('orders', v_rows, 'count', jsonb_array_length(v_rows));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_orders_needing_attention(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_orders_needing_attention(integer) TO authenticated;

-- ─── Auto-convert hooks (thin wrappers calling try_auto_convert) ─────────────

CREATE OR REPLACE FUNCTION public._lifecycle_after_payment_or_delivery(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.order_status;
BEGIN
  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id;
  IF v_status = 'DELIVERED' THEN
    PERFORM public.try_auto_convert_order_to_sale(p_order_id);
  END IF;
END;
$$;

-- Patch mark-payment to auto-convert when already delivered
CREATE OR REPLACE FUNCTION public.admin_mark_payment_received(
  p_order_id uuid,
  p_collection_method public.payment_collection_method DEFAULT 'CASH_ON_DELIVERY',
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency, paid_at
    )
    VALUES (
      p_order_id,
      'PAID',
      CASE
        WHEN p_collection_method = 'ONLINE_GATEWAY' THEN 'PAY_ONLINE_NOW'::public.payment_method_intent
        ELSE 'PAY_ON_DELIVERY'::public.payment_method_intent
      END,
      p_collection_method,
      v_order.total,
      coalesce(v_order.currency, 'INR'),
      now()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id, NULL, 'PAID', v_uid, 'ADMIN',
      coalesce(p_note, 'Payment marked received by admin')
    );
  ELSE
    IF v_payment.status = 'PAID' THEN
      NULL;
    ELSE
      v_from := v_payment.status;
      UPDATE public.payments
      SET status = 'PAID',
          collection_method = p_collection_method,
          amount = coalesce(nullif(v_payment.amount, 0), v_order.total),
          paid_at = now(),
          updated_at = now()
      WHERE id = v_payment.id
      RETURNING * INTO v_payment;

      INSERT INTO public.payment_events (
        payment_id, from_status, to_status, actor_profile_id, actor_role, note
      )
      VALUES (
        v_payment.id, v_from, 'PAID', v_uid, 'ADMIN',
        coalesce(p_note, 'Payment marked received by admin')
      );
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);

  RETURN v_payment.id;
END;
$$;

COMMENT ON FUNCTION public.admin_mark_payment_received IS
  'Orders H1 + lifecycle: mark PAID; auto-convert when order already DELIVERED.';

-- Note: delivery_complete_stop / delivery_collect_cod auto-convert is applied by
-- wrapping try_auto_convert in a AFTER-style call via dedicated patch functions
-- invoked from the existing SECURITY DEFINER bodies in a follow-up REPLACE below.

CREATE OR REPLACE FUNCTION public.delivery_complete_stop(
  p_stop_id uuid,
  p_notes text DEFAULT NULL,
  p_photo_captured boolean DEFAULT false,
  p_signature_captured boolean DEFAULT false,
  p_collect_cod_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_from public.order_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop not found'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  IF p_collect_cod_amount IS NOT NULL THEN
    PERFORM public.delivery_collect_cod(v_stop.order_id, p_collect_cod_amount, 'CASH_ON_DELIVERY');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = v_stop.order_id;
  IF NOT FOUND OR v_payment.status <> 'PAID' THEN
    IF FOUND AND v_payment.method_intent = 'PAY_ON_DELIVERY' THEN
      RAISE EXCEPTION 'Collect COD before marking delivered';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment record required before delivery confirmation';
    END IF;
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY' THEN
    IF v_order.status IN ('ASSIGNED_TO_ROUTE', 'READY_FOR_DISPATCH') THEN
      UPDATE public.orders SET status = 'OUT_FOR_DELIVERY', updated_at = now() WHERE id = v_order.id;
      INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
      VALUES (v_order.id, v_uid, v_from, 'OUT_FOR_DELIVERY', 'Auto out-for-delivery before complete');
      v_from := 'OUT_FOR_DELIVERY';
    ELSIF v_order.status <> 'OUT_FOR_DELIVERY' THEN
      RAISE EXCEPTION 'Order must be OUT_FOR_DELIVERY to complete (current %)', v_order.status;
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'DELIVERED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (v_order.id, v_uid, 'OUT_FOR_DELIVERY', 'DELIVERED', COALESCE(p_notes, 'Delivered'));

  INSERT INTO public.delivery_attempts (
    route_stop_id, order_id, succeeded, failure_reason, failure_note,
    delivery_notes, photo_captured, signature_captured
  )
  VALUES (
    p_stop_id, v_order.id, true, NULL, NULL,
    p_notes, COALESCE(p_photo_captured, false), COALESCE(p_signature_captured, false)
  );

  UPDATE public.route_stops
  SET status = 'COMPLETED', updated_at = now()
  WHERE id = p_stop_id;

  BEGIN
    PERFORM public._delivery_record_notification(
      v_order.id,
      'DELIVERY_COMPLETED',
      'Your order has been delivered successfully.',
      jsonb_build_object('stopId', p_stop_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM public.try_auto_convert_order_to_sale(v_order.id);

  RETURN p_stop_id;
END;
$$;

COMMENT ON FUNCTION public.delivery_complete_stop IS
  'H3/H5 + lifecycle: deliver stop then try_auto_convert_order_to_sale when PAID.';

