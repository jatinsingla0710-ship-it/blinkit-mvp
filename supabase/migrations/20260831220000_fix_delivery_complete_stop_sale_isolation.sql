-- Fix: Delivery PWA "Complete Delivery" rolls back when sale conversion fails.
--
-- Execution path:
--   StopDetailPage → deliveryApi.completeStop
--   → RPC delivery_complete_stop
--   → order DELIVERED + stop COMPLETED
--   → PERFORM try_auto_convert_order_to_sale
--   → _convert_order_to_sale_core
--
-- Historical failures (already patched in 20260827210000 / 20260827220000, re-asserted here):
--   1) order_events DELIVERED→DELIVERED violates order_events_status_changed (23514)
--   2) write_audit_log 6th arg typed as text instead of staff_role
--   3) try_auto_convert EXCEPTION handler also inserted same from/to → 23514 escapes
--
-- Critical gap this migration closes:
--   delivery_complete_stop (20260827150000) calls try_auto_convert WITHOUT isolation.
--   Any exception that escapes try_auto_convert aborts the whole TX → delivery not completed.
--
-- Fix:
--   - Re-apply safe convert core + try_auto_convert
--   - Isolate sale conversion inside delivery_complete_stop (delivery must succeed independently)
--   - Idempotent re-complete when stop already COMPLETED
--   - Clearer payment gate messages for drivers
-- Do NOT weaken order_events_status_changed. Do NOT invent payments.

-- ─── 1) Sale convert core (23514 + staff_role audit) ─────────────────────────

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
  v_actor_role public.staff_role;
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

  -- Informational — from_status NULL satisfies order_events_status_changed.
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

  v_actor_role := CASE
    WHEN public.is_admin() THEN 'ADMIN'::public.staff_role
    ELSE 'DELIVERY'::public.staff_role
  END;

  PERFORM public.write_audit_log(
    'order.converted_to_sale'::text,
    'order'::text,
    p_order_id,
    jsonb_build_object(
      'saleId', v_sale_id,
      'invoiceNumber', v_invoice,
      'itemCount', v_item_count,
      'auto', p_actor_profile_id IS DISTINCT FROM auth.uid() OR NOT public.is_admin()
    ),
    p_actor_profile_id,
    v_actor_role
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

-- ─── 2) Best-effort auto convert (never violates same-status events) ─────────

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
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN jsonb_build_object('converted', false, 'reason', SQLERRM, 'needsAttention', true);
  END;
END;
$$;

-- ─── 3) Complete stop — delivery succeeds even if sale conversion fails ──────

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

  -- Idempotent: already completed stop → success (no duplicate side effects).
  IF v_stop.status = 'COMPLETED'::public.route_stop_status THEN
    RETURN p_stop_id;
  END IF;

  IF v_stop.status = 'FAILED'::public.route_stop_status THEN
    RAISE EXCEPTION 'Stop already marked failed; reopen via admin before completing';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_from := v_order.status;

  IF p_collect_cod_amount IS NOT NULL THEN
    PERFORM public.delivery_collect_cod(v_stop.order_id, p_collect_cod_amount, 'CASH_ON_DELIVERY');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = v_stop.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record required before delivery confirmation';
  END IF;

  IF v_payment.status IS DISTINCT FROM 'PAID'::public.payment_status THEN
    IF v_payment.method_intent = 'PAY_ON_DELIVERY'::public.payment_method_intent THEN
      RAISE EXCEPTION
        'Collect ₹% cash before completing delivery (payment still %)',
        round(coalesce(v_order.total, 0) - coalesce(v_payment.cash_collected_amount, 0)
          - coalesce(v_payment.online_collected_amount, 0), 2),
        v_payment.status;
    END IF;
    RAISE EXCEPTION
      'Payment must be PAID before completing delivery (current: %)',
      v_payment.status;
  END IF;

  -- Already delivered order with open stop (rare) — finish stop only.
  IF v_order.status = 'DELIVERED'::public.order_status THEN
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
      PERFORM public.try_auto_convert_order_to_sale(v_order.id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN p_stop_id;
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY'::public.order_status THEN
    IF v_order.status IN (
      'ASSIGNED_TO_ROUTE'::public.order_status,
      'READY_FOR_DISPATCH'::public.order_status
    ) THEN
      UPDATE public.orders
      SET status = 'OUT_FOR_DELIVERY', updated_at = now()
      WHERE id = v_order.id;
      INSERT INTO public.order_events (
        order_id, actor_profile_id, from_status, to_status, note
      )
      VALUES (
        v_order.id, v_uid, v_from, 'OUT_FOR_DELIVERY',
        'Auto out-for-delivery before complete'
      );
      v_from := 'OUT_FOR_DELIVERY'::public.order_status;
    ELSE
      RAISE EXCEPTION
        'Order must be out for delivery to complete (current %)',
        v_order.status;
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'DELIVERED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, from_status, to_status, note
  )
  VALUES (
    v_order.id, v_uid, 'OUT_FOR_DELIVERY', 'DELIVERED',
    COALESCE(p_notes, 'Delivered')
  );

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

  -- Sale conversion must NEVER roll back a successful delivery.
  BEGIN
    PERFORM public.try_auto_convert_order_to_sale(v_order.id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.order_events (
        order_id, actor_profile_id, actor_role, from_status, to_status, note
      )
      VALUES (
        v_order.id,
        v_uid,
        NULL,
        NULL,
        'DELIVERED'::public.order_status,
        format('NEEDS_ATTENTION: Sale conversion failed after delivery — %s', SQLERRM)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN p_stop_id;
END;
$$;

COMMENT ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) IS
  'Convert delivered+PAID order to sale. Informational events use from_status NULL; audit uses staff_role.';

COMMENT ON FUNCTION public.try_auto_convert_order_to_sale(uuid) IS
  'Best-effort auto sale conversion; never raises; never violates order_events_status_changed.';

COMMENT ON FUNCTION public.delivery_complete_stop(uuid, text, boolean, boolean, numeric) IS
  'Confirm delivery stop. Requires PAID. Isolates try_auto_convert so sale failures do not roll back delivery.';
