-- Sales dashboard analytics — single source of truth for admin Sales section.
-- Valid sale = sales row with status <> REFUNDED (converted_at drives periods).
-- Financial year: April 1 – March 31 (Asia/Kolkata), configurable start month later.

CREATE OR REPLACE FUNCTION public._sales_valid_filter()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'REFUNDED';
$$;

CREATE OR REPLACE FUNCTION public._fy_bounds(
  p_ref_date date,
  p_start_month int DEFAULT 4
)
RETURNS TABLE (fy_start date, fy_end date, fy_label text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_year int := extract(year from p_ref_date)::int;
  v_month int := extract(month from p_ref_date)::int;
  v_start_year int;
  v_end_year int;
BEGIN
  IF v_month >= p_start_month THEN
    v_start_year := v_year;
  ELSE
    v_start_year := v_year - 1;
  END IF;
  v_end_year := v_start_year + 1;
  fy_start := make_date(v_start_year, p_start_month, 1);
  fy_end := make_date(v_end_year, p_start_month, 1);
  fy_label := format(
    'FY %s–%s',
    v_start_year,
    lpad((v_end_year % 100)::text, 2, '0')
  );
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_sales_dashboard_metrics(
  p_as_of_date date DEFAULT NULL,
  p_fy_start_month int DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := coalesce(p_as_of_date, (timezone('Asia/Kolkata', now()))::date);
  v_tz text := 'Asia/Kolkata';
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end date := (v_month_start + interval '1 month')::date;
  v_prev_month_start date := (v_month_start - interval '1 month')::date;
  v_prev_month_end date := v_month_start;
  v_prev_prev_month_start date := (v_prev_month_start - interval '1 month')::date;
  v_prev_prev_month_end date := v_prev_month_start;
  v_same_period_last_year_start date;
  v_same_period_last_year_end date;
  v_fy record;
  v_prev_fy_start date;
  v_prev_fy_end date;
  v_prev_fy_label text;
  v_all_time numeric := 0;
  v_all_count int := 0;
  v_cur_month numeric := 0;
  v_cur_month_count int := 0;
  v_prev_month numeric := 0;
  v_prev_month_count int := 0;
  v_prev_prev_month numeric := 0;
  v_same_period_ly numeric := 0;
  v_cur_fy numeric := 0;
  v_cur_fy_count int := 0;
  v_prev_fy numeric := 0;
  v_prev_fy_count int := 0;
  v_best_day date;
  v_best_day_amount numeric := 0;
  v_monthly_current_fy jsonb := '[]'::jsonb;
  v_monthly_previous_fy jsonb := '[]'::jsonb;
  v_monthly_calendar jsonb := '[]'::jsonb;
  v_top_customers jsonb := '[]'::jsonb;
  v_top_products jsonb := '[]'::jsonb;
  v_payment_breakdown jsonb := '[]'::jsonb;
  v_highest_month jsonb;
  v_lowest_month jsonb;
  v_growth_month numeric;
  v_growth_prev_month numeric;
  v_growth_fy numeric;
  v_cur_fy_months int;
  v_avg_monthly_fy numeric;
  v_avg_monthly_prev_fy numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin_or_read_only() THEN
    RAISE EXCEPTION 'Admin or read-only role required';
  END IF;

  SELECT * INTO v_fy FROM public._fy_bounds(v_today, p_fy_start_month);
  v_prev_fy_start := (v_fy.fy_start - interval '1 year')::date;
  v_prev_fy_end := v_fy.fy_start;
  v_prev_fy_label := format(
    'FY %s–%s',
    extract(year from v_prev_fy_start)::int,
    lpad(((extract(year from v_prev_fy_start)::int + 1) % 100)::text, 2, '0')
  );

  v_same_period_last_year_start := (v_month_start - interval '1 year')::date;
  v_same_period_last_year_end := v_today - (v_today - v_month_start);

  -- All time
  SELECT coalesce(sum(s.total), 0), count(*)::int
  INTO v_all_time, v_all_count
  FROM public.sales s
  WHERE upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Current month (month start → end of today inclusive via < tomorrow)
  SELECT coalesce(sum(s.total), 0), count(*)::int
  INTO v_cur_month, v_cur_month_count
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_month_start
    AND (s.converted_at AT TIME ZONE v_tz)::date <= v_today
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Previous full calendar month
  SELECT coalesce(sum(s.total), 0), count(*)::int
  INTO v_prev_month, v_prev_month_count
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_prev_month_start
    AND (s.converted_at AT TIME ZONE v_tz)::date < v_prev_month_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Month before previous (for prev month growth)
  SELECT coalesce(sum(s.total), 0)
  INTO v_prev_prev_month
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_prev_prev_month_start
    AND (s.converted_at AT TIME ZONE v_tz)::date < v_prev_prev_month_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Same calendar period last year (month start → same day-of-month capped)
  SELECT coalesce(sum(s.total), 0)
  INTO v_same_period_ly
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_same_period_last_year_start
    AND (s.converted_at AT TIME ZONE v_tz)::date <= (v_today - interval '1 year')::date
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Current FY
  SELECT coalesce(sum(s.total), 0), count(*)::int
  INTO v_cur_fy, v_cur_fy_count
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_fy.fy_start
    AND (s.converted_at AT TIME ZONE v_tz)::date < v_fy.fy_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Previous FY
  SELECT coalesce(sum(s.total), 0), count(*)::int
  INTO v_prev_fy, v_prev_fy_count
  FROM public.sales s
  WHERE (s.converted_at AT TIME ZONE v_tz)::date >= v_prev_fy_start
    AND (s.converted_at AT TIME ZONE v_tz)::date < v_prev_fy_end
    AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter();

  -- Best sales day (all time)
  SELECT d.day, d.day_total
  INTO v_best_day, v_best_day_amount
  FROM (
    SELECT (s.converted_at AT TIME ZONE v_tz)::date AS day,
           sum(s.total) AS day_total
    FROM public.sales s
    WHERE upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY 1
    ORDER BY 2 DESC, 1 DESC
    LIMIT 1
  ) d;

  -- Monthly breakdown: current FY (Apr→Mar order)
  WITH months AS (
    SELECT generate_series(0, 11) AS idx
  ),
  fy_months AS (
    SELECT
      m.idx,
      ((v_fy.fy_start + (m.idx || ' months')::interval))::date AS bucket_start,
      ((v_fy.fy_start + ((m.idx + 1) || ' months')::interval))::date AS bucket_end
    FROM months m
  ),
  agg AS (
    SELECT
      fm.idx,
      fm.bucket_start,
      coalesce(sum(s.total), 0) AS amount,
      count(s.id)::int AS sale_count
    FROM fy_months fm
    LEFT JOIN public.sales s
      ON (s.converted_at AT TIME ZONE v_tz)::date >= fm.bucket_start
     AND (s.converted_at AT TIME ZONE v_tz)::date < fm.bucket_end
     AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY fm.idx, fm.bucket_start
    ORDER BY fm.idx
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'monthIndex', a.idx,
      'year', extract(year from a.bucket_start)::int,
      'month', extract(month from a.bucket_start)::int,
      'label', to_char(a.bucket_start, 'Mon'),
      'amount', a.amount,
      'count', a.sale_count
    ) ORDER BY a.idx
  ), '[]'::jsonb)
  INTO v_monthly_current_fy
  FROM agg a;

  -- Previous FY months
  WITH months AS (
    SELECT generate_series(0, 11) AS idx
  ),
  fy_months AS (
    SELECT
      m.idx,
      ((v_prev_fy_start + (m.idx || ' months')::interval))::date AS bucket_start,
      ((v_prev_fy_start + ((m.idx + 1) || ' months')::interval))::date AS bucket_end
    FROM months m
  ),
  agg AS (
    SELECT
      fm.idx,
      fm.bucket_start,
      coalesce(sum(s.total), 0) AS amount,
      count(s.id)::int AS sale_count
    FROM fy_months fm
    LEFT JOIN public.sales s
      ON (s.converted_at AT TIME ZONE v_tz)::date >= fm.bucket_start
     AND (s.converted_at AT TIME ZONE v_tz)::date < fm.bucket_end
     AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY fm.idx, fm.bucket_start
    ORDER BY fm.idx
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'monthIndex', a.idx,
      'year', extract(year from a.bucket_start)::int,
      'month', extract(month from a.bucket_start)::int,
      'label', to_char(a.bucket_start, 'Mon'),
      'amount', a.amount,
      'count', a.sale_count
    ) ORDER BY a.idx
  ), '[]'::jsonb)
  INTO v_monthly_previous_fy
  FROM agg a;

  -- Calendar year containing v_today
  WITH months AS (
    SELECT generate_series(1, 12) AS m
  ),
  cal_months AS (
    SELECT
      m.m AS month_num,
      make_date(extract(year from v_today)::int, m.m, 1) AS bucket_start,
      (make_date(extract(year from v_today)::int, m.m, 1) + interval '1 month')::date AS bucket_end
    FROM months m
  ),
  agg AS (
    SELECT
      cm.month_num,
      cm.bucket_start,
      coalesce(sum(s.total), 0) AS amount,
      count(s.id)::int AS sale_count
    FROM cal_months cm
    LEFT JOIN public.sales s
      ON (s.converted_at AT TIME ZONE v_tz)::date >= cm.bucket_start
     AND (s.converted_at AT TIME ZONE v_tz)::date < cm.bucket_end
     AND upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY cm.month_num, cm.bucket_start
    ORDER BY cm.month_num
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'monthIndex', a.month_num - 1,
      'year', extract(year from a.bucket_start)::int,
      'month', a.month_num,
      'label', to_char(a.bucket_start, 'Mon'),
      'amount', a.amount,
      'count', a.sale_count
    ) ORDER BY a.month_num
  ), '[]'::jsonb)
  INTO v_monthly_calendar
  FROM agg a;

  -- Highest / lowest month in current FY (non-zero only for lowest meaningful)
  WITH fy_agg AS (
    SELECT *
    FROM jsonb_to_recordset(v_monthly_current_fy) AS x(
      monthIndex int, year int, month int, label text, amount numeric, count int
    )
  )
  SELECT jsonb_build_object(
    'label', (SELECT label FROM fy_agg ORDER BY amount DESC, monthIndex LIMIT 1),
    'year', (SELECT year FROM fy_agg ORDER BY amount DESC, monthIndex LIMIT 1),
    'month', (SELECT month FROM fy_agg ORDER BY amount DESC, monthIndex LIMIT 1),
    'amount', (SELECT amount FROM fy_agg ORDER BY amount DESC, monthIndex LIMIT 1)
  )
  INTO v_highest_month;

  WITH fy_agg AS (
    SELECT *
    FROM jsonb_to_recordset(v_monthly_current_fy) AS x(
      monthIndex int, year int, month int, label text, amount numeric, count int
    )
  )
  SELECT jsonb_build_object(
    'label', (SELECT label FROM fy_agg WHERE amount > 0 ORDER BY amount ASC, monthIndex LIMIT 1),
    'year', (SELECT year FROM fy_agg WHERE amount > 0 ORDER BY amount ASC, monthIndex LIMIT 1),
    'month', (SELECT month FROM fy_agg WHERE amount > 0 ORDER BY amount ASC, monthIndex LIMIT 1),
    'amount', coalesce((SELECT amount FROM fy_agg WHERE amount > 0 ORDER BY amount ASC, monthIndex LIMIT 1), 0)
  )
  INTO v_lowest_month;

  -- Top customers (all time)
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.amount DESC), '[]'::jsonb)
  INTO v_top_customers
  FROM (
    SELECT coalesce(sh.trade_name, '—') AS name,
           sum(s.total) AS amount,
           count(*)::int AS sale_count
    FROM public.sales s
    JOIN public.orders o ON o.id = s.order_id
    LEFT JOIN public.shops sh ON sh.id = o.shop_id
    WHERE upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY sh.trade_name
    ORDER BY sum(s.total) DESC
    LIMIT 5
  ) t;

  -- Top products by revenue (all time)
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT coalesce(si.product_name, si.sku_name, '—') AS name,
           coalesce(si.sku_code, '—') AS sku,
           sum(si.quantity) AS quantity,
           sum(si.line_total) AS revenue
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY si.product_name, si.sku_name, si.sku_code
    ORDER BY sum(si.line_total) DESC
    LIMIT 5
  ) t;

  -- Payment method breakdown (from payments linked via sales)
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.amount DESC), '[]'::jsonb)
  INTO v_payment_breakdown
  FROM (
    SELECT coalesce(p.collection_method::text, p.method_intent::text, 'UNKNOWN') AS method,
           sum(s.total) AS amount,
           count(*)::int AS sale_count
    FROM public.sales s
    JOIN public.payments p ON p.order_id = s.order_id
    WHERE upper(coalesce(s.status, 'COMPLETED')) <> public._sales_valid_filter()
    GROUP BY 1
    ORDER BY sum(s.total) DESC
  ) t;

  v_growth_month := CASE
    WHEN v_same_period_ly > 0 THEN round(((v_cur_month - v_same_period_ly) / v_same_period_ly) * 100, 1)
    WHEN v_cur_month > 0 THEN 100
    ELSE 0
  END;

  v_growth_prev_month := CASE
    WHEN v_prev_prev_month > 0 THEN round(((v_prev_month - v_prev_prev_month) / v_prev_prev_month) * 100, 1)
    WHEN v_prev_month > 0 THEN 100
    ELSE 0
  END;

  v_growth_fy := CASE
    WHEN v_prev_fy > 0 THEN round(((v_cur_fy - v_prev_fy) / v_prev_fy) * 100, 1)
    WHEN v_cur_fy > 0 THEN 100
    ELSE 0
  END;

  v_cur_fy_months := greatest(
    1,
    (
      (extract(year FROM age(v_today + 1, v_fy.fy_start)) * 12)
      + extract(month FROM age(v_today + 1, v_fy.fy_start))
    )::int
  );
  v_avg_monthly_fy := round(v_cur_fy / v_cur_fy_months, 2);
  v_avg_monthly_prev_fy := round(v_prev_fy / 12.0, 2);

  RETURN jsonb_build_object(
    'asOfDate', v_today,
    'timezone', v_tz,
    'fyStartMonth', p_fy_start_month,
    'allTime', jsonb_build_object('amount', v_all_time, 'count', v_all_count),
    'currentMonth', jsonb_build_object(
      'amount', v_cur_month,
      'count', v_cur_month_count,
      'start', v_month_start,
      'end', v_today,
      'compareAmount', v_same_period_ly,
      'growthPct', v_growth_month
    ),
    'previousMonth', jsonb_build_object(
      'amount', v_prev_month,
      'count', v_prev_month_count,
      'start', v_prev_month_start,
      'end', v_prev_month_end - 1,
      'label', to_char(v_prev_month_start, 'FMMonth YYYY'),
      'compareAmount', v_prev_prev_month,
      'growthPct', v_growth_prev_month
    ),
    'currentFinancialYear', jsonb_build_object(
      'label', v_fy.fy_label,
      'start', v_fy.fy_start,
      'end', v_fy.fy_end - 1,
      'amount', v_cur_fy,
      'count', v_cur_fy_count,
      'avgMonthly', v_avg_monthly_fy,
      'monthsElapsed', v_cur_fy_months
    ),
    'previousFinancialYear', jsonb_build_object(
      'label', v_prev_fy_label,
      'start', v_prev_fy_start,
      'end', v_prev_fy_end - 1,
      'amount', v_prev_fy,
      'count', v_prev_fy_count,
      'avgMonthly', v_avg_monthly_prev_fy,
      'growthPctVsCurrent', v_growth_fy
    ),
    'monthComparison', jsonb_build_object(
      'currentAmount', v_cur_month,
      'previousAmount', v_prev_month,
      'difference', v_cur_month - v_prev_month,
      'growthPct', CASE
        WHEN v_prev_month > 0 THEN round(((v_cur_month - v_prev_month) / v_prev_month) * 100, 1)
        WHEN v_cur_month > 0 THEN 100
        ELSE 0
      END
    ),
    'fyComparison', jsonb_build_object(
      'current', jsonb_build_object(
        'totalSales', v_cur_fy,
        'count', v_cur_fy_count,
        'avgSaleValue', CASE WHEN v_cur_fy_count > 0 THEN round(v_cur_fy / v_cur_fy_count, 2) ELSE 0 END
      ),
      'previous', jsonb_build_object(
        'totalSales', v_prev_fy,
        'count', v_prev_fy_count,
        'avgSaleValue', CASE WHEN v_prev_fy_count > 0 THEN round(v_prev_fy / v_prev_fy_count, 2) ELSE 0 END
      ),
      'growthPct', v_growth_fy
    ),
    'performance', jsonb_build_object(
      'totalSales', v_all_time,
      'saleCount', v_all_count,
      'avgSaleValue', CASE WHEN v_all_count > 0 THEN round(v_all_time / v_all_count, 2) ELSE 0 END,
      'highestMonth', v_highest_month,
      'lowestMonth', v_lowest_month,
      'bestDay', jsonb_build_object(
        'date', v_best_day,
        'amount', coalesce(v_best_day_amount, 0)
      )
    ),
    'monthlyBreakdown', jsonb_build_object(
      'currentFinancialYear', v_monthly_current_fy,
      'previousFinancialYear', v_monthly_previous_fy,
      'calendarYear', jsonb_build_object(
        'year', extract(year from v_today)::int,
        'months', v_monthly_calendar
      )
    ),
    'topCustomers', v_top_customers,
    'topProducts', v_top_products,
    'paymentBreakdown', v_payment_breakdown
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sales_dashboard_metrics(date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sales_dashboard_metrics(date, int) TO authenticated;

COMMENT ON FUNCTION public.admin_sales_dashboard_metrics(date, int) IS
  'Sales dashboard KPIs, FY/month breakdowns, growth. Valid sale = sales.status <> REFUNDED.';
