-- Sales H3: safe full-order Returns & Refunds on existing schema.
-- No new domain tables. Uses payments.REFUNDED, payment_events, sales /
-- sales_payments status text, inventory RETURN movements, order_events notes,
-- write_audit_log. Does not reverse DELIVERED. No partial / RMA / Razorpay.

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

  -- Optional restock: full sale_items qty back to the fulfilled reservation location.
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

      SELECT sr.operational_location_id
      INTO v_location_id
      FROM public.stock_reservations sr
      WHERE sr.order_id = p_order_id
        AND sr.sku_id = v_item.sku_id
        AND sr.status = 'FULFILLED'
      ORDER BY sr.updated_at DESC
      LIMIT 1;

      IF v_location_id IS NULL THEN
        SELECT sr.operational_location_id
        INTO v_location_id
        FROM public.stock_reservations sr
        WHERE sr.order_id = p_order_id
          AND sr.sku_id = v_item.sku_id
        ORDER BY sr.updated_at DESC
        LIMIT 1;
      END IF;

      IF v_location_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot restock SKU %: no stock reservation location for this order; use inventory adjust with note RETURN_PILOT|%',
          v_item.sku_id,
          p_order_id;
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

REVOKE ALL ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) IS
  'Sales H3: full-order return/refund — PAID→REFUNDED, optional RETURN restock from sale_items; does not reverse DELIVERED; no partial/RMA/Razorpay.';
