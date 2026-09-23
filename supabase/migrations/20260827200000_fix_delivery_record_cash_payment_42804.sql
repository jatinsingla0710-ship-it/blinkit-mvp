-- Fix PG 42804 in delivery_record_cash_payment.
-- Root cause (verified on remote): payment_events.actor_role is public.staff_role,
-- but the RPC declared v_actor_role as text and inserted it without a cast:
--   ERROR 42804: column "actor_role" is of type staff_role but expression is of type text
-- Preserve cash/remaining/custody behavior; no provider/QR changes.

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
  v_actor_role public.staff_role;
  v_new_status public.payment_status;
  v_collection_method public.payment_collection_method;
  v_online_action text;
  v_can_complete boolean;
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
    v_actor_role := 'ADMIN'::public.staff_role;
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY'::public.staff_role;
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_due := round(coalesce(v_order.total, 0)::numeric, 2);
  v_cash := round(p_cash_amount::numeric, 2);

  IF v_cash > v_due THEN
    RAISE EXCEPTION 'Cash received (₹%) cannot exceed amount due (₹%)', v_cash, v_due;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;

  v_online := CASE
    WHEN FOUND THEN coalesce(v_payment.online_collected_amount, 0::numeric)
    ELSE 0::numeric
  END;

  IF v_cash + v_online > v_due THEN
    RAISE EXCEPTION 'Cash + online (₹%) exceeds amount due (₹%)', v_cash + v_online, v_due;
  END IF;

  v_remaining := round((v_due - v_cash - v_online)::numeric, 2);
  v_new_status := CASE
    WHEN v_remaining <= 0 THEN 'PAID'::public.payment_status
    WHEN v_cash > 0 OR v_online > 0 THEN 'PAYMENT_PENDING'::public.payment_status
    ELSE 'UNPAID'::public.payment_status
  END;
  v_can_complete := (v_remaining <= 0);
  v_online_action := CASE
    WHEN v_remaining <= 0 THEN 'NOT_REQUIRED'::text
    WHEN public.payment_online_provider_configured() THEN 'READY'::text
    ELSE 'NOT_CONFIGURED'::text
  END;

  IF NOT FOUND THEN
    v_collection_method := CASE
      WHEN v_remaining <= 0 AND v_cash > 0 AND v_online <= 0
        THEN 'CASH_ON_DELIVERY'::public.payment_collection_method
      WHEN v_remaining <= 0 AND v_online > 0 AND v_cash <= 0
        THEN 'ONLINE_GATEWAY'::public.payment_collection_method
      WHEN v_remaining <= 0
        THEN 'CASH_ON_DELIVERY'::public.payment_collection_method
      ELSE NULL
    END;

    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id,
      v_new_status,
      'PAY_ON_DELIVERY'::public.payment_method_intent,
      v_collection_method,
      v_due,
      coalesce(v_order.currency, 'INR'),
      CASE WHEN v_new_status = 'PAID'::public.payment_status THEN now() ELSE NULL END,
      v_cash,
      v_online
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      NULL,
      v_new_status,
      v_uid,
      v_actor_role,
      format('Cash recorded ₹%s · remaining ₹%s', v_cash, v_remaining)
    );
  ELSE
    IF v_payment.status = 'PAID'::public.payment_status
       AND coalesce(v_payment.cash_collected_amount, 0::numeric) = v_cash
       AND coalesce(v_payment.online_collected_amount, 0::numeric) = v_online THEN
      NULL;
    ELSIF v_payment.status = 'PAID'::public.payment_status AND v_remaining > 0 THEN
      RAISE EXCEPTION 'Payment already PAID; cannot reduce coverage';
    ELSE
      v_from := v_payment.status;
      v_collection_method := CASE
        WHEN v_new_status = 'PAID'::public.payment_status
             AND v_cash > 0 AND v_online <= 0
          THEN 'CASH_ON_DELIVERY'::public.payment_collection_method
        WHEN v_new_status = 'PAID'::public.payment_status
             AND v_online > 0 AND v_cash <= 0
          THEN 'ONLINE_GATEWAY'::public.payment_collection_method
        WHEN v_new_status = 'PAID'::public.payment_status
          THEN coalesce(
            v_payment.collection_method,
            'CASH_ON_DELIVERY'::public.payment_collection_method
          )
        ELSE v_payment.collection_method
      END;

      UPDATE public.payments
      SET status = v_new_status,
          amount = v_due,
          cash_collected_amount = v_cash,
          online_collected_amount = v_online,
          collection_method = v_collection_method,
          paid_at = CASE
            WHEN v_new_status = 'PAID'::public.payment_status
              THEN coalesce(paid_at, now())
            ELSE NULL
          END,
          updated_at = now()
      WHERE id = v_payment.id
      RETURNING * INTO v_payment;

      IF v_from IS DISTINCT FROM v_new_status THEN
        INSERT INTO public.payment_events (
          payment_id, from_status, to_status, actor_profile_id, actor_role, note
        )
        VALUES (
          v_payment.id,
          v_from,
          v_new_status,
          v_uid,
          v_actor_role,
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
      p_order_id,
      v_payment.id,
      coalesce(v_driver, v_uid),
      v_cash,
      'WITH_DRIVER'::public.delivery_cod_custody_status,
      now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      payment_id = EXCLUDED.payment_id,
      amount = EXCLUDED.amount,
      delivery_profile_id = EXCLUDED.delivery_profile_id,
      status = CASE
        WHEN delivery_cod_custody.status IN (
          'HANDED_TO_COMPANY'::public.delivery_cod_custody_status,
          'RECONCILED'::public.delivery_cod_custody_status
        )
          THEN delivery_cod_custody.status
        ELSE 'WITH_DRIVER'::public.delivery_cod_custody_status
      END,
      updated_at = now();
  END IF;

  IF v_new_status = 'PAID'::public.payment_status THEN
    PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);
  END IF;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'amountDue', v_due,
    'cashCollected', v_cash,
    'onlineCollected', v_online,
    'remaining', v_remaining,
    'paymentStatus', v_new_status::text,
    'canCompleteDelivery', v_can_complete,
    'onlineProviderConfigured', public.payment_online_provider_configured(),
    'onlineAction', v_online_action
  );
END;
$$;

COMMENT ON FUNCTION public.delivery_record_cash_payment(uuid, numeric) IS
  'Delivery stop cash record. Fixes 42804: actor_role must be staff_role (not text). Cash→custody; online never custody.';

-- Same 42804 class bug in hardened collect_cod payment_events inserts
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
  v_actor_role public.staff_role;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_collection_method = 'CASH_ON_DELIVERY'::public.payment_collection_method THEN
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

  IF p_collection_method IN (
       'UPI_ON_DELIVERY'::public.payment_collection_method,
       'CARD_ON_DELIVERY'::public.payment_collection_method
     )
     AND NOT public.payment_online_provider_configured() THEN
    RAISE EXCEPTION
      'Online payment provider not configured. Record cash for the paid portion, or wait for provider confirmation.';
  END IF;

  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rs.route_id INTO v_route_id
  FROM public.route_stops rs WHERE rs.order_id = p_order_id LIMIT 1;
  IF v_route_id IS NULL THEN RAISE EXCEPTION 'Order is not on a delivery route'; END IF;

  IF public.is_admin() THEN
    v_actor_role := 'ADMIN'::public.staff_role;
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY'::public.staff_role;
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id,
      'PAID'::public.payment_status,
      'PAY_ON_DELIVERY'::public.payment_method_intent,
      p_collection_method,
      p_collected_amount,
      'INR',
      now(),
      0::numeric,
      p_collected_amount
    )
    RETURNING * INTO v_payment;
    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      NULL,
      'PAID'::public.payment_status,
      v_uid,
      v_actor_role,
      'On-delivery non-cash collected'
    );
  ELSE
    IF v_payment.status = 'PAID'::public.payment_status THEN
      RETURN v_payment.id;
    END IF;
    v_from := v_payment.status;
    UPDATE public.payments
    SET status = 'PAID'::public.payment_status,
        collection_method = p_collection_method,
        amount = p_collected_amount,
        online_collected_amount = p_collected_amount,
        cash_collected_amount = 0::numeric,
        paid_at = now(),
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      v_from,
      'PAID'::public.payment_status,
      v_uid,
      v_actor_role,
      'On-delivery non-cash collected'
    );
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);
  RETURN v_payment.id;
END;
$$;

COMMENT ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) IS
  'Full cash via delivery_record_cash_payment; actor_role typed as staff_role (42804 fix).';
