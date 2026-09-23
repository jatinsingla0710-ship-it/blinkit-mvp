-- Harden auto-sale after bank/UPI verify when order already DELIVERED.
--
-- Scenario A: report → complete (DELIVERED, PAYMENT_PENDING) → admin verify (PAID)
--   Must call try_auto_convert via _lifecycle_after_payment_or_delivery.
-- Scenario B: report → admin verify (PAID) → complete (DELIVERED)
--   delivery_complete_stop already calls try_auto_convert (unchanged).
--
-- Gap fixed:
--   1) already-PAID early return skipped conversion retry
--   2) conversion exceptions must not roll back successful PAID verification

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
  v_already boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;

  IF v_payment.status = 'PAID'::public.payment_status THEN
    v_already := true;
  ELSE
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
  END IF;

  -- Always attempt auto-convert when DELIVERED+PAID (idempotent; isolated).
  -- Scenario A: order already DELIVERED → sale created here.
  -- Scenario B: order not yet DELIVERED → no-op; complete_stop converts later.
  BEGIN
    PERFORM public._lifecycle_after_payment_or_delivery(p_order_id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.order_events (
        order_id, actor_profile_id, actor_role, from_status, to_status, note
      )
      VALUES (
        p_order_id,
        v_uid,
        NULL,
        NULL,
        v_order.status,
        format('NEEDS_ATTENTION: Sale conversion failed after payment verify — %s', SQLERRM)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'paymentStatus', 'PAID',
    'onlineCollected', coalesce(v_payment.online_collected_amount, 0),
    'alreadyVerified', v_already
  );
END;
$$;

COMMENT ON FUNCTION public.admin_verify_reported_payment(uuid, text) IS
  'Verify reported bank/UPI → PAID; always tries _lifecycle_after_payment_or_delivery (isolated).';
