-- Accrue fixed-per-unit salesman commission inside successful sale conversion.
-- Does not reverse on refund. Does not change pricing/inventory/payment logic.

-- Idempotency: at most one EARNED ledger row per sale_item.
CREATE UNIQUE INDEX IF NOT EXISTS salesman_commission_entries_one_earned_per_sale_item
  ON public.salesman_commission_entries (sale_item_id)
  WHERE status = 'EARNED'::public.salesman_commission_entry_status;

COMMENT ON INDEX public.salesman_commission_entries_one_earned_per_sale_item IS
  'Prevents duplicate EARNED commission rows if convert/accrual is retried.';

-- ─── Helper: accrue after sale_items exist ───────────────────────────────────

CREATE OR REPLACE FUNCTION public._accrue_salesman_commission_for_sale(
  p_order_id uuid,
  p_sale_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_earning public.salesman_earning_model;
  v_as_of date;
  v_item RECORD;
  v_rate numeric(12, 2);
  v_amount numeric(12, 2);
  v_created integer := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Only assisted salesman sales earn commission.
  IF v_order.source IS DISTINCT FROM 'SALESMAN_ASSISTED'::public.order_source THEN
    RETURN 0;
  END IF;

  IF v_order.created_by_profile_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT earning_model
  INTO v_earning
  FROM public.salesman_employment
  WHERE profile_id = v_order.created_by_profile_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_earning NOT IN (
    'COMMISSION'::public.salesman_earning_model,
    'SALARY_PLUS_COMMISSION'::public.salesman_earning_model
  ) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_as_of := coalesce(v_sale.converted_at::date, CURRENT_DATE);

  FOR v_item IN
    SELECT si.*
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
    ORDER BY si.created_at ASC, si.id ASC
  LOOP
    IF v_item.sku_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip if an EARNED row already exists (idempotent with unique index).
    IF EXISTS (
      SELECT 1
      FROM public.salesman_commission_entries e
      WHERE e.sale_item_id = v_item.id
        AND e.status = 'EARNED'::public.salesman_commission_entry_status
    ) THEN
      CONTINUE;
    END IF;

    SELECT t.fixed_amount_per_unit
    INTO v_rate
    FROM public.sku_commission_terms t
    WHERE t.sku_id = v_item.sku_id
      AND t.effective_from <= v_as_of
      AND (t.effective_to IS NULL OR t.effective_to >= v_as_of)
    ORDER BY t.effective_from DESC
    LIMIT 1;

    IF NOT FOUND OR v_rate IS NULL THEN
      CONTINUE;
    END IF;

    v_amount := round(v_item.quantity * v_rate, 2);

    BEGIN
      INSERT INTO public.salesman_commission_entries (
        salesman_profile_id,
        sale_id,
        sale_item_id,
        order_id,
        sku_id,
        quantity,
        unit_commission,
        commission_amount,
        status
      ) VALUES (
        v_order.created_by_profile_id,
        p_sale_id,
        v_item.id,
        p_order_id,
        v_item.sku_id,
        v_item.quantity,
        v_rate,
        v_amount,
        'EARNED'::public.salesman_commission_entry_status
      );
      v_created := v_created + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- Concurrent/retry path: keep conversion successful.
        NULL;
    END;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_salesman_commission_for_sale(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._accrue_salesman_commission_for_sale(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._accrue_salesman_commission_for_sale(uuid, uuid) FROM authenticated;

COMMENT ON FUNCTION public._accrue_salesman_commission_for_sale(uuid, uuid) IS
  'Internal: after sale_items exist, accrue EARNED fixed-per-unit commission for SALESMAN_ASSISTED orders when earning_model is COMMISSION or SALARY_PLUS_COMMISSION. Idempotent per sale_item.';

-- ─── Replace convert core: call accrual after sale_items ─────────────────────

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
  v_consume jsonb;
  v_commission_count integer := 0;
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

  -- Inventory first: if consumption fails, sale insert never commits.
  v_consume := public._consume_reserved_inventory_for_order(
    p_order_id,
    p_actor_profile_id
  );

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

  -- Commission accrual (no-op when ineligible / no terms). Never fails the sale.
  v_commission_count := public._accrue_salesman_commission_for_sale(
    p_order_id,
    v_sale_id
  );

  INSERT INTO public.sales_payments (
    sale_id, payment_id, status, amount, collected_at
  )
  VALUES (
    v_sale_id, v_payment.id, 'PAID', v_payment.amount, coalesce(v_payment.paid_at, now())
  );

  UPDATE public.orders
  SET sale_id = v_sale_id, updated_at = now()
  WHERE id = p_order_id;

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
    format(
      'Sale created · %s · inventory consumed (%s packs across %s reservations)',
      v_invoice,
      coalesce(v_consume ->> 'totalQuantity', '0'),
      coalesce(v_consume ->> 'consumedReservationCount', '0')
    )
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
      'inventoryConsume', v_consume,
      'commissionEntries', v_commission_count,
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
    'itemCount', v_item_count,
    'inventoryConsume', v_consume,
    'commissionEntries', v_commission_count
  );
END;
$$;

COMMENT ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) IS
  'Converts DELIVERED+PAID order to sale. Consumes reserved inventory before sale rows; accrues salesman commission for eligible SALESMAN_ASSISTED orders. Idempotent via orders.sale_id / sales.order_id / one EARNED commission per sale_item.';
