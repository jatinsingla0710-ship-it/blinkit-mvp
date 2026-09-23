-- Dashboard Card 3: manager-held COD (RECEIVED_BY_MANAGER only).
-- Breakdown RPC for Payments → Settlements (focus=with_manager).
-- Does not change custody workflow; Card 5/6 semantics unchanged.

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
  v_manager_collections_pending numeric := 0;
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

  -- Card 3: cash with Manager — not yet Owner-confirmed
  SELECT coalesce(sum(c.amount), 0)
  INTO v_manager_collections_pending
  FROM public.delivery_cod_custody c
  WHERE c.status = 'RECEIVED_BY_MANAGER';

  -- Card 6: cash still WITH_DRIVER
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
    'managerCollectionsPending', v_manager_collections_pending,
    'driverCollectionsPending', v_driver_collections_pending,
    'driverCollectionsCash', v_driver_collections_cash,
    'driverCollectionsOnline', 0,
    'paymentBankConfirmationConfigured', public.payment_bank_confirmation_configured(),
    'paymentOnlineProviderConfigured', public.payment_online_provider_configured()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_ops_dashboard_kpis IS
  'Card3=RECEIVED_BY_MANAGER custody; Card5=unpaid OFD customer residual; Card6=WITH_DRIVER cash custody.';

-- Manager + warehouse breakdown for dashboard drill-down / Payments settlements focus.
CREATE OR REPLACE FUNCTION public.admin_manager_cod_custody_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT coalesce(sum(c.amount), 0)
  INTO v_total
  FROM public.delivery_cod_custody c
  WHERE c.status = 'RECEIVED_BY_MANAGER';

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'managerProfileId', grouped.manager_profile_id,
        'managerName', grouped.manager_name,
        'warehouseId', grouped.warehouse_id,
        'warehouseName', grouped.warehouse_name,
        'amount', grouped.amount,
        'handoverCount', grouped.handover_count,
        'oldestHandoverAt', grouped.oldest_handover_at,
        'newestHandoverAt', grouped.newest_handover_at
      )
      ORDER BY grouped.warehouse_name, grouped.manager_name
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      coalesce(s.recorded_by_profile_id, ev.actor_profile_id)::text AS manager_profile_id,
      coalesce(mgr.display_name, 'Unknown manager') AS manager_name,
      coalesce(ol.id::text, '') AS warehouse_id,
      coalesce(ol.name, 'Unassigned warehouse') AS warehouse_name,
      sum(c.amount) AS amount,
      count(*)::int AS handover_count,
      min(coalesce(ev.created_at, c.updated_at)) AS oldest_handover_at,
      max(coalesce(ev.created_at, c.updated_at)) AS newest_handover_at
    FROM public.delivery_cod_custody c
    LEFT JOIN public.delivery_cod_settlements s ON s.id = c.settlement_id
    LEFT JOIN LATERAL (
      SELECT e.created_at, e.actor_profile_id
      FROM public.delivery_cod_custody_events e
      WHERE e.order_id = c.order_id
        AND e.to_status = 'RECEIVED_BY_MANAGER'::public.delivery_cod_custody_status
      ORDER BY e.created_at ASC
      LIMIT 1
    ) ev ON true
    LEFT JOIN public.profiles mgr
      ON mgr.id = coalesce(s.recorded_by_profile_id, ev.actor_profile_id)
    LEFT JOIN LATERAL (
      SELECT sr.operational_location_id
      FROM public.stock_reservations sr
      WHERE sr.order_id = c.order_id
      ORDER BY sr.created_at ASC
      LIMIT 1
    ) wh ON true
    LEFT JOIN public.operational_locations ol
      ON ol.id = wh.operational_location_id
      AND ol.deleted_at IS NULL
    WHERE c.status = 'RECEIVED_BY_MANAGER'
    GROUP BY
      coalesce(s.recorded_by_profile_id, ev.actor_profile_id),
      mgr.display_name,
      ol.id,
      ol.name
  ) grouped;

  RETURN jsonb_build_object(
    'totalAmount', v_total,
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manager_cod_custody_breakdown() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manager_cod_custody_breakdown() TO authenticated;

COMMENT ON FUNCTION public.admin_manager_cod_custody_breakdown IS
  'Manager-held COD (RECEIVED_BY_MANAGER). Warehouse from first stock_reservation per order; no warehouse-manager FK exists.';
