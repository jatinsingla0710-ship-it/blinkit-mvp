-- P0: Consume reserved inventory when converting a delivered+paid order to a sale.
-- Reuses inventory_balances, stock_reservations, inventory_movements (ORDER_DISPATCH),
-- and existing _convert_order_to_sale_core / admin_refund_converted_sale.
-- Does NOT invent a second inventory system.
--
-- Before (bug): convert marked reservations FULFILLED without reducing on_hand/reserved.
-- After: convert deducts from the exact reservation warehouse, clears reserved, writes
-- ORDER_DISPATCH, then marks FULFILLED — all in the same transaction as the sale.

-- ─── 1) Consume reserved stock for an order (exact reservation locations) ─────

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
  v_line_count integer := 0;
  v_active_res_count integer := 0;
BEGIN
  IF current_setting('groaurum.trusted_server_action', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Trusted server action required';
  END IF;

  SELECT count(*)::integer
  INTO v_line_count
  FROM public.order_lines
  WHERE order_id = p_order_id;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Order has no lines to fulfill inventory for';
  END IF;

  SELECT count(*)::integer
  INTO v_active_res_count
  FROM public.stock_reservations
  WHERE order_id = p_order_id
    AND status IN ('PENDING', 'RESERVED');

  IF v_active_res_count = 0 THEN
    -- Idempotent re-entry: if already fulfilled AND dispatch ledger exists, no-op.
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

REVOKE ALL ON FUNCTION public._consume_reserved_inventory_for_order(uuid, uuid) FROM PUBLIC;
-- Trusted internal helper only (called from SECURITY DEFINER convert path).

COMMENT ON FUNCTION public._consume_reserved_inventory_for_order(uuid, uuid) IS
  'Consumes PENDING/RESERVED stock_reservations at their exact operational_location: decreases on_hand and reserved, appends ORDER_DISPATCH, marks FULFILLED. Idempotent when already dispatched.';

-- ─── 2) Sale convert core — consume inventory inside the same transaction ───

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
    'inventoryConsume', v_consume
  );
END;
$$;

COMMENT ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) IS
  'Converts DELIVERED+PAID order to sale. Consumes reserved inventory (ORDER_DISPATCH) at reservation locations before creating sale rows. Idempotent via orders.sale_id / sales.order_id.';

-- ─── 3) Refund restock compatible with ORDER_DISPATCH consumption ───────────

CREATE OR REPLACE FUNCTION public.admin_refund_converted_sale(
  p_order_id uuid,
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT false
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
  v_sale public.sales%ROWTYPE;
  v_from public.payment_status;
  v_reason text;
  v_item RECORD;
  v_location_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_restocked int := 0;
  v_sale_updated boolean := false;
  v_dispatch_qty numeric(12, 3);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Refund reason is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IS DISTINCT FROM 'DELIVERED' AND v_order.sale_id IS NULL THEN
    RAISE EXCEPTION
      'Full return/refund requires a delivered order or a converted sale (current: %)',
      v_order.status;
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found for order';
  END IF;

  IF v_payment.status = 'REFUNDED' THEN
    IF v_order.sale_id IS NOT NULL THEN
      SELECT * INTO v_sale FROM public.sales WHERE id = v_order.sale_id;
    END IF;
    RETURN jsonb_build_object(
      'orderId', p_order_id,
      'paymentId', v_payment.id,
      'saleId', v_sale.id,
      'status', 'REFUNDED',
      'alreadyRefunded', true,
      'restockedItemCount', 0
    );
  END IF;

  IF v_payment.status IS DISTINCT FROM 'PAID' THEN
    RAISE EXCEPTION
      'Refund requires PAID payment (current: %)',
      v_payment.status;
  END IF;

  v_from := v_payment.status;

  UPDATE public.payments
  SET status = 'REFUNDED',
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (
    payment_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_payment.id,
    v_from,
    'REFUNDED',
    v_uid,
    'ADMIN',
    v_reason
  );

  IF v_order.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = v_order.sale_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.sales
      SET status = 'REFUNDED',
          updated_at = now()
      WHERE id = v_sale.id;

      UPDATE public.sales_payments
      SET status = 'REFUNDED'
      WHERE sale_id = v_sale.id;

      v_sale_updated := true;
    END IF;
  ELSE
    SELECT * INTO v_sale FROM public.sales WHERE order_id = p_order_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.orders
      SET sale_id = COALESCE(sale_id, v_sale.id),
          updated_at = now()
      WHERE id = p_order_id;

      UPDATE public.sales
      SET status = 'REFUNDED',
          updated_at = now()
      WHERE id = v_sale.id;

      UPDATE public.sales_payments
      SET status = 'REFUNDED'
      WHERE sale_id = v_sale.id;

      v_sale_updated := true;
    END IF;
  END IF;

  -- Optional restock: reverse ORDER_DISPATCH at the fulfilled reservation location.
  IF p_restock THEN
    IF NOT v_sale_updated OR v_sale.id IS NULL THEN
      RAISE EXCEPTION
        'Restock requires a converted sale with sale_items; inventory adjust manually otherwise';
    END IF;

    FOR v_item IN
      SELECT *
      FROM public.sale_items
      WHERE sale_id = v_sale.id
      ORDER BY created_at ASC
    LOOP
      IF v_item.sku_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot restock sale item %: missing sku_id',
          v_item.id;
      END IF;

      -- No double restock for the same order+sku.
      IF EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.reference_type = 'order'
          AND im.reference_id = p_order_id
          AND im.sku_id = v_item.sku_id
          AND im.movement_type = 'RETURN'
      ) THEN
        CONTINUE;
      END IF;

      -- Only restock when fulfillment actually consumed stock.
      SELECT abs(sum(im.quantity_delta))
      INTO v_dispatch_qty
      FROM public.inventory_movements im
      WHERE im.reference_type = 'order'
        AND im.reference_id = p_order_id
        AND im.sku_id = v_item.sku_id
        AND im.movement_type = 'ORDER_DISPATCH';

      IF v_dispatch_qty IS NULL OR v_dispatch_qty <= 0 THEN
        RAISE EXCEPTION
          'Cannot restock SKU %: no ORDER_DISPATCH consumption for this order (nothing to reverse)',
          v_item.sku_id;
      END IF;

      SELECT sr.operational_location_id
      INTO v_location_id
      FROM public.stock_reservations sr
      WHERE sr.order_id = p_order_id
        AND sr.sku_id = v_item.sku_id
        AND sr.status = 'FULFILLED'
      ORDER BY sr.updated_at DESC
      LIMIT 1;

      IF v_location_id IS NULL THEN
        SELECT im.operational_location_id
        INTO v_location_id
        FROM public.inventory_movements im
        WHERE im.reference_type = 'order'
          AND im.reference_id = p_order_id
          AND im.sku_id = v_item.sku_id
          AND im.movement_type = 'ORDER_DISPATCH'
        ORDER BY im.created_at DESC
        LIMIT 1;
      END IF;

      IF v_location_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot restock SKU %: no stock reservation/dispatch location for this order',
          v_item.sku_id;
      END IF;

      SELECT *
      INTO v_balance
      FROM public.inventory_balances
      WHERE sku_id = v_item.sku_id
        AND operational_location_id = v_location_id
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.inventory_balances (
          sku_id, operational_location_id, on_hand_quantity, reserved_quantity
        )
        VALUES (v_item.sku_id, v_location_id, 0, 0)
        RETURNING * INTO v_balance;

        SELECT *
        INTO v_balance
        FROM public.inventory_balances
        WHERE id = v_balance.id
        FOR UPDATE;
      END IF;

      -- Restock the fulfilled sale quantity (matches sale_items / original reservation).
      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_item.quantity,
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
        v_item.sku_id,
        v_location_id,
        'RETURN',
        v_item.quantity,
        v_reason,
        'order',
        p_order_id,
        v_uid
      );

      v_restocked := v_restocked + 1;
    END LOOP;
  END IF;

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id,
    v_uid,
    'ADMIN',
    NULL,
    v_order.status,
    'Full return/refund recorded: ' || v_reason
  );

  PERFORM public.write_audit_log(
    'sale.refunded_admin',
    'order',
    p_order_id,
    jsonb_build_object(
      'paymentId', v_payment.id,
      'saleId', v_sale.id,
      'reason', v_reason,
      'restock', p_restock,
      'restockedItemCount', v_restocked,
      'amount', v_payment.amount
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'saleId', v_sale.id,
    'status', 'REFUNDED',
    'alreadyRefunded', false,
    'restockedItemCount', v_restocked,
    'amount', v_payment.amount
  );
END;
$$;

COMMENT ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) IS
  'Refunds PAID converted sale. Optional restock reverses ORDER_DISPATCH at the fulfilled warehouse exactly once (RETURN movement). Idempotent when already REFUNDED.';
