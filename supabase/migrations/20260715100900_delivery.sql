-- GroAurum B2B: delivery routes, route stops, and delivery attempts.

CREATE TABLE public.delivery_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES public.service_areas (id) ON DELETE RESTRICT,
  route_date date NOT NULL,
  assigned_delivery_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status public.delivery_route_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX delivery_routes_service_area_date_idx
  ON public.delivery_routes (service_area_id, route_date DESC);

CREATE INDEX delivery_routes_assigned_delivery_idx
  ON public.delivery_routes (assigned_delivery_profile_id)
  WHERE assigned_delivery_profile_id IS NOT NULL;

CREATE INDEX delivery_routes_status_idx ON public.delivery_routes (status);

CREATE TRIGGER trg_delivery_routes_set_updated_at
  BEFORE UPDATE ON public.delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.delivery_routes (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  status public.route_stop_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_stops_sequence_positive CHECK (sequence > 0),
  CONSTRAINT route_stops_unique_sequence_per_route UNIQUE (route_id, sequence),
  CONSTRAINT route_stops_unique_order_per_route UNIQUE (route_id, order_id)
);

CREATE INDEX route_stops_order_idx ON public.route_stops (order_id);
CREATE INDEX route_stops_route_status_idx ON public.route_stops (route_id, status);

CREATE TRIGGER trg_route_stops_set_updated_at
  BEFORE UPDATE ON public.route_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_stop_id uuid NOT NULL REFERENCES public.route_stops (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL,
  failure_reason public.delivery_failure_reason,
  failure_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_attempts_failure_reason_when_failed CHECK (
    succeeded OR failure_reason IS NOT NULL
  ),
  CONSTRAINT delivery_attempts_no_failure_reason_when_succeeded CHECK (
    NOT succeeded OR failure_reason IS NULL
  )
);

CREATE INDEX delivery_attempts_route_stop_idx
  ON public.delivery_attempts (route_stop_id, attempted_at DESC);

CREATE INDEX delivery_attempts_order_idx
  ON public.delivery_attempts (order_id, attempted_at DESC);

COMMENT ON TABLE public.delivery_routes IS
  'Daily delivery route plan for a service area.';
COMMENT ON TABLE public.delivery_attempts IS
  'Append-only record of each delivery attempt, including failure reasons.';
