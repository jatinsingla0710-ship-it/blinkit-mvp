-- Fix PG 23514 on Complete Delivery after full cash payment.
--
-- Exact constraint (verified on remote):
--   public.order_events.order_events_status_changed
--   CHECK (from_status IS DISTINCT FROM to_status)
--
-- Failing value inserted by _convert_order_to_sale_core after delivery_complete_stop:
--   from_status = 'DELIVERED', to_status = 'DELIVERED'
--
-- Flow:
--   delivery_record_cash_payment (full cash, remaining 0) → PAID
--   delivery_complete_stop → order DELIVERED + OFD→DELIVERED event (valid)
--   try_auto_convert_order_to_sale → _convert_order_to_sale_core
--     → INSERT order_events DELIVERED→DELIVERED → 23514 aborts whole TX
--
-- Fix: informational order_events use from_status NULL (same pattern as invoice events).
-- Do NOT drop/weaken order_events_status_changed.

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

  UPDATE public.stock_reservations
  SET status = 'FULFILLED', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('PENDING', 'RESERVED');

  -- Informational note only — must NOT use same from/to (order_events_status_changed).
  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id,
    p_actor_profile_id,
    'ADMIN'::public.staff_role,
    NULL,
    'DELIVERED'::public.order_status,
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
    v_result := public._convert_order_to_sale_core(
      p_order_id,
      coalesce(auth.uid(), v_order.created_by_profile_id)
    );
    RETURN v_result || jsonb_build_object('converted', true);
  EXCEPTION WHEN OTHERS THEN
    -- Informational NEEDS_ATTENTION note; from_status NULL satisfies status_changed CHECK.
    INSERT INTO public.order_events (
      order_id, actor_profile_id, actor_role, from_status, to_status, note
    )
    VALUES (
      p_order_id,
      auth.uid(),
      NULL,
      NULL,
      v_order.status,
      format('NEEDS_ATTENTION: Sale conversion failed — %s', SQLERRM)
    );
    RETURN jsonb_build_object('converted', false, 'reason', SQLERRM, 'needsAttention', true);
  END;
END;
$$;

COMMENT ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) IS
  'Convert delivered+PAID order to sale. Informational order_events use from_status NULL (23514 fix).';

COMMENT ON FUNCTION public.try_auto_convert_order_to_sale(uuid) IS
  'Best-effort auto sale conversion after delivery; never violates order_events_status_changed.';
