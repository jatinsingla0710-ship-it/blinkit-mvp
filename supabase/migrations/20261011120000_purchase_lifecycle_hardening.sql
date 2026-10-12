-- Phase 6B.4 — Purchase lifecycle hardening
-- 1) Admin-gate purchase_payable_amounts (SECURITY DEFINER + is_admin)
-- 2) Serialize receive/return idempotency under purchase FOR UPDATE
--    so concurrent identical client_request_id soft-replays instead of unique_violation.

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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can view purchase payable amounts'
      USING ERRCODE = '42501';
  END IF;

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
  'Admin-only payable basis for one purchase: receipt totals − returns (new path), or '
  'legacy bill total when RECEIVED with no receipt rows. remaining < 0 = credit.';


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

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

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

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

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
