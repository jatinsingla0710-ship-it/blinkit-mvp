-- Sprint 4 / 0020: settings key-value store + reports_snapshot placeholder.

CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_key_not_blank CHECK (char_length(btrim(setting_key)) > 0)
);

CREATE UNIQUE INDEX settings_key_unique
  ON public.settings (lower(btrim(setting_key)))
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_settings_set_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.settings IS
  'Admin ERP system configuration. Keys are stable strings (company, payments, etc.).';

CREATE TABLE public.reports_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key text NOT NULL DEFAULT 'current',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_snapshot_key_not_blank CHECK (char_length(btrim(snapshot_key)) > 0)
);

CREATE UNIQUE INDEX reports_snapshot_key_unique
  ON public.reports_snapshot (lower(btrim(snapshot_key)))
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_reports_snapshot_set_updated_at
  BEFORE UPDATE ON public.reports_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.reports_snapshot IS
  'Future placeholder for materialized admin report payloads. Empty until analytics sprint.';

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports_snapshot ENABLE ROW LEVEL SECURITY;
