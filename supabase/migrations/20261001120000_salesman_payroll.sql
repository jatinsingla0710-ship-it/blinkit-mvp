-- Phase 3C: salesman payroll month snapshots.
-- Sources of truth remain salesman_salary_terms + salesman_commission_entries + attendance.
-- Paid payroll is historical and must not silently change when terms change later.

DO $$ BEGIN
  CREATE TYPE public.salesman_payroll_status AS ENUM (
    'DRAFT',
    'APPROVED',
    'PAID'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salesman_payroll_payment_method AS ENUM (
    'CASH',
    'BANK',
    'UPI',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.salesman_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  payroll_month date NOT NULL,
  earning_model text NOT NULL,
  base_salary numeric(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  unpaid_leave_days integer NOT NULL DEFAULT 0 CHECK (unpaid_leave_days >= 0),
  unpaid_deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unpaid_deduction >= 0),
  earned_commission numeric(12, 2) NOT NULL DEFAULT 0 CHECK (earned_commission >= 0),
  daily_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (daily_allowance >= 0),
  other_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_allowance >= 0),
  adjustments numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  status public.salesman_payroll_status NOT NULL DEFAULT 'DRAFT',
  paid_at timestamptz,
  payment_method public.salesman_payroll_payment_method,
  payment_reference text,
  notes text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  calculated_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_payroll_month_is_first CHECK (
    payroll_month = date_trunc('month', payroll_month)::date
  ),
  CONSTRAINT salesman_payroll_unique_month UNIQUE (salesman_profile_id, payroll_month),
  CONSTRAINT salesman_payroll_paid_state CHECK (
    (
      status = 'PAID'::public.salesman_payroll_status
      AND paid_at IS NOT NULL
      AND payment_method IS NOT NULL
    )
    OR (
      status <> 'PAID'::public.salesman_payroll_status
      AND paid_at IS NULL
      AND payment_method IS NULL
      AND payment_reference IS NULL
    )
  ),
  CONSTRAINT salesman_payroll_reference_length CHECK (
    payment_reference IS NULL
    OR char_length(btrim(payment_reference)) BETWEEN 1 AND 80
  ),
  CONSTRAINT salesman_payroll_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 500
  )
);

CREATE INDEX IF NOT EXISTS salesman_payroll_month_idx
  ON public.salesman_payroll (payroll_month DESC, status);

CREATE INDEX IF NOT EXISTS salesman_payroll_salesman_idx
  ON public.salesman_payroll (salesman_profile_id, payroll_month DESC);

DROP TRIGGER IF EXISTS trg_salesman_payroll_set_updated_at ON public.salesman_payroll;
CREATE TRIGGER trg_salesman_payroll_set_updated_at
  BEFORE UPDATE ON public.salesman_payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_payroll IS
  'Monthly payroll snapshot per salesman. Paid rows are historical and locked.';

ALTER TABLE public.salesman_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_payroll FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salesman_payroll_select ON public.salesman_payroll;
CREATE POLICY salesman_payroll_select
  ON public.salesman_payroll
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR salesman_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS salesman_payroll_admin_write ON public.salesman_payroll;
CREATE POLICY salesman_payroll_admin_write
  ON public.salesman_payroll
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.salesman_payroll TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_payroll TO authenticated;
GRANT ALL ON public.salesman_payroll TO service_role;

-- Scheduled working days in month (same rules as Admin calculateMonthlySalarySummary).
CREATE OR REPLACE FUNCTION public._salesman_scheduled_working_days(
  p_profile_id uuid,
  p_month date
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_last integer;
  v_weekly_off smallint;
  v_working smallint[];
  v_area uuid;
  v_count integer := 0;
  v_day integer;
  v_date date;
  v_dow integer;
BEGIN
  SELECT e.weekly_off_dow, e.working_days, e.primary_service_area_id
  INTO v_weekly_off, v_working, v_area
  FROM public.salesman_employment e
  WHERE e.profile_id = p_profile_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_last := EXTRACT(DAY FROM (v_month + INTERVAL '1 month - 1 day'))::integer;

  FOR v_day IN 1..v_last LOOP
    v_date := (v_month + (v_day - 1))::date;
    v_dow := EXTRACT(DOW FROM v_date)::integer;
    IF v_dow = v_weekly_off THEN
      CONTINUE;
    END IF;
    IF NOT (v_dow = ANY (v_working)) THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.company_holidays h
      WHERE h.holiday_date = v_date
        AND (h.service_area_id IS NULL OR h.service_area_id = v_area)
    ) THEN
      CONTINUE;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._salesman_scheduled_working_days(uuid, date) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_calculate_salesman_payroll(
  p_salesman_profile_id uuid,
  p_month date,
  p_adjustments numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS public.salesman_payroll
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', coalesce(p_month, CURRENT_DATE))::date;
  v_month_end date := (v_month + INTERVAL '1 month')::date;
  v_model public.salesman_earning_model;
  v_monthly numeric(12, 2) := 0;
  v_daily numeric(12, 2) := 0;
  v_other numeric(12, 2) := 0;
  v_salary_applies boolean := false;
  v_commission_applies boolean := false;
  v_earned numeric(12, 2) := 0;
  v_unpaid_days integer := 0;
  v_scheduled integer := 0;
  v_daily_rate numeric(12, 2) := 0;
  v_unpaid_deduction numeric(12, 2) := 0;
  v_base numeric(12, 2) := 0;
  v_adjustments numeric(12, 2) := coalesce(p_adjustments, 0);
  v_total numeric(12, 2);
  v_existing public.salesman_payroll%ROWTYPE;
  v_row public.salesman_payroll%ROWTYPE;
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can calculate payroll' USING ERRCODE = '42501';
  END IF;

  IF p_salesman_profile_id IS NULL THEN
    RAISE EXCEPTION 'Salesman is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_salesman_profile_id
      AND p.staff_role = 'SALESMAN'::public.staff_role
  ) THEN
    RAISE EXCEPTION 'Salesman profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.earning_model
  INTO v_model
  FROM public.salesman_employment e
  WHERE e.profile_id = p_salesman_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employment not configured for salesman'
      USING ERRCODE = '22023';
  END IF;

  v_salary_applies := v_model IN (
    'SALARY'::public.salesman_earning_model,
    'SALARY_PLUS_COMMISSION'::public.salesman_earning_model
  );
  v_commission_applies := v_model IN (
    'COMMISSION'::public.salesman_earning_model,
    'SALARY_PLUS_COMMISSION'::public.salesman_earning_model
  );

  IF v_salary_applies THEN
    SELECT t.monthly_salary, t.daily_allowance, t.other_allowance
    INTO v_monthly, v_daily, v_other
    FROM public.salesman_salary_terms t
    WHERE t.profile_id = p_salesman_profile_id
      AND t.effective_from <= (v_month_end - 1)
      AND (t.effective_to IS NULL OR t.effective_to >= v_month)
    ORDER BY t.effective_from DESC
    LIMIT 1;

    IF v_monthly IS NULL THEN
      RAISE EXCEPTION 'Salary terms not set for this month'
        USING ERRCODE = '22023';
    END IF;

    v_scheduled := public._salesman_scheduled_working_days(
      p_salesman_profile_id,
      v_month
    );

    SELECT count(*)::integer
    INTO v_unpaid_days
    FROM public.salesman_attendance a
    WHERE a.profile_id = p_salesman_profile_id
      AND a.work_date >= v_month
      AND a.work_date < v_month_end
      AND a.status = 'UNPAID_LEAVE'::public.salesman_attendance_status;

    IF v_scheduled > 0 THEN
      v_daily_rate := round(v_monthly / v_scheduled, 2);
    ELSE
      v_daily_rate := 0;
    END IF;
    v_unpaid_deduction := round(greatest(v_unpaid_days, 0) * v_daily_rate, 2);
    v_base := round(greatest(v_monthly - v_unpaid_deduction, 0), 2);
  ELSE
    v_monthly := 0;
    v_daily := 0;
    v_other := 0;
    v_base := 0;
    v_unpaid_deduction := 0;
    v_unpaid_days := 0;
  END IF;

  IF v_commission_applies THEN
    SELECT coalesce(sum(e.commission_amount), 0)
    INTO v_earned
    FROM public.salesman_commission_entries e
    WHERE e.salesman_profile_id = p_salesman_profile_id
      AND e.status = 'EARNED'::public.salesman_commission_entry_status
      AND (timezone('Asia/Kolkata', e.created_at))::date >= v_month
      AND (timezone('Asia/Kolkata', e.created_at))::date < v_month_end;
    v_earned := round(v_earned, 2);
  END IF;

  v_total := round(
    v_base + v_earned + coalesce(v_daily, 0) + coalesce(v_other, 0) + v_adjustments,
    2
  );
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Payroll total cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.salesman_payroll
  WHERE salesman_profile_id = p_salesman_profile_id
    AND payroll_month = v_month;

  IF FOUND THEN
    IF v_existing.status = 'PAID'::public.salesman_payroll_status THEN
      RAISE EXCEPTION 'Paid payroll cannot be recalculated'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.salesman_payroll
    SET
      earning_model = v_model::text,
      base_salary = v_base,
      unpaid_leave_days = v_unpaid_days,
      unpaid_deduction = v_unpaid_deduction,
      earned_commission = v_earned,
      daily_allowance = coalesce(v_daily, 0),
      other_allowance = coalesce(v_other, 0),
      adjustments = v_adjustments,
      total_amount = v_total,
      status = 'DRAFT'::public.salesman_payroll_status,
      notes = coalesce(v_notes, notes),
      calculated_at = now(),
      calculated_by_profile_id = auth.uid(),
      approved_at = NULL,
      approved_by_profile_id = NULL,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.salesman_payroll (
      salesman_profile_id,
      payroll_month,
      earning_model,
      base_salary,
      unpaid_leave_days,
      unpaid_deduction,
      earned_commission,
      daily_allowance,
      other_allowance,
      adjustments,
      total_amount,
      status,
      notes,
      calculated_by_profile_id
    )
    VALUES (
      p_salesman_profile_id,
      v_month,
      v_model::text,
      v_base,
      v_unpaid_days,
      v_unpaid_deduction,
      v_earned,
      coalesce(v_daily, 0),
      coalesce(v_other, 0),
      v_adjustments,
      v_total,
      'DRAFT'::public.salesman_payroll_status,
      v_notes,
      auth.uid()
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_salesman_payroll(p_payroll_id uuid)
RETURNS public.salesman_payroll
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.salesman_payroll%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can approve payroll' USING ERRCODE = '42501';
  END IF;

  UPDATE public.salesman_payroll
  SET
    status = 'APPROVED'::public.salesman_payroll_status,
    approved_at = now(),
    approved_by_profile_id = auth.uid(),
    updated_at = now()
  WHERE id = p_payroll_id
    AND status = 'DRAFT'::public.salesman_payroll_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only draft payroll can be approved'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_salesman_payroll_paid(
  p_payroll_id uuid,
  p_payment_method public.salesman_payroll_payment_method,
  p_payment_reference text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS public.salesman_payroll
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.salesman_payroll%ROWTYPE;
  v_ref text := NULLIF(btrim(coalesce(p_payment_reference, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can mark payroll paid' USING ERRCODE = '42501';
  END IF;

  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'Payment method is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.salesman_payroll
  SET
    status = 'PAID'::public.salesman_payroll_status,
    paid_at = coalesce(p_paid_at, now()),
    payment_method = p_payment_method,
    payment_reference = v_ref,
    updated_at = now()
  WHERE id = p_payroll_id
    AND status = 'APPROVED'::public.salesman_payroll_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only approved payroll can be marked paid'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_salesman_payroll_adjustments(
  p_payroll_id uuid,
  p_adjustments numeric,
  p_notes text DEFAULT NULL
)
RETURNS public.salesman_payroll
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.salesman_payroll%ROWTYPE;
  v_row public.salesman_payroll%ROWTYPE;
  v_total numeric(12, 2);
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can adjust payroll' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.salesman_payroll
  WHERE id = p_payroll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_existing.status = 'PAID'::public.salesman_payroll_status THEN
    RAISE EXCEPTION 'Paid payroll cannot be edited' USING ERRCODE = '22023';
  END IF;

  v_total := round(
    v_existing.base_salary
      + v_existing.earned_commission
      + v_existing.daily_allowance
      + v_existing.other_allowance
      + coalesce(p_adjustments, 0),
    2
  );
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Payroll total cannot be negative' USING ERRCODE = '22023';
  END IF;

  UPDATE public.salesman_payroll
  SET
    adjustments = coalesce(p_adjustments, 0),
    total_amount = v_total,
    notes = coalesce(v_notes, notes),
    status = 'DRAFT'::public.salesman_payroll_status,
    approved_at = NULL,
    approved_by_profile_id = NULL,
    updated_at = now()
  WHERE id = p_payroll_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_calculate_salesman_payroll(uuid, date, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_approve_salesman_payroll(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mark_salesman_payroll_paid(
  uuid,
  public.salesman_payroll_payment_method,
  text,
  timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_salesman_payroll_adjustments(uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_calculate_salesman_payroll(uuid, date, numeric, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_salesman_payroll(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_mark_salesman_payroll_paid(
  uuid,
  public.salesman_payroll_payment_method,
  text,
  timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_salesman_payroll_adjustments(uuid, numeric, text)
  TO authenticated, service_role;
