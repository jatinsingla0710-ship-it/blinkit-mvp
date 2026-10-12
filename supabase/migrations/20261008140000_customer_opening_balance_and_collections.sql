-- Phase 4C: customer opening receivable + customer-level collections.
-- Extends existing AR (1100) / equity (3000) / cash-bank journals.
-- Does not create fake orders/sales. Does not change customer document storage.

-- ─── 1) shop_opening_balances ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  as_of_date date NOT NULL,
  amount numeric(14, 2) NOT NULL,
  note text,
  journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT shop_opening_balances_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_opening_balances_one_active_per_shop_uidx
  ON public.shop_opening_balances (shop_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS shop_opening_balances_shop_idx
  ON public.shop_opening_balances (shop_id, as_of_date DESC);

COMMENT ON TABLE public.shop_opening_balances IS
  'Phase 4C: customer opening receivable (positive = customer owes). One active row per shop.';

CREATE TRIGGER trg_shop_opening_balances_set_updated_at
  BEFORE UPDATE ON public.shop_opening_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shop_opening_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_opening_balances FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_opening_balances_admin_all ON public.shop_opening_balances;
CREATE POLICY shop_opening_balances_admin_all
  ON public.shop_opening_balances
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_opening_balances TO authenticated;
GRANT ALL ON public.shop_opening_balances TO service_role;

-- ─── 2) shop_collections (unallocated customer-level payments) ────────────────

CREATE TABLE IF NOT EXISTS public.shop_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL,
  method text NOT NULL,
  note text,
  client_request_id text,
  journal_entry_id uuid REFERENCES public.journal_entries (id) ON DELETE SET NULL,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT shop_collections_amount_positive CHECK (amount > 0),
  CONSTRAINT shop_collections_request_not_blank CHECK (
    client_request_id IS NULL OR char_length(btrim(client_request_id)) BETWEEN 8 AND 128
  )
);

CREATE INDEX IF NOT EXISTS shop_collections_shop_active_idx
  ON public.shop_collections (shop_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shop_collections_actor_request_uidx
  ON public.shop_collections (created_by_profile_id, client_request_id)
  WHERE client_request_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.shop_collections IS
  'Phase 4C: unallocated customer-level collections (no fake order). Reduces shop outstanding.';

ALTER TABLE public.shop_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_collections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_collections_admin_all ON public.shop_collections;
CREATE POLICY shop_collections_admin_all
  ON public.shop_collections
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_collections TO authenticated;
GRANT ALL ON public.shop_collections TO service_role;

-- ─── 3) Outstanding helper (orders residual + opening − shop collections) ─────

CREATE OR REPLACE FUNCTION public._shop_receivable_outstanding(p_shop_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening numeric(14, 2) := 0;
  v_order_due numeric(14, 2) := 0;
  v_collections numeric(14, 2) := 0;
BEGIN
  SELECT coalesce(sum(amount), 0)
  INTO v_opening
  FROM public.shop_opening_balances
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL;

  SELECT coalesce(sum(
    CASE
      WHEN p.id IS NULL THEN o.total
      WHEN p.status IN (
        'PAID'::public.payment_status,
        'REFUNDED'::public.payment_status
      ) THEN 0
      ELSE greatest(
        0,
        round(
          o.total
          - coalesce(p.cash_collected_amount, 0)
          - coalesce(p.online_collected_amount, 0),
          2
        )
      )
    END
  ), 0)
  INTO v_order_due
  FROM public.orders o
  LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE o.shop_id = p_shop_id
    AND o.status IS DISTINCT FROM 'CANCELLED'::public.order_status;

  SELECT coalesce(sum(amount), 0)
  INTO v_collections
  FROM public.shop_collections
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL;

  RETURN round(greatest(0, v_opening + v_order_due - v_collections), 2);
END;
$$;

REVOKE ALL ON FUNCTION public._shop_receivable_outstanding(uuid) FROM PUBLIC;

COMMENT ON FUNCTION public._shop_receivable_outstanding(uuid) IS
  'Phase 4C: shop outstanding = opening + order residuals − unallocated shop collections.';

-- ─── 4) admin_set_shop_opening_balance ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_shop_opening_balance(
  p_shop_id uuid,
  p_as_of_date date,
  p_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_amount numeric(14, 2);
  v_shop public.shops%ROWTYPE;
  v_existing public.shop_opening_balances%ROWTYPE;
  v_new public.shop_opening_balances%ROWTYPE;
  v_journal uuid;
  v_lines jsonb;
  v_memo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_as_of_date IS NULL THEN
    RAISE EXCEPTION 'as_of_date is required' USING ERRCODE = '22023';
  END IF;

  v_amount := round(coalesce(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Opening balance must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_shop
  FROM public.shops
  WHERE id = p_shop_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF coalesce(v_shop.is_walk_in, false) IS TRUE THEN
    RAISE EXCEPTION 'Opening balance cannot be set for Walk-in Customer'
      USING ERRCODE = '22023';
  END IF;
  IF v_shop.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Shop is inactive';
  END IF;

  SELECT * INTO v_existing
  FROM public.shop_opening_balances
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF round(v_existing.amount, 2) = v_amount
       AND v_existing.as_of_date = p_as_of_date THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'shopId', v_existing.shop_id,
        'asOfDate', v_existing.as_of_date,
        'amount', v_existing.amount,
        'note', v_existing.note,
        'journalEntryId', v_existing.journal_entry_id,
        'outstanding', public._shop_receivable_outstanding(p_shop_id),
        'idempotentReplay', true
      );
    END IF;

    -- Reverse prior AR opening (idempotent per prior row id).
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', '3000', 'debit', v_existing.amount, 'credit', 0),
      jsonb_build_object('account_code', '1100', 'debit', 0, 'credit', v_existing.amount)
    );
    PERFORM public._accounting_post_journal(
      v_existing.as_of_date,
      'customer_opening_reversal',
      v_existing.id,
      format('Reverse opening balance %s', v_shop.trade_name),
      v_lines,
      v_uid
    );

    UPDATE public.shop_opening_balances
    SET deleted_at = now()
    WHERE id = v_existing.id;
  END IF;

  INSERT INTO public.shop_opening_balances (
    shop_id, as_of_date, amount, note, created_by_profile_id
  )
  VALUES (
    p_shop_id,
    p_as_of_date,
    v_amount,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_uid
  )
  RETURNING * INTO v_new;

  v_memo := coalesce(
    nullif(btrim(coalesce(p_note, '')), ''),
    format('Opening balance · %s', v_shop.trade_name)
  );

  v_lines := jsonb_build_array(
    jsonb_build_object('account_code', '1100', 'debit', v_amount, 'credit', 0),
    jsonb_build_object('account_code', '3000', 'debit', 0, 'credit', v_amount)
  );

  v_journal := public._accounting_post_journal(
    p_as_of_date,
    'customer_opening',
    v_new.id,
    left(v_memo, 500),
    v_lines,
    v_uid
  );

  UPDATE public.shop_opening_balances
  SET journal_entry_id = v_journal
  WHERE id = v_new.id
  RETURNING * INTO v_new;

  PERFORM public.write_audit_log(
    'shop.opening_balance_set',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'openingId', v_new.id,
      'amount', v_amount,
      'asOfDate', p_as_of_date,
      'journalEntryId', v_journal
    ),
    v_uid,
    'ADMIN'
  );

  RETURN jsonb_build_object(
    'id', v_new.id,
    'shopId', v_new.shop_id,
    'asOfDate', v_new.as_of_date,
    'amount', v_new.amount,
    'note', v_new.note,
    'journalEntryId', v_new.journal_entry_id,
    'outstanding', public._shop_receivable_outstanding(p_shop_id),
    'idempotentReplay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_shop_opening_balance(uuid, date, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_opening_balance(uuid, date, numeric, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_set_shop_opening_balance(uuid, date, numeric, text) IS
  'Admin: set active customer opening receivable. Dr 1100 / Cr 3000. Walk-in rejected. One active per shop.';

-- ─── 5) admin_record_customer_collection ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_record_customer_collection(
  p_shop_id uuid,
  p_amount numeric,
  p_method text,
  p_note text DEFAULT NULL,
  p_client_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_amount numeric(14, 2);
  v_shop public.shops%ROWTYPE;
  v_outstanding numeric(14, 2);
  v_bucket text;
  v_method text;
  v_request_id text;
  v_existing public.shop_collections%ROWTYPE;
  v_row public.shop_collections%ROWTYPE;
  v_journal uuid;
  v_lines jsonb := '[]'::jsonb;
  v_cash numeric(14, 2) := 0;
  v_online numeric(14, 2) := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required' USING ERRCODE = '22023';
  END IF;

  v_amount := round(coalesce(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Collection amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  v_method := upper(btrim(coalesce(p_method, '')));
  v_bucket := public._counter_collection_bucket(v_method);
  PERFORM public._counter_collection_method(v_method);

  v_request_id := nullif(btrim(coalesce(p_client_request_id, '')), '');
  IF v_request_id IS NOT NULL THEN
    IF char_length(v_request_id) < 8 OR char_length(v_request_id) > 128 THEN
      RAISE EXCEPTION 'client_request_id must be 8–128 characters'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing
    FROM public.shop_collections
    WHERE created_by_profile_id = v_uid
      AND client_request_id = v_request_id
      AND deleted_at IS NULL;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'shopId', v_existing.shop_id,
        'amount', v_existing.amount,
        'method', v_existing.method,
        'note', v_existing.note,
        'journalEntryId', v_existing.journal_entry_id,
        'outstanding', public._shop_receivable_outstanding(v_existing.shop_id),
        'idempotentReplay', true
      );
    END IF;
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_shop
  FROM public.shops
  WHERE id = p_shop_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF coalesce(v_shop.is_walk_in, false) IS TRUE THEN
    RAISE EXCEPTION 'Customer collection is not supported for Walk-in Customer'
      USING ERRCODE = '22023';
  END IF;
  IF v_shop.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Shop is inactive';
  END IF;

  -- Lock related money rows while computing outstanding.
  PERFORM 1 FROM public.orders WHERE shop_id = p_shop_id FOR UPDATE;
  PERFORM 1 FROM public.shop_opening_balances
    WHERE shop_id = p_shop_id AND deleted_at IS NULL FOR UPDATE;
  PERFORM 1 FROM public.shop_collections
    WHERE shop_id = p_shop_id AND deleted_at IS NULL FOR UPDATE;

  v_outstanding := public._shop_receivable_outstanding(p_shop_id);
  IF v_amount > v_outstanding THEN
    RAISE EXCEPTION 'Collection ₹% exceeds outstanding ₹%', v_amount, v_outstanding
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.shop_collections (
      shop_id, amount, method, note, client_request_id, created_by_profile_id
    )
    VALUES (
      p_shop_id,
      v_amount,
      v_method,
      nullif(btrim(coalesce(p_note, '')), ''),
      v_request_id,
      v_uid
    )
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN unique_violation THEN
      IF v_request_id IS NULL THEN
        RAISE;
      END IF;
      SELECT * INTO v_existing
      FROM public.shop_collections
      WHERE created_by_profile_id = v_uid
        AND client_request_id = v_request_id
        AND deleted_at IS NULL;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'shopId', v_existing.shop_id,
        'amount', v_existing.amount,
        'method', v_existing.method,
        'note', v_existing.note,
        'journalEntryId', v_existing.journal_entry_id,
        'outstanding', public._shop_receivable_outstanding(v_existing.shop_id),
        'idempotentReplay', true
      );
  END;

  IF v_bucket = 'cash' THEN
    v_cash := v_amount;
  ELSE
    v_online := v_amount;
  END IF;

  IF v_cash > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1000', 'debit', v_cash, 'credit', 0)
    );
  END IF;
  IF v_online > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1010', 'debit', v_online, 'credit', 0)
    );
  END IF;
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account_code', '1100', 'debit', 0, 'credit', v_amount)
  );

  v_journal := public._accounting_post_journal(
    now()::date,
    'customer_collection',
    v_row.id,
    left(
      coalesce(
        nullif(btrim(coalesce(p_note, '')), ''),
        format('Collection · %s · %s', v_shop.trade_name, v_method)
      ),
      500
    ),
    v_lines,
    v_uid
  );

  UPDATE public.shop_collections
  SET journal_entry_id = v_journal
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'id', v_row.id,
    'shopId', v_row.shop_id,
    'amount', v_row.amount,
    'method', v_row.method,
    'note', v_row.note,
    'journalEntryId', v_row.journal_entry_id,
    'outstanding', public._shop_receivable_outstanding(p_shop_id),
    'idempotentReplay', false
  );

  PERFORM public.write_audit_log(
    'shop.collection_recorded',
    'shop',
    p_shop_id,
    v_result,
    v_uid,
    'ADMIN'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_customer_collection(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_customer_collection(uuid, numeric, text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_record_customer_collection(uuid, numeric, text, text, text) IS
  'Admin: unallocated customer collection. Dr cash/bank, Cr AR 1100. No fake order. Idempotent via client_request_id.';
