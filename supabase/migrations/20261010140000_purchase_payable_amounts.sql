-- Phase 6B.2D — shared purchase payable basis helper (receipt/return vs legacy).
-- Does not add a second AP ledger. purchases.total stays the original bill total.
-- Overpayment remaining < 0 is an explicit supplier credit (no cash refund).

CREATE OR REPLACE FUNCTION public.purchase_payable_amounts(p_purchase_id uuid)
RETURNS TABLE (
  purchase_id uuid,
  status text,
  path text,
  bill_total numeric,
  receipt_total numeric,
  return_total numeric,
  payable_basis numeric,
  linked_payments numeric,
  remaining numeric,
  credit_on_bill numeric,
  has_receipt_events boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_has_receipts boolean;
  v_receipt_total numeric(14, 2);
  v_return_total numeric(14, 2);
  v_payments numeric(14, 2);
  v_basis numeric(14, 2);
  v_path text;
  v_remaining numeric(14, 2);
BEGIN
  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.purchase_receipts pr WHERE pr.purchase_id = p_purchase_id
  ) INTO v_has_receipts;

  SELECT coalesce(sum(pr.total_amount), 0)
  INTO v_receipt_total
  FROM public.purchase_receipts pr
  WHERE pr.purchase_id = p_purchase_id;

  SELECT coalesce(sum(pret.total_amount), 0)
  INTO v_return_total
  FROM public.purchase_returns pret
  WHERE pret.purchase_id = p_purchase_id;

  SELECT coalesce(sum(sp.amount), 0)
  INTO v_payments
  FROM public.supplier_payments sp
  WHERE sp.purchase_id = p_purchase_id;

  IF v_purchase.status IN (
    'DRAFT'::public.purchase_status,
    'CANCELLED'::public.purchase_status
  ) THEN
    v_path := 'none';
    v_basis := 0;
  ELSIF v_has_receipts THEN
    v_path := 'receipt_events';
    v_basis := greatest(0, round(v_receipt_total - v_return_total, 2));
  ELSIF v_purchase.status = 'RECEIVED'::public.purchase_status THEN
    v_path := 'legacy';
    v_basis := round(coalesce(v_purchase.total, 0), 2);
  ELSE
    v_path := 'none';
    v_basis := 0;
  END IF;

  v_remaining := round(v_basis - v_payments, 2);

  purchase_id := p_purchase_id;
  status := v_purchase.status::text;
  path := v_path;
  bill_total := round(coalesce(v_purchase.total, 0), 2);
  receipt_total := round(v_receipt_total, 2);
  return_total := round(v_return_total, 2);
  payable_basis := v_basis;
  linked_payments := round(v_payments, 2);
  remaining := v_remaining;
  credit_on_bill := greatest(0, round(-v_remaining, 2));
  has_receipt_events := v_has_receipts;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_payable_amounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_payable_amounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_payable_amounts(uuid) TO service_role;

COMMENT ON FUNCTION public.purchase_payable_amounts(uuid) IS
  'Payable basis for one purchase: receipt totals − returns (new path), or '
  'legacy bill total when RECEIVED with no receipt rows. remaining < 0 = credit.';
