-- Monthly salesman sales targets, plus read-only earnings for the signed-in salesman.
-- Achieved amount is delivered-and-paid order value. Commission is read from
-- salesman_commission_entries. This does not change pricing, payments, inventory,
-- delivery, or commission accrual.

CREATE TABLE IF NOT EXISTS public.salesman_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  target_month date NOT NULL,
  target_amount numeric(12, 2) NOT NULL CHECK (target_amount >= 0),
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_targets_profile_month_unique UNIQUE (salesman_profile_id, target_month),
  CONSTRAINT salesman_targets_month_start CHECK (
    target_month = date_trunc('month', target_month::timestamp)::date
  )
);

CREATE INDEX IF NOT EXISTS salesman_targets_profile_month_idx
  ON public.salesman_targets (salesman_profile_id, target_month DESC);

DROP TRIGGER IF EXISTS trg_salesman_targets_set_updated_at ON public.salesman_targets;
CREATE TRIGGER trg_salesman_targets_set_updated_at
  BEFORE UPDATE ON public.salesman_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_targets IS
  'One monthly sales target per salesman. Achieved, remaining, and progress are calculated, not stored.';

ALTER TABLE public.salesman_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_targets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salesman_targets_select ON public.salesman_targets;
CREATE POLICY salesman_targets_select
  ON public.salesman_targets
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR salesman_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS salesman_targets_admin_write ON public.salesman_targets;
CREATE POLICY salesman_targets_admin_write
  ON public.salesman_targets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.salesman_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_targets TO authenticated;
GRANT ALL ON public.salesman_targets TO service_role;

-- ─── Month + achieved amount (delivered and paid only) ───────────────────────

CREATE OR REPLACE FUNCTION public._salesman_month_start(p_month date)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc(
    'month',
    COALESCE(p_month, (timezone('Asia/Kolkata', now()))::date)::timestamp
  )::date;
$$;

CREATE OR REPLACE FUNCTION public._salesman_delivered_paid_total(
  p_profile_id uuid,
  p_month date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(o.total), 0)
  FROM public.orders o
  JOIN public.payments pay ON pay.id = o.payment_id
  LEFT JOIN public.sales s ON s.id = o.sale_id
  WHERE o.created_by_profile_id = p_profile_id
    AND o.status = 'DELIVERED'::public.order_status
    AND pay.status = 'PAID'::public.payment_status
    AND (timezone('Asia/Kolkata', COALESCE(s.converted_at, pay.paid_at, o.updated_at)))::date
      >= public._salesman_month_start(p_month)
    AND (timezone('Asia/Kolkata', COALESCE(s.converted_at, pay.paid_at, o.updated_at)))::date
      < (public._salesman_month_start(p_month) + INTERVAL '1 month')::date;
$$;

COMMENT ON FUNCTION public._salesman_delivered_paid_total(uuid, date) IS
  'Order value that is both DELIVERED and PAID in the Asia/Kolkata month. Pending, unconfirmed, and unpaid orders are excluded.';

CREATE OR REPLACE FUNCTION public._salesman_target_payload(
  p_profile_id uuid,
  p_month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := public._salesman_month_start(p_month);
  v_target numeric(12, 2);
  v_achieved numeric(12, 2);
  v_remaining numeric(12, 2);
  v_percent numeric(12, 1);
BEGIN
  SELECT target_amount
  INTO v_target
  FROM public.salesman_targets
  WHERE salesman_profile_id = p_profile_id
    AND target_month = v_month;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_achieved := round(public._salesman_delivered_paid_total(p_profile_id, v_month), 2);
  v_remaining := round(GREATEST(0, v_target - v_achieved), 2);
  IF v_target <= 0 THEN
    v_percent := 0;
  ELSE
    v_percent := round((v_achieved / v_target) * 100, 1);
  END IF;

  RETURN jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM-DD'),
    'targetAmount', v_target,
    'achievedAmount', v_achieved,
    'remainingAmount', v_remaining,
    'progressPercent', v_percent
  );
END;
$$;

REVOKE ALL ON FUNCTION public._salesman_month_start(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_delivered_paid_total(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_target_payload(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_month_start(date) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._salesman_delivered_paid_total(uuid, date) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._salesman_target_payload(uuid, date) FROM anon, authenticated;

-- ─── Salesman read / admin write ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.salesman_month_target(p_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;
  RETURN public._salesman_target_payload(v_uid, p_month);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_salesman_target(
  p_profile_id uuid,
  p_month date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Target can only be read for a salesman';
  END IF;
  RETURN public._salesman_target_payload(p_profile_id, p_month);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_salesman_target(
  p_profile_id uuid,
  p_month date,
  p_target_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Target can only be set for a salesman';
  END IF;
  IF p_target_amount IS NULL OR p_target_amount < 0 THEN
    RAISE EXCEPTION 'Enter a target amount of zero or more';
  END IF;

  v_month := public._salesman_month_start(p_month);

  INSERT INTO public.salesman_targets (
    salesman_profile_id,
    target_month,
    target_amount,
    created_by_profile_id
  ) VALUES (
    p_profile_id,
    v_month,
    round(p_target_amount, 2),
    auth.uid()
  )
  ON CONFLICT (salesman_profile_id, target_month)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    created_by_profile_id = EXCLUDED.created_by_profile_id,
    updated_at = now();

  RETURN public._salesman_target_payload(p_profile_id, v_month);
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_month_target(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_salesman_target(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_salesman_target(uuid, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_month_target(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_salesman_target(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_salesman_target(uuid, date, numeric) TO authenticated;

COMMENT ON FUNCTION public.salesman_month_target(date) IS
  'Signed-in salesman reads their own monthly target. Null when none is set. Progress uses delivered-and-paid sales only.';
COMMENT ON FUNCTION public.admin_set_salesman_target(uuid, date, numeric) IS
  'Admin creates or updates one salesman monthly target. Salesmen cannot call this.';

-- ─── Earnings: ledger commission + salary terms, no estimated commission ─────

CREATE OR REPLACE FUNCTION public.salesman_earnings_month(p_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_month date;
  v_month_end date;
  v_model public.salesman_earning_model;
  v_monthly numeric(12, 2);
  v_daily numeric(12, 2);
  v_other numeric(12, 2);
  v_earned numeric(12, 2);
  v_salary_applies boolean := false;
  v_total numeric(12, 2);
  v_includes_salary boolean := false;
  v_awaiting_count integer := 0;
  v_awaiting_value numeric(12, 2) := 0;
  v_entries jsonb := '[]'::jsonb;
  v_awaiting jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;

  v_month := public._salesman_month_start(p_month);
  v_month_end := (v_month + INTERVAL '1 month')::date;

  SELECT earning_model
  INTO v_model
  FROM public.salesman_employment
  WHERE profile_id = v_uid;

  v_salary_applies := v_model IN (
    'SALARY'::public.salesman_earning_model,
    'SALARY_PLUS_COMMISSION'::public.salesman_earning_model
  );

  IF v_salary_applies THEN
    SELECT t.monthly_salary, t.daily_allowance, t.other_allowance
    INTO v_monthly, v_daily, v_other
    FROM public.salesman_salary_terms t
    WHERE t.profile_id = v_uid
      AND t.effective_from <= (v_month_end - 1)
      AND (t.effective_to IS NULL OR t.effective_to >= v_month)
    ORDER BY t.effective_from DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(e.commission_amount), 0)
  INTO v_earned
  FROM public.salesman_commission_entries e
  WHERE e.salesman_profile_id = v_uid
    AND e.status = 'EARNED'::public.salesman_commission_entry_status
    AND (timezone('Asia/Kolkata', e.created_at))::date >= v_month
    AND (timezone('Asia/Kolkata', e.created_at))::date < v_month_end;

  v_earned := round(v_earned, 2);
  IF v_salary_applies AND v_monthly IS NOT NULL THEN
    v_total := round(v_monthly + v_earned, 2);
    v_includes_salary := true;
  ELSE
    v_total := v_earned;
    v_includes_salary := false;
  END IF;

  SELECT COALESCE(jsonb_agg(g.item ORDER BY g.earned_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      max(e.created_at) AS earned_at,
      jsonb_build_object(
        'orderId', o.id,
        'orderNumber', upper(left(o.id::text, 8)),
        'shopName', sh.trade_name,
        'earnedAt', max(e.created_at),
        'orderStatus', o.status,
        'commissionAmount', round(sum(e.commission_amount), 2)
      ) AS item
    FROM public.salesman_commission_entries e
    JOIN public.orders o ON o.id = e.order_id
    JOIN public.shops sh ON sh.id = o.shop_id
    WHERE e.salesman_profile_id = v_uid
      AND e.status = 'EARNED'::public.salesman_commission_entry_status
      AND (timezone('Asia/Kolkata', e.created_at))::date >= v_month
      AND (timezone('Asia/Kolkata', e.created_at))::date < v_month_end
    GROUP BY o.id, sh.trade_name, o.status
  ) g;

  SELECT count(*)::integer, COALESCE(sum(o.total), 0)
  INTO v_awaiting_count, v_awaiting_value
  FROM public.orders o
  WHERE o.created_by_profile_id = v_uid
    AND (timezone('Asia/Kolkata', o.created_at))::date >= v_month
    AND (timezone('Asia/Kolkata', o.created_at))::date < v_month_end
    AND o.status IS DISTINCT FROM 'CANCELLED'::public.order_status
    AND NOT EXISTS (
      SELECT 1
      FROM public.salesman_commission_entries e
      WHERE e.order_id = o.id
        AND e.salesman_profile_id = v_uid
        AND e.status = 'EARNED'::public.salesman_commission_entry_status
    );

  SELECT COALESCE(jsonb_agg(g.item ORDER BY g.created_at DESC), '[]'::jsonb)
  INTO v_awaiting
  FROM (
    SELECT
      o.created_at,
      jsonb_build_object(
        'orderId', o.id,
        'orderNumber', upper(left(o.id::text, 8)),
        'shopName', sh.trade_name,
        'createdAt', o.created_at,
        'orderStatus', o.status,
        'orderTotal', o.total
      ) AS item
    FROM public.orders o
    JOIN public.shops sh ON sh.id = o.shop_id
    WHERE o.created_by_profile_id = v_uid
      AND (timezone('Asia/Kolkata', o.created_at))::date >= v_month
      AND (timezone('Asia/Kolkata', o.created_at))::date < v_month_end
      AND o.status IS DISTINCT FROM 'CANCELLED'::public.order_status
      AND NOT EXISTS (
        SELECT 1
        FROM public.salesman_commission_entries e
        WHERE e.order_id = o.id
          AND e.salesman_profile_id = v_uid
          AND e.status = 'EARNED'::public.salesman_commission_entry_status
      )
    ORDER BY o.created_at DESC
    LIMIT 30
  ) g;

  RETURN jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM-DD'),
    'earningModel', v_model,
    'earnedCommission', v_earned,
    'salaryApplies', v_salary_applies,
    'salary', CASE
      WHEN v_salary_applies AND v_monthly IS NOT NULL THEN jsonb_build_object(
        'monthlySalary', v_monthly,
        'dailyAllowance', COALESCE(v_daily, 0),
        'otherAllowance', COALESCE(v_other, 0)
      )
      ELSE NULL
    END,
    'totalEarnings', v_total,
    'totalIncludesSalary', v_includes_salary,
    'awaitingOrderCount', v_awaiting_count,
    'awaitingOrderValue', round(COALESCE(v_awaiting_value, 0), 2),
    'awaitingOrders', v_awaiting,
    'entries', v_entries,
    'payslipsAvailable', false,
    'target', public._salesman_target_payload(v_uid, v_month)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_earnings_month(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_earnings_month(date) TO authenticated;

COMMENT ON FUNCTION public.salesman_earnings_month(date) IS
  'Signed-in salesman reads this month''s earned commission from the ledger, open salary terms, and orders that have not earned commission. Does not estimate commission.';
