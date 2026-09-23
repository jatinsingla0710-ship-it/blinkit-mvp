-- Orders H2: trusted admin_convert_order_to_sale (atomic sales conversion).
-- Replaces client multi-table CRUD. Uses existing sales / sale_items / sales_payments.
-- Does not invent tables or change order status (stays DELIVERED).

CREATE OR REPLACE FUNCTION public.admin_convert_order_to_sale(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_sale_id uuid;
  v_invoice text;
  v_discount numeric(12, 2);
  v_line RECORD;
  v_item_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotent: already converted
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
    SET sale_id = v_sale.id,
        updated_at = now()
    WHERE id = p_order_id
      AND sale_id IS NULL;

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

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

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

  v_invoice := 'INV-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8));

  INSERT INTO public.sales (
    order_id,
    invoice_number,
    status,
    subtotal,
    discount,
    total,
    currency,
    converted_by_profile_id,
    converted_at
  )
  VALUES (
    p_order_id,
    v_invoice,
    'COMPLETED',
    v_order.subtotal,
    v_discount,
    v_order.total,
    COALESCE(v_order.currency, 'INR'),
    v_uid,
    now()
  )
  RETURNING * INTO v_sale;

  v_sale_id := v_sale.id;

  FOR v_line IN
    SELECT *
    FROM public.order_lines
    WHERE order_id = p_order_id
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.sale_items (
      sale_id,
      order_line_id,
      sku_id,
      product_name,
      sku_code,
      sku_name,
      quantity,
      unit_price,
      discount,
      line_total
    )
    VALUES (
      v_sale_id,
      v_line.id,
      v_line.sku_id,
      COALESCE(v_line.product_name_snapshot, v_line.sku_name_snapshot, 'Item'),
      COALESCE(v_line.sku_code_snapshot, '—'),
      COALESCE(v_line.sku_name_snapshot, '—'),
      v_line.quantity,
      v_line.agreed_unit_price,
      0,
      COALESCE(v_line.line_total, round(v_line.quantity * v_line.agreed_unit_price, 2))
    );
    v_item_count := v_item_count + 1;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Order has no lines to convert';
  END IF;

  INSERT INTO public.sales_payments (
    sale_id,
    payment_id,
    status,
    amount,
    collected_at
  )
  VALUES (
    v_sale_id,
    v_payment.id,
    'PAID',
    v_payment.amount,
    COALESCE(v_payment.paid_at, now())
  );

  UPDATE public.orders
  SET sale_id = v_sale_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- Audit event without status change (from NULL → current DELIVERED)
  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id,
    v_uid,
    'ADMIN',
    NULL,
    'DELIVERED',
    format('Converted to sale · %s · Completed', v_sale.invoice_number)
  );

  PERFORM public.write_audit_log(
    'order.converted_to_sale',
    'sale',
    v_sale_id,
    jsonb_build_object(
      'orderId', p_order_id,
      'invoiceNumber', v_sale.invoice_number,
      'total', v_sale.total,
      'itemCount', v_item_count
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'saleId', v_sale_id,
    'invoiceNumber', v_sale.invoice_number,
    'convertedAt', v_sale.converted_at,
    'orderId', p_order_id,
    'alreadyConverted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_convert_order_to_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_convert_order_to_sale(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_convert_order_to_sale(uuid) IS
  'Orders H2: atomic Convert to Sale — delivered + PAID required; writes sales/sale_items/sales_payments and orders.sale_id.';
