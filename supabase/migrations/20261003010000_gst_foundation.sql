-- Phase 9 — GST foundation (India).
-- Adds party GSTIN, SKU HSN/rate, purchase CGST/SGST/IGST split, GST CoA.
-- Does NOT claim GSTR filing, e-invoice, or full tax compliance.

-- ─── Customer GSTIN ──────────────────────────────────────────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS gstin text;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_gstin_length;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_gstin_length CHECK (
    gstin IS NULL OR char_length(btrim(gstin)) BETWEEN 1 AND 20
  );

COMMENT ON COLUMN public.shops.gstin IS
  'Customer GSTIN (optional). Structural validation in app; not portal-verified.';

-- ─── SKU HSN + GST rate master ───────────────────────────────────────────────

ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS hsn_code text;

ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS gst_rate_percent numeric(5, 2);

ALTER TABLE public.skus
  DROP CONSTRAINT IF EXISTS skus_hsn_code_length;
ALTER TABLE public.skus
  ADD CONSTRAINT skus_hsn_code_length CHECK (
    hsn_code IS NULL OR char_length(btrim(hsn_code)) BETWEEN 4 AND 8
  );

ALTER TABLE public.skus
  DROP CONSTRAINT IF EXISTS skus_gst_rate_percent_range;
ALTER TABLE public.skus
  ADD CONSTRAINT skus_gst_rate_percent_range CHECK (
    gst_rate_percent IS NULL
    OR (gst_rate_percent >= 0 AND gst_rate_percent <= 100)
  );

COMMENT ON COLUMN public.skus.hsn_code IS
  'HSN code for GST rate mapping (foundation; not auto-filing).';
COMMENT ON COLUMN public.skus.gst_rate_percent IS
  'GST rate percent for this SKU (e.g. 5, 12, 18).';

-- ─── Purchase GST split ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.gst_supply_type AS ENUM ('INTRA', 'INTER', 'UNSET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS supply_type public.gst_supply_type NOT NULL DEFAULT 'UNSET';

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS cgst_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS sgst_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS igst_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_gst_components_non_negative;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_gst_components_non_negative CHECK (
    cgst_amount >= 0 AND sgst_amount >= 0 AND igst_amount >= 0
  );

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_gst_components_match_tax;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_gst_components_match_tax CHECK (
    (
      tax_amount = 0
      AND cgst_amount = 0
      AND sgst_amount = 0
      AND igst_amount = 0
    )
    OR (
      abs(
        tax_amount - round(cgst_amount + sgst_amount + igst_amount, 2)
      ) < 0.015
    )
    OR (
      -- Legacy rows / unset split: components stay zero until owner sets supply type.
      cgst_amount = 0 AND sgst_amount = 0 AND igst_amount = 0
    )
  );

COMMENT ON COLUMN public.purchases.supply_type IS
  'INTRA = CGST+SGST, INTER = IGST, UNSET = tax not split yet.';

-- ─── GST chart of accounts ───────────────────────────────────────────────────

INSERT INTO public.chart_of_accounts (code, name, account_type, is_system)
VALUES
  ('1310', 'CGST Input', 'ASSET', true),
  ('1320', 'SGST Input', 'ASSET', true),
  ('1330', 'IGST Input', 'ASSET', true),
  ('2100', 'CGST Payable', 'LIABILITY', true),
  ('2110', 'SGST Payable', 'LIABILITY', true),
  ('2120', 'IGST Payable', 'LIABILITY', true)
ON CONFLICT (code) DO NOTHING;

-- Keep 1300 as unclassified input clearing when split is unset.

-- ─── Purchase draft upsert with GST split ────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_upsert_purchase_draft(
  uuid, uuid, uuid, date, text, numeric, text, jsonb
);

CREATE OR REPLACE FUNCTION public.admin_upsert_purchase_draft(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_operational_location_id uuid,
  p_purchase_date date,
  p_bill_number text,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_supply_type text DEFAULT 'UNSET',
  p_cgst_amount numeric DEFAULT 0,
  p_sgst_amount numeric DEFAULT 0,
  p_igst_amount numeric DEFAULT 0
)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases;
  v_item jsonb;
  v_sku public.skus%ROWTYPE;
  v_product_name text;
  v_qty numeric(12, 3);
  v_unit_cost numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_tax numeric(12, 2) := round(coalesce(p_tax_amount, 0), 2);
  v_cgst numeric(12, 2) := round(coalesce(p_cgst_amount, 0), 2);
  v_sgst numeric(12, 2) := round(coalesce(p_sgst_amount, 0), 2);
  v_igst numeric(12, 2) := round(coalesce(p_igst_amount, 0), 2);
  v_supply public.gst_supply_type;
  v_bill text := btrim(coalesce(p_bill_number, ''));
  v_item_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage purchases' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_supply := upper(btrim(coalesce(p_supply_type, 'UNSET')))::public.gst_supply_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid GST supply type' USING ERRCODE = '22023';
  END;

  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'Supplier not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_operational_location_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operational_locations ol
    WHERE ol.id = p_operational_location_id
      AND ol.deleted_at IS NULL
      AND ol.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Warehouse not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  IF p_purchase_date IS NULL THEN
    RAISE EXCEPTION 'Purchase date is required' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_bill) < 1 OR char_length(v_bill) > 80 THEN
    RAISE EXCEPTION 'Bill number is required (max 80 characters)'
      USING ERRCODE = '22023';
  END IF;

  IF v_tax < 0 OR v_tax > 9999999.99 THEN
    RAISE EXCEPTION 'Tax amount must be zero or positive'
      USING ERRCODE = '22023';
  END IF;

  IF v_cgst < 0 OR v_sgst < 0 OR v_igst < 0 THEN
    RAISE EXCEPTION 'GST component amounts cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  IF v_tax = 0 THEN
    v_cgst := 0;
    v_sgst := 0;
    v_igst := 0;
  ELSIF v_cgst + v_sgst + v_igst > 0
    AND abs(v_tax - round(v_cgst + v_sgst + v_igst, 2)) >= 0.015 THEN
    RAISE EXCEPTION 'CGST + SGST + IGST must equal tax amount'
      USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one purchase item is required'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_count := v_item_count + 1;
    IF NULLIF(btrim(coalesce(v_item ->> 'sku_id', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Each item requires a SKU' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_sku
    FROM public.skus
    WHERE id = (v_item ->> 'sku_id')::uuid
      AND deleted_at IS NULL
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SKU not found or inactive: %', v_item ->> 'sku_id'
        USING ERRCODE = 'P0002';
    END IF;

    v_qty := round(coalesce((v_item ->> 'quantity')::numeric, 0), 3);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, -1), 2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than 0' USING ERRCODE = '22023';
    END IF;

    IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'Item unit cost must be zero or positive'
        USING ERRCODE = '22023';
    END IF;

    v_line_total := round(v_qty * v_unit_cost, 2);
    v_subtotal := round(v_subtotal + v_line_total, 2);
  END LOOP;

  IF p_purchase_id IS NULL THEN
    INSERT INTO public.purchases (
      supplier_id,
      operational_location_id,
      purchase_date,
      bill_number,
      status,
      subtotal,
      tax_amount,
      cgst_amount,
      sgst_amount,
      igst_amount,
      supply_type,
      total,
      notes,
      created_by_profile_id
    )
    VALUES (
      p_supplier_id,
      p_operational_location_id,
      p_purchase_date,
      v_bill,
      'DRAFT'::public.purchase_status,
      v_subtotal,
      v_tax,
      v_cgst,
      v_sgst,
      v_igst,
      v_supply,
      round(v_subtotal + v_tax, 2),
      NULLIF(btrim(coalesce(p_notes, '')), ''),
      auth.uid()
    )
    RETURNING * INTO v_purchase;
  ELSE
    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_purchase.status <> 'DRAFT'::public.purchase_status THEN
      RAISE EXCEPTION 'Only draft purchases can be edited'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.purchases
    SET
      supplier_id = p_supplier_id,
      operational_location_id = p_operational_location_id,
      purchase_date = p_purchase_date,
      bill_number = v_bill,
      subtotal = v_subtotal,
      tax_amount = v_tax,
      cgst_amount = v_cgst,
      sgst_amount = v_sgst,
      igst_amount = v_igst,
      supply_type = v_supply,
      total = round(v_subtotal + v_tax, 2),
      notes = NULLIF(btrim(coalesce(p_notes, '')), '')
    WHERE id = p_purchase_id
    RETURNING * INTO v_purchase;

    DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_sku
    FROM public.skus
    WHERE id = (v_item ->> 'sku_id')::uuid;

    SELECT p.name INTO v_product_name
    FROM public.products p
    WHERE p.id = v_sku.product_id;

    v_qty := round((v_item ->> 'quantity')::numeric, 3);
    v_unit_cost := round((v_item ->> 'unit_cost')::numeric, 2);
    v_line_total := round(v_qty * v_unit_cost, 2);

    INSERT INTO public.purchase_items (
      purchase_id,
      sku_id,
      quantity,
      unit_cost,
      line_total,
      product_name,
      sku_code,
      sku_name
    )
    VALUES (
      v_purchase.id,
      v_sku.id,
      v_qty,
      v_unit_cost,
      v_line_total,
      coalesce(NULLIF(btrim(v_product_name), ''), v_sku.name),
      v_sku.sku_code,
      v_sku.name
    );
  END LOOP;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_purchase_draft(
  uuid, uuid, uuid, date, text, numeric, text, jsonb, text, numeric, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_purchase_draft(
  uuid, uuid, uuid, date, text, numeric, text, jsonb, text, numeric, numeric, numeric
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_purchase_draft(
  uuid, uuid, uuid, date, text, numeric, text, jsonb, text, numeric, numeric, numeric
) TO service_role;

COMMENT ON FUNCTION public.admin_upsert_purchase_draft IS
  'Phase 9: draft purchase upsert with optional CGST/SGST/IGST split.';

-- ─── Helper: purchase input-tax debit lines ───────────────────────────────────

CREATE OR REPLACE FUNCTION public._accounting_purchase_tax_debit_lines(
  p_tax numeric,
  p_cgst numeric,
  p_sgst numeric,
  p_igst numeric
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_tax numeric(14, 2) := round(coalesce(p_tax, 0), 2);
  v_cgst numeric(14, 2) := round(coalesce(p_cgst, 0), 2);
  v_sgst numeric(14, 2) := round(coalesce(p_sgst, 0), 2);
  v_igst numeric(14, 2) := round(coalesce(p_igst, 0), 2);
  v_lines jsonb := '[]'::jsonb;
  v_split numeric(14, 2);
BEGIN
  IF v_tax <= 0 THEN
    RETURN v_lines;
  END IF;

  v_split := round(v_cgst + v_sgst + v_igst, 2);
  IF v_split > 0 AND abs(v_tax - v_split) < 0.015 THEN
    IF v_cgst > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1310', 'debit', v_cgst, 'credit', 0)
      );
    END IF;
    IF v_sgst > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1320', 'debit', v_sgst, 'credit', 0)
      );
    END IF;
    IF v_igst > 0 THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_code', '1330', 'debit', v_igst, 'credit', 0)
      );
    END IF;
    RETURN v_lines;
  END IF;

  -- Unclassified / legacy: clearing account.
  RETURN jsonb_build_array(
    jsonb_build_object('account_code', '1300', 'debit', v_tax, 'credit', 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._accounting_purchase_tax_debit_lines(
  numeric, numeric, numeric, numeric
) FROM PUBLIC;

-- Patch purchase-receive posting inside sync by replacing the function body
-- while preserving sale/collection/expense/payroll loops from Phase 6.

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
  'Phase 9: domain→journal sync; purchase tax posts CGST/SGST/IGST input when split.';
