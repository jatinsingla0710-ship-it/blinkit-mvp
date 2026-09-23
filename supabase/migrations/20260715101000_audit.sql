-- GroAurum B2B: append-only audit log for trusted workflow actions.

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role public.staff_role,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_not_blank CHECK (char_length(btrim(action)) > 0),
  CONSTRAINT audit_logs_entity_type_not_blank CHECK (char_length(btrim(entity_type)) > 0),
  CONSTRAINT audit_logs_payload_is_object CHECK (
    payload IS NULL OR jsonb_typeof(payload) = 'object'
  )
);

CREATE INDEX audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX audit_logs_actor_created_idx
  ON public.audit_logs (actor_profile_id, created_at DESC)
  WHERE actor_profile_id IS NOT NULL;

CREATE INDEX audit_logs_created_idx
  ON public.audit_logs (created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail. Rows may only be inserted, never updated or deleted.';
