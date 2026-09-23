-- Payment cash vs online split (amounts on payments) + correct dashboard Card 5/6.
-- CUSTOMER PAID ≠ ADMIN RECEIVED. No payment-provider / QR integration.

-- ─── Amount split columns (not new statuses) ─────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cash_collected_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (cash_collected_amount >= 0);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS online_collected_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (online_collected_amount >= 0);

COMMENT ON COLUMN public.payments.cash_collected_amount IS
  'Cash collected from customer (may be WITH_DRIVER until Admin settlement).';
COMMENT ON COLUMN public.payments.online_collected_amount IS
  'Online amount confirmed by provider/webhook only — never driver-typed.';

-- Online dynamic payment provider gate (false until wired later)
CREATE OR REPLACE FUNCTION public.payment_online_provider_configured()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

COMMENT ON FUNCTION public.payment_online_provider_configured() IS
  'Dynamic order online payment / QR provider. False until a real provider is connected.';

REVOKE ALL ON FUNCTION public.payment_online_provider_configured() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_online_provider_configured() TO authenticated;

-- ─── Record cash at stop: remaining = due − cash − confirmed online ──────────

CREATE OR REPLACE FUNCTION public.delivery_record_cash_payment(
  p_order_id uuid,
  p_cash_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route_id uuid;
  v_driver uuid;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_due numeric(12, 2);
  v_cash numeric(12, 2);
  v_online numeric(12, 2);
  v_remaining numeric(12, 2);
  v_from public.payment_status;
  v_actor_role text;
  v_new_status public.payment_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_cash_amount IS NULL OR p_cash_amount < 0 THEN
    RAISE EXCEPTION 'Cash amount must be zero or positive';
  END IF;

  SELECT rs.route_id, dr.assigned_delivery_profile_id
  INTO v_route_id, v_driver
  FROM public.route_stops rs
  JOIN public.delivery_routes dr ON dr.id = rs.route_id
  WHERE rs.order_id = p_order_id
  LIMIT 1;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Order is not on a delivery route';
  END IF;

  IF public.is_admin() THEN
    v_actor_role := 'ADMIN';
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_due := coalesce(v_order.total, 0);
  v_cash := round(p_cash_amount, 2);

  IF v_cash > v_due THEN
    RAISE EXCEPTION 'Cash received (₹%) cannot exceed amount due (₹%)', v_cash, v_due;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;

  v_online := CASE WHEN FOUND THEN coalesce(v_payment.online_collected_amount, 0) ELSE 0 END;

  IF v_cash + v_online > v_due THEN
    RAISE EXCEPTION 'Cash + online (₹%) exceeds amount due (₹%)', v_cash + v_online, v_due;
  END IF;

  v_remaining := round(v_due - v_cash - v_online, 2);
  v_new_status := CASE
    WHEN v_remaining <= 0 THEN 'PAID'::public.payment_status
    WHEN v_cash > 0 OR v_online > 0 THEN 'PAYMENT_PENDING'::public.payment_status
    ELSE 'UNPAID'::public.payment_status
  END;

  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id,
      v_new_status,
      'PAY_ON_DELIVERY',
      CASE WHEN v_remaining <= 0 AND v_cash > 0 THEN 'CASH_ON_DELIVERY' ELSE NULL END,
      v_due,
      coalesce(v_order.currency, 'INR'),
      CASE WHEN v_new_status = 'PAID' THEN now() ELSE NULL END,
      v_cash,
      v_online
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id, NULL, v_new_status, v_uid, v_actor_role,
      format('Cash recorded ₹%s · remaining ₹%s', v_cash, v_remaining)
    );
  ELSE
    IF v_payment.status = 'PAID'
       AND coalesce(v_payment.cash_collected_amount, 0) = v_cash
       AND coalesce(v_payment.online_collected_amount, 0) = v_online THEN
      -- Idempotent full paid
      NULL;
    ELSIF v_payment.status = 'PAID' AND v_remaining > 0 THEN
      RAISE EXCEPTION 'Payment already PAID; cannot reduce coverage';
    ELSE
      v_from := v_payment.status;
      UPDATE public.payments
      SET status = v_new_status,
          amount = v_due,
          cash_collected_amount = v_cash,
          online_collected_amount = v_online,
          collection_method = CASE
            WHEN v_new_status = 'PAID' AND v_cash > 0 AND v_online <= 0 THEN 'CASH_ON_DELIVERY'
            WHEN v_new_status = 'PAID' AND v_online > 0 AND v_cash <= 0 THEN 'ONLINE_GATEWAY'
            WHEN v_new_status = 'PAID' THEN coalesce(collection_method, 'CASH_ON_DELIVERY')
            ELSE collection_method
          END,
          paid_at = CASE WHEN v_new_status = 'PAID' THEN coalesce(paid_at, now()) ELSE NULL END,
          updated_at = now()
      WHERE id = v_payment.id
      RETURNING * INTO v_payment;

      IF v_from IS DISTINCT FROM v_new_status THEN
        INSERT INTO public.payment_events (
          payment_id, from_status, to_status, actor_profile_id, actor_role, note
        )
        VALUES (
          v_payment.id, v_from, v_new_status, v_uid, v_actor_role,
          format('Cash recorded ₹%s · remaining ₹%s', v_cash, v_remaining)
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  -- Cash custody only for cash portion > 0 (never online)
  IF v_cash > 0 AND coalesce(v_driver, v_uid) IS NOT NULL THEN
    INSERT INTO public.delivery_cod_custody (
      order_id, payment_id, delivery_profile_id, amount, status, collected_at
    )
    VALUES (
      p_order_id, v_payment.id, coalesce(v_driver, v_uid),
      v_cash, 'WITH_DRIVER', now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      payment_id = EXCLUDED.payment_id,
      amount = EXCLUDED.amount,
      delivery_profile_id = EXCLUDED.delivery_profile_id,
      status = CASE
        WHEN delivery_cod_custody.status IN ('HANDED_TO_COMPANY', 'RECONCILED')
          THEN delivery_cod_custody.status
        ELSE 'WITH_DRIVER'
      END,
      updated_at = now();
  END IF;

  IF v_new_status = 'PAID' THEN
    PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);
  END IF;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'amountDue', v_due,
    'cashCollected', v_cash,
    'onlineCollected', v_online,
    'remaining', v_remaining,
    'paymentStatus', v_new_status,
    'canCompleteDelivery', v_remaining <= 0,
    'onlineProviderConfigured', public.payment_online_provider_configured(),
    'onlineAction', CASE
      WHEN v_remaining <= 0 THEN 'NOT_REQUIRED'
      WHEN public.payment_online_provider_configured() THEN 'READY'
      ELSE 'NOT_CONFIGURED'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_record_cash_payment(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_record_cash_payment(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.delivery_record_cash_payment IS
  'Delivery stop: record cash; remaining must be covered by confirmed online before PAID. Online never typed by driver.';

-- Harden COD collect: cash goes through delivery_record_cash_payment (full cash only here)
CREATE OR REPLACE FUNCTION public.delivery_collect_cod(
  p_order_id uuid,
  p_collected_amount numeric,
  p_collection_method public.payment_collection_method DEFAULT 'CASH_ON_DELIVERY'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_result jsonb;
  v_route_id uuid;
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
  v_actor_role text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_collection_method = 'CASH_ON_DELIVERY' THEN
    v_result := public.delivery_record_cash_payment(p_order_id, p_collected_amount);
    IF (v_result->>'remaining')::numeric > 0 THEN
      RAISE EXCEPTION
        'Cash ₹% leaves remaining ₹%. Use record-cash for partial; complete only when remaining is ₹0.',
        p_collected_amount,
        (v_result->>'remaining')::numeric;
    END IF;
    RETURN (v_result->>'paymentId')::uuid;
  END IF;

  IF p_collected_amount IS NULL OR p_collected_amount < 0 THEN
    RAISE EXCEPTION 'Invalid collected amount';
  END IF;
  IF round(p_collected_amount, 2) <> round(coalesce(v_order.total, 0), 2) THEN
    RAISE EXCEPTION 'Collected amount must equal order total (₹%) for non-cash methods',
      v_order.total;
  END IF;

  IF p_collection_method IN ('UPI_ON_DELIVERY', 'CARD_ON_DELIVERY')
     AND NOT public.payment_online_provider_configured() THEN
    RAISE EXCEPTION
      'Online payment provider not configured. Record cash for the paid portion, or wait for provider confirmation.';
  END IF;

  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rs.route_id INTO v_route_id
  FROM public.route_stops rs WHERE rs.order_id = p_order_id LIMIT 1;
  IF v_route_id IS NULL THEN RAISE EXCEPTION 'Order is not on a delivery route'; END IF;

  IF public.is_admin() THEN
    v_actor_role := 'ADMIN';
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id, 'PAID', 'PAY_ON_DELIVERY', p_collection_method,
      p_collected_amount, 'INR', now(), 0, p_collected_amount
    )
    RETURNING * INTO v_payment;
    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (v_payment.id, NULL, 'PAID', v_uid, v_actor_role, 'On-delivery non-cash collected');
  ELSE
    IF v_payment.status = 'PAID' THEN
      RETURN v_payment.id;
    END IF;
    v_from := v_payment.status;
    UPDATE public.payments
    SET status = 'PAID',
        collection_method = p_collection_method,
        amount = p_collected_amount,
        online_collected_amount = p_collected_amount,
        cash_collected_amount = 0,
        paid_at = now(),
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (v_payment.id, v_from, 'PAID', v_uid, v_actor_role, 'On-delivery non-cash collected');
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);
  RETURN v_payment.id;
END;
$$;

COMMENT ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) IS
  'Full cash via delivery_record_cash_payment; non-cash requires provider or exact total. No fake online PAID.';

-- ─── Dashboard KPIs: Card 5 unpaid OFD residual; Card 6 WITH_DRIVER custody ─

CREATE OR REPLACE FUNCTION public.admin_ops_dashboard_kpis(
  p_today date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(p_today, (timezone('Asia/Kolkata', now()))::date);
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end date := (v_month_start + interval '1 month')::date;
  v_monthly_revenue numeric := 0;
  v_pending_orders int := 0;
  v_salesmen_working int := 0;
  v_in_transit int := 0;
  v_delivered_in_workload int := 0;
  v_workload_total int := 0;
  v_pending_to_receive_total numeric := 0;
  v_pending_to_receive_orders int := 0;
  v_driver_collections_pending numeric := 0;
  v_driver_collections_cash numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT coalesce(sum(s.total), 0)
  INTO v_monthly_revenue
  FROM public.sales s
  WHERE s.converted_at >= v_month_start
    AND s.converted_at < v_month_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> 'REFUNDED';

  SELECT count(*)::int
  INTO v_pending_orders
  FROM public.orders o
  WHERE o.status IN (
    'DRAFT_ASSISTED',
    'AWAITING_CUSTOMER_CONFIRMATION',
    'CONFIRMED',
    'STOCK_RESERVED',
    'PROCESSING',
    'READY_FOR_DISPATCH'
  );

  SELECT count(DISTINCT x.profile_id)::int
  INTO v_salesmen_working
  FROM (
    SELECT sa.profile_id
    FROM public.salesman_attendance sa
    WHERE sa.work_date = v_today
      AND sa.status = 'PRESENT'
      AND sa.day_started_at IS NOT NULL
    UNION
    SELECT sv.salesman_profile_id
    FROM public.sales_visits sv
    WHERE sv.status IS DISTINCT FROM 'MISSED'
      AND (
        (sv.visited_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.visited_at))::date = v_today)
        OR (sv.planned_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.planned_at))::date = v_today
            AND sv.status IN ('PLANNED', 'VISITED', 'PENDING'))
      )
  ) x;

  SELECT count(*)::int
  INTO v_in_transit
  FROM public.orders o
  WHERE o.status = 'OUT_FOR_DELIVERY';

  SELECT
    count(*) FILTER (WHERE rs.status = 'COMPLETED')::int,
    count(*)::int
  INTO v_delivered_in_workload, v_workload_total
  FROM public.route_stops rs
  JOIN public.delivery_routes dr ON dr.id = rs.route_id
  WHERE dr.route_date = v_today
    AND dr.deleted_at IS NULL
    AND dr.status = 'IN_PROGRESS';

  -- Card 5: customer payment still outstanding on OFD orders
  -- (order total − cash_collected − online_collected). PAID → 0.
  -- Does NOT include WITH_DRIVER cash (already paid by customer).
  SELECT
    coalesce(sum(
      CASE
        WHEN p.status = 'PAID' THEN 0::numeric
        WHEN p.id IS NULL THEN o.total
        ELSE greatest(
          o.total
            - coalesce(p.cash_collected_amount, 0)
            - coalesce(p.online_collected_amount, 0),
          0
        )
      END
    ), 0),
    count(*) FILTER (
      WHERE p.status IS DISTINCT FROM 'PAID'
        AND (
          p.id IS NULL
          OR (o.total - coalesce(p.cash_collected_amount, 0) - coalesce(p.online_collected_amount, 0)) > 0
        )
    )::int
  INTO v_pending_to_receive_total, v_pending_to_receive_orders
  FROM public.orders o
  LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE o.status = 'OUT_FOR_DELIVERY';

  -- Card 6: cash already collected, still awaiting Admin settlement
  -- Includes converted sales. Online never in custody.
  SELECT coalesce(sum(c.amount), 0)
  INTO v_driver_collections_pending
  FROM public.delivery_cod_custody c
  WHERE c.status = 'WITH_DRIVER';

  v_driver_collections_cash := v_driver_collections_pending;

  RETURN jsonb_build_object(
    'asOfDate', v_today,
    'monthlyRevenue', v_monthly_revenue,
    'pendingOrders', v_pending_orders,
    'salesmenWorkingToday', v_salesmen_working,
    'inTransitOrders', v_in_transit,
    'workloadDelivered', v_delivered_in_workload,
    'workloadTotal', v_workload_total,
    'workloadRemaining', greatest(v_workload_total - v_delivered_in_workload, 0),
    'pendingToReceiveTotal', v_pending_to_receive_total,
    'pendingToReceiveOrders', v_pending_to_receive_orders,
    'pendingToReceiveCash', 0,
    'pendingToReceiveOnline', 0,
    'pendingToReceiveUnknown', 0,
    'driverCollectionsPending', v_driver_collections_pending,
    'driverCollectionsCash', v_driver_collections_cash,
    'driverCollectionsOnline', 0,
    'paymentBankConfirmationConfigured', public.payment_bank_confirmation_configured(),
    'paymentOnlineProviderConfigured', public.payment_online_provider_configured()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_ops_dashboard_kpis IS
  'Card5=unpaid OFD customer residual; Card6=WITH_DRIVER cash custody (incl. after sale).';
