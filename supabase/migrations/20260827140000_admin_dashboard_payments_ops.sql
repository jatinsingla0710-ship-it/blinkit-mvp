-- Final Admin Dashboard + Payments: aggregated KPIs and payments overview.
-- Read-only for admin/read_only. Settlements continue via existing admin_settle_delivery_cod.

CREATE OR REPLACE FUNCTION public.payment_bank_confirmation_configured()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Razorpay webhook + apply_payment_webhook_event exist; confirmation is
  -- evidence-based per payment (provider_reference), not assumed globally fake.
  SELECT true;
$$;

COMMENT ON FUNCTION public.payment_bank_confirmation_configured() IS
  'True when online provider webhook path is available. Per-row bank confirmation still requires provider_reference.';

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
  v_pending_to_receive_cash numeric := 0;
  v_pending_to_receive_online numeric := 0;
  v_pending_to_receive_unknown numeric := 0;
  v_driver_collections_pending numeric := 0;
  v_driver_collections_cash numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  -- 1) Monthly revenue from converted sales (exclude refunded)
  SELECT coalesce(sum(s.total), 0)
  INTO v_monthly_revenue
  FROM public.sales s
  WHERE s.converted_at >= v_month_start
    AND s.converted_at < v_month_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> 'REFUNDED';

  -- 2) Pending orders (pipeline before route assignment / OFD / terminal)
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

  -- 3) Salesmen working today: attendance PRESENT with day started, OR real visit activity today
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

  -- 4) In transit: OUT_FOR_DELIVERY orders (not merely scheduled)
  SELECT count(*)::int
  INTO v_in_transit
  FROM public.orders o
  WHERE o.status = 'OUT_FOR_DELIVERY';

  -- Today's active delivery workload: stops on today's IN_PROGRESS routes
  SELECT
    count(*) FILTER (WHERE rs.status = 'COMPLETED')::int,
    count(*)::int
  INTO v_delivered_in_workload, v_workload_total
  FROM public.route_stops rs
  JOIN public.delivery_routes dr ON dr.id = rs.route_id
  WHERE dr.route_date = v_today
    AND dr.deleted_at IS NULL
    AND dr.status = 'IN_PROGRESS';

  -- 5) Pending to receive: value of OUT_FOR_DELIVERY orders (order value exposure)
  SELECT
    coalesce(sum(o.total), 0),
    coalesce(sum(o.total) FILTER (
      WHERE p.method_intent = 'PAY_ON_DELIVERY'
        OR p.collection_method IN ('CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY')
    ), 0),
    coalesce(sum(o.total) FILTER (
      WHERE p.method_intent = 'PAY_ONLINE_NOW'
        OR p.collection_method = 'ONLINE_GATEWAY'
    ), 0),
    coalesce(sum(o.total) FILTER (
      WHERE p.id IS NULL
        OR (
          p.method_intent IS DISTINCT FROM 'PAY_ON_DELIVERY'
          AND p.method_intent IS DISTINCT FROM 'PAY_ONLINE_NOW'
          AND coalesce(p.collection_method::text, '') NOT IN (
            'ONLINE_GATEWAY', 'CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY'
          )
        )
    ), 0)
  INTO
    v_pending_to_receive_total,
    v_pending_to_receive_cash,
    v_pending_to_receive_online,
    v_pending_to_receive_unknown
  FROM public.orders o
  LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE o.status = 'OUT_FOR_DELIVERY';

  -- 6) Delivery boy collections pending = custody WITH_DRIVER (cash collected, not settled)
  SELECT coalesce(sum(c.amount), 0)
  INTO v_driver_collections_pending
  FROM public.delivery_cod_custody c
  WHERE c.status = 'WITH_DRIVER';

  v_driver_collections_cash := v_driver_collections_pending;
  -- Online gateway payments never enter cash custody (H5 design)

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
    'pendingToReceiveCash', v_pending_to_receive_cash,
    'pendingToReceiveOnline', v_pending_to_receive_online,
    'pendingToReceiveUnknown', v_pending_to_receive_unknown,
    'driverCollectionsPending', v_driver_collections_pending,
    'driverCollectionsCash', v_driver_collections_cash,
    'driverCollectionsOnline', 0,
    'paymentBankConfirmationConfigured', public.payment_bank_confirmation_configured()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ops_dashboard_kpis(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ops_dashboard_kpis(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_salesmen_working_today(
  p_today date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(p_today, (timezone('Asia/Kolkata', now()))::date);
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.display_name), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id AS profile_id,
      p.display_name,
      CASE
        WHEN sa.day_started_at IS NOT NULL AND sa.day_ended_at IS NULL THEN 'ON_FIELD'
        WHEN sa.day_ended_at IS NOT NULL THEN 'DAY_ENDED'
        WHEN sa.status = 'PRESENT' THEN 'PRESENT'
        ELSE 'ACTIVE_VIA_VISITS'
      END AS operational_state,
      sa.day_started_at,
      sa.day_ended_at,
      (
        SELECT sa2.name
        FROM public.service_areas sa2
        WHERE sa2.id = se.primary_service_area_id
      ) AS service_area_name,
      (
        SELECT count(*)::int
        FROM public.shop_salesman_assignments ssa
        WHERE ssa.salesman_profile_id = p.id
          AND ssa.effective_to IS NULL
      ) AS assigned_shops,
      (
        SELECT count(*)::int
        FROM public.sales_visits sv
        WHERE sv.salesman_profile_id = p.id
          AND sv.status IS DISTINCT FROM 'MISSED'
          AND (
            (sv.visited_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.visited_at))::date = v_today)
            OR (sv.planned_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.planned_at))::date = v_today)
          )
      ) AS visits_today,
      (
        SELECT count(*)::int
        FROM public.orders o
        WHERE o.created_by_profile_id = p.id
          AND (timezone('Asia/Kolkata', o.created_at))::date = v_today
          AND o.status IS DISTINCT FROM 'CANCELLED'
      ) AS orders_today,
      (
        SELECT jsonb_build_object(
          'shopName', sh.trade_name,
          'visitedAt', sv.visited_at,
          'status', sv.status
        )
        FROM public.sales_visits sv
        JOIN public.shops sh ON sh.id = sv.shop_id
        WHERE sv.salesman_profile_id = p.id
          AND sv.visited_at IS NOT NULL
          AND (timezone('Asia/Kolkata', sv.visited_at))::date = v_today
        ORDER BY sv.visited_at DESC
        LIMIT 1
      ) AS last_visit
    FROM public.profiles p
    LEFT JOIN public.salesman_employment se ON se.profile_id = p.id
    LEFT JOIN public.salesman_attendance sa
      ON sa.profile_id = p.id AND sa.work_date = v_today
    WHERE p.deleted_at IS NULL
      AND 'SALESMAN' = ANY (p.roles)
      AND (
        (sa.status = 'PRESENT' AND sa.day_started_at IS NOT NULL)
        OR EXISTS (
          SELECT 1 FROM public.sales_visits sv
          WHERE sv.salesman_profile_id = p.id
            AND sv.status IS DISTINCT FROM 'MISSED'
            AND (
              (sv.visited_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.visited_at))::date = v_today)
              OR (sv.planned_at IS NOT NULL AND (timezone('Asia/Kolkata', sv.planned_at))::date = v_today
                  AND sv.status IN ('PLANNED', 'VISITED', 'PENDING'))
            )
        )
      )
  ) r;

  RETURN jsonb_build_object('asOfDate', v_today, 'salesmen', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_salesmen_working_today(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_salesmen_working_today(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_payments_overview(
  p_today date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(p_today, (timezone('Asia/Kolkata', now()))::date);
  v_day_start timestamptz := (v_today::timestamp AT TIME ZONE 'Asia/Kolkata');
  v_day_end timestamptz := v_day_start + interval '1 day';
  v_sales numeric := 0;
  v_received numeric := 0;
  v_pending_customer numeric := 0;
  v_with_drivers numeric := 0;
  v_settled numeric := 0;
  v_online numeric := 0;
  v_cash numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT coalesce(sum(s.total), 0)
  INTO v_sales
  FROM public.sales s
  WHERE s.converted_at >= v_day_start
    AND s.converted_at < v_day_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> 'REFUNDED';

  SELECT
    coalesce(sum(p.amount) FILTER (WHERE p.status = 'PAID'), 0),
    coalesce(sum(p.amount) FILTER (
      WHERE p.status IN ('UNPAID', 'PAYMENT_PENDING')
    ), 0),
    coalesce(sum(p.amount) FILTER (
      WHERE p.status = 'PAID'
        AND p.collection_method = 'ONLINE_GATEWAY'
    ), 0),
    coalesce(sum(p.amount) FILTER (
      WHERE p.status = 'PAID'
        AND p.collection_method IN ('CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY', 'OTHER')
    ), 0)
  INTO v_received, v_pending_customer, v_online, v_cash
  FROM public.payments p
  WHERE (p.paid_at IS NOT NULL AND p.paid_at >= v_day_start AND p.paid_at < v_day_end)
     OR (p.paid_at IS NULL AND p.created_at >= v_day_start AND p.created_at < v_day_end);

  SELECT coalesce(sum(c.amount), 0)
  INTO v_with_drivers
  FROM public.delivery_cod_custody c
  WHERE c.status = 'WITH_DRIVER';

  SELECT coalesce(sum(s.amount), 0)
  INTO v_settled
  FROM public.delivery_cod_settlements s
  WHERE s.settled_at >= v_day_start
    AND s.settled_at < v_day_end;

  RETURN jsonb_build_object(
    'asOfDate', v_today,
    'sales', v_sales,
    'received', v_received,
    'pendingCustomerPayment', v_pending_customer,
    'withDeliveryBoys', v_with_drivers,
    'settledToCompany', v_settled,
    'online', v_online,
    'cash', v_cash,
    'paymentBankConfirmationConfigured', public.payment_bank_confirmation_configured(),
    'reconciliationGlobalStatus',
      CASE
        WHEN public.payment_bank_confirmation_configured() THEN 'EVIDENCE_BASED'
        ELSE 'NOT_CONFIGURED'
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payments_overview(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_payments_overview(date) TO authenticated;

COMMENT ON FUNCTION public.admin_ops_dashboard_kpis IS
  'Final dashboard: sales.total revenue, pending orders, working salesmen, OFD/in-transit, custody pending.';
COMMENT ON FUNCTION public.admin_salesmen_working_today IS
  'Salesmen with real attendance start or visit activity today — not merely active profiles.';
COMMENT ON FUNCTION public.admin_payments_overview IS
  'Payments hub today rollup from sales, payments, custody, settlements.';
