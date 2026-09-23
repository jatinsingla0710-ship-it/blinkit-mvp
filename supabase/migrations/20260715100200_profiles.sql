-- GroAurum B2B: user profiles linked 1:1 with Supabase Auth identities.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  mobile text NOT NULL,
  roles public.staff_role[] NOT NULL DEFAULT ARRAY['CUSTOMER']::public.staff_role[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_display_name_not_blank CHECK (char_length(btrim(display_name)) > 0),
  CONSTRAINT profiles_mobile_normalized CHECK (mobile = public.normalize_mobile(mobile)),
  CONSTRAINT profiles_roles_not_empty CHECK (coalesce(array_length(roles, 1), 0) >= 1)
);

CREATE UNIQUE INDEX profiles_mobile_active_unique
  ON public.profiles (public.normalize_mobile(mobile))
  WHERE is_active;

CREATE INDEX profiles_roles_gin_idx ON public.profiles USING gin (roles);

CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.profiles IS
  'Application profile for every authenticated user. id mirrors auth.users.id.';
COMMENT ON COLUMN public.profiles.roles IS
  'Staff capabilities. CUSTOMER is the default retail shop identity.';
