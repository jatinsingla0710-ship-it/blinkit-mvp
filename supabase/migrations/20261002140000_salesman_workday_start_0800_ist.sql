-- Phase: Sales workday earliest start (08:00 IST). Attendance stays calendar-day based.
-- Does NOT create daily payroll. Monthly salary/commission unchanged.

CREATE OR REPLACE FUNCTION public.salesman_start_day(
  p_work_date date DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ist timestamptz := timezone('Asia/Kolkata', now());
  v_date date := COALESCE(
    p_work_date,
    (timezone('Asia/Kolkata', now()))::date
  );
  v_emp public.salesman_employment%ROWTYPE;
  v_existing public.salesman_attendance%ROWTYPE;
  v_status public.salesman_attendance_status;
  v_dow smallint;
  v_row public.salesman_attendance%ROWTYPE;
  v_hour numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.salesman_require_active_employment(v_uid);

  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RAISE EXCEPTION 'latitude and longitude must both be set or both omitted';
  END IF;
  IF p_lat IS NOT NULL THEN
    PERFORM public.assert_geo_coordinates(p_lat, p_lng);
  END IF;

  -- Workday may start from 08:00 IST onward (same calendar date).
  v_hour := EXTRACT(HOUR FROM v_now_ist)
    + EXTRACT(MINUTE FROM v_now_ist) / 60.0;
  IF v_date = (timezone('Asia/Kolkata', now()))::date AND v_hour < 8 THEN
    RAISE EXCEPTION 'Workday starts at 8:00 AM'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_emp
  FROM public.salesman_employment
  WHERE profile_id = v_uid;

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
    start_lat,
    start_lng,
    recorded_by_profile_id
  )
  VALUES (
    v_uid,
    v_date,
    v_status,
    CASE WHEN v_status = 'PRESENT' THEN now() ELSE NULL END,
    p_lat,
    p_lng,
    v_uid
  )
  ON CONFLICT (profile_id, work_date) DO UPDATE
  SET
    status = EXCLUDED.status,
    day_started_at = COALESCE(
      public.salesman_attendance.day_started_at,
      EXCLUDED.day_started_at
    ),
    start_lat = COALESCE(EXCLUDED.start_lat, public.salesman_attendance.start_lat),
    start_lng = COALESCE(EXCLUDED.start_lng, public.salesman_attendance.start_lng),
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.day_started',
    'salesman_attendance',
    v_row.id,
    jsonb_build_object(
      'workDate', v_date,
      'status', v_row.status,
      'hasGps', v_row.start_lat IS NOT NULL
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

COMMENT ON FUNCTION public.salesman_start_day(date, double precision, double precision) IS
  'Start salesman workday (PRESENT). Earliest start 08:00 Asia/Kolkata. Not payroll.';
