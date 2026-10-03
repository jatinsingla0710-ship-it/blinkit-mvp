-- Phase 6 — Double-entry accounting foundation.
-- Journals are derived from existing domain events (sales, collections, purchases,
-- supplier payments, expenses, payroll). Operational rows are NOT duplicated.
-- Does NOT build full financial statements (Phase 8) or cash/bank accounts UX (Phase 7).

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chart_of_accounts_code_unique UNIQUE (code),
  CONSTRAINT chart_of_accounts_code_format CHECK (code ~ '^[0-9]{4}$'),
  CONSTRAINT chart_of_accounts_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS chart_of_accounts_type_idx
  ON public.chart_of_accounts (account_type, code);

DROP TRIGGER IF EXISTS trg_chart_of_accounts_set_updated_at ON public.chart_of_accounts;
CREATE TRIGGER trg_chart_of_accounts_set_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.chart_of_accounts IS
  'Phase 6 system chart of accounts. Owner language stays simple; codes are internal.';

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  memo text NOT NULL,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_source_unique UNIQUE (source_type, source_id),
  CONSTRAINT journal_entries_source_type_length CHECK (
    char_length(btrim(source_type)) BETWEEN 1 AND 64
  ),
  CONSTRAINT journal_entries_memo_length CHECK (
    char_length(btrim(memo)) BETWEEN 1 AND 500
  )
);

CREATE INDEX IF NOT EXISTS journal_entries_date_idx
  ON public.journal_entries (entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS journal_entries_source_idx
  ON public.journal_entries (source_type, source_id);

COMMENT ON TABLE public.journal_entries IS
  'Balanced journals posted from domain events. Idempotent per (source_type, source_id).';

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts (id) ON DELETE RESTRICT,
  debit numeric(14, 2) NOT NULL DEFAULT 0,
  credit numeric(14, 2) NOT NULL DEFAULT 0,
  line_memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_amounts_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT journal_lines_one_sided CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx
  ON public.journal_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS journal_lines_account_idx
  ON public.journal_lines (account_id);

COMMENT ON TABLE public.journal_lines IS
  'Journal lines. Each line is debit XOR credit; entry totals must balance.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chart_of_accounts_admin_select ON public.chart_of_accounts;
CREATE POLICY chart_of_accounts_admin_select
  ON public.chart_of_accounts FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS journal_entries_admin_select ON public.journal_entries;
CREATE POLICY journal_entries_admin_select
  ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS journal_lines_admin_select ON public.journal_lines;
CREATE POLICY journal_lines_admin_select
  ON public.journal_lines FOR SELECT TO authenticated
  USING (public.is_admin());

-- Writes only via SECURITY DEFINER sync/post helpers.
GRANT SELECT ON public.chart_of_accounts TO authenticated;
GRANT SELECT ON public.journal_entries TO authenticated;
GRANT SELECT ON public.journal_lines TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
GRANT ALL ON public.journal_entries TO service_role;
GRANT ALL ON public.journal_lines TO service_role;

-- ─── Seed system accounts ────────────────────────────────────────────────────

INSERT INTO public.chart_of_accounts (code, name, account_type, is_system)
VALUES
  ('1000', 'Cash', 'ASSET', true),
  ('1010', 'Bank', 'ASSET', true),
  ('1100', 'Money Due (Customers)', 'ASSET', true),
  ('1200', 'Inventory', 'ASSET', true),
  ('1300', 'Input Tax Clearing', 'ASSET', true),
  ('2000', 'Money to Pay (Suppliers)', 'LIABILITY', true),
  ('3000', 'Owner Equity', 'EQUITY', true),
  ('4000', 'Sales', 'REVENUE', true),
  ('5000', 'Cost of Goods Sold', 'EXPENSE', true),
  ('5100', 'Company Expenses', 'EXPENSE', true),
  ('5200', 'Payroll', 'EXPENSE', true)
ON CONFLICT (code) DO NOTHING;

-- ─── Post balanced journal (idempotent) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public._accounting_post_journal(
  p_entry_date date,
  p_source_type text,
  p_source_id uuid,
  p_memo text,
  p_lines jsonb,
  p_actor uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_entry_id uuid;
  v_line jsonb;
  v_code text;
  v_account_id uuid;
  v_debit numeric(14, 2);
  v_credit numeric(14, 2);
  v_sum_debit numeric(14, 2) := 0;
  v_sum_credit numeric(14, 2) := 0;
  v_actor uuid := COALESCE(p_actor, auth.uid());
BEGIN
  IF p_entry_date IS NULL OR p_source_type IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'Journal source fields are required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal requires at least two lines' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE source_type = btrim(p_source_type)
    AND source_id = p_source_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Validate balance before insert.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit := round(coalesce((v_line ->> 'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line ->> 'credit')::numeric, 0), 2);
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'Journal amounts cannot be negative' USING ERRCODE = '22023';
    END IF;
    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each journal line must be debit XOR credit' USING ERRCODE = '22023';
    END IF;
    v_sum_debit := v_sum_debit + v_debit;
    v_sum_credit := v_sum_credit + v_credit;
  END LOOP;

  IF v_sum_debit <> v_sum_credit THEN
    RAISE EXCEPTION 'Journal is not balanced: debit % credit %', v_sum_debit, v_sum_credit
      USING ERRCODE = '22023';
  END IF;

  IF v_sum_debit <= 0 THEN
    RAISE EXCEPTION 'Journal total must be greater than zero' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.journal_entries (
    entry_date, source_type, source_id, memo, created_by_profile_id
  )
  VALUES (
    p_entry_date,
    btrim(p_source_type),
    p_source_id,
    left(btrim(COALESCE(p_memo, 'Journal')), 500),
    v_actor
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_code := btrim(v_line ->> 'account_code');
    v_debit := round(coalesce((v_line ->> 'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line ->> 'credit')::numeric, 0), 2);

    SELECT id INTO v_account_id
    FROM public.chart_of_accounts
    WHERE code = v_code AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown account code %', v_code USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.journal_lines (
      journal_entry_id, account_id, debit, credit, line_memo
    )
    VALUES (
      v_entry_id,
      v_account_id,
      v_debit,
      v_credit,
      NULLIF(btrim(COALESCE(v_line ->> 'memo', '')), '')
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accounting_post_journal(date, text, uuid, text, jsonb, uuid) FROM PUBLIC;

COMMENT ON FUNCTION public._accounting_post_journal(date, text, uuid, text, jsonb, uuid) IS
  'Internal: posts an idempotent balanced journal from account_code lines.';

-- ─── Sync journals from domain events for a date range ───────────────────────

CREATE OR REPLACE FUNCTION public.admin_sync_accounting_journals(
  p_date_from date,
  p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_posted integer := 0;
  v_skipped integer := 0;
  v_row record;
  v_lines jsonb;
  v_cogs numeric(14, 2);
  v_cash numeric(14, 2);
  v_bank numeric(14, 2);
  v_existing uuid;
  v_entry_date date;
  v_inv numeric(14, 2);
  v_tax numeric(14, 2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can sync accounting journals' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN
    RAISE EXCEPTION 'Valid date range is required' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Sales: Dr Money Due / Cr Sales (+ COGS / Inventory when cost known)
  FOR v_row IN
    SELECT s.id, s.total, s.converted_at, s.status, s.invoice_number, s.order_id
    FROM public.sales s
    WHERE s.converted_at::date >= p_date_from
      AND s.converted_at::date <= p_date_to
      AND s.status IS DISTINCT FROM 'REFUNDED'
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'sale' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT coalesce(sum(abs(im.quantity_delta) * im.unit_cost), 0)
    INTO v_cogs
    FROM public.inventory_movements im
    WHERE im.reference_type = 'order'
      AND im.reference_id = v_row.order_id
      AND im.movement_type = 'ORDER_DISPATCH'
      AND im.unit_cost IS NOT NULL;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1100', 'debit', v_row.total, 'credit', 0),
      jsonb_build_object('account_code', '4000', 'debit', 0, 'credit', v_row.total)
    );

    IF v_cogs > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '5000', 'debit', round(v_cogs, 2), 'credit', 0),
        jsonb_build_object('account_code', '1200', 'debit', 0, 'credit', round(v_cogs, 2))
      );
    END IF;

    PERFORM public._accounting_post_journal(
      v_row.converted_at::date,
      'sale',
      v_row.id,
      format('Sale %s', coalesce(v_row.invoice_number, v_row.id::text)),
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Collections from payments (cash / bank split). Skip zero collected.
  FOR v_row IN
    SELECT
      p.id,
      coalesce(p.cash_collected_amount, 0) AS cash_amt,
      coalesce(p.online_collected_amount, 0) AS bank_amt,
      coalesce(p.amount, 0) AS payment_amount,
      p.status::text AS payment_status,
      coalesce(p.paid_at, p.updated_at, p.created_at) AS collected_at
    FROM public.payments p
    WHERE coalesce(p.paid_at, p.updated_at, p.created_at)::date >= p_date_from
      AND coalesce(p.paid_at, p.updated_at, p.created_at)::date <= p_date_to
      AND (
        coalesce(p.cash_collected_amount, 0) > 0
        OR coalesce(p.online_collected_amount, 0) > 0
        OR (
          p.status::text = 'PAID'
          AND coalesce(p.amount, 0) > 0
        )
      )
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'collection' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_cash := round(v_row.cash_amt, 2);
    v_bank := round(v_row.bank_amt, 2);
    IF v_cash + v_bank <= 0 AND v_row.payment_status = 'PAID' THEN
      -- Legacy full paid without cash/online split → treat as bank.
      v_bank := round(v_row.payment_amount, 2);
    END IF;
    IF v_cash + v_bank <= 0 THEN
      CONTINUE;
    END IF;

    v_lines := '[]'::jsonb;
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
      jsonb_build_object(
        'account_code', '1100',
        'debit', 0,
        'credit', round(v_cash + v_bank, 2)
      )
    );

    PERFORM public._accounting_post_journal(
      v_row.collected_at::date,
      'collection',
      v_row.id,
      'Customer collection',
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Purchase receive: Dr Inventory (+ input tax) / Cr Money to Pay
  FOR v_row IN
    SELECT
      p.id,
      p.bill_number,
      p.received_at,
      p.subtotal,
      p.tax_amount,
      p.total,
      coalesce(
        (
          SELECT sum(pi.line_total)
          FROM public.purchase_items pi
          WHERE pi.purchase_id = p.id
        ),
        p.subtotal
      ) AS inventory_cost
    FROM public.purchases p
    WHERE p.status = 'RECEIVED'
      AND p.received_at IS NOT NULL
      AND p.received_at::date >= p_date_from
      AND p.received_at::date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'purchase_receive' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_inv := round(coalesce(v_row.inventory_cost, 0), 2);
    v_tax := round(coalesce(v_row.tax_amount, 0), 2);
    IF v_inv + v_tax <= 0 THEN
      CONTINUE;
    END IF;

    -- Keep balanced against payable total when tax/subtotal mismatch.
    IF round(v_inv + v_tax, 2) <> round(v_row.total, 2) THEN
      v_inv := round(v_row.total - v_tax, 2);
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit', v_inv, 'credit', 0)
    );
    IF v_tax > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1300', 'debit', v_tax, 'credit', 0)
      );
    END IF;
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2000', 'debit', 0, 'credit', round(v_row.total, 2))
    );

    PERFORM public._accounting_post_journal(
      v_row.received_at::date,
      'purchase_receive',
      v_row.id,
      format('Purchase received %s', v_row.bill_number),
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Supplier payments: Dr Money to Pay / Cr Cash or Bank
  FOR v_row IN
    SELECT sp.id, sp.amount, sp.payment_date, sp.payment_method
    FROM public.supplier_payments sp
    WHERE sp.payment_date >= p_date_from
      AND sp.payment_date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'supplier_payment' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '2000', 'debit', round(v_row.amount, 2), 'credit', 0),
      jsonb_build_object(
        'account_code',
        CASE
          WHEN v_row.payment_method::text = 'CASH' THEN '1000'
          ELSE '1010'
        END,
        'debit', 0,
        'credit', round(v_row.amount, 2)
      )
    );

    PERFORM public._accounting_post_journal(
      v_row.payment_date,
      'supplier_payment',
      v_row.id,
      'Supplier payment',
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Company expenses: Dr Expenses / Cr Cash or Bank
  FOR v_row IN
    SELECT e.id, e.amount, e.expense_date, e.payment_method, e.description
    FROM public.company_expenses e
    WHERE e.expense_date >= p_date_from
      AND e.expense_date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'company_expense' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '5100', 'debit', round(v_row.amount, 2), 'credit', 0),
      jsonb_build_object(
        'account_code',
        CASE
          WHEN v_row.payment_method::text = 'CASH' THEN '1000'
          ELSE '1010'
        END,
        'debit', 0,
        'credit', round(v_row.amount, 2)
      )
    );

    PERFORM public._accounting_post_journal(
      v_row.expense_date,
      'company_expense',
      v_row.id,
      left(coalesce(v_row.description, 'Company expense'), 500),
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Paid payroll: Dr Payroll / Cr Cash or Bank
  FOR v_row IN
    SELECT pr.id, pr.total_amount, pr.paid_at, pr.payment_method
    FROM public.salesman_payroll pr
    WHERE pr.status = 'PAID'
      AND pr.paid_at IS NOT NULL
      AND pr.paid_at::date >= p_date_from
      AND pr.paid_at::date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'payroll' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '5200', 'debit', round(v_row.total_amount, 2), 'credit', 0),
      jsonb_build_object(
        'account_code',
        CASE
          WHEN coalesce(v_row.payment_method, '') ILIKE 'CASH' THEN '1000'
          ELSE '1010'
        END,
        'debit', 0,
        'credit', round(v_row.total_amount, 2)
      )
    );

    PERFORM public._accounting_post_journal(
      v_row.paid_at::date,
      'payroll',
      v_row.id,
      'Salesman payroll paid',
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'dateFrom', p_date_from,
    'dateTo', p_date_to,
    'posted', v_posted,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sync_accounting_journals(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sync_accounting_journals(date, date) TO authenticated;

COMMENT ON FUNCTION public.admin_sync_accounting_journals(date, date) IS
  'Phase 6: idempotently posts balanced journals from sales, collections, purchases, '
  'supplier payments, expenses, and paid payroll for the date range.';
