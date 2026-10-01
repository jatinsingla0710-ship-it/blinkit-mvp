-- Phase 3B: company/business expenses (NOT salesman expense claims).
-- Day Book derives cash activity from payments + this table; no journal/ledger table.

DO $$ BEGIN
  CREATE TYPE public.company_expense_category AS ENUM (
    'PURCHASE',
    'TRANSPORT',
    'RENT',
    'SALARY',
    'UTILITIES',
    'MARKETING',
    'OFFICE',
    'MAINTENANCE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.company_expense_payment_method AS ENUM (
    'CASH',
    'BANK',
    'UPI',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.company_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category public.company_expense_category NOT NULL,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  payment_method public.company_expense_payment_method NOT NULL DEFAULT 'CASH',
  reference_number text,
  receipt_path text,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_expenses_amount_positive CHECK (amount > 0 AND amount <= 9999999.99),
  CONSTRAINT company_expenses_description_length CHECK (
    char_length(btrim(description)) BETWEEN 1 AND 500
  ),
  CONSTRAINT company_expenses_reference_length CHECK (
    reference_number IS NULL OR char_length(btrim(reference_number)) BETWEEN 1 AND 80
  ),
  CONSTRAINT company_expenses_receipt_path_length CHECK (
    receipt_path IS NULL OR char_length(receipt_path) BETWEEN 1 AND 500
  )
);

CREATE INDEX IF NOT EXISTS company_expenses_date_idx
  ON public.company_expenses (expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS company_expenses_category_idx
  ON public.company_expenses (category, expense_date DESC);

DROP TRIGGER IF EXISTS trg_company_expenses_set_updated_at ON public.company_expenses;
CREATE TRIGGER trg_company_expenses_set_updated_at
  BEFORE UPDATE ON public.company_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.company_expenses IS
  'Admin-entered company/business expenses. Separate from salesman_expenses claims.';

ALTER TABLE public.company_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_expenses FORCE ROW LEVEL SECURITY;

-- Admin / read-only staff only — never salesmen.
DROP POLICY IF EXISTS company_expenses_admin_select ON public.company_expenses;
CREATE POLICY company_expenses_admin_select
  ON public.company_expenses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS company_expenses_admin_write ON public.company_expenses;
CREATE POLICY company_expenses_admin_write
  ON public.company_expenses
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_expenses TO authenticated;
GRANT ALL ON public.company_expenses TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_company_expense(
  p_expense_date date,
  p_category public.company_expense_category,
  p_amount numeric,
  p_description text,
  p_payment_method public.company_expense_payment_method DEFAULT 'CASH',
  p_reference_number text DEFAULT NULL,
  p_receipt_path text DEFAULT NULL
)
RETURNS public.company_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.company_expenses;
  v_desc text := btrim(coalesce(p_description, ''));
  v_ref text := NULLIF(btrim(coalesce(p_reference_number, '')), '');
  v_receipt text := NULLIF(btrim(coalesce(p_receipt_path, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create company expenses'
      USING ERRCODE = '42501';
  END IF;

  IF p_expense_date IS NULL THEN
    RAISE EXCEPTION 'Expense date is required' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999.99 THEN
    RAISE EXCEPTION 'Amount must be greater than 0' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_desc) < 1 OR char_length(v_desc) > 500 THEN
    RAISE EXCEPTION 'Description is required (max 500 characters)'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.company_expenses (
    expense_date,
    category,
    amount,
    description,
    payment_method,
    reference_number,
    receipt_path,
    created_by_profile_id
  )
  VALUES (
    p_expense_date,
    p_category,
    round(p_amount, 2),
    v_desc,
    coalesce(p_payment_method, 'CASH'::public.company_expense_payment_method),
    v_ref,
    v_receipt,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_company_expense(
  p_expense_id uuid,
  p_expense_date date,
  p_category public.company_expense_category,
  p_amount numeric,
  p_description text,
  p_payment_method public.company_expense_payment_method DEFAULT 'CASH',
  p_reference_number text DEFAULT NULL,
  p_receipt_path text DEFAULT NULL
)
RETURNS public.company_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.company_expenses;
  v_desc text := btrim(coalesce(p_description, ''));
  v_ref text := NULLIF(btrim(coalesce(p_reference_number, '')), '');
  v_receipt text := NULLIF(btrim(coalesce(p_receipt_path, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update company expenses'
      USING ERRCODE = '42501';
  END IF;

  IF p_expense_id IS NULL THEN
    RAISE EXCEPTION 'Expense id is required' USING ERRCODE = '22023';
  END IF;

  IF p_expense_date IS NULL THEN
    RAISE EXCEPTION 'Expense date is required' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999.99 THEN
    RAISE EXCEPTION 'Amount must be greater than 0' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_desc) < 1 OR char_length(v_desc) > 500 THEN
    RAISE EXCEPTION 'Description is required (max 500 characters)'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.company_expenses
  SET
    expense_date = p_expense_date,
    category = p_category,
    amount = round(p_amount, 2),
    description = v_desc,
    payment_method = coalesce(
      p_payment_method,
      'CASH'::public.company_expense_payment_method
    ),
    reference_number = v_ref,
    receipt_path = v_receipt,
    updated_at = now()
  WHERE id = p_expense_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_company_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete company expenses'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.company_expenses WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_company_expense(
  date,
  public.company_expense_category,
  numeric,
  text,
  public.company_expense_payment_method,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_company_expense(
  uuid,
  date,
  public.company_expense_category,
  numeric,
  text,
  public.company_expense_payment_method,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_company_expense(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_company_expense(
  date,
  public.company_expense_category,
  numeric,
  text,
  public.company_expense_payment_method,
  text,
  text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_company_expense(
  uuid,
  date,
  public.company_expense_category,
  numeric,
  text,
  public.company_expense_payment_method,
  text,
  text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_company_expense(uuid)
  TO authenticated, service_role;
