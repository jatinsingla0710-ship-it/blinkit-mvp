-- GroAurum B2B: retail shops, contacts, invitations, auth links, salesman assignments.

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  legal_name text,
  lifecycle_status public.shop_lifecycle_status NOT NULL DEFAULT 'LEAD',
  service_area_id uuid REFERENCES public.service_areas (id) ON DELETE SET NULL,
  assigned_salesman_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  delivery_address_line text NOT NULL,
  delivery_city text NOT NULL,
  delivery_state text NOT NULL,
  delivery_pin_code text NOT NULL,
  delivery_lat double precision,
  delivery_lng double precision,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shops_trade_name_not_blank CHECK (char_length(btrim(trade_name)) > 0),
  CONSTRAINT shops_delivery_address_not_blank CHECK (char_length(btrim(delivery_address_line)) > 0),
  CONSTRAINT shops_delivery_pin_code_format CHECK (delivery_pin_code ~ '^[0-9]{6}$'),
  CONSTRAINT shops_delivery_lat_range CHECK (
    delivery_lat IS NULL OR (delivery_lat >= -90 AND delivery_lat <= 90)
  ),
  CONSTRAINT shops_delivery_lng_range CHECK (
    delivery_lng IS NULL OR (delivery_lng >= -180 AND delivery_lng <= 180)
  )
);

CREATE INDEX shops_service_area_idx ON public.shops (service_area_id);
CREATE INDEX shops_assigned_salesman_idx ON public.shops (assigned_salesman_profile_id);
CREATE INDEX shops_lifecycle_status_idx ON public.shops (lifecycle_status);
CREATE INDEX shops_delivery_pin_code_idx ON public.shops (delivery_pin_code);

CREATE TRIGGER trg_shops_set_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shop_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  name text NOT NULL,
  mobile text NOT NULL,
  email extensions.citext,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_contacts_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT shop_contacts_mobile_normalized CHECK (mobile = public.normalize_mobile(mobile)),
  CONSTRAINT shop_contacts_email_format CHECK (
    email IS NULL OR email::text ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

CREATE INDEX shop_contacts_shop_idx ON public.shop_contacts (shop_id);
CREATE UNIQUE INDEX shop_contacts_one_primary_per_shop
  ON public.shop_contacts (shop_id)
  WHERE is_primary;

CREATE UNIQUE INDEX shop_contacts_shop_mobile_unique
  ON public.shop_contacts (shop_id, public.normalize_mobile(mobile));

CREATE TRIGGER trg_shop_contacts_set_updated_at
  BEFORE UPDATE ON public.shop_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shop_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  mobile text NOT NULL,
  token text NOT NULL,
  status public.shop_invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_invitations_mobile_normalized CHECK (mobile = public.normalize_mobile(mobile)),
  CONSTRAINT shop_invitations_token_not_blank CHECK (char_length(btrim(token)) >= 16),
  CONSTRAINT shop_invitations_expires_after_sent CHECK (expires_at > sent_at)
);

CREATE UNIQUE INDEX shop_invitations_token_unique ON public.shop_invitations (token);
CREATE INDEX shop_invitations_shop_idx ON public.shop_invitations (shop_id);
CREATE INDEX shop_invitations_pending_mobile_idx
  ON public.shop_invitations (public.normalize_mobile(mobile))
  WHERE status = 'PENDING';

CREATE TABLE public.shop_auth_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_auth_links_unique_shop_user UNIQUE (shop_id, auth_user_id)
);

CREATE UNIQUE INDEX shop_auth_links_one_shop_per_auth_user
  ON public.shop_auth_links (auth_user_id);

CREATE INDEX shop_auth_links_shop_idx ON public.shop_auth_links (shop_id);

CREATE TABLE public.shop_salesman_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  assigned_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_salesman_assignments_effective_range CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE UNIQUE INDEX shop_salesman_assignments_one_active_per_shop
  ON public.shop_salesman_assignments (shop_id)
  WHERE effective_to IS NULL;

CREATE INDEX shop_salesman_assignments_salesman_active_idx
  ON public.shop_salesman_assignments (salesman_profile_id)
  WHERE effective_to IS NULL;

CREATE INDEX shop_salesman_assignments_shop_history_idx
  ON public.shop_salesman_assignments (shop_id, effective_from DESC);

CREATE TRIGGER trg_shop_salesman_assignments_set_updated_at
  BEFORE UPDATE ON public.shop_salesman_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_salesman_assignment_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.salesman_profile_id
      AND 'SALESMAN' = ANY (p.roles)
  ) THEN
    RAISE EXCEPTION 'profile % is not a SALESMAN', NEW.salesman_profile_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shop_salesman_assignments_role_check
  BEFORE INSERT OR UPDATE ON public.shop_salesman_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_salesman_assignment_role();

CREATE OR REPLACE FUNCTION public.sync_shop_assigned_salesman()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.effective_to IS NULL THEN
    UPDATE public.shops
    SET assigned_salesman_profile_id = NEW.salesman_profile_id
    WHERE id = NEW.shop_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.effective_to IS NULL AND (
      OLD.effective_to IS NOT NULL
      OR OLD.salesman_profile_id IS DISTINCT FROM NEW.salesman_profile_id
    ) THEN
      UPDATE public.shops
      SET assigned_salesman_profile_id = NEW.salesman_profile_id
      WHERE id = NEW.shop_id;
    ELSIF NEW.effective_to IS NOT NULL AND OLD.effective_to IS NULL THEN
      UPDATE public.shops
      SET assigned_salesman_profile_id = NULL
      WHERE id = NEW.shop_id
        AND assigned_salesman_profile_id = OLD.salesman_profile_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shop_salesman_assignments_sync_shop
  AFTER INSERT OR UPDATE ON public.shop_salesman_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shop_assigned_salesman();

COMMENT ON TABLE public.shops IS
  'B2B retail shop account. service_area_id is resolved via serviceability rules, not embedded PIN identity.';
COMMENT ON TABLE public.shop_auth_links IS
  'Maps a Supabase Auth user to exactly one shop customer identity.';
COMMENT ON TABLE public.shop_salesman_assignments IS
  'Salesman assignment history. effective_to IS NULL marks the current assignment.';
