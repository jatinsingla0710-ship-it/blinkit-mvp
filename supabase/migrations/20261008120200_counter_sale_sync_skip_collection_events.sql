-- Skip admin_sync collection posting when counter sale already posted collection_event journals.

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

    -- Counter sales post per payment_event as collection_event; do not double-post.
    IF EXISTS (
      SELECT 1
      FROM public.payment_events pe
      JOIN public.journal_entries je
        ON je.source_type = 'collection_event'
       AND je.source_id = pe.id
      WHERE pe.payment_id = v_row.id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_cash := round(v_row.cash_amt, 2);
    v_bank := round(v_row.bank_amt, 2);
    IF v_cash + v_bank <= 0 AND v_row.payment_status = 'PAID' THEN
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

  -- Purchase receive with CGST/SGST/IGST input when split is set.
  FOR v_row IN
    SELECT
      p.id,
      p.bill_number,
      p.received_at,
      p.subtotal,
      p.tax_amount,
      p.cgst_amount,
      p.sgst_amount,
      p.igst_amount,
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

    IF round(v_inv + v_tax, 2) <> round(v_row.total, 2) THEN
      v_inv := round(v_row.total - v_tax, 2);
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit', v_inv, 'credit', 0)
    );
    v_lines := v_lines || public._accounting_purchase_tax_debit_lines(
      v_tax,
      v_row.cgst_amount,
      v_row.sgst_amount,
      v_row.igst_amount
    );
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
      'Paid payroll',
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'posted', v_posted,
    'skipped', v_skipped,
    'dateFrom', p_date_from,
    'dateTo', p_date_to
  );
END;
$$;


COMMENT ON FUNCTION public.admin_sync_accounting_journals(date, date) IS
  'Phase 9 + counter sale: domain→journal sync; skips payments covered by collection_event journals.';
