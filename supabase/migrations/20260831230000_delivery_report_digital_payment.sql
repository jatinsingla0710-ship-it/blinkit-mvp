-- Delivery PWA: report bank/UPI payment (awaiting verification) + complete-stop gate.
-- Reuses payments.status PAYMENT_PENDING, collection_method, provider_reference.
-- Does NOT mark PAID / company-received until admin verifies.
-- Does NOT invent gateway confirmation.

-- ─── 1) Driver reports digital payment (not verified) ────────────────────────

CREATE OR REPLACE FUNCTION public.delivery_report_digital_payment(
  p_order_id uuid,
  p_amount numeric,
  p_collection_method public.payment_collection_method,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route_id uuid;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_due numeric(12, 2);
  v_amount numeric(12, 2);
  v_from public.payment_status;
  v_actor_role public.staff_role;
  v_method public.payment_collection_method;
  v_ref text;
  v_note text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_method := p_collection_method;
  IF v_method IS NULL OR v_method NOT IN (
    'UPI_ON_DELIVERY'::public.payment_collection_method,
    'CARD_ON_DELIVERY'::public.payment_collection_method,
    'ONLINE_GATEWAY'::public.payment_collection_method,
    'OTHER'::public.payment_collection_method
  ) THEN
    RAISE EXCEPTION 'Choose Bank Transfer, UPI, or Other online method';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Reported amount must be positive';
  END IF;

  SELECT rs.route_id
  INTO v_route_id
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
  v_amount := round(p_amount::numeric, 2);
  IF v_amount > v_due THEN
    RAISE EXCEPTION 'Reported amount (₹%) cannot exceed order total (₹%)', v_amount, v_due;
  END IF;

  v_ref := nullif(btrim(coalesce(p_reference, '')), '');
  v_note := format(
    'REPORTED_AWAITING_VERIFICATION · %s · ₹%s%s%s',
    v_method::text,
    v_amount::text,
    CASE WHEN v_ref IS NOT NULL THEN format(' · ref %s', v_ref) ELSE '' END,
    CASE WHEN nullif(btrim(coalesce(p_notes, '')), '') IS NOT NULL
      THEN format(' · %s', btrim(p_notes)) ELSE '' END
  );

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency,
      provider_reference, paid_at, cash_collected_amount, online_collected_amount
    )
    VALUES (
      p_order_id,
      'PAYMENT_PENDING'::public.payment_status,
      'PAY_ON_DELIVERY'::public.payment_method_intent,
      v_method,
      v_due,
      coalesce(v_order.currency, 'INR'),
      v_ref,
      NULL,
      0::numeric,
      0::numeric
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      NULL,
      'PAYMENT_PENDING'::public.payment_status,
      v_uid,
      v_actor_role,
      v_note
    );
  ELSE
    IF v_payment.status = 'PAID'::public.payment_status THEN
      RAISE EXCEPTION 'Payment is already verified as PAID';
    END IF;

    v_from := v_payment.status;

    UPDATE public.payments
    SET status = 'PAYMENT_PENDING'::public.payment_status,
        method_intent = coalesce(method_intent, 'PAY_ON_DELIVERY'::public.payment_method_intent),
        collection_method = v_method,
        provider_reference = coalesce(v_ref, provider_reference),
        -- Do NOT credit online_collected until admin verifies (not company-received).
        online_collected_amount = coalesce(online_collected_amount, 0),
        paid_at = NULL,
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    IF v_from IS DISTINCT FROM 'PAYMENT_PENDING'::public.payment_status THEN
      INSERT INTO public.payment_events (
        payment_id, from_status, to_status, actor_profile_id, actor_role, note
      )
      VALUES (
        v_payment.id,
        v_from,
        'PAYMENT_PENDING'::public.payment_status,
        v_uid,
        v_actor_role,
        v_note
      );
    ELSE
      -- Same status: append reference via audit note path using FAILED bounce avoided —
      -- use a no-op status change is illegal; store note by inserting UNPAID→PENDING only once.
      -- For re-report while pending, update provider_reference only (event optional via audit).
      PERFORM public.write_audit_log(
        'payment.digital_reported'::text,
        'payment'::text,
        v_payment.id,
        jsonb_build_object(
          'orderId', p_order_id,
          'method', v_method::text,
          'amount', v_amount,
          'reference', v_ref,
          'note', v_note
        ),
        v_uid,
        v_actor_role
      );
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'amountDue', v_due,
    'reportedAmount', v_amount,
    'paymentStatus', v_payment.status::text,
    'collectionMethod', v_payment.collection_method::text,
    'providerReference', v_payment.provider_reference,
    'awaitingVerification', true,
    'canCompleteDelivery', true,
    'cashCollected', coalesce(v_payment.cash_collected_amount, 0),
    'onlineCollected', coalesce(v_payment.online_collected_amount, 0),
    'remaining', v_due
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_report_digital_payment(
  uuid, numeric, public.payment_collection_method, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_report_digital_payment(
  uuid, numeric, public.payment_collection_method, text, text
) TO authenticated;

COMMENT ON FUNCTION public.delivery_report_digital_payment IS
  'Driver reports bank/UPI/online payment. Sets PAYMENT_PENDING awaiting admin verify — never invents PAID/gateway confirmation.';

-- ─── 2) Admin verifies reported digital payment → PAID ───────────────────────

CREATE OR REPLACE FUNCTION public.admin_verify_reported_payment(
  p_order_id uuid,
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
  v_from public.payment_status;
  v_online numeric(12, 2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;

  IF v_payment.status = 'PAID'::public.payment_status THEN
    RETURN jsonb_build_object(
      'orderId', p_order_id,
      'paymentId', v_payment.id,
      'paymentStatus', 'PAID',
      'alreadyVerified', true
    );
  END IF;

  IF v_payment.status IS DISTINCT FROM 'PAYMENT_PENDING'::public.payment_status THEN
    RAISE EXCEPTION 'Only PAYMENT_PENDING reported payments can be verified (current: %)',
      v_payment.status;
  END IF;

  IF v_payment.collection_method IS NULL
     OR v_payment.collection_method = 'CASH_ON_DELIVERY'::public.payment_collection_method THEN
    RAISE EXCEPTION 'This payment is not a reported bank/UPI payment';
  END IF;

  v_from := v_payment.status;
  v_online := round(
    greatest(
      coalesce(v_payment.amount, v_order.total, 0)
        - coalesce(v_payment.cash_collected_amount, 0),
      0
    )::numeric,
    2
  );

  UPDATE public.payments
  SET status = 'PAID'::public.payment_status,
      online_collected_amount = v_online,
      paid_at = now(),
      collection_method = coalesce(collection_method, 'OTHER'::public.payment_collection_method),
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
    'ADMIN'::public.staff_role,
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Admin verified bank/UPI payment reported by delivery'
    )
  );

  PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'paymentStatus', 'PAID',
    'onlineCollected', v_online,
    'alreadyVerified', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_reported_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_verify_reported_payment(uuid, text) TO authenticated;

-- ─── 3) Admin rejects reported digital payment ───────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_reject_reported_payment(
  p_order_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;

  IF v_payment.status = 'PAID'::public.payment_status THEN
    RAISE EXCEPTION 'Cannot reject an already verified PAID payment';
  END IF;

  v_from := v_payment.status;

  UPDATE public.payments
  SET status = 'UNPAID'::public.payment_status,
      collection_method = NULL,
      provider_reference = NULL,
      online_collected_amount = 0,
      paid_at = NULL,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  IF v_from IS DISTINCT FROM 'UNPAID'::public.payment_status THEN
    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (
      v_payment.id,
      v_from,
      'UNPAID'::public.payment_status,
      v_uid,
      'ADMIN'::public.staff_role,
      coalesce(
        nullif(btrim(coalesce(p_note, '')), ''),
        'Admin rejected reported bank/UPI payment — not received'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'paymentStatus', 'UNPAID',
    'rejected', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_reported_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_reported_payment(uuid, text) TO authenticated;

-- ─── 4) Complete stop: allow reported digital pending (not unpaid) ────────────
-- Replaces payment gate only; keeps sale-conversion isolation from 31220000.

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
  v_digital_reported boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop not found'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

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
    RAISE EXCEPTION 'Record the customer payment before completing delivery';
  END IF;

  v_digital_reported :=
    v_payment.status = 'PAYMENT_PENDING'::public.payment_status
    AND v_payment.collection_method IS NOT NULL
    AND v_payment.collection_method IS DISTINCT FROM 'CASH_ON_DELIVERY'::public.payment_collection_method;

  IF v_payment.status IS DISTINCT FROM 'PAID'::public.payment_status
     AND NOT v_digital_reported THEN
    IF v_payment.method_intent = 'PAY_ON_DELIVERY'::public.payment_method_intent
       OR v_payment.status IN (
         'UNPAID'::public.payment_status,
         'PAYMENT_PENDING'::public.payment_status,
         'FAILED'::public.payment_status
       ) THEN
      RAISE EXCEPTION
        'Record the customer payment before completing delivery (remaining unpaid)';
    END IF;
    RAISE EXCEPTION
      'Payment must be PAID or reported for verification before completing delivery (current: %)',
      v_payment.status;
  END IF;

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
    COALESCE(
      p_notes,
      CASE
        WHEN v_digital_reported THEN 'Delivered · payment awaiting company verification'
        ELSE 'Delivered'
      END
    )
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

  -- Sale conversion only when PAID; reported-pending must not auto-convert.
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

COMMENT ON FUNCTION public.delivery_complete_stop(uuid, text, boolean, boolean, numeric) IS
  'Confirm delivery. Requires PAID cash or reported bank/UPI (PAYMENT_PENDING). Sale convert only when PAID.';
