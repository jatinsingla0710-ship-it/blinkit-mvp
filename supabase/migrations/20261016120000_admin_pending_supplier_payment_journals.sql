-- Phase 7B.4 — Admin read of supplier payments missing Books journals.
-- Used by AR/AP reconciliation. Read-only: does not post, sync, or reverse journals.

CREATE OR REPLACE FUNCTION public.admin_pending_supplier_payment_journals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_total numeric(14, 2);
  v_pending_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can view pending supplier-payment journals'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(round(sum(sp.amount), 2), 0),
    count(*)::integer
  INTO v_pending_total, v_pending_count
  FROM public.supplier_payments sp
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.journal_entries je
    WHERE je.source_type = 'supplier_payment'
      AND je.source_id = sp.id
  );

  RETURN jsonb_build_object(
    'pendingTotal', v_pending_total,
    'pendingCount', v_pending_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pending_supplier_payment_journals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_pending_supplier_payment_journals() FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_pending_supplier_payment_journals()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pending_supplier_payment_journals()
  TO service_role;

COMMENT ON FUNCTION public.admin_pending_supplier_payment_journals() IS
  'Admin-only read: pendingTotal / pendingCount for supplier_payments with no '
  'journal_entries row (source_type=supplier_payment, source_id=payment.id). '
  'Does not sync or post journals. EXECUTE revoked from PUBLIC and anon; '
  'granted to authenticated and service_role.';
