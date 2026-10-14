-- Phase 7B.3D — Revoke anonymous EXECUTE on accounting journal sync.
-- Signature: public.admin_sync_accounting_journals(date, date)
-- Does not alter the function body. Restates intended grants for
-- authenticated and service_role (admin gate inside the function remains).

REVOKE EXECUTE ON FUNCTION public.admin_sync_accounting_journals(date, date)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_sync_accounting_journals(date, date)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_accounting_journals(date, date)
  TO service_role;

COMMENT ON FUNCTION public.admin_sync_accounting_journals(date, date) IS
  'Domain→journal sync. purchase_receipt + purchase_return events, legacy '
  'purchase_receive (RECEIVED without receipt rows). Skips collection_event-covered payments. '
  'Supplier-payment posts lock the payment row (FOR UPDATE) so concurrent '
  'admin_delete_supplier_payment cannot leave an unrepaired journal. '
  'EXECUTE revoked from anon; granted to authenticated and service_role.';
