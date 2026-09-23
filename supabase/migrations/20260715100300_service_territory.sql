-- GroAurum B2B: service territory, serviceability rules, and operational locations.
-- ServiceArea identity is independent of PIN codes; rules evolve via serviceability_rules.

CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_areas_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT service_areas_display_order_non_negative CHECK (display_order >= 0)
);

CREATE UNIQUE INDEX service_areas_name_unique ON public.service_areas (lower(btrim(name)));

CREATE TRIGGER trg_service_areas_set_updated_at
  BEFORE UPDATE ON public.service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.serviceability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id uuid NOT NULL REFERENCES public.service_areas (id) ON DELETE RESTRICT,
  rule_type public.serviceability_rule_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT serviceability_rules_config_is_object CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT serviceability_rules_pin_config CHECK (
    rule_type <> 'PIN_CODE'
    OR (
      config ? 'pinCodes'
      AND jsonb_typeof(config -> 'pinCodes') = 'array'
      AND jsonb_array_length(config -> 'pinCodes') > 0
    )
  ),
  CONSTRAINT serviceability_rules_admin_area_config CHECK (
    rule_type <> 'ADMIN_AREA'
    OR (
      config ? 'areaCodes'
      AND jsonb_typeof(config -> 'areaCodes') = 'array'
      AND jsonb_array_length(config -> 'areaCodes') > 0
    )
  ),
  CONSTRAINT serviceability_rules_polygon_config CHECK (
    rule_type <> 'POLYGON'
    OR (
      config ? 'polygonRef'
      AND jsonb_typeof(config -> 'polygonRef') = 'string'
      AND char_length(btrim(config ->> 'polygonRef')) > 0
    )
  )
);

CREATE INDEX serviceability_rules_service_area_idx
  ON public.serviceability_rules (service_area_id);

CREATE INDEX serviceability_rules_active_idx
  ON public.serviceability_rules (service_area_id, rule_type)
  WHERE is_active;

CREATE INDEX serviceability_rules_config_gin_idx
  ON public.serviceability_rules USING gin (config);

CREATE TRIGGER trg_serviceability_rules_set_updated_at
  BEFORE UPDATE ON public.serviceability_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.operational_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.operational_location_kind NOT NULL DEFAULT 'OPS_BASE',
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pin_code text NOT NULL,
  lat double precision,
  lng double precision,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_locations_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT operational_locations_address_not_blank CHECK (char_length(btrim(address_line)) > 0),
  CONSTRAINT operational_locations_pin_code_format CHECK (pin_code ~ '^[0-9]{6}$'),
  CONSTRAINT operational_locations_lat_range CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT operational_locations_lng_range CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
);

CREATE UNIQUE INDEX operational_locations_name_unique
  ON public.operational_locations (lower(btrim(name)));

CREATE TRIGGER trg_operational_locations_set_updated_at
  BEFORE UPDATE ON public.operational_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.service_areas IS
  'Stable operational delivery territory. Not tied to a single PIN code.';
COMMENT ON TABLE public.serviceability_rules IS
  'Extensible membership rules (PIN, admin area, polygon ref) bound to a service area.';
COMMENT ON COLUMN public.serviceability_rules.config IS
  'PIN_CODE: {"pinCodes":["110001"]}. ADMIN_AREA: {"areaCodes":["DL-SOUTH"]}. POLYGON: {"polygonRef":"..."}.';
COMMENT ON TABLE public.operational_locations IS
  'Physical ops base or warehouse — not a consumer dark store.';
