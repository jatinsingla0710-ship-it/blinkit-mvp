-- GroAurum B2B: core PostgreSQL extensions and shared trigger helpers.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE UPDATE trigger helper: sets updated_at to transaction timestamp.';

CREATE OR REPLACE FUNCTION public.prevent_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION public.prevent_modification() IS
  'BEFORE UPDATE/DELETE trigger helper for immutable ledger tables.';

CREATE OR REPLACE FUNCTION public.attach_updated_at_trigger(p_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trigger_name text := format('trg_%s_set_updated_at', p_table::text);
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %s',
    v_trigger_name,
    p_table
  );
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
    v_trigger_name,
    p_table
  );
END;
$$;

COMMENT ON FUNCTION public.attach_updated_at_trigger(regclass) IS
  'Attach set_updated_at() to a table that has an updated_at column.';
