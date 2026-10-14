-- Phase 7B.1 — Sale refund + supplier payment journal integrity.
-- Preserves original journals; posts idempotent reversing journals.
-- Refunds remain full-only (existing admin_refund_converted_sale contract).
-- Supplier payment delete remains a domain hard-delete; accounting history is kept.

-- ─── Reverse a posted journal (swap debit/credit) ────────────────────────────

CREATE OR REPLACE FUNCTION public._accounting_reverse_posted_journal(
  p_original_source_type text,
  p_original_source_id uuid,
  p_reversal_source_type text,
  p_reversal_source_id uuid,
  p_memo text,
  p_entry_date date DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_exclude_account_codes text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original uuid;
  v_existing_reversal uuid;
  v_entry_date date;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_actor uuid := COALESCE(p_actor, auth.uid());
BEGIN
  IF p_original_source_type IS NULL
    OR p_original_source_id IS NULL
    OR p_reversal_source_type IS NULL
    OR p_reversal_source_id IS NULL
  THEN
    RAISE EXCEPTION 'Journal reverse source fields are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, entry_date
  INTO v_original, v_entry_date
  FROM public.journal_entries
  WHERE source_type = btrim(p_original_source_type)
    AND source_id = p_original_source_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_existing_reversal
  FROM public.journal_entries
  WHERE source_type = btrim(p_reversal_source_type)
    AND source_id = p_reversal_source_id;

  IF FOUND THEN
    RETURN v_existing_reversal;
  END IF;

  FOR v_line IN
    SELECT
      coa.code AS account_code,
      jl.debit,
      jl.credit
    FROM public.journal_lines jl
    INNER JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
    WHERE jl.journal_entry_id = v_original
      AND (
        p_exclude_account_codes IS NULL
        OR NOT (coa.code = ANY (p_exclude_account_codes))
      )
    ORDER BY jl.id ASC
  LOOP
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', v_line.account_code,
        'debit', v_line.credit,
        'credit', v_line.debit
      )
    );
  END LOOP;

  IF jsonb_array_length(v_lines) < 2 THEN
    -- Nothing left to reverse after exclusions (or malformed original).
    RETURN NULL;
  END IF;

  RETURN public._accounting_post_journal(
    coalesce(p_entry_date, now()::date, v_entry_date),
    btrim(p_reversal_source_type),
    p_reversal_source_id,
    left(btrim(COALESCE(p_memo, 'Journal reversal')), 500),
    v_lines,
    v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public._accounting_reverse_posted_journal(
  text, uuid, text, uuid, text, date, uuid, text[]
) FROM PUBLIC;

COMMENT ON FUNCTION public._accounting_reverse_posted_journal(
  text, uuid, text, uuid, text, date, uuid, text[]
) IS
  'Internal: posts an idempotent reversing journal for an existing '
  '(source_type, source_id). Optional account-code exclusions keep pairs '
  'like COGS/Inventory when goods are not restocked. Returns NULL if original missing.';

-- ─── Sale refund: reverse posted sale + collection journals ──────────────────

CREATE OR REPLACE FUNCTION public._accounting_post_sale_refund_reversals(
  p_sale_id uuid,
  p_payment_id uuid,
  p_order_id uuid,
  p_reverse_cogs boolean,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor, auth.uid());
  v_exclude text[];
  v_sale_rev uuid;
  v_collection_rev uuid;
  v_event record;
  v_event_revs integer := 0;
  v_event_rev uuid;
BEGIN
  IF p_reverse_cogs THEN
    v_exclude := NULL;
  ELSE
    -- Keep COGS / Inventory when goods are not returned to stock.
    v_exclude := ARRAY['5000', '1200'];
  END IF;

  IF p_sale_id IS NOT NULL THEN
    v_sale_rev := public._accounting_reverse_posted_journal(
      'sale',
      p_sale_id,
      'sale_refund',
      p_sale_id,
      format('Refund sale %s', p_sale_id),
      now()::date,
      v_actor,
      v_exclude
    );
  END IF;

  IF p_payment_id IS NOT NULL THEN
    v_collection_rev := public._accounting_reverse_posted_journal(
      'collection',
      p_payment_id,
      'collection_refund',
      p_payment_id,
      'Refund customer collection',
      now()::date,
      v_actor,
      NULL
    );

    FOR v_event IN
      SELECT pe.id
      FROM public.payment_events pe
      WHERE pe.payment_id = p_payment_id
      ORDER BY pe.created_at ASC, pe.id ASC
    LOOP
      v_event_rev := public._accounting_reverse_posted_journal(
        'collection_event',
        v_event.id,
        'collection_event_refund',
        v_event.id,
        'Refund collection event',
        now()::date,
        v_actor,
        NULL
      );
      IF v_event_rev IS NOT NULL THEN
        v_event_revs := v_event_revs + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'saleRefundJournalId', v_sale_rev,
    'collectionRefundJournalId', v_collection_rev,
    'collectionEventRefundCount', v_event_revs,
    'orderId', p_order_id,
    'reverseCogs', p_reverse_cogs
  );
END;
$$;

REVOKE ALL ON FUNCTION public._accounting_post_sale_refund_reversals(
  uuid, uuid, uuid, boolean, uuid
) FROM PUBLIC;

COMMENT ON FUNCTION public._accounting_post_sale_refund_reversals(
  uuid, uuid, uuid, boolean, uuid
) IS
  'Internal: idempotent Books reversals for a refunded sale/payment. '
  'COGS/Inventory reversed only when reverse_cogs is true (restock path).';

CREATE OR REPLACE FUNCTION public.admin_refund_converted_sale(
  p_order_id uuid,
  p_reason text DEFAULT NULL,
  p_restock boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_from public.payment_status;
  v_reason text;
  v_item RECORD;
  v_location_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_restocked int := 0;
  v_sale_updated boolean := false;
  v_dispatch_qty numeric(12, 3);
  v_reverse_cogs boolean := false;
  v_journal_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Refund reason is required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IS DISTINCT FROM 'DELIVERED' AND v_order.sale_id IS NULL THEN
    RAISE EXCEPTION
      'Full return/refund requires a delivered order or a converted sale (current: %)',
      v_order.status;
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found for order';
  END IF;

  IF v_payment.status = 'REFUNDED' THEN
    IF v_order.sale_id IS NOT NULL THEN
      SELECT * INTO v_sale FROM public.sales WHERE id = v_order.sale_id;
    ELSE
      SELECT * INTO v_sale FROM public.sales WHERE order_id = p_order_id;
    END IF;

    -- Backfill Books reversals for refunds posted before journal integrity.
    v_reverse_cogs := EXISTS (
      SELECT 1
      FROM public.inventory_movements im
      WHERE im.reference_type = 'order'
        AND im.reference_id = p_order_id
        AND im.movement_type = 'RETURN'
    );

    v_journal_meta := public._accounting_post_sale_refund_reversals(
      v_sale.id,
      v_payment.id,
      p_order_id,
      v_reverse_cogs,
      v_uid
    );

    RETURN jsonb_build_object(
      'orderId', p_order_id,
      'paymentId', v_payment.id,
      'saleId', v_sale.id,
      'status', 'REFUNDED',
      'alreadyRefunded', true,
      'restockedItemCount', 0,
      'journalReversal', v_journal_meta
    );
  END IF;

  IF v_payment.status IS DISTINCT FROM 'PAID' THEN
    RAISE EXCEPTION
      'Refund requires PAID payment (current: %)',
      v_payment.status;
  END IF;

  v_from := v_payment.status;

  UPDATE public.payments
  SET status = 'REFUNDED',
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (
    payment_id, from_status, to_status, actor_profile_id, actor_role, note
  )
  VALUES (
    v_payment.id,
    v_from,
    'REFUNDED',
    v_uid,
    'ADMIN',
    v_reason
  );

  IF v_order.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = v_order.sale_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.sales
      SET status = 'REFUNDED',
          updated_at = now()
      WHERE id = v_sale.id;

      UPDATE public.sales_payments
      SET status = 'REFUNDED'
      WHERE sale_id = v_sale.id;

      v_sale_updated := true;
    END IF;
  ELSE
    SELECT * INTO v_sale FROM public.sales WHERE order_id = p_order_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.orders
      SET sale_id = COALESCE(sale_id, v_sale.id),
          updated_at = now()
      WHERE id = p_order_id;

      UPDATE public.sales
      SET status = 'REFUNDED',
          updated_at = now()
      WHERE id = v_sale.id;

      UPDATE public.sales_payments
      SET status = 'REFUNDED'
      WHERE sale_id = v_sale.id;

      v_sale_updated := true;
    END IF;
  END IF;

  -- Optional restock: reverse ORDER_DISPATCH at the fulfilled reservation location.
  IF p_restock THEN
    IF NOT v_sale_updated OR v_sale.id IS NULL THEN
      RAISE EXCEPTION
        'Restock requires a converted sale with sale_items; inventory adjust manually otherwise';
    END IF;

    FOR v_item IN
      SELECT *
      FROM public.sale_items
      WHERE sale_id = v_sale.id
      ORDER BY created_at ASC
    LOOP
      IF v_item.sku_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot restock sale item %: missing sku_id',
          v_item.id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.reference_type = 'order'
          AND im.reference_id = p_order_id
          AND im.sku_id = v_item.sku_id
          AND im.movement_type = 'RETURN'
      ) THEN
        CONTINUE;
      END IF;

      SELECT abs(sum(im.quantity_delta))
      INTO v_dispatch_qty
      FROM public.inventory_movements im
      WHERE im.reference_type = 'order'
        AND im.reference_id = p_order_id
        AND im.sku_id = v_item.sku_id
        AND im.movement_type = 'ORDER_DISPATCH';

      IF v_dispatch_qty IS NULL OR v_dispatch_qty <= 0 THEN
        RAISE EXCEPTION
          'Cannot restock SKU %: no ORDER_DISPATCH consumption for this order (nothing to reverse)',
          v_item.sku_id;
      END IF;

      SELECT sr.operational_location_id
      INTO v_location_id
      FROM public.stock_reservations sr
      WHERE sr.order_id = p_order_id
        AND sr.sku_id = v_item.sku_id
        AND sr.status = 'FULFILLED'
      ORDER BY sr.updated_at DESC
      LIMIT 1;

      IF v_location_id IS NULL THEN
        SELECT im.operational_location_id
        INTO v_location_id
        FROM public.inventory_movements im
        WHERE im.reference_type = 'order'
          AND im.reference_id = p_order_id
          AND im.sku_id = v_item.sku_id
          AND im.movement_type = 'ORDER_DISPATCH'
        ORDER BY im.created_at DESC
        LIMIT 1;
      END IF;

      IF v_location_id IS NULL THEN
        RAISE EXCEPTION
          'Cannot restock SKU %: no stock reservation/dispatch location for this order',
          v_item.sku_id;
      END IF;

      SELECT *
      INTO v_balance
      FROM public.inventory_balances
      WHERE sku_id = v_item.sku_id
        AND operational_location_id = v_location_id
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.inventory_balances (
          sku_id, operational_location_id, on_hand_quantity, reserved_quantity
        )
        VALUES (v_item.sku_id, v_location_id, 0, 0)
        RETURNING * INTO v_balance;

        SELECT *
        INTO v_balance
        FROM public.inventory_balances
        WHERE id = v_balance.id
        FOR UPDATE;
      END IF;

      UPDATE public.inventory_balances
      SET on_hand_quantity = on_hand_quantity + v_item.quantity,
          updated_at = now()
      WHERE id = v_balance.id;

      INSERT INTO public.inventory_movements (
        sku_id,
        operational_location_id,
        movement_type,
        quantity_delta,
        reason,
        reference_type,
        reference_id,
        actor_profile_id
      )
      VALUES (
        v_item.sku_id,
        v_location_id,
        'RETURN',
        v_item.quantity,
        v_reason,
        'order',
        p_order_id,
        v_uid
      );

      v_restocked := v_restocked + 1;
    END LOOP;
  END IF;

  -- Books: reverse sale (+ COGS only when restocked) and collections.
  v_reverse_cogs := p_restock AND v_restocked > 0;
  IF NOT v_reverse_cogs THEN
    v_reverse_cogs := EXISTS (
      SELECT 1
      FROM public.inventory_movements im
      WHERE im.reference_type = 'order'
        AND im.reference_id = p_order_id
        AND im.movement_type = 'RETURN'
    );
  END IF;

  v_journal_meta := public._accounting_post_sale_refund_reversals(
    v_sale.id,
    v_payment.id,
    p_order_id,
    v_reverse_cogs,
    v_uid
  );

  INSERT INTO public.order_events (
    order_id, actor_profile_id, actor_role, from_status, to_status, note
  )
  VALUES (
    p_order_id,
    v_uid,
    'ADMIN',
    NULL,
    v_order.status,
    'Full return/refund recorded: ' || v_reason
  );

  PERFORM public.write_audit_log(
    'sale.refunded_admin',
    'order',
    p_order_id,
    jsonb_build_object(
      'paymentId', v_payment.id,
      'saleId', v_sale.id,
      'reason', v_reason,
      'restock', p_restock,
      'restockedItemCount', v_restocked,
      'amount', v_payment.amount,
      'journalReversal', v_journal_meta
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentId', v_payment.id,
    'saleId', v_sale.id,
    'status', 'REFUNDED',
    'alreadyRefunded', false,
    'restockedItemCount', v_restocked,
    'amount', v_payment.amount,
    'journalReversal', v_journal_meta
  );
END;
$$;

COMMENT ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) IS
  'Refunds PAID converted sale. Optional restock reverses ORDER_DISPATCH at the fulfilled warehouse exactly once (RETURN movement). '
  'Posts idempotent Books reversals for sale/collection journals; COGS/Inventory reversed only when restocked. '
  'Idempotent when already REFUNDED (also backfills missing journal reversals).';

-- Grants unchanged from prior migration.
REVOKE ALL ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_converted_sale(uuid, text, boolean)
  TO service_role;

-- ─── Supplier payment delete: reverse journal then hard-delete domain row ────

CREATE OR REPLACE FUNCTION public.admin_delete_supplier_payment(
  p_payment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.supplier_payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete supplier payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment id is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.supplier_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier payment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Preserve accounting history: reverse before domain delete (idempotent).
  PERFORM public._accounting_reverse_posted_journal(
    'supplier_payment',
    v_payment.id,
    'supplier_payment_reversal',
    v_payment.id,
    format('Reverse supplier payment %s', v_payment.id),
    coalesce(v_payment.payment_date, now()::date),
    v_uid,
    NULL
  );

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

COMMENT ON FUNCTION public.admin_delete_supplier_payment(uuid) IS
  'Admin hard-deletes a supplier payment after posting an idempotent '
  'supplier_payment_reversal journal when a supplier_payment journal exists.';
