-- Phase 6B.2B — partial purchase receiving (receipts + lines + RPCs + sync).
-- Ordered qty stays on purchase_items. Append-only purchase_receipts/lines.
-- Journals: new events use purchase_receipt; legacy RECEIVED without receipt
-- rows keep purchase_receive. No supplier returns / UI in this migration.

-- ─── 1) Header timestamps + received-state CHECK ─────────────────────────────

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS first_received_at timestamptz;

UPDATE public.purchases
SET first_received_at = received_at
WHERE status = 'RECEIVED'::public.purchase_status
  AND received_at IS NOT NULL
  AND first_received_at IS NULL;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_received_state;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_received_state CHECK (
    (
      status = 'DRAFT'::public.purchase_status
      AND received_at IS NULL
      AND received_by_profile_id IS NULL
      AND first_received_at IS NULL
    )
    OR (
      status = 'CANCELLED'::public.purchase_status
      AND received_at IS NULL
      AND received_by_profile_id IS NULL
      AND first_received_at IS NULL
    )
    OR (
      status = 'PARTIALLY_RECEIVED'::public.purchase_status
      AND first_received_at IS NOT NULL
      AND received_at IS NULL
    )
    OR (
      status = 'RECEIVED'::public.purchase_status
      AND received_at IS NOT NULL
      AND first_received_at IS NOT NULL
    )
  );

COMMENT ON COLUMN public.purchases.first_received_at IS
  'Set on first receipt event. Final completion uses received_at when status=RECEIVED.';

-- ─── 2) Receipt event tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  client_request_id text,
  taxable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  cgst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  sgst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  igst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_receipts_amounts_non_negative CHECK (
    taxable_amount >= 0
    AND tax_amount >= 0
    AND cgst_amount >= 0
    AND sgst_amount >= 0
    AND igst_amount >= 0
    AND total_amount >= 0
  ),
  CONSTRAINT purchase_receipts_total_matches CHECK (
    total_amount = round(taxable_amount + tax_amount, 2)
  ),
  CONSTRAINT purchase_receipts_client_request_id_length CHECK (
    client_request_id IS NULL
    OR char_length(btrim(client_request_id)) BETWEEN 8 AND 128
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_receipts_actor_client_request_unique
  ON public.purchase_receipts (actor_profile_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_receipts_purchase_idx
  ON public.purchase_receipts (purchase_id, received_at ASC);

COMMENT ON TABLE public.purchase_receipts IS
  'Append-only receiving events. Idempotency via actor + client_request_id.';

CREATE TABLE IF NOT EXISTS public.purchase_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts (id) ON DELETE CASCADE,
  purchase_item_id uuid NOT NULL REFERENCES public.purchase_items (id) ON DELETE RESTRICT,
  quantity numeric(12, 3) NOT NULL,
  unit_cost numeric(12, 2) NOT NULL,
  line_taxable numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_receipt_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_receipt_lines_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT purchase_receipt_lines_taxable_non_negative CHECK (line_taxable >= 0)
);

CREATE INDEX IF NOT EXISTS purchase_receipt_lines_receipt_idx
  ON public.purchase_receipt_lines (receipt_id);

CREATE INDEX IF NOT EXISTS purchase_receipt_lines_item_idx
  ON public.purchase_receipt_lines (purchase_item_id);

COMMENT ON TABLE public.purchase_receipt_lines IS
  'Quantities received in one receipt event; ordered qty remains on purchase_items.';

-- One RECEIPT movement per receipt line (partial path). Legacy purchase_item unique kept.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_purchase_receipt_line_unique
  ON public.inventory_movements (reference_id)
  WHERE reference_type = 'purchase_receipt_line'
    AND movement_type = 'RECEIPT'::public.inventory_movement_type;

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_receipts_admin_select ON public.purchase_receipts;
CREATE POLICY purchase_receipts_admin_select
  ON public.purchase_receipts FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchase_receipts_admin_write ON public.purchase_receipts;
CREATE POLICY purchase_receipts_admin_write
  ON public.purchase_receipts FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS purchase_receipt_lines_admin_select ON public.purchase_receipt_lines;
CREATE POLICY purchase_receipt_lines_admin_select
  ON public.purchase_receipt_lines FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchase_receipt_lines_admin_write ON public.purchase_receipt_lines;
CREATE POLICY purchase_receipt_lines_admin_write
  ON public.purchase_receipt_lines FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipt_lines TO authenticated;
GRANT ALL ON public.purchase_receipts TO service_role;
GRANT ALL ON public.purchase_receipt_lines TO service_role;

-- ─── 3) Payments may link to partially received bills ────────────────────────

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

    IF v_purchase.status NOT IN (
      'RECEIVED'::public.purchase_status,
      'PARTIALLY_RECEIVED'::public.purchase_status
    ) THEN
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

-- ─── 4) admin_receive_purchase_lines ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_receive_purchase_lines(
  p_purchase_id uuid,
  p_lines jsonb,
  p_client_request_id text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor_profile_id, auth.uid());
  v_request_id text := nullif(btrim(coalesce(p_client_request_id, '')), '');
  v_purchase public.purchases%ROWTYPE;
  v_receipt public.purchase_receipts%ROWTYPE;
  v_existing public.purchase_receipts%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric(12, 3);
  v_received numeric(12, 3);
  v_remaining numeric(12, 3);
  v_line_taxable numeric(12, 2);
  v_taxable numeric(12, 2) := 0;
  v_tax numeric(12, 2) := 0;
  v_cgst numeric(12, 2) := 0;
  v_sgst numeric(12, 2) := 0;
  v_igst numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_tax_prev numeric(12, 2) := 0;
  v_taxable_prev numeric(12, 2) := 0;
  v_bill_subtotal numeric(12, 2);
  v_bill_tax numeric(12, 2);
  v_remaining_taxable numeric(12, 2);
  v_remaining_tax numeric(12, 2);
  v_ratio numeric;
  v_completes boolean;
  v_movements integer := 0;
  v_qty_total numeric(12, 3) := 0;
  v_receipt_line_id uuid;
  v_lines jsonb;
  v_journal_lines jsonb;
  v_status public.purchase_status;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can receive purchases' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one receipt line is required' USING ERRCODE = '22023';
  END IF;

  IF v_request_id IS NOT NULL AND char_length(v_request_id) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'client_request_id must be 8–128 characters'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Idempotent replay (header-scoped request id)
  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.purchase_receipts
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.purchase_id IS DISTINCT FROM p_purchase_id THEN
        RAISE EXCEPTION
          'client_request_id already used for a different purchase'
          USING ERRCODE = '23505';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM (
          SELECT
            (e ->> 'purchase_item_id')::uuid AS purchase_item_id,
            (e ->> 'quantity')::numeric(12, 3) AS quantity
          FROM jsonb_array_elements(p_lines) e
        ) req
        FULL OUTER JOIN (
          SELECT purchase_item_id, quantity
          FROM public.purchase_receipt_lines
          WHERE receipt_id = v_existing.id
        ) got
          ON got.purchase_item_id = req.purchase_item_id
         AND got.quantity IS NOT DISTINCT FROM req.quantity
        WHERE req.purchase_item_id IS NULL OR got.purchase_item_id IS NULL
      ) OR (
        SELECT count(*) FROM jsonb_array_elements(p_lines)
      ) <> (
        SELECT count(*) FROM public.purchase_receipt_lines
        WHERE receipt_id = v_existing.id
      ) THEN
        RAISE EXCEPTION
          'client_request_id already used with different receipt lines'
          USING ERRCODE = '23505';
      END IF;

      SELECT status INTO v_status FROM public.purchases WHERE id = p_purchase_id;

      RETURN jsonb_build_object(
        'purchaseId', p_purchase_id,
        'status', v_status,
        'receiptId', v_existing.id,
        'alreadyReceived', true,
        'idempotentReplay', true,
        'movementCount', 0,
        'totalQuantity', 0,
        'taxableAmount', v_existing.taxable_amount,
        'taxAmount', v_existing.tax_amount,
        'totalAmount', v_existing.total_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_purchase.status = 'RECEIVED'::public.purchase_status THEN
    RAISE EXCEPTION 'Purchase is already fully received' USING ERRCODE = '22023';
  END IF;

  IF v_purchase.status NOT IN (
    'DRAFT'::public.purchase_status,
    'PARTIALLY_RECEIVED'::public.purchase_status
  ) THEN
    RAISE EXCEPTION 'Only draft or partially received purchases can be received'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.operational_locations ol
    WHERE ol.id = v_purchase.operational_location_id
      AND ol.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  -- Normalize + validate lines (no writes yet)
  v_lines := '[]'::jsonb;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_item_id := (v_line ->> 'purchase_item_id')::uuid;
      v_qty := (v_line ->> 'quantity')::numeric(12, 3);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Each receipt line needs purchase_item_id and quantity'
        USING ERRCODE = '22023';
    END;

    IF v_item_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Receipt quantity must be positive' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_item
    FROM public.purchase_items
    WHERE id = v_item_id
      AND purchase_id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase item % not found on this purchase', v_item_id
        USING ERRCODE = 'P0002';
    END IF;

    SELECT coalesce(sum(prl.quantity), 0) INTO v_received
    FROM public.purchase_receipt_lines prl
    INNER JOIN public.purchase_receipts pr ON pr.id = prl.receipt_id
    WHERE prl.purchase_item_id = v_item_id;

    v_remaining := v_item.quantity - v_received;
    IF v_qty > v_remaining THEN
      RAISE EXCEPTION
        'Receipt quantity % exceeds remaining % for purchase item %',
        v_qty, v_remaining, v_item_id
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_lines) x
      WHERE (x.value ->> 'purchase_item_id')::uuid = v_item_id
    ) THEN
      RAISE EXCEPTION 'Duplicate purchase_item_id in receipt lines'
        USING ERRCODE = '22023';
    END IF;

    v_line_taxable := round(v_qty * v_item.unit_cost, 2);
    v_taxable := v_taxable + v_line_taxable;
    v_qty_total := v_qty_total + v_qty;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'purchase_item_id', v_item_id,
        'sku_id', v_item.sku_id,
        'quantity', v_qty,
        'unit_cost', v_item.unit_cost,
        'line_taxable', v_line_taxable
      )
    );
  END LOOP;

  v_bill_subtotal := round(coalesce(v_purchase.subtotal, 0), 2);
  v_bill_tax := round(coalesce(v_purchase.tax_amount, 0), 2);

  SELECT
    coalesce(sum(pr.taxable_amount), 0),
    coalesce(sum(pr.tax_amount), 0)
  INTO v_taxable_prev, v_tax_prev
  FROM public.purchase_receipts pr
  WHERE pr.purchase_id = p_purchase_id;

  -- Completes bill when every purchase item is fully covered after this receipt.
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.purchase_items pi
    LEFT JOIN (
      SELECT purchase_item_id, sum(quantity) AS qty
      FROM public.purchase_receipt_lines prl
      INNER JOIN public.purchase_receipts pr ON pr.id = prl.receipt_id
      WHERE pr.purchase_id = p_purchase_id
      GROUP BY purchase_item_id
    ) r ON r.purchase_item_id = pi.id
    LEFT JOIN (
      SELECT
        (e ->> 'purchase_item_id')::uuid AS purchase_item_id,
        (e ->> 'quantity')::numeric(12, 3) AS quantity
      FROM jsonb_array_elements(v_lines) e
    ) n ON n.purchase_item_id = pi.id
    WHERE pi.purchase_id = p_purchase_id
      AND pi.quantity > coalesce(r.qty, 0) + coalesce(n.quantity, 0)
  ) INTO v_completes;

  v_remaining_taxable := round(v_bill_subtotal - v_taxable_prev, 2);
  v_remaining_tax := round(v_bill_tax - v_tax_prev, 2);

  IF v_bill_tax <= 0 OR v_taxable <= 0 THEN
    v_tax := 0;
    v_cgst := 0;
    v_sgst := 0;
    v_igst := 0;
  ELSIF v_completes THEN
    v_tax := v_remaining_tax;
  ELSIF v_remaining_taxable <= 0 THEN
    v_tax := 0;
  ELSE
    v_tax := round(v_remaining_tax * (v_taxable / v_remaining_taxable), 2);
    IF v_tax > v_remaining_tax THEN
      v_tax := v_remaining_tax;
    END IF;
  END IF;

  IF v_tax > 0 AND v_bill_tax > 0 THEN
    v_ratio := v_tax / v_bill_tax;
    v_cgst := round(coalesce(v_purchase.cgst_amount, 0) * v_ratio, 2);
    v_sgst := round(coalesce(v_purchase.sgst_amount, 0) * v_ratio, 2);
    v_igst := round(coalesce(v_purchase.igst_amount, 0) * v_ratio, 2);
    -- Adjust largest component so components sum to v_tax.
    IF round(v_cgst + v_sgst + v_igst, 2) <> v_tax THEN
      IF v_igst >= v_cgst AND v_igst >= v_sgst THEN
        v_igst := round(v_tax - v_cgst - v_sgst, 2);
      ELSIF v_cgst >= v_sgst THEN
        v_cgst := round(v_tax - v_sgst - v_igst, 2);
      ELSE
        v_sgst := round(v_tax - v_cgst - v_igst, 2);
      END IF;
    END IF;
  END IF;

  v_total := round(v_taxable + v_tax, 2);

  INSERT INTO public.purchase_receipts (
    purchase_id,
    received_at,
    actor_profile_id,
    client_request_id,
    taxable_amount,
    tax_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount
  )
  VALUES (
    p_purchase_id,
    v_now,
    v_actor,
    v_request_id,
    v_taxable,
    v_tax,
    v_cgst,
    v_sgst,
    v_igst,
    v_total
  )
  RETURNING * INTO v_receipt;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
  LOOP
    v_item_id := (v_line ->> 'purchase_item_id')::uuid;
    v_qty := (v_line ->> 'quantity')::numeric(12, 3);

    INSERT INTO public.purchase_receipt_lines (
      receipt_id, purchase_item_id, quantity, unit_cost, line_taxable
    )
    VALUES (
      v_receipt.id,
      v_item_id,
      v_qty,
      (v_line ->> 'unit_cost')::numeric(12, 2),
      (v_line ->> 'line_taxable')::numeric(12, 2)
    )
    RETURNING id INTO v_receipt_line_id;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = (v_line ->> 'sku_id')::uuid
      AND operational_location_id = v_purchase.operational_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.inventory_balances (
        sku_id, operational_location_id, on_hand_quantity, reserved_quantity,
        average_unit_cost, stock_value
      )
      VALUES (
        (v_line ->> 'sku_id')::uuid,
        v_purchase.operational_location_id,
        0, 0, NULL, 0
      )
      RETURNING * INTO v_balance;

      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE id = v_balance.id
      FOR UPDATE;
    END IF;

    UPDATE public.inventory_balances
    SET on_hand_quantity = on_hand_quantity + v_qty
    WHERE id = v_balance.id;

    INSERT INTO public.inventory_movements (
      sku_id,
      operational_location_id,
      movement_type,
      quantity_delta,
      unit_cost,
      reason,
      reference_type,
      reference_id,
      actor_profile_id
    )
    VALUES (
      (v_line ->> 'sku_id')::uuid,
      v_purchase.operational_location_id,
      'RECEIPT'::public.inventory_movement_type,
      v_qty,
      (v_line ->> 'unit_cost')::numeric(12, 2),
      format(
        'Purchase bill %s · receipt · cost %s',
        v_purchase.bill_number,
        (v_line ->> 'unit_cost')
      ),
      'purchase_receipt_line',
      v_receipt_line_id,
      v_actor
    );

    v_movements := v_movements + 1;
  END LOOP;

  IF v_completes THEN
    v_status := 'RECEIVED'::public.purchase_status;
    UPDATE public.purchases
    SET
      status = v_status,
      first_received_at = coalesce(first_received_at, v_now),
      received_at = v_now,
      received_by_profile_id = v_actor
    WHERE id = p_purchase_id
    RETURNING * INTO v_purchase;
  ELSE
    v_status := 'PARTIALLY_RECEIVED'::public.purchase_status;
    UPDATE public.purchases
    SET
      status = v_status,
      first_received_at = coalesce(first_received_at, v_now),
      received_at = NULL,
      received_by_profile_id = NULL
    WHERE id = p_purchase_id
    RETURNING * INTO v_purchase;
  END IF;

  -- Post purchase_receipt journal in the same transaction.
  IF v_total > 0 THEN
    v_journal_lines := jsonb_build_array(
      jsonb_build_object('account_code', '1200', 'debit', v_taxable, 'credit', 0)
    );
    v_journal_lines := v_journal_lines || public._accounting_purchase_tax_debit_lines(
      v_tax, v_cgst, v_sgst, v_igst
    );
    v_journal_lines := v_journal_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2000', 'debit', 0, 'credit', v_total)
    );

    PERFORM public._accounting_post_journal(
      v_now::date,
      'purchase_receipt',
      v_receipt.id,
      format('Purchase receipt %s', v_purchase.bill_number),
      v_journal_lines,
      v_actor
    );
  END IF;

  RETURN jsonb_build_object(
    'purchaseId', p_purchase_id,
    'status', v_status,
    'receiptId', v_receipt.id,
    'alreadyReceived', false,
    'idempotentReplay', false,
    'movementCount', v_movements,
    'totalQuantity', v_qty_total,
    'taxableAmount', v_taxable,
    'taxAmount', v_tax,
    'totalAmount', v_total,
    'receivedAt', v_receipt.received_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_receive_purchase_lines(
  uuid, jsonb, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_receive_purchase_lines(
  uuid, jsonb, text, uuid
) TO authenticated;

COMMENT ON FUNCTION public.admin_receive_purchase_lines(uuid, jsonb, text, uuid) IS
  'Partial/full receive into purchase_receipts + RECEIPT movements (purchase_receipt_line). '
  'Posts purchase_receipt journal in-txn. Idempotent via actor client_request_id.';

-- ─── 5) Backward-compatible full receive wrapper ─────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_receive_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_lines jsonb;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can receive purchases' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_purchase.status = 'RECEIVED'::public.purchase_status THEN
    RETURN jsonb_build_object(
      'purchaseId', v_purchase.id,
      'status', v_purchase.status,
      'alreadyReceived', true,
      'movementCount', 0,
      'totalQuantity', 0
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'purchase_item_id', pi.id,
        'quantity', pi.quantity - coalesce(r.qty, 0)
      )
      ORDER BY pi.created_at ASC, pi.id ASC
    ),
    '[]'::jsonb
  )
  INTO v_lines
  FROM public.purchase_items pi
  LEFT JOIN (
    SELECT prl.purchase_item_id, sum(prl.quantity) AS qty
    FROM public.purchase_receipt_lines prl
    INNER JOIN public.purchase_receipts pr ON pr.id = prl.receipt_id
    WHERE pr.purchase_id = p_purchase_id
    GROUP BY prl.purchase_item_id
  ) r ON r.purchase_item_id = pi.id
  WHERE pi.purchase_id = p_purchase_id
    AND pi.quantity - coalesce(r.qty, 0) > 0;

  IF v_lines IS NULL OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'Purchase has no remaining quantity to receive'
      USING ERRCODE = '22023';
  END IF;

  v_result := public.admin_receive_purchase_lines(
    p_purchase_id,
    v_lines,
    NULL,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'purchaseId', v_result ->> 'purchaseId',
    'status', v_result ->> 'status',
    'alreadyReceived', coalesce((v_result ->> 'alreadyReceived')::boolean, false),
    'movementCount', coalesce((v_result ->> 'movementCount')::integer, 0),
    'totalQuantity', coalesce((v_result ->> 'totalQuantity')::numeric, 0),
    'receiptId', v_result ->> 'receiptId',
    'receivedAt', v_result ->> 'receivedAt'
  );
END;
$$;

COMMENT ON FUNCTION public.admin_receive_purchase(uuid) IS
  'Receives all remaining purchase quantities via admin_receive_purchase_lines. '
  'Idempotent when already RECEIVED.';

-- ─── 6) Sync: legacy purchase_receive XOR new purchase_receipt ───────────────

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

  -- New path: purchase_receipt events (posted in receive RPC; backfill if missing).
  FOR v_row IN
    SELECT
      pr.id,
      pr.received_at,
      pr.taxable_amount,
      pr.tax_amount,
      pr.cgst_amount,
      pr.sgst_amount,
      pr.igst_amount,
      pr.total_amount,
      p.bill_number
    FROM public.purchase_receipts pr
    INNER JOIN public.purchases p ON p.id = pr.purchase_id
    WHERE pr.received_at::date >= p_date_from
      AND pr.received_at::date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'purchase_receipt' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF round(coalesce(v_row.total_amount, 0), 2) <= 0 THEN
      CONTINUE;
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_code', '1200',
        'debit', round(v_row.taxable_amount, 2),
        'credit', 0
      )
    );
    v_lines := v_lines || public._accounting_purchase_tax_debit_lines(
      round(v_row.tax_amount, 2),
      round(v_row.cgst_amount, 2),
      round(v_row.sgst_amount, 2),
      round(v_row.igst_amount, 2)
    );
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '2000',
        'debit', 0,
        'credit', round(v_row.total_amount, 2)
      )
    );

    PERFORM public._accounting_post_journal(
      v_row.received_at::date,
      'purchase_receipt',
      v_row.id,
      format('Purchase receipt %s', v_row.bill_number),
      v_lines,
      v_actor
    );
    v_posted := v_posted + 1;
  END LOOP;

  -- Legacy: fully RECEIVED purchases with no receipt-event rows.
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
      AND NOT EXISTS (
        SELECT 1 FROM public.purchase_receipts pr WHERE pr.purchase_id = p.id
      )
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
  'Domain→journal sync. purchase_receipt events + legacy purchase_receive '
  '(RECEIVED without receipt rows only). Skips collection_event-covered payments.';
