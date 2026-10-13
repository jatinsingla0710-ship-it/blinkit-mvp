-- Phase 7B.2B — Restrict direct EXECUTE on internal accounting helpers.
-- Nested calls from postgres-owned SECURITY DEFINER admin RPCs remain valid
-- because privilege checks use the function owner (postgres), not the JWT role.

REVOKE ALL ON FUNCTION public._accounting_post_journal(
  date, text, uuid, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public._accounting_reverse_posted_journal(
  text, uuid, text, uuid, text, date, uuid, text[]
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public._accounting_post_sale_refund_reversals(
  uuid, uuid, uuid, boolean, uuid
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._accounting_post_journal(
  date, text, uuid, text, jsonb, uuid
) IS
  'Internal: posts an idempotent balanced journal from account_code lines. '
  'EXECUTE revoked from API roles; callable only by postgres-owned DEFINER RPCs.';

COMMENT ON FUNCTION public._accounting_reverse_posted_journal(
  text, uuid, text, uuid, text, date, uuid, text[]
) IS
  'Internal: posts an idempotent reversing journal for an existing '
  '(source_type, source_id). EXECUTE revoked from API roles.';

COMMENT ON FUNCTION public._accounting_post_sale_refund_reversals(
  uuid, uuid, uuid, boolean, uuid
) IS
  'Internal: idempotent Books reversals for a refunded sale/payment. '
  'EXECUTE revoked from API roles.';
