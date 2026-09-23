-- Salesman H4: minimal employment / salary / attendance / holidays + trusted RPCs.
-- Preserves H1–H3: provision-salesman, shop_salesman_assignments, sales_visits RPCs unchanged.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.salesman_employment_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salesman_id_proof_type AS ENUM (
    'AADHAAR',
    'PAN',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salesman_attendance_status AS ENUM (
    'PRESENT',
    'ABSENT',
    'PAID_LEAVE',
    'UNPAID_LEAVE',
    'HOLIDAY',
    'WEEKLY_OFF'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── A. salesman_employment ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.salesman_employment (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  joining_date date NOT NULL DEFAULT (CURRENT_DATE),
  employment_status public.salesman_employment_status NOT NULL DEFAULT 'ACTIVE',
  address text,
  contact_email text,
  id_proof_type public.salesman_id_proof_type,
  id_proof_number text,
  primary_service_area_id uuid REFERENCES public.service_areas (id) ON DELETE SET NULL,
  -- Postgres DOW: 0 = Sunday … 6 = Saturday
  weekly_off_dow smallint NOT NULL DEFAULT 0
    CHECK (weekly_off_dow >= 0 AND weekly_off_dow <= 6),
  -- Working days as DOW array (excludes weekly_off_dow in application logic)
  working_days smallint[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::smallint[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_employment_working_days_valid CHECK (
    coalesce(array_length(working_days, 1), 0) >= 1
    AND working_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

CREATE INDEX IF NOT EXISTS salesman_employment_service_area_idx
  ON public.salesman_employment (primary_service_area_id);

CREATE TRIGGER trg_salesman_employment_set_updated_at
  BEFORE UPDATE ON public.salesman_employment
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_employment IS
  'Salesman H4: employment / weekly-off / working days for SALESMAN profiles.';

-- ─── B. salesman_salary_terms (append-only history) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.salesman_salary_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  monthly_salary numeric(12, 2) NOT NULL CHECK (monthly_salary >= 0),
  daily_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (daily_allowance >= 0),
  other_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_allowance >= 0),
  effective_from date NOT NULL,
  effective_to date,
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_salary_terms_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS salesman_salary_terms_profile_idx
  ON public.salesman_salary_terms (profile_id, effective_from DESC);

COMMENT ON TABLE public.salesman_salary_terms IS
  'Salesman H4: append-only salary / DA / allowance history. Close prior row before insert.';

-- ─── C. salesman_attendance ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.salesman_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  status public.salesman_attendance_status NOT NULL,
  day_started_at timestamptz,
  day_ended_at timestamptz,
  correction_reason text,
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_attendance_unique_day UNIQUE (profile_id, work_date),
  CONSTRAINT salesman_attendance_end_after_start CHECK (
    day_ended_at IS NULL
    OR day_started_at IS NULL
    OR day_ended_at >= day_started_at
  )
);

CREATE INDEX IF NOT EXISTS salesman_attendance_profile_date_idx
  ON public.salesman_attendance (profile_id, work_date DESC);

CREATE TRIGGER trg_salesman_attendance_set_updated_at
  BEFORE UPDATE ON public.salesman_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_attendance IS
  'Salesman H4: one attendance / presence row per salesman per calendar date.';

-- ─── D. company_holidays ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  service_area_id uuid REFERENCES public.service_areas (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_holidays_unique UNIQUE (holiday_date, service_area_id)
);

CREATE INDEX IF NOT EXISTS company_holidays_date_idx
  ON public.company_holidays (holiday_date);

COMMENT ON TABLE public.company_holidays IS
  'Salesman H4: company/area holidays. NULL service_area_id = company-wide.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.salesman_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_employment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_salary_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_salary_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salesman_employment_select ON public.salesman_employment;
CREATE POLICY salesman_employment_select
  ON public.salesman_employment
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
  );

DROP POLICY IF EXISTS salesman_employment_admin_write ON public.salesman_employment;
CREATE POLICY salesman_employment_admin_write
  ON public.salesman_employment
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_salary_terms_select ON public.salesman_salary_terms;
CREATE POLICY salesman_salary_terms_select
  ON public.salesman_salary_terms
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
  );

DROP POLICY IF EXISTS salesman_salary_terms_admin_write ON public.salesman_salary_terms;
CREATE POLICY salesman_salary_terms_admin_write
  ON public.salesman_salary_terms
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_attendance_select ON public.salesman_attendance;
CREATE POLICY salesman_attendance_select
  ON public.salesman_attendance
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR profile_id = auth.uid()
  );

-- Writes go through SECURITY DEFINER RPCs; no direct client INSERT/UPDATE for salesmen.
DROP POLICY IF EXISTS salesman_attendance_admin_write ON public.salesman_attendance;
CREATE POLICY salesman_attendance_admin_write
  ON public.salesman_attendance
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS company_holidays_select ON public.company_holidays;
CREATE POLICY company_holidays_select
  ON public.company_holidays
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS company_holidays_admin_write ON public.company_holidays;
CREATE POLICY company_holidays_admin_write
  ON public.company_holidays
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.salesman_employment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_employment TO authenticated;
GRANT SELECT ON public.salesman_salary_terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_salary_terms TO authenticated;
GRANT SELECT ON public.salesman_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_attendance TO authenticated;
GRANT SELECT ON public.company_holidays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_holidays TO authenticated;

GRANT ALL ON public.salesman_employment TO service_role;
GRANT ALL ON public.salesman_salary_terms TO service_role;
GRANT ALL ON public.salesman_attendance TO service_role;
GRANT ALL ON public.company_holidays TO service_role;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_salesman_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.deleted_at IS NULL
      AND 'SALESMAN'::public.staff_role = ANY (p.roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_holiday(
  p_date date,
  p_service_area_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_holidays h
    WHERE h.holiday_date = p_date
      AND (
        h.service_area_id IS NULL
        OR (p_service_area_id IS NOT NULL AND h.service_area_id = p_service_area_id)
      )
  );
$$;

-- ─── E. Trusted RPCs ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_upsert_salesman_employment(
  p_profile_id uuid,
  p_joining_date date DEFAULT NULL,
  p_employment_status public.salesman_employment_status DEFAULT 'ACTIVE',
  p_address text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_id_proof_type public.salesman_id_proof_type DEFAULT NULL,
  p_id_proof_number text DEFAULT NULL,
  p_primary_service_area_id uuid DEFAULT NULL,
  p_weekly_off_dow smallint DEFAULT 0,
  p_working_days smallint[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::smallint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.salesman_employment%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Valid SALESMAN profile is required';
  END IF;
  IF p_weekly_off_dow IS NULL OR p_weekly_off_dow < 0 OR p_weekly_off_dow > 6 THEN
    RAISE EXCEPTION 'weekly_off_dow must be 0–6 (Sun–Sat)';
  END IF;
  IF p_working_days IS NULL OR coalesce(array_length(p_working_days, 1), 0) < 1 THEN
    RAISE EXCEPTION 'working_days must include at least one day';
  END IF;

  UPDATE public.profiles
  SET
    is_active = (p_employment_status = 'ACTIVE'),
    updated_at = now()
  WHERE id = p_profile_id;

  INSERT INTO public.salesman_employment (
    profile_id,
    joining_date,
    employment_status,
    address,
    contact_email,
    id_proof_type,
    id_proof_number,
    primary_service_area_id,
    weekly_off_dow,
    working_days
  )
  VALUES (
    p_profile_id,
    COALESCE(p_joining_date, CURRENT_DATE),
    COALESCE(p_employment_status, 'ACTIVE'),
    NULLIF(btrim(p_address), ''),
    NULLIF(lower(btrim(COALESCE(p_contact_email, ''))), ''),
    p_id_proof_type,
    NULLIF(btrim(p_id_proof_number), ''),
    p_primary_service_area_id,
    COALESCE(p_weekly_off_dow, 0),
    COALESCE(p_working_days, ARRAY[1, 2, 3, 4, 5, 6]::smallint[])
  )
  ON CONFLICT (profile_id) DO UPDATE
  SET
    joining_date = EXCLUDED.joining_date,
    employment_status = EXCLUDED.employment_status,
    address = EXCLUDED.address,
    contact_email = EXCLUDED.contact_email,
    id_proof_type = EXCLUDED.id_proof_type,
    id_proof_number = EXCLUDED.id_proof_number,
    primary_service_area_id = EXCLUDED.primary_service_area_id,
    weekly_off_dow = EXCLUDED.weekly_off_dow,
    working_days = EXCLUDED.working_days,
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.employment_upserted',
    'salesman_employment',
    p_profile_id,
    jsonb_build_object(
      'employmentStatus', v_row.employment_status,
      'weeklyOffDow', v_row.weekly_off_dow,
      'joiningDate', v_row.joining_date
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'profileId', v_row.profile_id,
    'joiningDate', v_row.joining_date,
    'employmentStatus', v_row.employment_status,
    'contactEmail', v_row.contact_email,
    'weeklyOffDow', v_row.weekly_off_dow,
    'workingDays', v_row.working_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_salesman_employment(
  uuid, date, public.salesman_employment_status, text, text,
  public.salesman_id_proof_type, text, uuid, smallint, smallint[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_salesman_employment(
  uuid, date, public.salesman_employment_status, text, text,
  public.salesman_id_proof_type, text, uuid, smallint, smallint[]
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_salesman_salary_terms(
  p_profile_id uuid,
  p_monthly_salary numeric,
  p_daily_allowance numeric DEFAULT 0,
  p_other_allowance numeric DEFAULT 0,
  p_effective_from date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := COALESCE(p_effective_from, CURRENT_DATE);
  v_row public.salesman_salary_terms%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Valid SALESMAN profile is required';
  END IF;
  IF p_monthly_salary IS NULL OR p_monthly_salary < 0 THEN
    RAISE EXCEPTION 'monthly_salary must be >= 0';
  END IF;

  -- Close any open terms that would overlap the new effective_from.
  UPDATE public.salesman_salary_terms
  SET effective_to = v_from - 1
  WHERE profile_id = p_profile_id
    AND effective_to IS NULL
    AND effective_from < v_from;

  INSERT INTO public.salesman_salary_terms (
    profile_id,
    monthly_salary,
    daily_allowance,
    other_allowance,
    effective_from,
    effective_to,
    recorded_by_profile_id
  )
  VALUES (
    p_profile_id,
    p_monthly_salary,
    COALESCE(p_daily_allowance, 0),
    COALESCE(p_other_allowance, 0),
    v_from,
    NULL,
    v_uid
  )
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.salary_terms_set',
    'salesman_salary_terms',
    v_row.id,
    jsonb_build_object(
      'profileId', p_profile_id,
      'monthlySalary', v_row.monthly_salary,
      'dailyAllowance', v_row.daily_allowance,
      'otherAllowance', v_row.other_allowance,
      'effectiveFrom', v_row.effective_from
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'profileId', v_row.profile_id,
    'monthlySalary', v_row.monthly_salary,
    'dailyAllowance', v_row.daily_allowance,
    'otherAllowance', v_row.other_allowance,
    'effectiveFrom', v_row.effective_from,
    'effectiveTo', v_row.effective_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_salesman_salary_terms(
  uuid, numeric, numeric, numeric, date
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_salesman_salary_terms(
  uuid, numeric, numeric, numeric, date
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_salesman_attendance(
  p_profile_id uuid,
  p_work_date date,
  p_status public.salesman_attendance_status,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev public.salesman_attendance_status;
  v_row public.salesman_attendance%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'Valid SALESMAN profile is required';
  END IF;
  IF p_work_date IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'work_date and status are required';
  END IF;

  SELECT status INTO v_prev
  FROM public.salesman_attendance
  WHERE profile_id = p_profile_id
    AND work_date = p_work_date;

  IF FOUND AND v_prev IS DISTINCT FROM p_status AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Correction reason is required when changing attendance status';
  END IF;

  INSERT INTO public.salesman_attendance (
    profile_id,
    work_date,
    status,
    correction_reason,
    recorded_by_profile_id
  )
  VALUES (
    p_profile_id,
    p_work_date,
    p_status,
    v_reason,
    v_uid
  )
  ON CONFLICT (profile_id, work_date) DO UPDATE
  SET
    status = EXCLUDED.status,
    correction_reason = COALESCE(EXCLUDED.correction_reason, public.salesman_attendance.correction_reason),
    recorded_by_profile_id = v_uid,
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.attendance_set',
    'salesman_attendance',
    v_row.id,
    jsonb_build_object(
      'profileId', p_profile_id,
      'workDate', p_work_date,
      'previousStatus', v_prev,
      'status', p_status,
      'reason', v_reason
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'profileId', v_row.profile_id,
    'workDate', v_row.work_date,
    'status', v_row.status,
    'dayStartedAt', v_row.day_started_at,
    'dayEndedAt', v_row.day_ended_at,
    'correctionReason', v_row.correction_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_salesman_attendance(
  uuid, date, public.salesman_attendance_status, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_salesman_attendance(
  uuid, date, public.salesman_attendance_status, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_company_holiday(
  p_holiday_date date,
  p_name text,
  p_service_area_id uuid DEFAULT NULL,
  p_holiday_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.company_holidays%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_holiday_date IS NULL OR NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'holiday_date and name are required';
  END IF;

  IF p_holiday_id IS NOT NULL THEN
    UPDATE public.company_holidays
    SET
      holiday_date = p_holiday_date,
      name = btrim(p_name),
      service_area_id = p_service_area_id
    WHERE id = p_holiday_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Holiday not found';
    END IF;
  ELSE
    INSERT INTO public.company_holidays (holiday_date, name, service_area_id)
    VALUES (p_holiday_date, btrim(p_name), p_service_area_id)
    ON CONFLICT (holiday_date, service_area_id) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING * INTO v_row;
  END IF;

  PERFORM public.write_audit_log(
    'company.holiday_upserted',
    'company_holiday',
    v_row.id,
    jsonb_build_object(
      'holidayDate', v_row.holiday_date,
      'name', v_row.name,
      'serviceAreaId', v_row.service_area_id
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'holidayDate', v_row.holiday_date,
    'name', v_row.name,
    'serviceAreaId', v_row.service_area_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_company_holiday(date, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_company_holiday(date, text, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.salesman_start_day(
  p_work_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_date date := COALESCE(p_work_date, CURRENT_DATE);
  v_emp public.salesman_employment%ROWTYPE;
  v_existing public.salesman_attendance%ROWTYPE;
  v_status public.salesman_attendance_status;
  v_dow smallint;
  v_row public.salesman_attendance%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;

  SELECT * INTO v_emp
  FROM public.salesman_employment
  WHERE profile_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employment profile not configured — ask Admin to set working days';
  END IF;
  IF v_emp.employment_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Employment is not ACTIVE';
  END IF;

  SELECT * INTO v_existing
  FROM public.salesman_attendance
  WHERE profile_id = v_uid
    AND work_date = v_date
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'PRESENT' AND v_existing.day_started_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'profileId', v_existing.profile_id,
        'workDate', v_existing.work_date,
        'status', v_existing.status,
        'dayStartedAt', v_existing.day_started_at,
        'dayEndedAt', v_existing.day_ended_at,
        'alreadyStarted', true
      );
    END IF;
    IF v_existing.status IN ('WEEKLY_OFF', 'HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE') THEN
      RAISE EXCEPTION 'Cannot start day — attendance is %', v_existing.status;
    END IF;
  END IF;

  v_dow := EXTRACT(DOW FROM v_date)::smallint;

  IF v_dow = v_emp.weekly_off_dow THEN
    v_status := 'WEEKLY_OFF';
  ELSIF public.is_company_holiday(v_date, v_emp.primary_service_area_id) THEN
    v_status := 'HOLIDAY';
  ELSIF NOT (v_dow = ANY (v_emp.working_days)) THEN
    v_status := 'WEEKLY_OFF';
  ELSE
    v_status := 'PRESENT';
  END IF;

  INSERT INTO public.salesman_attendance (
    profile_id,
    work_date,
    status,
    day_started_at,
    recorded_by_profile_id
  )
  VALUES (
    v_uid,
    v_date,
    v_status,
    CASE WHEN v_status = 'PRESENT' THEN now() ELSE NULL END,
    v_uid
  )
  ON CONFLICT (profile_id, work_date) DO UPDATE
  SET
    status = EXCLUDED.status,
    day_started_at = COALESCE(
      public.salesman_attendance.day_started_at,
      EXCLUDED.day_started_at
    ),
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.day_started',
    'salesman_attendance',
    v_row.id,
    jsonb_build_object(
      'workDate', v_date,
      'status', v_row.status
    ),
    v_uid,
    'SALESMAN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'profileId', v_row.profile_id,
    'workDate', v_row.work_date,
    'status', v_row.status,
    'dayStartedAt', v_row.day_started_at,
    'dayEndedAt', v_row.day_ended_at,
    'alreadyStarted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_start_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_start_day(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.salesman_end_day(
  p_work_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_date date := COALESCE(p_work_date, CURRENT_DATE);
  v_row public.salesman_attendance%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_attendance
  WHERE profile_id = v_uid
    AND work_date = v_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Start Day first before ending the day';
  END IF;
  IF v_row.status <> 'PRESENT' THEN
    RAISE EXCEPTION 'End Day only applies to PRESENT attendance (current: %)', v_row.status;
  END IF;
  IF v_row.day_started_at IS NULL THEN
    RAISE EXCEPTION 'Day was not started';
  END IF;
  IF v_row.day_ended_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_row.id,
      'profileId', v_row.profile_id,
      'workDate', v_row.work_date,
      'status', v_row.status,
      'dayStartedAt', v_row.day_started_at,
      'dayEndedAt', v_row.day_ended_at,
      'alreadyEnded', true
    );
  END IF;

  UPDATE public.salesman_attendance
  SET
    day_ended_at = now(),
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.day_ended',
    'salesman_attendance',
    v_row.id,
    jsonb_build_object(
      'workDate', v_date,
      'dayEndedAt', v_row.day_ended_at
    ),
    v_uid,
    'SALESMAN'
  );

  RETURN jsonb_build_object(
    'id', v_row.id,
    'profileId', v_row.profile_id,
    'workDate', v_row.work_date,
    'status', v_row.status,
    'dayStartedAt', v_row.day_started_at,
    'dayEndedAt', v_row.day_ended_at,
    'alreadyEnded', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_end_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_end_day(date) TO authenticated;

COMMENT ON FUNCTION public.admin_upsert_salesman_employment IS
  'Salesman H4: admin upsert employment / weekly off / working days.';
COMMENT ON FUNCTION public.admin_set_salesman_salary_terms IS
  'Salesman H4: append-only salary terms; closes prior open row.';
COMMENT ON FUNCTION public.admin_set_salesman_attendance IS
  'Salesman H4: admin set/correct attendance; reason required on status change.';
COMMENT ON FUNCTION public.admin_upsert_company_holiday IS
  'Salesman H4: upsert company or area holiday.';
COMMENT ON FUNCTION public.salesman_start_day IS
  'Salesman H4: start day presence; auto WEEKLY_OFF/HOLIDAY when applicable.';
COMMENT ON FUNCTION public.salesman_end_day IS
  'Salesman H4: end day for PRESENT attendance.';
