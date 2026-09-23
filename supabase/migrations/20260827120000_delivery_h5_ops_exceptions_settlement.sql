-- Delivery H5: employment, vehicles, slots, schedule history, COD custody/settlement,
-- exceptions, atomic schedule/assign, status sync. Preserves H1–H4 RPCs/contracts.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.delivery_employment_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_operational_status AS ENUM (
    'AVAILABLE',
    'ON_ROUTE',
    'OFF_DUTY',
    'UNAVAILABLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_id_proof_type AS ENUM ('AADHAAR', 'PAN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'ON_ROUTE',
    'MAINTENANCE',
    'UNAVAILABLE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_schedule_event_kind AS ENUM (
    'SCHEDULED',
    'RESCHEDULED',
    'DELAYED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_cod_custody_status AS ENUM (
    'WITH_DRIVER',
    'HANDED_TO_COMPANY',
    'RECONCILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_exception_category AS ENUM (
    'DRIVER',
    'VEHICLE',
    'WAREHOUSE_ORDER',
    'EXTERNAL',
    'CUSTOMER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_exception_status AS ENUM (
    'OPEN',
    'RESOLVED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_exception_action AS ENUM (
    'RESUME',
    'REPLACE_DRIVER',
    'REPLACE_VEHICLE',
    'RESCHEDULE_ROUTE',
    'CANCEL_ATTEMPT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_notification_event_kind AS ENUM (
    'DELIVERY_SCHEDULED',
    'DELIVERY_RESCHEDULED',
    'OUT_FOR_DELIVERY',
    'DELIVERY_COMPLETED',
    'DELIVERY_FAILED',
    'DELIVERY_DELAYED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── A. delivery_employment ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_employment (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  joining_date date NOT NULL DEFAULT (CURRENT_DATE),
  employment_status public.delivery_employment_status NOT NULL DEFAULT 'ACTIVE',
  operational_status public.delivery_operational_status NOT NULL DEFAULT 'AVAILABLE',
  address text,
  contact_email text,
  id_proof_type public.delivery_id_proof_type,
  id_proof_number text,
  primary_service_area_id uuid REFERENCES public.service_areas (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_employment_area_idx
  ON public.delivery_employment (primary_service_area_id);
CREATE INDEX IF NOT EXISTS delivery_employment_ops_idx
  ON public.delivery_employment (operational_status)
  WHERE employment_status = 'ACTIVE';

CREATE TRIGGER trg_delivery_employment_set_updated_at
  BEFORE UPDATE ON public.delivery_employment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.delivery_employment IS
  'Delivery H5: employment + operational status for DELIVERY profiles (no payroll).';

-- ─── B. vehicles + assignment history ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'VAN',
  capacity_label text,
  status public.vehicle_status NOT NULL DEFAULT 'AVAILABLE',
  is_active boolean NOT NULL DEFAULT true,
  assigned_delivery_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT vehicles_number_not_blank CHECK (char_length(btrim(vehicle_number)) > 0),
  CONSTRAINT vehicles_type_not_blank CHECK (char_length(btrim(vehicle_type)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_number_active_uidx
  ON public.vehicles (lower(btrim(vehicle_number)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS vehicles_status_idx ON public.vehicles (status)
  WHERE deleted_at IS NULL AND is_active;

CREATE TRIGGER trg_vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.vehicle_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  delivery_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  route_id uuid REFERENCES public.delivery_routes (id) ON DELETE SET NULL,
  from_status public.vehicle_status,
  to_status public.vehicle_status NOT NULL,
  note text,
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_assignment_history_vehicle_idx
  ON public.vehicle_assignment_history (vehicle_id, created_at DESC);

COMMENT ON TABLE public.vehicles IS
  'Delivery H5: fleet units. No GPS/fuel. Status gates assignment.';
COMMENT ON TABLE public.vehicle_assignment_history IS
  'Delivery H5: append-only vehicle status / assignment audit.';

-- ─── C. time slots ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_time_slots_label_not_blank CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT delivery_time_slots_range CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_time_slots_label_uidx
  ON public.delivery_time_slots (lower(btrim(label)));

INSERT INTO public.delivery_time_slots (label, start_time, end_time, sort_order)
SELECT v.label, v.start_time::time, v.end_time::time, v.sort_order
FROM (VALUES
  ('9–11', '09:00', '11:00', 10),
  ('11–1', '11:00', '13:00', 20),
  ('2–4', '14:00', '16:00', 30),
  ('4–6', '16:00', '18:00', 40)
) AS v(label, start_time, end_time, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_time_slots s
  WHERE lower(btrim(s.label)) = lower(btrim(v.label))
);

-- ─── D. extend delivery_routes ───────────────────────────────────────────────

ALTER TABLE public.delivery_routes
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE SET NULL;

ALTER TABLE public.delivery_routes
  ADD COLUMN IF NOT EXISTS time_slot_id uuid REFERENCES public.delivery_time_slots (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS delivery_routes_vehicle_idx
  ON public.delivery_routes (vehicle_id)
  WHERE vehicle_id IS NOT NULL AND deleted_at IS NULL;

-- ─── E. schedule history (append-only) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.delivery_routes (id) ON DELETE SET NULL,
  route_stop_id uuid REFERENCES public.route_stops (id) ON DELETE SET NULL,
  kind public.delivery_schedule_event_kind NOT NULL,
  delivery_date date NOT NULL,
  time_slot_id uuid REFERENCES public.delivery_time_slots (id) ON DELETE SET NULL,
  delivery_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  reason text,
  exception_id uuid,
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_schedule_events_order_idx
  ON public.delivery_schedule_events (order_id, created_at DESC);

COMMENT ON TABLE public.delivery_schedule_events IS
  'Delivery H5: append-only schedule / reschedule / delay history per order.';

-- ─── F. COD custody + settlements ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_cod_custody (
  order_id uuid PRIMARY KEY REFERENCES public.orders (id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  delivery_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  status public.delivery_cod_custody_status NOT NULL DEFAULT 'WITH_DRIVER',
  collected_at timestamptz NOT NULL DEFAULT now(),
  settlement_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_cod_custody_driver_status_idx
  ON public.delivery_cod_custody (delivery_profile_id, status);

CREATE TRIGGER trg_delivery_cod_custody_set_updated_at
  BEFORE UPDATE ON public.delivery_cod_custody
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.delivery_cod_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  reference text,
  note text,
  status public.delivery_cod_custody_status NOT NULL DEFAULT 'HANDED_TO_COMPANY',
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_cod_settlements_driver_idx
  ON public.delivery_cod_settlements (delivery_profile_id, settled_at DESC);

ALTER TABLE public.delivery_cod_custody
  DROP CONSTRAINT IF EXISTS delivery_cod_custody_settlement_fk;
ALTER TABLE public.delivery_cod_custody
  ADD CONSTRAINT delivery_cod_custody_settlement_fk
  FOREIGN KEY (settlement_id) REFERENCES public.delivery_cod_settlements (id)
  ON DELETE SET NULL;

COMMENT ON TABLE public.delivery_cod_custody IS
  'Delivery H5: cash with driver after COD collect; never auto-settled.';
COMMENT ON TABLE public.delivery_cod_settlements IS
  'Delivery H5: explicit driver → company cash handover.';

-- ─── G. exceptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.delivery_exception_category NOT NULL,
  reason_code text NOT NULL,
  reason_note text,
  status public.delivery_exception_status NOT NULL DEFAULT 'OPEN',
  route_id uuid REFERENCES public.delivery_routes (id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  route_stop_id uuid REFERENCES public.route_stops (id) ON DELETE SET NULL,
  reported_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action_taken public.delivery_exception_action,
  action_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_exceptions_reason_not_blank CHECK (char_length(btrim(reason_code)) > 0)
);

CREATE INDEX IF NOT EXISTS delivery_exceptions_open_idx
  ON public.delivery_exceptions (status, created_at DESC)
  WHERE status = 'OPEN';

CREATE TRIGGER trg_delivery_exceptions_set_updated_at
  BEFORE UPDATE ON public.delivery_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.delivery_schedule_events
  DROP CONSTRAINT IF EXISTS delivery_schedule_events_exception_fk;
ALTER TABLE public.delivery_schedule_events
  ADD CONSTRAINT delivery_schedule_events_exception_fk
  FOREIGN KEY (exception_id) REFERENCES public.delivery_exceptions (id)
  ON DELETE SET NULL;

COMMENT ON TABLE public.delivery_exceptions IS
  'Delivery H5: operational exceptions; Admin resolves with bulk-safe actions.';

-- ─── H. notification events (honest provider state) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  kind public.delivery_notification_event_kind NOT NULL,
  message_preview text NOT NULL,
  outbox_id uuid REFERENCES public.notification_outbox (id) ON DELETE SET NULL,
  provider_configured boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_notification_events_preview_not_blank
    CHECK (char_length(btrim(message_preview)) > 0)
);

CREATE INDEX IF NOT EXISTS delivery_notification_events_order_idx
  ON public.delivery_notification_events (order_id, created_at DESC);

COMMENT ON TABLE public.delivery_notification_events IS
  'Delivery H5: customer notification intents. provider_configured=false when no SMS/WhatsApp.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.delivery_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_employment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignment_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_time_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_schedule_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cod_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cod_custody FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cod_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_cod_settlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_exceptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notification_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_employment_select ON public.delivery_employment;
CREATE POLICY delivery_employment_select ON public.delivery_employment
  FOR SELECT TO authenticated
  USING (public.is_admin() OR profile_id = auth.uid());

DROP POLICY IF EXISTS delivery_employment_admin_write ON public.delivery_employment;
CREATE POLICY delivery_employment_admin_write ON public.delivery_employment
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR assigned_delivery_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.vehicle_id = vehicles.id
        AND dr.assigned_delivery_profile_id = auth.uid()
        AND dr.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS vehicles_admin_write ON public.vehicles;
CREATE POLICY vehicles_admin_write ON public.vehicles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS vehicle_history_select ON public.vehicle_assignment_history;
CREATE POLICY vehicle_history_select ON public.vehicle_assignment_history
  FOR SELECT TO authenticated
  USING (public.is_admin() OR delivery_profile_id = auth.uid());

DROP POLICY IF EXISTS vehicle_history_admin_write ON public.vehicle_assignment_history;
CREATE POLICY vehicle_history_admin_write ON public.vehicle_assignment_history
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_time_slots_select ON public.delivery_time_slots;
CREATE POLICY delivery_time_slots_select ON public.delivery_time_slots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS delivery_time_slots_admin_write ON public.delivery_time_slots;
CREATE POLICY delivery_time_slots_admin_write ON public.delivery_time_slots
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_schedule_events_select ON public.delivery_schedule_events;
CREATE POLICY delivery_schedule_events_select ON public.delivery_schedule_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR delivery_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.shop_auth_links sal ON sal.shop_id = o.shop_id
      WHERE o.id = delivery_schedule_events.order_id
        AND sal.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS delivery_schedule_events_admin_write ON public.delivery_schedule_events;
CREATE POLICY delivery_schedule_events_admin_write ON public.delivery_schedule_events
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_cod_custody_select ON public.delivery_cod_custody;
CREATE POLICY delivery_cod_custody_select ON public.delivery_cod_custody
  FOR SELECT TO authenticated
  USING (public.is_admin() OR delivery_profile_id = auth.uid());

DROP POLICY IF EXISTS delivery_cod_custody_admin_write ON public.delivery_cod_custody;
CREATE POLICY delivery_cod_custody_admin_write ON public.delivery_cod_custody
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_cod_settlements_select ON public.delivery_cod_settlements;
CREATE POLICY delivery_cod_settlements_select ON public.delivery_cod_settlements
  FOR SELECT TO authenticated
  USING (public.is_admin() OR delivery_profile_id = auth.uid());

DROP POLICY IF EXISTS delivery_cod_settlements_admin_write ON public.delivery_cod_settlements;
CREATE POLICY delivery_cod_settlements_admin_write ON public.delivery_cod_settlements
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_exceptions_select ON public.delivery_exceptions;
CREATE POLICY delivery_exceptions_select ON public.delivery_exceptions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR reported_by_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.id = delivery_exceptions.route_id
        AND dr.assigned_delivery_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS delivery_exceptions_admin_write ON public.delivery_exceptions;
CREATE POLICY delivery_exceptions_admin_write ON public.delivery_exceptions
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS delivery_notification_events_select ON public.delivery_notification_events;
CREATE POLICY delivery_notification_events_select ON public.delivery_notification_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.shop_auth_links sal ON sal.shop_id = o.shop_id
      WHERE o.id = delivery_notification_events.order_id
        AND sal.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS delivery_notification_events_admin_write ON public.delivery_notification_events;
CREATE POLICY delivery_notification_events_admin_write ON public.delivery_notification_events
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delivery_provider_configured()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

COMMENT ON FUNCTION public.delivery_provider_configured() IS
  'Delivery H5: SMS/WhatsApp provider gate. Returns false until a real provider is configured.';

CREATE OR REPLACE FUNCTION public._delivery_record_notification(
  p_order_id uuid,
  p_kind public.delivery_notification_event_kind,
  p_message text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_configured boolean := public.delivery_provider_configured();
  v_outbox uuid;
  v_recipient text;
BEGIN
  SELECT coalesce(nullif(btrim(p.mobile), ''), 'unknown')
  INTO v_recipient
  FROM public.orders o
  LEFT JOIN public.shop_auth_links sal ON sal.shop_id = o.shop_id
  LEFT JOIN public.profiles p ON p.id = sal.auth_user_id
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_configured AND v_recipient IS DISTINCT FROM 'unknown' THEN
    v_outbox := public.enqueue_notification(
      'SMS'::public.notification_channel,
      lower(p_kind::text),
      v_recipient,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('message', p_message),
      'order',
      p_order_id
    );
  END IF;

  INSERT INTO public.delivery_notification_events (
    order_id, kind, message_preview, outbox_id, provider_configured, payload, created_by_profile_id
  )
  VALUES (
    p_order_id, p_kind, btrim(p_message), v_outbox, v_configured,
    coalesce(p_payload, '{}'::jsonb), auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._delivery_assert_driver_assignable(
  p_profile_id uuid,
  p_exclude_route_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles public.staff_role[];
  v_emp public.delivery_employment%ROWTYPE;
  v_active_route uuid;
  v_route_code text;
BEGIN
  SELECT roles INTO v_roles FROM public.profiles
  WHERE id = p_profile_id AND deleted_at IS NULL AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery profile not found or inactive';
  END IF;
  IF NOT ('DELIVERY' = ANY (v_roles)) THEN
    RAISE EXCEPTION 'Profile is not a delivery staff member';
  END IF;

  SELECT * INTO v_emp FROM public.delivery_employment WHERE profile_id = p_profile_id;
  IF FOUND THEN
    IF v_emp.employment_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Delivery boy is inactive and cannot be assigned';
    END IF;
    IF v_emp.operational_status IN ('UNAVAILABLE', 'OFF_DUTY') THEN
      RAISE EXCEPTION 'Delivery boy is % and cannot be assigned', v_emp.operational_status;
    END IF;
  END IF;

  SELECT dr.id INTO v_active_route
  FROM public.delivery_routes dr
  WHERE dr.assigned_delivery_profile_id = p_profile_id
    AND dr.deleted_at IS NULL
    AND dr.status IN ('PLANNED', 'IN_PROGRESS')
    AND (p_exclude_route_id IS NULL OR dr.id IS DISTINCT FROM p_exclude_route_id)
  LIMIT 1;

  IF v_active_route IS NOT NULL THEN
    v_route_code := 'R' || upper(substr(replace(v_active_route::text, '-', ''), 1, 4));
    RAISE EXCEPTION '% is currently on Route %',
      (SELECT display_name FROM public.profiles WHERE id = p_profile_id),
      v_route_code;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._delivery_assert_vehicle_assignable(
  p_vehicle_id uuid,
  p_exclude_route_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_active_route uuid;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE id = p_vehicle_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;
  IF NOT v_vehicle.is_active THEN
    RAISE EXCEPTION 'Vehicle is inactive and cannot be assigned';
  END IF;
  IF v_vehicle.status IN ('MAINTENANCE', 'UNAVAILABLE') THEN
    RAISE EXCEPTION 'Vehicle is % and cannot be assigned', v_vehicle.status;
  END IF;

  SELECT dr.id INTO v_active_route
  FROM public.delivery_routes dr
  WHERE dr.vehicle_id = p_vehicle_id
    AND dr.deleted_at IS NULL
    AND dr.status IN ('PLANNED', 'IN_PROGRESS')
    AND (p_exclude_route_id IS NULL OR dr.id IS DISTINCT FROM p_exclude_route_id)
  LIMIT 1;

  IF v_active_route IS NOT NULL THEN
    RAISE EXCEPTION 'Vehicle % is already assigned to another active route',
      v_vehicle.vehicle_number;
  END IF;
END;
$$;

-- ─── Employment / vehicle RPCs ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_upsert_delivery_employment(
  p_profile_id uuid,
  p_joining_date date DEFAULT NULL,
  p_employment_status public.delivery_employment_status DEFAULT 'ACTIVE',
  p_operational_status public.delivery_operational_status DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_id_proof_type public.delivery_id_proof_type DEFAULT NULL,
  p_id_proof_number text DEFAULT NULL,
  p_primary_service_area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles public.staff_role[];
  v_row public.delivery_employment%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT roles INTO v_roles FROM public.profiles WHERE id = p_profile_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF NOT ('DELIVERY' = ANY (v_roles)) THEN
    RAISE EXCEPTION 'Profile must have DELIVERY role';
  END IF;

  INSERT INTO public.delivery_employment AS de (
    profile_id, joining_date, employment_status, operational_status,
    address, contact_email, id_proof_type, id_proof_number, primary_service_area_id
  )
  VALUES (
    p_profile_id,
    coalesce(p_joining_date, CURRENT_DATE),
    p_employment_status,
    coalesce(p_operational_status, 'AVAILABLE'::public.delivery_operational_status),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_contact_email), ''),
    p_id_proof_type,
    nullif(btrim(p_id_proof_number), ''),
    p_primary_service_area_id
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    joining_date = coalesce(EXCLUDED.joining_date, de.joining_date),
    employment_status = EXCLUDED.employment_status,
    operational_status = coalesce(p_operational_status, de.operational_status),
    address = EXCLUDED.address,
    contact_email = EXCLUDED.contact_email,
    id_proof_type = EXCLUDED.id_proof_type,
    id_proof_number = EXCLUDED.id_proof_number,
    primary_service_area_id = EXCLUDED.primary_service_area_id,
    updated_at = now()
  RETURNING * INTO v_row;

  UPDATE public.profiles
  SET is_active = (p_employment_status = 'ACTIVE'),
      updated_at = now()
  WHERE id = p_profile_id;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_delivery_employment(
  uuid, date, public.delivery_employment_status, public.delivery_operational_status,
  text, text, public.delivery_id_proof_type, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_delivery_employment(
  uuid, date, public.delivery_employment_status, public.delivery_operational_status,
  text, text, public.delivery_id_proof_type, text, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_vehicle(
  p_vehicle_id uuid DEFAULT NULL,
  p_vehicle_number text DEFAULT NULL,
  p_vehicle_type text DEFAULT 'VAN',
  p_capacity_label text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_status public.vehicle_status DEFAULT NULL,
  p_assigned_delivery_profile_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row public.vehicles%ROWTYPE;
  v_from public.vehicle_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_vehicle_number IS NULL OR char_length(btrim(p_vehicle_number)) = 0 THEN
    RAISE EXCEPTION 'Vehicle number is required';
  END IF;

  IF p_vehicle_id IS NULL THEN
    INSERT INTO public.vehicles (
      vehicle_number, vehicle_type, capacity_label, is_active, status,
      assigned_delivery_profile_id, notes
    )
    VALUES (
      btrim(p_vehicle_number),
      coalesce(nullif(btrim(p_vehicle_type), ''), 'VAN'),
      nullif(btrim(p_capacity_label), ''),
      coalesce(p_is_active, true),
      coalesce(p_status, 'AVAILABLE'::public.vehicle_status),
      p_assigned_delivery_profile_id,
      nullif(btrim(p_notes), '')
    )
    RETURNING * INTO v_row;

    INSERT INTO public.vehicle_assignment_history (
      vehicle_id, delivery_profile_id, from_status, to_status, note, recorded_by_profile_id
    )
    VALUES (
      v_row.id, v_row.assigned_delivery_profile_id, NULL, v_row.status,
      'Vehicle created', auth.uid()
    );
  ELSE
    SELECT * INTO v_row FROM public.vehicles WHERE id = p_vehicle_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    v_from := v_row.status;

    UPDATE public.vehicles
    SET vehicle_number = btrim(p_vehicle_number),
        vehicle_type = coalesce(nullif(btrim(p_vehicle_type), ''), vehicle_type),
        capacity_label = nullif(btrim(p_capacity_label), ''),
        is_active = coalesce(p_is_active, is_active),
        status = coalesce(p_status, status),
        assigned_delivery_profile_id = p_assigned_delivery_profile_id,
        notes = nullif(btrim(p_notes), ''),
        updated_at = now()
    WHERE id = p_vehicle_id
    RETURNING * INTO v_row;

    IF v_from IS DISTINCT FROM v_row.status
       OR v_from IS DISTINCT FROM coalesce(p_status, v_from) THEN
      INSERT INTO public.vehicle_assignment_history (
        vehicle_id, delivery_profile_id, from_status, to_status, note, recorded_by_profile_id
      )
      VALUES (
        v_row.id, v_row.assigned_delivery_profile_id, v_from, v_row.status,
        'Vehicle updated', auth.uid()
      );
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_vehicle(
  uuid, text, text, text, boolean, public.vehicle_status, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_vehicle(
  uuid, text, text, text, boolean, public.vehicle_status, uuid, text
) TO authenticated;

-- ─── Atomic schedule + assign ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_schedule_and_assign_delivery(
  p_order_ids uuid[],
  p_delivery_profile_id uuid,
  p_vehicle_id uuid,
  p_delivery_date date,
  p_time_slot_id uuid,
  p_route_id uuid DEFAULT NULL,
  p_service_area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route public.delivery_routes%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_order_id uuid;
  v_area uuid;
  v_slot public.delivery_time_slots%ROWTYPE;
  v_existing_stop public.route_stops%ROWTYPE;
  v_stop_id uuid;
  v_next_seq integer;
  v_created_route boolean := false;
  v_reused_route boolean := false;
  v_assigned int := 0;
  v_driver_name text;
  v_slot_label text;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_order_ids IS NULL OR coalesce(array_length(p_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one order is required';
  END IF;
  IF p_delivery_date IS NULL THEN RAISE EXCEPTION 'Delivery date is required'; END IF;
  IF p_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle is required'; END IF;

  SELECT * INTO v_slot FROM public.delivery_time_slots
  WHERE id = p_time_slot_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Time slot not found or inactive'; END IF;
  v_slot_label := v_slot.label;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Lock first order to determine service area
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_ids[1] FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_area := coalesce(p_service_area_id, v_order.service_area_id);
  IF v_area IS NULL THEN RAISE EXCEPTION 'Order has no service area'; END IF;

  IF p_route_id IS NOT NULL THEN
    SELECT * INTO v_route FROM public.delivery_routes
    WHERE id = p_route_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
    IF v_route.status IN ('COMPLETED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Cannot assign to a % route', v_route.status;
    END IF;
    IF v_route.service_area_id IS DISTINCT FROM v_area THEN
      RAISE EXCEPTION 'Route service area does not match orders';
    END IF;
    IF v_route.route_date IS DISTINCT FROM p_delivery_date THEN
      RAISE EXCEPTION 'Route date does not match delivery date';
    END IF;
    PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, v_route.id);
    PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, v_route.id);
    v_reused_route := true;
  ELSE
    -- Prefer existing open route for same driver + date + area
    SELECT * INTO v_route
    FROM public.delivery_routes
    WHERE deleted_at IS NULL
      AND service_area_id = v_area
      AND route_date = p_delivery_date
      AND assigned_delivery_profile_id = p_delivery_profile_id
      AND status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, v_route.id);
      PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, v_route.id);
      v_reused_route := true;
    ELSE
      PERFORM public._delivery_assert_driver_assignable(p_delivery_profile_id, NULL);
      PERFORM public._delivery_assert_vehicle_assignable(p_vehicle_id, NULL);

      INSERT INTO public.delivery_routes (
        service_area_id, route_date, assigned_delivery_profile_id,
        vehicle_id, time_slot_id, status
      )
      VALUES (
        v_area, p_delivery_date, p_delivery_profile_id,
        p_vehicle_id, p_time_slot_id, 'PLANNED'
      )
      RETURNING * INTO v_route;
      v_created_route := true;
    END IF;
  END IF;

  UPDATE public.delivery_routes
  SET assigned_delivery_profile_id = p_delivery_profile_id,
      vehicle_id = p_vehicle_id,
      time_slot_id = p_time_slot_id,
      route_date = p_delivery_date,
      status = CASE
        WHEN status IN ('DRAFT', 'PLANNED') THEN 'PLANNED'::public.delivery_route_status
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_route.id
  RETURNING * INTO v_route;

  UPDATE public.vehicles
  SET status = CASE
        WHEN status = 'ON_ROUTE' THEN status
        ELSE 'ASSIGNED'::public.vehicle_status
      END,
      assigned_delivery_profile_id = p_delivery_profile_id,
      updated_at = now()
  WHERE id = p_vehicle_id;

  INSERT INTO public.vehicle_assignment_history (
    vehicle_id, delivery_profile_id, route_id, from_status, to_status, note, recorded_by_profile_id
  )
  VALUES (
    p_vehicle_id, p_delivery_profile_id, v_route.id, 'AVAILABLE', 'ASSIGNED',
    'Assigned to route', v_uid
  );

  -- Driver stays AVAILABLE until route start (operational ON_ROUTE on start)
  INSERT INTO public.delivery_employment (profile_id, employment_status, operational_status)
  VALUES (p_delivery_profile_id, 'ACTIVE', 'AVAILABLE')
  ON CONFLICT (profile_id) DO NOTHING;

  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', v_order_id; END IF;
    IF v_order.service_area_id IS DISTINCT FROM v_area THEN
      RAISE EXCEPTION 'All orders must share the same service area';
    END IF;

    IF public.order_status_happy_path_index(v_order.status) < 5
       AND v_order.status IS DISTINCT FROM 'ASSIGNED_TO_ROUTE'
       AND v_order.status IS DISTINCT FROM 'OUT_FOR_DELIVERY'
       AND v_order.status IS DISTINCT FROM 'DELIVERED'
    THEN
      RAISE EXCEPTION
        'Order must be packed (Ready for Dispatch) before scheduling (current: %)',
        v_order.status;
    END IF;

    SELECT * INTO v_existing_stop
    FROM public.route_stops WHERE order_id = v_order_id LIMIT 1;

    IF FOUND THEN
      IF v_existing_stop.route_id = v_route.id THEN
        v_stop_id := v_existing_stop.id;
      ELSE
        RAISE EXCEPTION 'Order % is already assigned to another route', v_order_id;
      END IF;
    ELSE
      SELECT coalesce(max(sequence), 0) + 1 INTO v_next_seq
      FROM public.route_stops WHERE route_id = v_route.id;

      INSERT INTO public.route_stops (route_id, order_id, sequence, status)
      VALUES (v_route.id, v_order_id, v_next_seq, 'PENDING')
      RETURNING id INTO v_stop_id;
    END IF;

    INSERT INTO public.delivery_schedule_events (
      order_id, route_id, route_stop_id, kind, delivery_date, time_slot_id,
      delivery_profile_id, vehicle_id, recorded_by_profile_id
    )
    VALUES (
      v_order_id, v_route.id, v_stop_id, 'SCHEDULED', p_delivery_date, p_time_slot_id,
      p_delivery_profile_id, p_vehicle_id, v_uid
    );

    IF v_order.status = 'READY_FOR_DISPATCH' THEN
      PERFORM public.admin_advance_order_to(
        v_order_id,
        'ASSIGNED_TO_ROUTE',
        format('Scheduled for %s · %s', p_delivery_date::text, v_slot_label)
      );
    END IF;

    SELECT display_name INTO v_driver_name FROM public.profiles WHERE id = p_delivery_profile_id;
    v_msg := format(
      'Your order is scheduled for delivery on %s between %s.',
      to_char(p_delivery_date, 'DD Mon YYYY'),
      v_slot_label
    );
    PERFORM public._delivery_record_notification(
      v_order_id,
      'DELIVERY_SCHEDULED',
      v_msg,
      jsonb_build_object(
        'deliveryDate', p_delivery_date,
        'timeSlot', v_slot_label,
        'routeId', v_route.id
      )
    );

    v_assigned := v_assigned + 1;
  END LOOP;

  PERFORM public.write_audit_log(
    'delivery.scheduled_assigned_admin',
    'delivery_route',
    v_route.id,
    jsonb_build_object(
      'orderIds', to_jsonb(p_order_ids),
      'deliveryProfileId', p_delivery_profile_id,
      'vehicleId', p_vehicle_id,
      'deliveryDate', p_delivery_date,
      'timeSlotId', p_time_slot_id,
      'createdRoute', v_created_route,
      'reusedRoute', v_reused_route,
      'assignedCount', v_assigned
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'routeId', v_route.id,
    'createdRoute', v_created_route,
    'reusedRoute', v_reused_route,
    'assignedCount', v_assigned,
    'deliveryDate', p_delivery_date,
    'timeSlotId', p_time_slot_id,
    'deliveryProfileId', p_delivery_profile_id,
    'vehicleId', p_vehicle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_schedule_and_assign_delivery(
  uuid[], uuid, uuid, date, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_schedule_and_assign_delivery(
  uuid[], uuid, uuid, date, uuid, uuid, uuid
) TO authenticated;

COMMENT ON FUNCTION public.admin_schedule_and_assign_delivery IS
  'Delivery H5: atomic schedule + route reuse/create + stops + vehicle + history + notify event.';

-- ─── COD settlement ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_settle_delivery_cod(
  p_delivery_profile_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settlement_id uuid;
  v_remaining numeric;
  v_row public.delivery_cod_custody%ROWTYPE;
  v_applied numeric := 0;
  v_orders uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Settlement amount must be positive';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  INSERT INTO public.delivery_cod_settlements (
    delivery_profile_id, amount, reference, note, status, recorded_by_profile_id
  )
  VALUES (
    p_delivery_profile_id, p_amount,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
    'HANDED_TO_COMPANY', v_uid
  )
  RETURNING id INTO v_settlement_id;

  v_remaining := p_amount;

  FOR v_row IN
    SELECT * FROM public.delivery_cod_custody
    WHERE delivery_profile_id = p_delivery_profile_id
      AND status = 'WITH_DRIVER'
    ORDER BY collected_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    IF v_row.amount <= v_remaining THEN
      UPDATE public.delivery_cod_custody
      SET status = 'HANDED_TO_COMPANY',
          settlement_id = v_settlement_id,
          updated_at = now()
      WHERE order_id = v_row.order_id;
      v_remaining := v_remaining - v_row.amount;
      v_applied := v_applied + v_row.amount;
      v_orders := array_append(v_orders, v_row.order_id);
    END IF;
  END LOOP;

  IF v_applied = 0 THEN
    RAISE EXCEPTION 'No matching WITH_DRIVER COD custody found for this amount';
  END IF;

  IF v_applied < p_amount THEN
    UPDATE public.delivery_cod_settlements
    SET amount = v_applied,
        note = coalesce(note || ' · ', '') || format('Applied %s of requested %s', v_applied, p_amount)
    WHERE id = v_settlement_id;
  END IF;

  RETURN jsonb_build_object(
    'settlementId', v_settlement_id,
    'appliedAmount', v_applied,
    'orderIds', to_jsonb(v_orders)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_settle_delivery_cod(uuid, numeric, text, text) TO authenticated;

-- ─── Exceptions ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_delivery_exception(
  p_category public.delivery_exception_category,
  p_reason_code text,
  p_reason_note text DEFAULT NULL,
  p_route_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_route_stop_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.delivery_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  INSERT INTO public.delivery_exceptions (
    category, reason_code, reason_note, route_id, order_id, route_stop_id,
    reported_by_profile_id
  )
  VALUES (
    p_category, btrim(p_reason_code), nullif(btrim(p_reason_note), ''),
    p_route_id, p_order_id, p_route_stop_id, auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_delivery_exception(
  public.delivery_exception_category, text, text, uuid, uuid, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_delivery_exception(
  public.delivery_exception_category, text, text, uuid, uuid, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_delivery_exception(
  p_exception_id uuid,
  p_action public.delivery_exception_action,
  p_action_note text DEFAULT NULL,
  p_replacement_delivery_profile_id uuid DEFAULT NULL,
  p_replacement_vehicle_id uuid DEFAULT NULL,
  p_new_delivery_date date DEFAULT NULL,
  p_new_time_slot_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ex public.delivery_exceptions%ROWTYPE;
  v_route public.delivery_routes%ROWTYPE;
  v_stop public.route_stops%ROWTYPE;
  v_slot_label text;
  v_msg text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT * INTO v_ex FROM public.delivery_exceptions WHERE id = p_exception_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exception not found'; END IF;
  IF v_ex.status <> 'OPEN' THEN RAISE EXCEPTION 'Exception is not open'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  IF v_ex.route_id IS NOT NULL THEN
    SELECT * INTO v_route FROM public.delivery_routes
    WHERE id = v_ex.route_id AND deleted_at IS NULL FOR UPDATE;
  END IF;

  CASE p_action
    WHEN 'RESUME' THEN
      NULL;

    WHEN 'REPLACE_DRIVER' THEN
      IF v_route.id IS NULL THEN RAISE EXCEPTION 'Route required for REPLACE_DRIVER'; END IF;
      IF p_replacement_delivery_profile_id IS NULL THEN
        RAISE EXCEPTION 'Replacement driver required';
      END IF;
      PERFORM public._delivery_assert_driver_assignable(
        p_replacement_delivery_profile_id, v_route.id
      );
      UPDATE public.delivery_routes
      SET assigned_delivery_profile_id = p_replacement_delivery_profile_id,
          updated_at = now()
      WHERE id = v_route.id;
      IF v_route.vehicle_id IS NOT NULL THEN
        UPDATE public.vehicles
        SET assigned_delivery_profile_id = p_replacement_delivery_profile_id,
            updated_at = now()
        WHERE id = v_route.vehicle_id;
      END IF;

    WHEN 'REPLACE_VEHICLE' THEN
      IF v_route.id IS NULL THEN RAISE EXCEPTION 'Route required for REPLACE_VEHICLE'; END IF;
      IF p_replacement_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'Replacement vehicle required';
      END IF;
      PERFORM public._delivery_assert_vehicle_assignable(p_replacement_vehicle_id, v_route.id);
      IF v_route.vehicle_id IS NOT NULL THEN
        UPDATE public.vehicles
        SET status = 'AVAILABLE', updated_at = now()
        WHERE id = v_route.vehicle_id AND status <> 'ON_ROUTE';
      END IF;
      UPDATE public.delivery_routes
      SET vehicle_id = p_replacement_vehicle_id, updated_at = now()
      WHERE id = v_route.id;
      UPDATE public.vehicles
      SET status = CASE WHEN v_route.status = 'IN_PROGRESS' THEN 'ON_ROUTE' ELSE 'ASSIGNED' END,
          assigned_delivery_profile_id = v_route.assigned_delivery_profile_id,
          updated_at = now()
      WHERE id = p_replacement_vehicle_id;
      INSERT INTO public.vehicle_assignment_history (
        vehicle_id, delivery_profile_id, route_id, from_status, to_status, note, recorded_by_profile_id
      )
      VALUES (
        p_replacement_vehicle_id, v_route.assigned_delivery_profile_id, v_route.id,
        'AVAILABLE',
        CASE WHEN v_route.status = 'IN_PROGRESS' THEN 'ON_ROUTE'::public.vehicle_status ELSE 'ASSIGNED'::public.vehicle_status END,
        'Exception vehicle replace', v_uid
      );

    WHEN 'RESCHEDULE_ROUTE' THEN
      IF v_route.id IS NULL THEN RAISE EXCEPTION 'Route required for RESCHEDULE_ROUTE'; END IF;
      IF p_new_delivery_date IS NULL OR p_new_time_slot_id IS NULL THEN
        RAISE EXCEPTION 'New delivery date and time slot required';
      END IF;
      SELECT label INTO v_slot_label FROM public.delivery_time_slots WHERE id = p_new_time_slot_id;
      IF v_slot_label IS NULL THEN RAISE EXCEPTION 'Time slot not found'; END IF;

      UPDATE public.delivery_routes
      SET route_date = p_new_delivery_date,
          time_slot_id = p_new_time_slot_id,
          status = CASE
            WHEN status = 'IN_PROGRESS' THEN 'PLANNED'::public.delivery_route_status
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_route.id;

      FOR v_stop IN
        SELECT * FROM public.route_stops
        WHERE route_id = v_route.id AND status IN ('PENDING', 'IN_PROGRESS', 'FAILED')
      LOOP
        INSERT INTO public.delivery_schedule_events (
          order_id, route_id, route_stop_id, kind, delivery_date, time_slot_id,
          delivery_profile_id, vehicle_id, reason, exception_id, recorded_by_profile_id
        )
        VALUES (
          v_stop.order_id, v_route.id, v_stop.id, 'RESCHEDULED',
          p_new_delivery_date, p_new_time_slot_id,
          v_route.assigned_delivery_profile_id, v_route.vehicle_id,
          coalesce(p_action_note, v_ex.reason_code), v_ex.id, v_uid
        );

        UPDATE public.route_stops
        SET status = 'PENDING', updated_at = now()
        WHERE id = v_stop.id AND status = 'IN_PROGRESS';

        v_msg := format(
          'Your order has been rescheduled for delivery on %s between %s.',
          to_char(p_new_delivery_date, 'DD Mon YYYY'),
          v_slot_label
        );
        PERFORM public._delivery_record_notification(
          v_stop.order_id, 'DELIVERY_RESCHEDULED', v_msg,
          jsonb_build_object('deliveryDate', p_new_delivery_date, 'timeSlot', v_slot_label)
        );
      END LOOP;

      IF v_route.assigned_delivery_profile_id IS NOT NULL THEN
        UPDATE public.delivery_employment
        SET operational_status = 'AVAILABLE', updated_at = now()
        WHERE profile_id = v_route.assigned_delivery_profile_id
          AND operational_status = 'ON_ROUTE';
      END IF;
      IF v_route.vehicle_id IS NOT NULL THEN
        UPDATE public.vehicles
        SET status = 'ASSIGNED', updated_at = now()
        WHERE id = v_route.vehicle_id AND status = 'ON_ROUTE';
      END IF;

    WHEN 'CANCEL_ATTEMPT' THEN
      IF v_ex.route_stop_id IS NULL AND v_ex.order_id IS NULL THEN
        RAISE EXCEPTION 'Stop or order required for CANCEL_ATTEMPT';
      END IF;
      -- Mark open stop failed with OTHER if possible; do not invent SKIPPED flow.
      IF v_ex.route_stop_id IS NOT NULL THEN
        UPDATE public.route_stops
        SET status = 'FAILED', updated_at = now()
        WHERE id = v_ex.route_stop_id AND status IN ('PENDING', 'IN_PROGRESS');
      END IF;

    ELSE
      RAISE EXCEPTION 'Unsupported action %', p_action;
  END CASE;

  -- Delay notification for DRIVER/VEHICLE/EXTERNAL when not reschedule
  IF p_action IN ('REPLACE_DRIVER', 'REPLACE_VEHICLE', 'RESUME')
     AND v_ex.category IN ('DRIVER', 'VEHICLE', 'EXTERNAL')
     AND v_route.id IS NOT NULL
  THEN
    FOR v_stop IN
      SELECT * FROM public.route_stops
      WHERE route_id = v_route.id AND status IN ('PENDING', 'IN_PROGRESS')
    LOOP
      INSERT INTO public.delivery_schedule_events (
        order_id, route_id, route_stop_id, kind, delivery_date, time_slot_id,
        delivery_profile_id, vehicle_id, reason, exception_id, recorded_by_profile_id
      )
      VALUES (
        v_stop.order_id, v_route.id, v_stop.id, 'DELAYED',
        coalesce(v_route.route_date, CURRENT_DATE), v_route.time_slot_id,
        v_route.assigned_delivery_profile_id, v_route.vehicle_id,
        v_ex.reason_code, v_ex.id, v_uid
      );
      PERFORM public._delivery_record_notification(
        v_stop.order_id,
        'DELIVERY_DELAYED',
        'Your delivery has been delayed due to an unexpected delivery issue. We will update you with the new delivery time.',
        jsonb_build_object('exceptionId', v_ex.id, 'reasonCode', v_ex.reason_code)
      );
    END LOOP;
  END IF;

  UPDATE public.delivery_exceptions
  SET status = 'RESOLVED',
      action_taken = p_action,
      action_note = nullif(btrim(p_action_note), ''),
      resolved_by_profile_id = v_uid,
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_exception_id
  RETURNING * INTO v_ex;

  RETURN to_jsonb(v_ex);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_delivery_exception(
  uuid, public.delivery_exception_action, text, uuid, uuid, date, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_delivery_exception(
  uuid, public.delivery_exception_action, text, uuid, uuid, date, uuid
) TO authenticated;

-- ─── Patch start / complete / collect for ops + custody + notify ─────────────

CREATE OR REPLACE FUNCTION public.delivery_start_route(p_route_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status public.delivery_route_status;
  v_driver uuid;
  v_vehicle uuid;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(p_route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT status, assigned_delivery_profile_id, vehicle_id
  INTO v_status, v_driver, v_vehicle
  FROM public.delivery_routes WHERE id = p_route_id;
  IF v_status NOT IN ('DRAFT', 'PLANNED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Route cannot be started from status %', v_status;
  END IF;

  UPDATE public.delivery_routes
  SET status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_route_id;

  IF v_driver IS NOT NULL THEN
    UPDATE public.delivery_employment
    SET operational_status = 'ON_ROUTE', updated_at = now()
    WHERE profile_id = v_driver;
  END IF;
  IF v_vehicle IS NOT NULL THEN
    UPDATE public.vehicles
    SET status = 'ON_ROUTE', updated_at = now()
    WHERE id = v_vehicle;
  END IF;

  FOR r IN
    SELECT rs.id AS stop_id, rs.order_id, o.status AS order_status
    FROM public.route_stops rs
    JOIN public.orders o ON o.id = rs.order_id
    WHERE rs.route_id = p_route_id
      AND rs.status IN ('PENDING', 'IN_PROGRESS')
  LOOP
    IF r.order_status IN ('ASSIGNED_TO_ROUTE', 'READY_FOR_DISPATCH', 'PROCESSING', 'CONFIRMED', 'STOCK_RESERVED') THEN
      UPDATE public.orders
      SET status = 'OUT_FOR_DELIVERY', updated_at = now()
      WHERE id = r.order_id;

      INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
      VALUES (r.order_id, v_uid, r.order_status, 'OUT_FOR_DELIVERY', 'Route started — out for delivery');

      PERFORM public._delivery_record_notification(
        r.order_id,
        'OUT_FOR_DELIVERY',
        'Your order is out for delivery today.',
        jsonb_build_object('routeId', p_route_id)
      );
    END IF;
  END LOOP;

  RETURN p_route_id;
END;
$$;

COMMENT ON FUNCTION public.delivery_start_route(uuid) IS
  'Sprint 8 + Delivery H4/H5: start route; sync driver/vehicle ON_ROUTE; notify OFD events.';

CREATE OR REPLACE FUNCTION public.delivery_complete_route(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
  v_completed int;
  v_failed int;
  v_cod_expected numeric := 0;
  v_cod_collected numeric := 0;
  v_driver uuid;
  v_vehicle uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(p_route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT
    count(*) FILTER (WHERE status IN ('PENDING', 'IN_PROGRESS')),
    count(*) FILTER (WHERE status = 'COMPLETED'),
    count(*) FILTER (WHERE status = 'FAILED')
  INTO v_pending, v_completed, v_failed
  FROM public.route_stops
  WHERE route_id = p_route_id;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Cannot close route: % stop(s) still open', v_pending;
  END IF;

  SELECT
    COALESCE(sum(p.amount) FILTER (
      WHERE p.method_intent = 'PAY_ON_DELIVERY' OR p.collection_method IN (
        'CASH_ON_DELIVERY', 'UPI_ON_DELIVERY', 'CARD_ON_DELIVERY'
      )
    ), 0),
    COALESCE(sum(p.amount) FILTER (WHERE p.status = 'PAID'), 0)
  INTO v_cod_expected, v_cod_collected
  FROM public.route_stops rs
  LEFT JOIN public.payments p ON p.order_id = rs.order_id
  WHERE rs.route_id = p_route_id;

  SELECT assigned_delivery_profile_id, vehicle_id
  INTO v_driver, v_vehicle
  FROM public.delivery_routes WHERE id = p_route_id;

  UPDATE public.delivery_routes
  SET status = 'COMPLETED', updated_at = now()
  WHERE id = p_route_id;

  IF v_driver IS NOT NULL THEN
    UPDATE public.delivery_employment
    SET operational_status = 'AVAILABLE', updated_at = now()
    WHERE profile_id = v_driver AND operational_status = 'ON_ROUTE';
  END IF;
  IF v_vehicle IS NOT NULL THEN
    UPDATE public.vehicles
    SET status = 'AVAILABLE', updated_at = now()
    WHERE id = v_vehicle AND status IN ('ON_ROUTE', 'ASSIGNED');
  END IF;

  RETURN jsonb_build_object(
    'routeId', p_route_id,
    'completedDeliveries', v_completed,
    'failedDeliveries', v_failed,
    'codExpected', v_cod_expected,
    'codCollected', v_cod_collected,
    'codPending', GREATEST(v_cod_expected - v_cod_collected, 0),
    'closedAt', now()
  );
END;
$$;

COMMENT ON FUNCTION public.delivery_complete_route(uuid) IS
  'Sprint 8 + Delivery H2/H5: close route; free driver/vehicle; return COD summary.';

CREATE OR REPLACE FUNCTION public.delivery_collect_cod(
  p_order_id uuid,
  p_collected_amount numeric,
  p_collection_method public.payment_collection_method DEFAULT 'CASH_ON_DELIVERY'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_route_id uuid;
  v_driver uuid;
  v_payment public.payments%ROWTYPE;
  v_from public.payment_status;
  v_actor_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rs.route_id, dr.assigned_delivery_profile_id
  INTO v_route_id, v_driver
  FROM public.route_stops rs
  JOIN public.delivery_routes dr ON dr.id = rs.route_id
  WHERE rs.order_id = p_order_id
  LIMIT 1;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Order is not on a delivery route';
  END IF;

  IF public.is_admin() THEN
    v_actor_role := 'ADMIN';
  ELSE
    IF NOT public.profile_has_role('DELIVERY') THEN
      RAISE EXCEPTION 'Delivery role required';
    END IF;
    IF v_route_id NOT IN (SELECT public.delivery_route_ids()) THEN
      RAISE EXCEPTION 'Order is not on an assigned delivery route';
    END IF;
    v_actor_role := 'DELIVERY';
  END IF;

  IF p_collected_amount IS NULL OR p_collected_amount < 0 THEN
    RAISE EXCEPTION 'Invalid collected amount';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.payments (
      order_id, status, method_intent, collection_method, amount, currency, paid_at
    )
    VALUES (
      p_order_id, 'PAID', 'PAY_ON_DELIVERY', p_collection_method,
      p_collected_amount, 'INR', now()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.payment_events (
      payment_id, from_status, to_status, actor_profile_id, actor_role, note
    )
    VALUES (v_payment.id, NULL, 'PAID', v_uid, v_actor_role, 'COD collected on delivery');
  ELSE
    IF v_payment.status = 'PAID' THEN
      -- still ensure custody row for cash methods
      NULL;
    ELSE
      v_from := v_payment.status;
      UPDATE public.payments
      SET status = 'PAID',
          collection_method = p_collection_method,
          amount = p_collected_amount,
          paid_at = now(),
          updated_at = now()
      WHERE id = v_payment.id;

      INSERT INTO public.payment_events (
        payment_id, from_status, to_status, actor_profile_id, actor_role, note
      )
      VALUES (v_payment.id, v_from, 'PAID', v_uid, v_actor_role, 'COD collected on delivery');
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_id = v_payment.id, updated_at = now()
  WHERE id = p_order_id AND payment_id IS NULL;

  -- Cash custody only for cash COD (not online)
  IF p_collection_method = 'CASH_ON_DELIVERY' AND coalesce(v_driver, v_uid) IS NOT NULL THEN
    INSERT INTO public.delivery_cod_custody (
      order_id, payment_id, delivery_profile_id, amount, status, collected_at
    )
    VALUES (
      p_order_id, v_payment.id, coalesce(v_driver, v_uid),
      p_collected_amount, 'WITH_DRIVER', now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      payment_id = EXCLUDED.payment_id,
      amount = EXCLUDED.amount,
      status = CASE
        WHEN delivery_cod_custody.status = 'WITH_DRIVER' THEN 'WITH_DRIVER'
        ELSE delivery_cod_custody.status
      END,
      updated_at = now();
  END IF;

  RETURN v_payment.id;
END;
$$;

COMMENT ON FUNCTION public.delivery_collect_cod(uuid, numeric, public.payment_collection_method) IS
  'Sprint 8 + Delivery H4/H5: collect COD; set cash custody WITH_DRIVER for cash.';

-- Notify on complete/fail stop (wrap existing bodies via CREATE OR REPLACE of thin add-ons
-- by re-reading H3 functions and appending notification — keep validation identical)

CREATE OR REPLACE FUNCTION public.delivery_complete_stop(
  p_stop_id uuid,
  p_notes text DEFAULT NULL,
  p_photo_captured boolean DEFAULT false,
  p_signature_captured boolean DEFAULT false,
  p_collect_cod_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_from public.order_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop not found'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  IF p_collect_cod_amount IS NOT NULL THEN
    PERFORM public.delivery_collect_cod(v_stop.order_id, p_collect_cod_amount, 'CASH_ON_DELIVERY');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = v_stop.order_id;
  IF NOT FOUND OR v_payment.status <> 'PAID' THEN
    IF FOUND AND v_payment.method_intent = 'PAY_ON_DELIVERY' THEN
      RAISE EXCEPTION 'Collect COD before marking delivered';
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment record required before delivery confirmation';
    END IF;
  END IF;

  IF v_order.status <> 'OUT_FOR_DELIVERY' THEN
    IF v_order.status IN ('ASSIGNED_TO_ROUTE', 'READY_FOR_DISPATCH') THEN
      UPDATE public.orders SET status = 'OUT_FOR_DELIVERY', updated_at = now() WHERE id = v_order.id;
      INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
      VALUES (v_order.id, v_uid, v_from, 'OUT_FOR_DELIVERY', 'Auto out-for-delivery before complete');
      v_from := 'OUT_FOR_DELIVERY';
    ELSIF v_order.status <> 'OUT_FOR_DELIVERY' THEN
      RAISE EXCEPTION 'Order must be OUT_FOR_DELIVERY to complete (current %)', v_order.status;
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'DELIVERED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (v_order.id, v_uid, 'OUT_FOR_DELIVERY', 'DELIVERED', COALESCE(p_notes, 'Delivered'));

  INSERT INTO public.delivery_attempts (
    route_stop_id, order_id, succeeded, failure_reason, failure_note,
    delivery_notes, photo_captured, signature_captured
  )
  VALUES (
    p_stop_id, v_order.id, true, NULL, NULL,
    p_notes, COALESCE(p_photo_captured, false), COALESCE(p_signature_captured, false)
  );

  UPDATE public.route_stops
  SET status = 'COMPLETED', updated_at = now()
  WHERE id = p_stop_id;

  PERFORM public._delivery_record_notification(
    v_order.id,
    'DELIVERY_COMPLETED',
    'Your order has been delivered successfully.',
    jsonb_build_object('stopId', p_stop_id)
  );

  RETURN p_stop_id;
END;
$$;

COMMENT ON FUNCTION public.delivery_complete_stop IS
  'Sprint 8 + Delivery H3/H5: confirm delivery; notify completion event.';

CREATE OR REPLACE FUNCTION public.delivery_fail_stop(
  p_stop_id uuid,
  p_failure_reason public.delivery_failure_reason,
  p_notes text DEFAULT NULL,
  p_photo_captured boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stop public.route_stops%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_from public.order_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop not found'; END IF;

  IF public.is_admin() THEN
    NULL;
  ELSE
    PERFORM public.assert_delivery_owns_route(v_stop.route_id);
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = v_stop.order_id FOR UPDATE;
  v_from := v_order.status;

  UPDATE public.orders
  SET status = 'DELIVERY_FAILED', updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_events (order_id, actor_profile_id, from_status, to_status, note)
  VALUES (v_order.id, v_uid, v_from, 'DELIVERY_FAILED', COALESCE(p_notes, p_failure_reason::text));

  INSERT INTO public.delivery_attempts (
    route_stop_id, order_id, succeeded, failure_reason, failure_note,
    delivery_notes, photo_captured, signature_captured
  )
  VALUES (
    p_stop_id, v_order.id, false, p_failure_reason, p_notes,
    p_notes, COALESCE(p_photo_captured, false), false
  );

  UPDATE public.route_stops
  SET status = 'FAILED', updated_at = now()
  WHERE id = p_stop_id;

  PERFORM public._delivery_record_notification(
    v_order.id,
    'DELIVERY_FAILED',
    'We could not complete your delivery. We will update you with the next steps.',
    jsonb_build_object('stopId', p_stop_id, 'failureReason', p_failure_reason)
  );

  RETURN p_stop_id;
END;
$$;

COMMENT ON FUNCTION public.delivery_fail_stop IS
  'Sprint 8 + Delivery H3/H5: fail stop; notify failure event.';

-- ─── Recommendations helper (simple) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_recommend_delivery_assignment(
  p_service_area_id uuid,
  p_delivery_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  SELECT jsonb_build_object(
    'deliveryProfileId', p.id,
    'displayName', p.display_name,
    'stopCount', coalesce((
      SELECT count(*)::int FROM public.route_stops rs
      JOIN public.delivery_routes dr ON dr.id = rs.route_id
      WHERE dr.assigned_delivery_profile_id = p.id
        AND dr.route_date = p_delivery_date
        AND dr.deleted_at IS NULL
        AND dr.status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS')
    ), 0),
    'existingRouteId', (
      SELECT dr.id FROM public.delivery_routes dr
      WHERE dr.assigned_delivery_profile_id = p.id
        AND dr.service_area_id = p_service_area_id
        AND dr.route_date = p_delivery_date
        AND dr.deleted_at IS NULL
        AND dr.status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS')
      ORDER BY dr.created_at DESC
      LIMIT 1
    ),
    'sameServiceArea', true,
    'operationalStatus', coalesce(de.operational_status, 'AVAILABLE'),
    'vehicleId', (
      SELECT v.id FROM public.vehicles v
      WHERE v.deleted_at IS NULL AND v.is_active
        AND v.status IN ('AVAILABLE', 'ASSIGNED')
        AND (v.assigned_delivery_profile_id IS NULL OR v.assigned_delivery_profile_id = p.id)
      ORDER BY CASE WHEN v.assigned_delivery_profile_id = p.id THEN 0 ELSE 1 END, v.created_at
      LIMIT 1
    )
  )
  INTO v_rec
  FROM public.profiles p
  LEFT JOIN public.delivery_employment de ON de.profile_id = p.id
  WHERE p.deleted_at IS NULL
    AND p.is_active
    AND 'DELIVERY' = ANY (p.roles)
    AND (de.profile_id IS NULL OR (
      de.employment_status = 'ACTIVE'
      AND de.operational_status = 'AVAILABLE'
      AND (de.primary_service_area_id IS NULL OR de.primary_service_area_id = p_service_area_id)
    ))
    AND NOT EXISTS (
      SELECT 1 FROM public.delivery_routes dr
      WHERE dr.assigned_delivery_profile_id = p.id
        AND dr.deleted_at IS NULL
        AND dr.status = 'IN_PROGRESS'
        AND dr.route_date IS DISTINCT FROM p_delivery_date
    )
  ORDER BY
    CASE WHEN de.primary_service_area_id = p_service_area_id THEN 0 ELSE 1 END,
    coalesce((
      SELECT count(*) FROM public.route_stops rs
      JOIN public.delivery_routes dr ON dr.id = rs.route_id
      WHERE dr.assigned_delivery_profile_id = p.id
        AND dr.route_date = p_delivery_date
        AND dr.deleted_at IS NULL
    ), 0) DESC,
    p.display_name
  LIMIT 1;

  RETURN coalesce(v_rec, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recommend_delivery_assignment(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recommend_delivery_assignment(uuid, date) TO authenticated;
