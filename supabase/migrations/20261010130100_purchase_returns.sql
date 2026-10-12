-- Phase 6B.2C — Supplier returns (append-only events + PURCHASE_RETURN movements).
-- Mirrors partial-receiving: header idempotency, pro-rata tax, in-txn journals.
-- No cash/bank refund when return exceeds payable. No purchase UI.

-- ─── 1) Tax credit helper (inverse of purchase tax debits) ────────────────────

CREATE OR REPLACE FUNCTION public._accounting_purchase_tax_credit_lines(
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
  v_debits jsonb;
  v_credits jsonb := '[]'::jsonb;
  v_line jsonb;
BEGIN
  v_debits := public._accounting_purchase_tax_debit_lines(
    p_tax, p_cgst, p_sgst, p_igst
  );
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_debits)
  LOOP
    v_credits := v_credits || jsonb_build_array(
      jsonb_build_object(
        'account_code', v_line ->> 'account_code',
        'debit', 0,
        'credit', coalesce((v_line ->> 'debit')::numeric, 0)
      )
    );
  END LOOP;
  RETURN v_credits;
END;
$$;

REVOKE ALL ON FUNCTION public._accounting_purchase_tax_credit_lines(
  numeric, numeric, numeric, numeric
) FROM PUBLIC;

COMMENT ON FUNCTION public._accounting_purchase_tax_credit_lines(
  numeric, numeric, numeric, numeric
) IS
  'Internal: credit-side mirror of _accounting_purchase_tax_debit_lines for purchase returns.';

-- ─── 2) Append-only return tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  returned_at timestamptz NOT NULL DEFAULT now(),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  client_request_id text,
  reason text NOT NULL,
  taxable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  cgst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  sgst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  igst_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_returns_amounts_non_negative CHECK (
    taxable_amount >= 0
    AND tax_amount >= 0
    AND cgst_amount >= 0
    AND sgst_amount >= 0
    AND igst_amount >= 0
    AND total_amount >= 0
  ),
  CONSTRAINT purchase_returns_total_matches CHECK (
    total_amount = round(taxable_amount + tax_amount, 2)
  ),
  CONSTRAINT purchase_returns_client_request_id_length CHECK (
    client_request_id IS NULL
    OR char_length(btrim(client_request_id)) BETWEEN 8 AND 128
  ),
  CONSTRAINT purchase_returns_reason_length CHECK (
    char_length(btrim(reason)) BETWEEN 1 AND 500
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_returns_actor_client_request_unique
  ON public.purchase_returns (actor_profile_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_returns_purchase_idx
  ON public.purchase_returns (purchase_id, returned_at ASC);

CREATE INDEX IF NOT EXISTS purchase_returns_supplier_idx
  ON public.purchase_returns (supplier_id, returned_at DESC);

COMMENT ON TABLE public.purchase_returns IS
  'Append-only supplier return events. Idempotency via actor + client_request_id.';

CREATE TABLE IF NOT EXISTS public.purchase_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns (id) ON DELETE CASCADE,
  purchase_item_id uuid NOT NULL REFERENCES public.purchase_items (id) ON DELETE RESTRICT,
  receipt_line_id uuid REFERENCES public.purchase_receipt_lines (id) ON DELETE RESTRICT,
  quantity numeric(12, 3) NOT NULL,
  unit_cost numeric(12, 2) NOT NULL,
  line_taxable numeric(12, 2) NOT NULL,
  line_tax numeric(12, 2) NOT NULL DEFAULT 0,
  line_total numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_return_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_return_lines_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT purchase_return_lines_taxable_non_negative CHECK (line_taxable >= 0),
  CONSTRAINT purchase_return_lines_tax_non_negative CHECK (line_tax >= 0),
  CONSTRAINT purchase_return_lines_total_matches CHECK (
    line_total = round(line_taxable + line_tax, 2)
  )
);

CREATE INDEX IF NOT EXISTS purchase_return_lines_return_idx
  ON public.purchase_return_lines (return_id);

CREATE INDEX IF NOT EXISTS purchase_return_lines_item_idx
  ON public.purchase_return_lines (purchase_item_id);

CREATE INDEX IF NOT EXISTS purchase_return_lines_receipt_line_idx
  ON public.purchase_return_lines (receipt_line_id)
  WHERE receipt_line_id IS NOT NULL;

COMMENT ON TABLE public.purchase_return_lines IS
  'Quantities returned in one return event; optional link to original receipt line.';

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_purchase_return_line_unique
  ON public.inventory_movements (reference_id)
  WHERE reference_type = 'purchase_return_line'
    AND movement_type = 'PURCHASE_RETURN'::public.inventory_movement_type;

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_returns_admin_select ON public.purchase_returns;
CREATE POLICY purchase_returns_admin_select
  ON public.purchase_returns FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchase_returns_admin_write ON public.purchase_returns;
CREATE POLICY purchase_returns_admin_write
  ON public.purchase_returns FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS purchase_return_lines_admin_select ON public.purchase_return_lines;
CREATE POLICY purchase_return_lines_admin_select
  ON public.purchase_return_lines FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchase_return_lines_admin_write ON public.purchase_return_lines;
CREATE POLICY purchase_return_lines_admin_write
  ON public.purchase_return_lines FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_return_lines TO authenticated;
GRANT ALL ON public.purchase_returns TO service_role;
GRANT ALL ON public.purchase_return_lines TO service_role;

-- ─── 3) admin_create_purchase_return ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_purchase_return(
  p_purchase_id uuid,
  p_lines jsonb,
  p_reason text,
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_purchase public.purchases%ROWTYPE;
  v_return public.purchase_returns%ROWTYPE;
  v_existing public.purchase_returns%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_receipt_line public.purchase_receipt_lines%ROWTYPE;
  v_line jsonb;
  v_item_id uuid;
  v_receipt_line_id uuid;
  v_qty numeric(12, 3);
  v_received numeric(12, 3);
  v_returned numeric(12, 3);
  v_net numeric(12, 3);
  v_rl_returned numeric(12, 3);
  v_line_taxable numeric(12, 2);
  v_taxable numeric(12, 2) := 0;
  v_tax numeric(12, 2) := 0;
  v_cgst numeric(12, 2) := 0;
  v_sgst numeric(12, 2) := 0;
  v_igst numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_tax_prev numeric(12, 2) := 0;
  v_taxable_prev numeric(12, 2) := 0;
  v_taxable_recv numeric(12, 2) := 0;
  v_tax_recv numeric(12, 2) := 0;
  v_remaining_taxable numeric(12, 2);
  v_remaining_tax numeric(12, 2);
  v_ratio numeric;
  v_completes boolean;
  v_has_receipt_events boolean;
  v_movements integer := 0;
  v_qty_total numeric(12, 3) := 0;
  v_return_line_id uuid;
  v_lines jsonb;
  v_journal_lines jsonb;
  v_tax_left numeric(12, 2);
  v_line_tax numeric(12, 2);
  v_line_idx integer;
  v_line_count integer;
  v_new_on_hand numeric(12, 3);
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create purchase returns' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Return reason is required' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Return reason must be at most 500 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one return line is required' USING ERRCODE = '22023';
  END IF;

  IF v_request_id IS NOT NULL AND char_length(v_request_id) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'client_request_id must be 8–128 characters'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  -- Idempotent replay (header-scoped request id)
  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.purchase_returns
    WHERE actor_profile_id = v_actor
      AND client_request_id = v_request_id
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.purchase_id IS DISTINCT FROM p_purchase_id THEN
        RAISE EXCEPTION
          'client_request_id already used for a different purchase'
          USING ERRCODE = '23505';
      END IF;

      IF nullif(btrim(coalesce(v_existing.reason, '')), '') IS DISTINCT FROM v_reason THEN
        RAISE EXCEPTION
          'client_request_id already used with a different return reason'
          USING ERRCODE = '23505';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM (
          SELECT
            (e ->> 'purchase_item_id')::uuid AS purchase_item_id,
            (e ->> 'quantity')::numeric(12, 3) AS quantity,
            nullif(e ->> 'receipt_line_id', '')::uuid AS receipt_line_id
          FROM jsonb_array_elements(p_lines) e
        ) req
        FULL OUTER JOIN (
          SELECT purchase_item_id, quantity, receipt_line_id
          FROM public.purchase_return_lines
          WHERE return_id = v_existing.id
        ) got
          ON got.purchase_item_id = req.purchase_item_id
         AND got.quantity IS NOT DISTINCT FROM req.quantity
         AND got.receipt_line_id IS NOT DISTINCT FROM req.receipt_line_id
        WHERE req.purchase_item_id IS NULL OR got.purchase_item_id IS NULL
      ) OR (
        SELECT count(*) FROM jsonb_array_elements(p_lines)
      ) <> (
        SELECT count(*) FROM public.purchase_return_lines
        WHERE return_id = v_existing.id
      ) THEN
        RAISE EXCEPTION
          'client_request_id already used with different return lines'
          USING ERRCODE = '23505';
      END IF;

      RETURN jsonb_build_object(
        'purchaseId', p_purchase_id,
        'returnId', v_existing.id,
        'idempotentReplay', true,
        'movementCount', 0,
        'totalQuantity', 0,
        'taxableAmount', v_existing.taxable_amount,
        'taxAmount', v_existing.tax_amount,
        'totalAmount', v_existing.total_amount,
        'reason', v_existing.reason
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

  IF v_purchase.status NOT IN (
    'PARTIALLY_RECEIVED'::public.purchase_status,
    'RECEIVED'::public.purchase_status
  ) THEN
    RAISE EXCEPTION
      'Only partially or fully received purchases can be returned'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.operational_locations ol
    WHERE ol.id = v_purchase.operational_location_id
      AND ol.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.purchase_receipts pr WHERE pr.purchase_id = p_purchase_id
  ) INTO v_has_receipt_events;

  -- Normalize + validate lines (no writes yet)
  v_lines := '[]'::jsonb;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_item_id := (v_line ->> 'purchase_item_id')::uuid;
      v_qty := (v_line ->> 'quantity')::numeric(12, 3);
      v_receipt_line_id := nullif(v_line ->> 'receipt_line_id', '')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION
        'Each return line needs purchase_item_id and quantity'
        USING ERRCODE = '22023';
    END;

    IF v_item_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be positive' USING ERRCODE = '22023';
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

    -- Legacy full receive: RECEIPT on purchase_item, no receipt-event rows.
    IF v_received = 0 AND NOT v_has_receipt_events THEN
      IF EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.reference_type = 'purchase_item'
          AND im.reference_id = v_item_id
          AND im.movement_type = 'RECEIPT'::public.inventory_movement_type
      ) THEN
        v_received := v_item.quantity;
      END IF;
    END IF;

    SELECT coalesce(sum(prl.quantity), 0) INTO v_returned
    FROM public.purchase_return_lines prl
    INNER JOIN public.purchase_returns pr ON pr.id = prl.return_id
    WHERE prl.purchase_item_id = v_item_id;

    v_net := v_received - v_returned;
    IF v_qty > v_net THEN
      RAISE EXCEPTION
        'Return quantity % exceeds net received % for purchase item %',
        v_qty, v_net, v_item_id
        USING ERRCODE = '22023';
    END IF;

    IF v_receipt_line_id IS NOT NULL THEN
      SELECT * INTO v_receipt_line
      FROM public.purchase_receipt_lines
      WHERE id = v_receipt_line_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Receipt line % not found', v_receipt_line_id
          USING ERRCODE = 'P0002';
      END IF;

      IF v_receipt_line.purchase_item_id IS DISTINCT FROM v_item_id THEN
        RAISE EXCEPTION
          'Receipt line % does not belong to purchase item %',
          v_receipt_line_id, v_item_id
          USING ERRCODE = '22023';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.purchase_receipts pr
        WHERE pr.id = v_receipt_line.receipt_id
          AND pr.purchase_id = p_purchase_id
      ) THEN
        RAISE EXCEPTION
          'Receipt line % is not on this purchase', v_receipt_line_id
          USING ERRCODE = '22023';
      END IF;

      SELECT coalesce(sum(prl.quantity), 0) INTO v_rl_returned
      FROM public.purchase_return_lines prl
      WHERE prl.receipt_line_id = v_receipt_line_id;

      IF v_qty > (v_receipt_line.quantity - v_rl_returned) THEN
        RAISE EXCEPTION
          'Return quantity % exceeds net on receipt line %',
          v_qty, v_receipt_line_id
          USING ERRCODE = '22023';
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_lines) x
      WHERE (x.value ->> 'purchase_item_id')::uuid = v_item_id
        AND (
          nullif(x.value ->> 'receipt_line_id', '')::uuid
          IS NOT DISTINCT FROM v_receipt_line_id
        )
    ) THEN
      RAISE EXCEPTION 'Duplicate return line for the same item/receipt line'
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
        'line_taxable', v_line_taxable,
        'receipt_line_id', to_jsonb(v_receipt_line_id)
      )
    );
  END LOOP;

  -- Tax base: allocated receipt tax (or full bill for legacy receive).
  IF v_has_receipt_events THEN
    SELECT
      coalesce(sum(pr.taxable_amount), 0),
      coalesce(sum(pr.tax_amount), 0)
    INTO v_taxable_recv, v_tax_recv
    FROM public.purchase_receipts pr
    WHERE pr.purchase_id = p_purchase_id;
  ELSE
    v_taxable_recv := round(coalesce(v_purchase.subtotal, 0), 2);
    v_tax_recv := round(coalesce(v_purchase.tax_amount, 0), 2);
  END IF;

  SELECT
    coalesce(sum(pr.taxable_amount), 0),
    coalesce(sum(pr.tax_amount), 0)
  INTO v_taxable_prev, v_tax_prev
  FROM public.purchase_returns pr
  WHERE pr.purchase_id = p_purchase_id;

  -- Completes when every item's net received is fully returned after this event.
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.purchase_items pi
    WHERE pi.purchase_id = p_purchase_id
      AND (
        CASE
          WHEN v_has_receipt_events THEN
            coalesce((
              SELECT sum(prl.quantity)
              FROM public.purchase_receipt_lines prl
              INNER JOIN public.purchase_receipts pr ON pr.id = prl.receipt_id
              WHERE prl.purchase_item_id = pi.id
            ), 0)
          WHEN EXISTS (
            SELECT 1
            FROM public.inventory_movements im
            WHERE im.reference_type = 'purchase_item'
              AND im.reference_id = pi.id
              AND im.movement_type = 'RECEIPT'::public.inventory_movement_type
          ) THEN pi.quantity
          ELSE 0
        END
      ) > coalesce((
        SELECT sum(prl.quantity)
        FROM public.purchase_return_lines prl
        INNER JOIN public.purchase_returns pr ON pr.id = prl.return_id
        WHERE prl.purchase_item_id = pi.id
      ), 0) + coalesce((
        SELECT sum((e ->> 'quantity')::numeric(12, 3))
        FROM jsonb_array_elements(v_lines) e
        WHERE (e ->> 'purchase_item_id')::uuid = pi.id
      ), 0)
  ) INTO v_completes;

  v_remaining_taxable := round(v_taxable_recv - v_taxable_prev, 2);
  v_remaining_tax := round(v_tax_recv - v_tax_prev, 2);

  IF v_tax_recv <= 0 OR v_taxable <= 0 THEN
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

  IF v_tax > 0 AND v_tax_recv > 0 THEN
    IF v_has_receipt_events THEN
      -- Scale from cumulative receipt GST split still returnable.
      SELECT
        greatest(
          0,
          coalesce(sum(pr.cgst_amount), 0) - coalesce(
            (SELECT sum(x.cgst_amount) FROM public.purchase_returns x
             WHERE x.purchase_id = p_purchase_id), 0
          )
        ),
        greatest(
          0,
          coalesce(sum(pr.sgst_amount), 0) - coalesce(
            (SELECT sum(x.sgst_amount) FROM public.purchase_returns x
             WHERE x.purchase_id = p_purchase_id), 0
          )
        ),
        greatest(
          0,
          coalesce(sum(pr.igst_amount), 0) - coalesce(
            (SELECT sum(x.igst_amount) FROM public.purchase_returns x
             WHERE x.purchase_id = p_purchase_id), 0
          )
        )
      INTO v_cgst, v_sgst, v_igst
      FROM public.purchase_receipts pr
      WHERE pr.purchase_id = p_purchase_id;

      IF v_completes THEN
        -- Keep remainder components exactly.
        NULL;
      ELSE
        v_ratio := v_tax / v_remaining_tax;
        v_cgst := round(v_cgst * v_ratio, 2);
        v_sgst := round(v_sgst * v_ratio, 2);
        v_igst := round(v_igst * v_ratio, 2);
      END IF;
    ELSE
      v_ratio := v_tax / v_tax_recv;
      v_cgst := round(coalesce(v_purchase.cgst_amount, 0) * v_ratio, 2);
      v_sgst := round(coalesce(v_purchase.sgst_amount, 0) * v_ratio, 2);
      v_igst := round(coalesce(v_purchase.igst_amount, 0) * v_ratio, 2);
    END IF;

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

  -- Stable line order for deterministic tax remainder.
  SELECT coalesce(
    jsonb_agg(value ORDER BY (value ->> 'purchase_item_id')::uuid, ord),
    '[]'::jsonb
  )
  INTO v_lines
  FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t(value, ord);

  v_line_count := jsonb_array_length(v_lines);
  v_tax_left := v_tax;
  v_line_idx := 0;

  INSERT INTO public.purchase_returns (
    purchase_id,
    supplier_id,
    returned_at,
    actor_profile_id,
    client_request_id,
    reason,
    taxable_amount,
    tax_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount
  )
  VALUES (
    p_purchase_id,
    v_purchase.supplier_id,
    v_now,
    v_actor,
    v_request_id,
    v_reason,
    v_taxable,
    v_tax,
    v_cgst,
    v_sgst,
    v_igst,
    v_total
  )
  RETURNING * INTO v_return;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t(value, ord)
    ORDER BY ord
  LOOP
    v_item_id := (v_line ->> 'purchase_item_id')::uuid;
    v_qty := (v_line ->> 'quantity')::numeric(12, 3);
    v_line_taxable := (v_line ->> 'line_taxable')::numeric(12, 2);
    v_receipt_line_id := CASE
      WHEN jsonb_typeof(v_line -> 'receipt_line_id') = 'null' THEN NULL
      ELSE nullif(v_line ->> 'receipt_line_id', '')::uuid
    END;

    v_line_idx := v_line_idx + 1;
    IF v_line_idx = v_line_count OR v_taxable <= 0 THEN
      v_line_tax := v_tax_left;
    ELSE
      v_line_tax := round(v_tax * (v_line_taxable / v_taxable), 2);
      IF v_line_tax > v_tax_left THEN
        v_line_tax := v_tax_left;
      END IF;
    END IF;
    v_tax_left := round(v_tax_left - v_line_tax, 2);

    INSERT INTO public.purchase_return_lines (
      return_id,
      purchase_item_id,
      receipt_line_id,
      quantity,
      unit_cost,
      line_taxable,
      line_tax,
      line_total
    )
    VALUES (
      v_return.id,
      v_item_id,
      v_receipt_line_id,
      v_qty,
      (v_line ->> 'unit_cost')::numeric(12, 2),
      v_line_taxable,
      v_line_tax,
      round(v_line_taxable + v_line_tax, 2)
    )
    RETURNING id INTO v_return_line_id;

    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = (v_line ->> 'sku_id')::uuid
      AND operational_location_id = v_purchase.operational_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Inventory balance not found for SKU on this warehouse'
        USING ERRCODE = 'P0002';
    END IF;

    v_new_on_hand := v_balance.on_hand_quantity - v_qty;
    IF v_new_on_hand < v_balance.reserved_quantity THEN
      RAISE EXCEPTION
        'Return would leave on-hand % below reserved %',
        v_new_on_hand, v_balance.reserved_quantity
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.inventory_balances
    SET on_hand_quantity = v_new_on_hand
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
      'PURCHASE_RETURN'::public.inventory_movement_type,
      -v_qty,
      NULL,
      format(
        'Purchase return %s · %s',
        v_purchase.bill_number,
        left(v_reason, 120)
      ),
      'purchase_return_line',
      v_return_line_id,
      v_actor
    );

    v_movements := v_movements + 1;
  END LOOP;

  -- Reverse AP / inventory / input tax in the same transaction.
  IF v_total > 0 THEN
    v_journal_lines := jsonb_build_array(
      jsonb_build_object('account_code', '2000', 'debit', v_total, 'credit', 0),
      jsonb_build_object('account_code', '1200', 'debit', 0, 'credit', v_taxable)
    );
    v_journal_lines := v_journal_lines || public._accounting_purchase_tax_credit_lines(
      v_tax, v_cgst, v_sgst, v_igst
    );

    PERFORM public._accounting_post_journal(
      v_now::date,
      'purchase_return',
      v_return.id,
      format('Purchase return %s', v_purchase.bill_number),
      v_journal_lines,
      v_actor
    );
  END IF;

  RETURN jsonb_build_object(
    'purchaseId', p_purchase_id,
    'returnId', v_return.id,
    'idempotentReplay', false,
    'movementCount', v_movements,
    'totalQuantity', v_qty_total,
    'taxableAmount', v_taxable,
    'taxAmount', v_tax,
    'totalAmount', v_total,
    'reason', v_return.reason,
    'returnedAt', v_return.returned_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_purchase_return(
  uuid, jsonb, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_purchase_return(
  uuid, jsonb, text, text, uuid
) TO authenticated;

COMMENT ON FUNCTION public.admin_create_purchase_return(
  uuid, jsonb, text, text, uuid
) IS
  'Supplier return: purchase_returns + PURCHASE_RETURN movements (purchase_return_line). '
  'Posts purchase_return journal in-txn. Idempotent via actor client_request_id.';

-- ─── 4) Sync backfill for purchase_return (posted in RPC; fill gaps) ─────────

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

  -- purchase_return events (posted in return RPC; backfill if missing).
  FOR v_row IN
    SELECT
      pret.id,
      pret.returned_at,
      pret.taxable_amount,
      pret.tax_amount,
      pret.cgst_amount,
      pret.sgst_amount,
      pret.igst_amount,
      pret.total_amount,
      p.bill_number
    FROM public.purchase_returns pret
    INNER JOIN public.purchases p ON p.id = pret.purchase_id
    WHERE pret.returned_at::date >= p_date_from
      AND pret.returned_at::date <= p_date_to
  LOOP
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE source_type = 'purchase_return' AND source_id = v_row.id;
    IF FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF round(coalesce(v_row.total_amount, 0), 2) <= 0 THEN
      CONTINUE;
    END IF;

    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_code', '2000',
        'debit', round(v_row.total_amount, 2),
        'credit', 0
      ),
      jsonb_build_object(
        'account_code', '1200',
        'debit', 0,
        'credit', round(v_row.taxable_amount, 2)
      )
    );
    v_lines := v_lines || public._accounting_purchase_tax_credit_lines(
      round(v_row.tax_amount, 2),
      round(v_row.cgst_amount, 2),
      round(v_row.sgst_amount, 2),
      round(v_row.igst_amount, 2)
    );

    PERFORM public._accounting_post_journal(
      v_row.returned_at::date,
      'purchase_return',
      v_row.id,
      format('Purchase return %s', v_row.bill_number),
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
  'Domain→journal sync. purchase_receipt + purchase_return events, legacy '
  'purchase_receive (RECEIVED without receipt rows). Skips collection_event-covered payments.';
