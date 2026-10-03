-- Phase 2 RichlyBook: Supplier Payables.
-- Reuses existing suppliers + RECEIVED purchases.
-- Does NOT create double-entry journals, COGS, GST, or inventory valuation.

DO $$ BEGIN
  CREATE TYPE public.supplier_payment_method AS ENUM (
    'CASH',
    'BANK',
    'UPI',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  purchase_id uuid REFERENCES public.purchases (id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  payment_method public.supplier_payment_method NOT NULL DEFAULT 'CASH',
  reference_number text,
  notes text,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payments_amount_positive CHECK (
    amount > 0 AND amount <= 9999999.99
  ),
  CONSTRAINT supplier_payments_reference_length CHECK (
    reference_number IS NULL
    OR char_length(btrim(reference_number)) BETWEEN 1 AND 80
  ),
  CONSTRAINT supplier_payments_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx
  ON public.supplier_payments (supplier_id, payment_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS supplier_payments_date_idx
  ON public.supplier_payments (payment_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS supplier_payments_purchase_idx
  ON public.supplier_payments (purchase_id)
  WHERE purchase_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_supplier_payments_set_updated_at
  ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payments_set_updated_at
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.supplier_payments IS
  'Phase 2 supplier payments against payable balances from RECEIVED purchases. Not expenses.';

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_payments_admin_select ON public.supplier_payments;
CREATE POLICY supplier_payments_admin_select
  ON public.supplier_payments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS supplier_payments_admin_write ON public.supplier_payments;
CREATE POLICY supplier_payments_admin_write
  ON public.supplier_payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;

CREATE OR REPLACE FUNCTION public.admin_record_supplier_payment(
  p_supplier_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method text DEFAULT 'CASH',
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_purchase_id uuid DEFAULT NULL
)
RETURNS public.supplier_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.supplier_payments;
  v_method public.supplier_payment_method;
  v_purchase public.purchases;
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_reference text := NULLIF(btrim(coalesce(p_reference_number, '')), '');
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can record supplier payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'Supplier not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment date is required' USING ERRCODE = '22023';
  END IF;

  IF v_amount <= 0 OR v_amount > 9999999.99 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_method := upper(btrim(coalesce(p_payment_method, 'CASH')))
      ::public.supplier_payment_method;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid payment method'
      USING ERRCODE = '22023';
  END;

  IF p_purchase_id IS NOT NULL THEN
    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_purchase.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION 'Purchase does not belong to this supplier'
        USING ERRCODE = '22023';
    END IF;

    IF v_purchase.status <> 'RECEIVED'::public.purchase_status THEN
      RAISE EXCEPTION 'Only received purchases can be linked to payments'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.supplier_payments (
    supplier_id,
    purchase_id,
    payment_date,
    amount,
    payment_method,
    reference_number,
    notes,
    created_by_profile_id
  )
  VALUES (
    p_supplier_id,
    p_purchase_id,
    p_payment_date,
    v_amount,
    v_method,
    v_reference,
    v_notes,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_supplier_payment(
  uuid, date, numeric, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_supplier_payment(
  uuid, date, numeric, text, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_supplier_payment(
  uuid, date, numeric, text, text, text, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_supplier_payment(
  p_payment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete supplier payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment id is required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.supplier_payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier payment not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_supplier_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_supplier_payment(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_supplier_payment(uuid)
  TO service_role;
