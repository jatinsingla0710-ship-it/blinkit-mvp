-- Phase 7 — Cash & Bank.
-- Balances come only from posted journal lines (Cash 1000 / Bank 1010).
-- Owner can record verified opening, transfers, deposits, and withdrawals.
-- Does NOT invent balances from Day Book when journals are empty.
-- Does NOT build full bank statement matching (light ledger view only).

CREATE OR REPLACE FUNCTION public.admin_record_cash_bank_transfer(
  p_entry_date date,
  p_amount numeric,
  p_direction text,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_amount numeric(14, 2);
  v_source_id uuid := gen_random_uuid();
  v_dir text := lower(btrim(COALESCE(p_direction, '')));
  v_lines jsonb;
  v_memo text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can record cash/bank transfers' USING ERRCODE = '42501';
  END IF;

  IF p_entry_date IS NULL THEN
    RAISE EXCEPTION 'Entry date is required' USING ERRCODE = '22023';
  END IF;

  v_amount := round(COALESCE(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF v_dir NOT IN ('cash_to_bank', 'bank_to_cash') THEN
    RAISE EXCEPTION 'Direction must be cash_to_bank or bank_to_cash' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  IF v_dir = 'cash_to_bank' THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1010', 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_code', '1000', 'debit', 0, 'credit', v_amount)
    );
    v_memo := COALESCE(NULLIF(btrim(COALESCE(p_memo, '')), ''), 'Transfer cash to bank');
  ELSE
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_code', '1010', 'debit', 0, 'credit', v_amount)
    );
    v_memo := COALESCE(NULLIF(btrim(COALESCE(p_memo, '')), ''), 'Transfer bank to cash');
  END IF;

  RETURN public._accounting_post_journal(
    p_entry_date,
    'cash_transfer',
    v_source_id,
    left(v_memo, 500),
    v_lines,
    v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_cash_bank_transfer(date, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_cash_bank_transfer(date, numeric, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_record_cash_bank_transfer(date, numeric, text, text) IS
  'Phase 7: posts a balanced cash↔bank transfer journal from verified owner input.';

CREATE OR REPLACE FUNCTION public.admin_record_cash_bank_opening(
  p_entry_date date,
  p_cash_amount numeric DEFAULT 0,
  p_bank_amount numeric DEFAULT 0,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_cash numeric(14, 2) := round(COALESCE(p_cash_amount, 0), 2);
  v_bank numeric(14, 2) := round(COALESCE(p_bank_amount, 0), 2);
  v_total numeric(14, 2);
  v_source_id uuid := gen_random_uuid();
  v_lines jsonb := '[]'::jsonb;
  v_memo text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can record cash/bank opening balances' USING ERRCODE = '42501';
  END IF;

  IF p_entry_date IS NULL THEN
    RAISE EXCEPTION 'Entry date is required' USING ERRCODE = '22023';
  END IF;

  IF v_cash < 0 OR v_bank < 0 THEN
    RAISE EXCEPTION 'Opening amounts cannot be negative' USING ERRCODE = '22023';
  END IF;

  v_total := round(v_cash + v_bank, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Enter at least one verified opening amount' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  IF v_cash > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'debit', v_cash, 'credit', 0)
    );
  END IF;
  IF v_bank > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1010', 'debit', v_bank, 'credit', 0)
    );
  END IF;
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account_code', '3000', 'debit', 0, 'credit', v_total)
  );

  v_memo := COALESCE(
    NULLIF(btrim(COALESCE(p_memo, '')), ''),
    'Verified opening cash/bank balance'
  );

  RETURN public._accounting_post_journal(
    p_entry_date,
    'opening_balance',
    v_source_id,
    left(v_memo, 500),
    v_lines,
    v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_cash_bank_opening(date, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_cash_bank_opening(date, numeric, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.admin_record_cash_bank_opening(date, numeric, numeric, text) IS
  'Phase 7: posts verified opening cash/bank against Owner Equity. Does not invent amounts.';

CREATE OR REPLACE FUNCTION public.admin_record_cash_bank_external(
  p_entry_date date,
  p_account text,
  p_kind text,
  p_amount numeric,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_amount numeric(14, 2);
  v_account text := lower(btrim(COALESCE(p_account, '')));
  v_kind text := lower(btrim(COALESCE(p_kind, '')));
  v_code text;
  v_source_id uuid := gen_random_uuid();
  v_lines jsonb;
  v_memo text;
  v_source_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can record cash/bank deposits or withdrawals'
      USING ERRCODE = '42501';
  END IF;

  IF p_entry_date IS NULL THEN
    RAISE EXCEPTION 'Entry date is required' USING ERRCODE = '22023';
  END IF;

  v_amount := round(COALESCE(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF v_account NOT IN ('cash', 'bank') THEN
    RAISE EXCEPTION 'Account must be cash or bank' USING ERRCODE = '22023';
  END IF;

  IF v_kind NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Kind must be deposit or withdrawal' USING ERRCODE = '22023';
  END IF;

  v_code := CASE WHEN v_account = 'cash' THEN '1000' ELSE '1010' END;
  v_source_type := CASE WHEN v_kind = 'deposit' THEN 'cash_deposit' ELSE 'cash_withdrawal' END;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  IF v_kind = 'deposit' THEN
    -- Owner puts verified money into cash/bank.
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_code, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_code', '3000', 'debit', 0, 'credit', v_amount)
    );
    v_memo := COALESCE(
      NULLIF(btrim(COALESCE(p_memo, '')), ''),
      format('Deposit to %s', v_account)
    );
  ELSE
    -- Owner takes verified money out of cash/bank.
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '3000', 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_code', v_code, 'debit', 0, 'credit', v_amount)
    );
    v_memo := COALESCE(
      NULLIF(btrim(COALESCE(p_memo, '')), ''),
      format('Withdrawal from %s', v_account)
    );
  END IF;

  RETURN public._accounting_post_journal(
    p_entry_date,
    v_source_type,
    v_source_id,
    left(v_memo, 500),
    v_lines,
    v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_cash_bank_external(date, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_cash_bank_external(date, text, text, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.admin_record_cash_bank_external(date, text, text, numeric, text) IS
  'Phase 7: posts verified deposit/withdrawal journals against Owner Equity.';
