-- Enrich admin_orders_needing_attention: human-readable detail, unresolved checks,
-- payment verification pending, open delivery exceptions, summary by reason.

CREATE OR REPLACE FUNCTION public.admin_orders_needing_attention(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '[]'::jsonb;
  v_limit int := greatest(coalesce(p_limit, 50), 1);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  WITH base AS (
    SELECT
      o.id AS order_id,
      o.status,
      o.total,
      o.updated_at,
      o.sale_id,
      sh.trade_name AS shop_name,
      (
        SELECT oe.note
        FROM public.order_events oe
        WHERE oe.order_id = o.id
          AND oe.note ILIKE 'NEEDS_ATTENTION:%'
        ORDER BY oe.created_at DESC
        LIMIT 1
      ) AS latest_attention_note,
      (
        SELECT oe.created_at
        FROM public.order_events oe
        WHERE oe.order_id = o.id
          AND oe.note ILIKE 'NEEDS_ATTENTION:%'
        ORDER BY oe.created_at DESC
        LIMIT 1
      ) AS latest_attention_at,
      (
        SELECT de.reason_code || coalesce(' · ' || nullif(btrim(de.reason_note), ''), '')
        FROM public.delivery_exceptions de
        WHERE de.order_id = o.id
          AND de.status = 'OPEN'::public.delivery_exception_status
        ORDER BY de.created_at DESC
        LIMIT 1
      ) AS open_exception_detail,
      (
        SELECT pe.note
        FROM public.payments p
        JOIN public.payment_events pe ON pe.payment_id = p.id
        WHERE p.order_id = o.id
          AND p.status = 'PAYMENT_PENDING'::public.payment_status
          AND pe.note ILIKE 'REPORTED_AWAITING_VERIFICATION%'
        ORDER BY pe.created_at DESC
        LIMIT 1
      ) AS payment_report_note,
      EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.order_id = o.id AND p.status = 'FAILED'::public.payment_status
      ) AS has_payment_failed,
      EXISTS (
        SELECT 1 FROM public.payments p
        JOIN public.payment_events pe ON pe.payment_id = p.id
        WHERE p.order_id = o.id
          AND p.status = 'PAYMENT_PENDING'::public.payment_status
          AND pe.note ILIKE 'REPORTED_AWAITING_VERIFICATION%'
      ) AS has_payment_verification_pending,
      EXISTS (
        SELECT 1 FROM public.route_stops rs WHERE rs.order_id = o.id
      ) AS has_route_stop
    FROM public.orders o
    JOIN public.shops sh ON sh.id = o.shop_id
    WHERE o.status IS DISTINCT FROM 'CANCELLED'::public.order_status
  ),
  scored AS (
    SELECT
      b.*,
      CASE
        WHEN b.status = 'DELIVERY_FAILED'::public.order_status THEN 'delivery_failed'
        WHEN b.open_exception_detail IS NOT NULL THEN 'delivery_exception'
        WHEN b.has_payment_failed THEN 'payment_failed'
        WHEN b.has_payment_verification_pending THEN 'payment_verification_pending'
        WHEN b.status = 'DELIVERED'::public.order_status
          AND b.sale_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.payments p
            WHERE p.order_id = b.order_id AND p.status = 'PAID'::public.payment_status
          ) THEN 'sale_conversion_pending'
        WHEN b.status = 'READY_FOR_DISPATCH'::public.order_status
          AND NOT b.has_route_stop THEN 'assignment_pending'
        WHEN b.latest_attention_note IS NOT NULL
          AND b.latest_attention_at > now() - interval '7 days'
          AND NOT (
            b.latest_attention_note ILIKE '%delivery assignment failed%'
            AND (b.status IS DISTINCT FROM 'READY_FOR_DISPATCH'::public.order_status OR b.has_route_stop)
          )
          AND NOT (
            b.latest_attention_note ILIKE '%Sale conversion failed%'
            AND (b.sale_id IS NOT NULL OR b.status IS DISTINCT FROM 'DELIVERED'::public.order_status)
          ) THEN 'exception_flag'
        ELSE NULL
      END AS reason_code,
      CASE
        WHEN b.status = 'DELIVERY_FAILED'::public.order_status THEN 1
        WHEN b.open_exception_detail IS NOT NULL THEN 1
        WHEN b.has_payment_failed THEN 2
        WHEN b.has_payment_verification_pending THEN 3
        WHEN b.status = 'DELIVERED'::public.order_status AND b.sale_id IS NULL THEN 4
        WHEN b.status = 'READY_FOR_DISPATCH'::public.order_status THEN 5
        ELSE 6
      END AS priority,
      CASE
        WHEN b.status = 'DELIVERY_FAILED'::public.order_status THEN 'critical'
        WHEN b.open_exception_detail IS NOT NULL THEN 'critical'
        WHEN b.has_payment_failed THEN 'critical'
        WHEN b.has_payment_verification_pending THEN 'action_required'
        WHEN b.status = 'DELIVERED'::public.order_status AND b.sale_id IS NULL THEN 'action_required'
        WHEN b.status = 'READY_FOR_DISPATCH'::public.order_status THEN 'action_required'
        ELSE 'review'
      END AS severity,
      CASE
        WHEN b.status = 'DELIVERY_FAILED'::public.order_status THEN
          'Delivery could not be completed. Review the failed delivery and decide next steps.'
        WHEN b.open_exception_detail IS NOT NULL THEN
          'Delivery exception reported: ' || b.open_exception_detail
        WHEN b.has_payment_failed THEN
          'Payment failed or was rejected. Review payment details and retry collection.'
        WHEN b.has_payment_verification_pending THEN
          coalesce(
            b.payment_report_note,
            'Driver reported a digital payment awaiting admin verification.'
          )
        WHEN b.status = 'DELIVERED'::public.order_status
          AND b.sale_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.payments p
            WHERE p.order_id = b.order_id AND p.status = 'PAID'::public.payment_status
          ) THEN
          'Order is delivered and paid but has not been converted to a sale.'
        WHEN b.status = 'READY_FOR_DISPATCH'::public.order_status
          AND NOT b.has_route_stop THEN
          coalesce(
            nullif(regexp_replace(b.latest_attention_note, '^NEEDS_ATTENTION:\s*', '', 'i'), ''),
            'Order is packed but no delivery person has been assigned.'
          )
        WHEN b.latest_attention_note IS NOT NULL THEN
          regexp_replace(b.latest_attention_note, '^NEEDS_ATTENTION:\s*', '', 'i')
        ELSE 'This order needs manual review.'
      END AS attention_detail
    FROM base b
  ),
  filtered AS (
    SELECT *
    FROM scored
    WHERE reason_code IS NOT NULL
    ORDER BY priority, updated_at DESC
    LIMIT v_limit
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'order_id', f.order_id,
      'status', f.status,
      'total', f.total,
      'updated_at', f.updated_at,
      'shop_name', f.shop_name,
      'reason_code', f.reason_code,
      'priority', f.priority,
      'severity', f.severity,
      'attention_detail', f.attention_detail
    ) ORDER BY f.priority, f.updated_at DESC
  ), '[]'::jsonb)
  INTO v_rows
  FROM filtered f;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('reason_code', s.reason_code, 'count', s.cnt)
    ORDER BY s.cnt DESC, s.reason_code
  ), '[]'::jsonb)
  INTO v_summary
  FROM (
    SELECT reason_code, count(*)::int AS cnt
    FROM filtered
    GROUP BY reason_code
  ) s;

  RETURN jsonb_build_object(
    'orders', v_rows,
    'count', jsonb_array_length(v_rows),
    'summary', v_summary
  );
END;
$$;

COMMENT ON FUNCTION public.admin_orders_needing_attention(integer) IS
  'Unresolved orders needing admin action with reason codes, severity, and detail text.';
