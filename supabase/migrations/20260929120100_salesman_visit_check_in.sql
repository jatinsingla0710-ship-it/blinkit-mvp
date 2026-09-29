-- Phase 4: optional Start/End Day GPS, visit check-in, and visit completion.
-- Reuses salesman_attendance, sales_visits, shops.delivery_lat/lng, and the
-- private salesman-media bucket. Does not add a bucket. Visit photos use
-- {auth.uid}/{shop_id}/visits/{visit_id}, which the existing salesman-media
-- policies already restrict to the signed-in salesman and an assigned shop.
-- Does not change orders, payments, commission, inventory, or pricing.

ALTER TABLE public.salesman_attendance
  ADD COLUMN IF NOT EXISTS start_lat double precision,
  ADD COLUMN IF NOT EXISTS start_lng double precision,
  ADD COLUMN IF NOT EXISTS end_lat double precision,
  ADD COLUMN IF NOT EXISTS end_lng double precision;

ALTER TABLE public.sales_visits
  ADD COLUMN IF NOT EXISTS check_in_lat double precision,
  ADD COLUMN IF NOT EXISTS check_in_lng double precision,
  ADD COLUMN IF NOT EXISTS check_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_distance_m integer,
  ADD COLUMN IF NOT EXISTS completion_lat double precision,
  ADD COLUMN IF NOT EXISTS completion_lng double precision,
  ADD COLUMN IF NOT EXISTS completion_distance_m integer,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE public.sales_visits
  DROP CONSTRAINT IF EXISTS sales_visits_visited_at_when_visited;

ALTER TABLE public.sales_visits
  DROP CONSTRAINT IF EXISTS sales_visits_done_requires_visited_at;

ALTER TABLE public.sales_visits
  ADD CONSTRAINT sales_visits_done_requires_visited_at CHECK (
    (
      status IN ('VISITED', 'SHOP_CLOSED')
      AND visited_at IS NOT NULL
    )
    OR status NOT IN ('VISITED', 'SHOP_CLOSED')
  );

CREATE OR REPLACE FUNCTION public.assert_geo_coordinates(
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'latitude and longitude are required'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'invalid coordinates'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_geo_coordinates(double precision, double precision) FROM PUBLIC;

-- Mean Earth radius 6,371,000 m. Haversine, result in metres.
CREATE OR REPLACE FUNCTION public.geo_distance_metres(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earth constant double precision := 6371000;
  v_dlat double precision;
  v_dlng double precision;
  v_a double precision;
BEGIN
  PERFORM public.assert_geo_coordinates(p_lat1, p_lng1);
  PERFORM public.assert_geo_coordinates(p_lat2, p_lng2);
  v_dlat := radians(p_lat2 - p_lat1);
  v_dlng := radians(p_lng2 - p_lng1);
  v_a := power(sin(v_dlat / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(v_dlng / 2), 2);
  RETURN v_earth * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
END;
$$;

REVOKE ALL ON FUNCTION public.geo_distance_metres(
  double precision, double precision, double precision, double precision
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_distance_metres(
  double precision, double precision, double precision, double precision
) TO authenticated;

CREATE OR REPLACE FUNCTION public.salesman_require_active_employment(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.salesman_employment_status;
BEGIN
  IF p_profile_id IS NULL OR NOT public.is_salesman_profile(p_profile_id) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;
  SELECT employment_status INTO v_status
  FROM public.salesman_employment
  WHERE profile_id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employment profile not configured — ask Admin to set working days';
  END IF;
  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Employment is not ACTIVE';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_require_active_employment(uuid) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.salesman_start_day(date);

CREATE OR REPLACE FUNCTION public.salesman_start_day(
  p_work_date date DEFAULT CURRENT_DATE,
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
  PERFORM public.salesman_require_active_employment(v_uid);

  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RAISE EXCEPTION 'latitude and longitude must both be set or both omitted';
  END IF;
  IF p_lat IS NOT NULL THEN
    PERFORM public.assert_geo_coordinates(p_lat, p_lng);
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

REVOKE ALL ON FUNCTION public.salesman_start_day(date, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_start_day(date, double precision, double precision) TO authenticated;

DROP FUNCTION IF EXISTS public.salesman_end_day(date);

CREATE OR REPLACE FUNCTION public.salesman_end_day(
  p_work_date date DEFAULT CURRENT_DATE,
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
  v_date date := COALESCE(p_work_date, CURRENT_DATE);
  v_row public.salesman_attendance%ROWTYPE;
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
    end_lat = COALESCE(p_lat, end_lat),
    end_lng = COALESCE(p_lng, end_lng),
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  PERFORM public.write_audit_log(
    'salesman.day_ended',
    'salesman_attendance',
    v_row.id,
    jsonb_build_object(
      'workDate', v_date,
      'dayEndedAt', v_row.day_ended_at,
      'hasGps', v_row.end_lat IS NOT NULL
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

REVOKE ALL ON FUNCTION public.salesman_end_day(date, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_end_day(date, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.salesman_check_in_visit(
  p_visit_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visit public.sales_visits%ROWTYPE;
  v_shop_lat double precision;
  v_shop_lng double precision;
  v_distance integer;
  v_verification text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.salesman_require_active_employment(v_uid);
  PERFORM public.assert_geo_coordinates(p_lat, p_lng);

  SELECT * INTO v_visit
  FROM public.sales_visits
  WHERE id = p_visit_id
    AND salesman_profile_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;

  IF v_visit.shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to you';
  END IF;

  SELECT s.delivery_lat, s.delivery_lng
  INTO v_shop_lat, v_shop_lng
  FROM public.shops s
  WHERE s.id = v_visit.shop_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF v_shop_lat IS NULL OR v_shop_lng IS NULL THEN
    v_distance := NULL;
    v_verification := 'unavailable';
  ELSE
    PERFORM public.assert_geo_coordinates(v_shop_lat, v_shop_lng);
    v_distance := round(public.geo_distance_metres(p_lat, p_lng, v_shop_lat, v_shop_lng))::integer;
    v_verification := 'verified';
  END IF;

  UPDATE public.sales_visits
  SET
    check_in_lat = p_lat,
    check_in_lng = p_lng,
    check_in_at = now(),
    check_in_distance_m = v_distance,
    updated_at = now()
  WHERE id = v_visit.id
  RETURNING * INTO v_visit;

  RETURN jsonb_build_object(
    'visitId', v_visit.id,
    'checkedInAt', v_visit.check_in_at,
    'latitude', v_visit.check_in_lat,
    'longitude', v_visit.check_in_lng,
    'distanceMetres', v_visit.check_in_distance_m,
    'gpsVerification', v_verification
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_check_in_visit(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_check_in_visit(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.salesman_complete_visit(
  p_visit_id uuid,
  p_status text,
  p_lat double precision,
  p_lng double precision,
  p_update_notes boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_photo_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visit public.sales_visits%ROWTYPE;
  v_status public.sales_visit_status;
  v_shop_lat double precision;
  v_shop_lng double precision;
  v_distance integer;
  v_verification text;
  v_notes text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.salesman_require_active_employment(v_uid);
  PERFORM public.assert_geo_coordinates(p_lat, p_lng);

  IF p_status IS NULL OR p_status NOT IN ('VISITED', 'SHOP_CLOSED') THEN
    RAISE EXCEPTION 'Visit can only be completed as VISITED or SHOP_CLOSED';
  END IF;
  v_status := p_status::public.sales_visit_status;

  SELECT * INTO v_visit
  FROM public.sales_visits
  WHERE id = p_visit_id
    AND salesman_profile_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  IF v_visit.status IN ('VISITED', 'SHOP_CLOSED') THEN
    RAISE EXCEPTION 'Visit is already complete';
  END IF;
  IF v_visit.check_in_at IS NULL THEN
    RAISE EXCEPTION 'Check in before completing this visit';
  END IF;
  IF v_visit.shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'Shop is not assigned to you';
  END IF;

  IF p_photo_path IS NOT NULL THEN
    IF (storage.foldername(p_photo_path))[1] IS DISTINCT FROM v_uid::text
      OR (storage.foldername(p_photo_path))[2] IS DISTINCT FROM v_visit.shop_id::text
      OR split_part(p_photo_path, '/', 3) IS DISTINCT FROM 'visits'
      OR split_part(p_photo_path, '/', 4) IS DISTINCT FROM v_visit.id::text
    THEN
      RAISE EXCEPTION 'Visit photo path is not allowed';
    END IF;
  END IF;

  SELECT s.delivery_lat, s.delivery_lng
  INTO v_shop_lat, v_shop_lng
  FROM public.shops s
  WHERE s.id = v_visit.shop_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF v_shop_lat IS NULL OR v_shop_lng IS NULL THEN
    v_distance := NULL;
    v_verification := 'unavailable';
  ELSE
    v_distance := round(public.geo_distance_metres(p_lat, p_lng, v_shop_lat, v_shop_lng))::integer;
    v_verification := 'verified';
  END IF;

  IF p_update_notes THEN
    v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');
  ELSE
    v_notes := v_visit.notes;
  END IF;

  UPDATE public.sales_visits
  SET
    status = v_status,
    notes = v_notes,
    visited_at = COALESCE(visited_at, now()),
    completed_at = now(),
    completion_lat = p_lat,
    completion_lng = p_lng,
    completion_distance_m = v_distance,
    photo_path = COALESCE(p_photo_path, photo_path),
    updated_at = now()
  WHERE id = v_visit.id
  RETURNING * INTO v_visit;

  RETURN jsonb_build_object(
    'visitId', v_visit.id,
    'status', v_visit.status,
    'notes', v_visit.notes,
    'completedAt', v_visit.completed_at,
    'latitude', v_visit.completion_lat,
    'longitude', v_visit.completion_lng,
    'distanceMetres', v_visit.completion_distance_m,
    'gpsVerification', v_verification,
    'photoPath', v_visit.photo_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_complete_visit(
  uuid, text, double precision, double precision, boolean, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_complete_visit(
  uuid, text, double precision, double precision, boolean, text, text
) TO authenticated;

COMMENT ON FUNCTION public.salesman_check_in_visit IS
  'Salesman check-in. Records GPS and distance to shops.delivery_lat/lng. Missing shop GPS returns gpsVerification=unavailable and does not invent coordinates.';
COMMENT ON FUNCTION public.salesman_complete_visit IS
  'Complete a checked-in visit as VISITED or SHOP_CLOSED. Omitted notes are preserved; p_update_notes clears or replaces them.';
