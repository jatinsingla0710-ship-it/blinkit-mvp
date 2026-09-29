-- Expense claims and return/damage requests.
-- Approval changes status only. It does not move stock, payments, or commission.
-- Photos reuse the private salesman-media bucket:
--   {uid}/expenses/{expense_id}
--   {uid}/returns/{request_id}

DO $$ BEGIN
  CREATE TYPE public.salesman_claim_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salesman_expense_category AS ENUM ('TRAVEL', 'FOOD', 'PHONE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.salesman_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category public.salesman_expense_category NOT NULL,
  amount numeric(12, 2) NOT NULL,
  expense_date date NOT NULL,
  note text,
  receipt_path text,
  status public.salesman_claim_status NOT NULL DEFAULT 'PENDING',
  review_note text,
  reviewed_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_expenses_amount_positive CHECK (amount > 0 AND amount <= 9999999.99),
  CONSTRAINT salesman_expenses_note_length CHECK (
    note IS NULL OR char_length(note) <= 500
  ),
  CONSTRAINT salesman_expenses_review_note_length CHECK (
    review_note IS NULL OR char_length(review_note) <= 500
  ),
  CONSTRAINT salesman_expenses_receipt_path CHECK (
    receipt_path IS NULL
    OR receipt_path = (salesman_profile_id::text || '/expenses/' || id::text)
  ),
  CONSTRAINT salesman_expenses_review_state CHECK (
    (
      status = 'PENDING'::public.salesman_claim_status
      AND reviewed_at IS NULL
      AND reviewed_by_profile_id IS NULL
    )
    OR (
      status <> 'PENDING'::public.salesman_claim_status
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS salesman_expenses_owner_idx
  ON public.salesman_expenses (salesman_profile_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_salesman_expenses_set_updated_at ON public.salesman_expenses;
CREATE TRIGGER trg_salesman_expenses_set_updated_at
  BEFORE UPDATE ON public.salesman_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_expenses IS
  'Salesman expense claim. Approval is a status only and does not pay or post anything.';

CREATE TABLE IF NOT EXISTS public.salesman_return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  shop_name text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  sku_name text NOT NULL,
  sku_code text NOT NULL,
  quantity numeric(12, 3) NOT NULL,
  reason text NOT NULL,
  note text,
  photo_path text,
  status public.salesman_claim_status NOT NULL DEFAULT 'PENDING',
  review_note text,
  reviewed_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_return_requests_quantity_positive CHECK (quantity > 0 AND quantity <= 999999),
  CONSTRAINT salesman_return_requests_reason_length CHECK (
    char_length(btrim(reason)) BETWEEN 1 AND 200
  ),
  CONSTRAINT salesman_return_requests_note_length CHECK (
    note IS NULL OR char_length(note) <= 500
  ),
  CONSTRAINT salesman_return_requests_review_note_length CHECK (
    review_note IS NULL OR char_length(review_note) <= 500
  ),
  CONSTRAINT salesman_return_requests_photo_path CHECK (
    photo_path IS NULL
    OR photo_path = (salesman_profile_id::text || '/returns/' || id::text)
  ),
  CONSTRAINT salesman_return_requests_review_state CHECK (
    (
      status = 'PENDING'::public.salesman_claim_status
      AND reviewed_at IS NULL
      AND reviewed_by_profile_id IS NULL
    )
    OR (
      status <> 'PENDING'::public.salesman_claim_status
      AND reviewed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS salesman_return_requests_owner_idx
  ON public.salesman_return_requests (salesman_profile_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_salesman_return_requests_set_updated_at ON public.salesman_return_requests;
CREATE TRIGGER trg_salesman_return_requests_set_updated_at
  BEFORE UPDATE ON public.salesman_return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.salesman_return_requests IS
  'Request to return or report damaged goods. Approval does not change inventory, sales, payments, or commission.';

ALTER TABLE public.salesman_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_return_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salesman_expenses_select ON public.salesman_expenses;
CREATE POLICY salesman_expenses_select
  ON public.salesman_expenses
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR salesman_profile_id = auth.uid());

DROP POLICY IF EXISTS salesman_expenses_admin_write ON public.salesman_expenses;
CREATE POLICY salesman_expenses_admin_write
  ON public.salesman_expenses
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_return_requests_select ON public.salesman_return_requests;
CREATE POLICY salesman_return_requests_select
  ON public.salesman_return_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR salesman_profile_id = auth.uid());

DROP POLICY IF EXISTS salesman_return_requests_admin_write ON public.salesman_return_requests;
CREATE POLICY salesman_return_requests_admin_write
  ON public.salesman_return_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.salesman_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_expenses TO authenticated;
GRANT ALL ON public.salesman_expenses TO service_role;
GRANT SELECT ON public.salesman_return_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_return_requests TO authenticated;
GRANT ALL ON public.salesman_return_requests TO service_role;

-- Receipts and return photos. Profile and shop paths stay as they are.
CREATE OR REPLACE FUNCTION public.salesman_media_object_allowed(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
  SELECT
    public.profile_has_role('SALESMAN')
    AND (storage.foldername(p_name))[1] = auth.uid()::text
    AND (
      (
        storage.filename(p_name) = 'profile'
        AND coalesce(array_length(storage.foldername(p_name), 1), 0) = 1
      )
      OR (
        (storage.foldername(p_name))[2]
          ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND (storage.foldername(p_name))[2]::uuid IN (SELECT public.salesman_shop_ids())
      )
      OR (
        (storage.foldername(p_name))[2] = 'expenses'
        AND coalesce(array_length(storage.foldername(p_name), 1), 0) = 2
        AND storage.filename(p_name)
          ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.salesman_expenses e
          WHERE e.id = storage.filename(p_name)::uuid
            AND e.salesman_profile_id = auth.uid()
        )
      )
      OR (
        (storage.foldername(p_name))[2] = 'returns'
        AND coalesce(array_length(storage.foldername(p_name), 1), 0) = 2
        AND storage.filename(p_name)
          ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND EXISTS (
          SELECT 1
          FROM public.salesman_return_requests r
          WHERE r.id = storage.filename(p_name)::uuid
            AND r.salesman_profile_id = auth.uid()
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.salesman_media_object_writable(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
  SELECT public.salesman_media_object_allowed(p_name)
    AND (
      (
        (storage.foldername(p_name))[2] IS DISTINCT FROM 'expenses'
        AND (storage.foldername(p_name))[2] IS DISTINCT FROM 'returns'
      )
      OR (
        (storage.foldername(p_name))[2] = 'expenses'
        AND EXISTS (
          SELECT 1
          FROM public.salesman_expenses e
          WHERE e.id = storage.filename(p_name)::uuid
            AND e.salesman_profile_id = auth.uid()
            AND e.status = 'PENDING'::public.salesman_claim_status
        )
      )
      OR (
        (storage.foldername(p_name))[2] = 'returns'
        AND EXISTS (
          SELECT 1
          FROM public.salesman_return_requests r
          WHERE r.id = storage.filename(p_name)::uuid
            AND r.salesman_profile_id = auth.uid()
            AND r.status = 'PENDING'::public.salesman_claim_status
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.salesman_media_object_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_media_object_writable(text) TO authenticated;

DROP POLICY IF EXISTS salesman_media_salesman_insert ON storage.objects;
CREATE POLICY salesman_media_salesman_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_writable(name)
  );

DROP POLICY IF EXISTS salesman_media_salesman_update ON storage.objects;
CREATE POLICY salesman_media_salesman_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_writable(name)
  )
  WITH CHECK (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_writable(name)
  );

DROP POLICY IF EXISTS salesman_media_salesman_delete ON storage.objects;
CREATE POLICY salesman_media_salesman_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_writable(name)
  );

-- ─── Shared checks ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._salesman_require_self()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND is_active AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This account is not active';
  END IF;
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public._salesman_require_self() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_require_self() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._salesman_expense_json(p_row public.salesman_expenses)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'salesmanProfileId', p_row.salesman_profile_id,
    'category', p_row.category,
    'amount', p_row.amount,
    'expenseDate', to_char(p_row.expense_date, 'YYYY-MM-DD'),
    'note', p_row.note,
    'receiptPath', p_row.receipt_path,
    'status', p_row.status,
    'reviewNote', p_row.review_note,
    'reviewedAt', p_row.reviewed_at,
    'createdAt', p_row.created_at
  );
$$;

CREATE OR REPLACE FUNCTION public._salesman_return_json(p_row public.salesman_return_requests)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'salesmanProfileId', p_row.salesman_profile_id,
    'shopId', p_row.shop_id,
    'shopName', p_row.shop_name,
    'orderId', p_row.order_id,
    'skuId', p_row.sku_id,
    'productName', p_row.product_name,
    'skuName', p_row.sku_name,
    'skuCode', p_row.sku_code,
    'quantity', p_row.quantity,
    'reason', p_row.reason,
    'note', p_row.note,
    'photoPath', p_row.photo_path,
    'status', p_row.status,
    'reviewNote', p_row.review_note,
    'reviewedAt', p_row.reviewed_at,
    'createdAt', p_row.created_at
  );
$$;

REVOKE ALL ON FUNCTION public._salesman_expense_json(public.salesman_expenses) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_return_json(public.salesman_return_requests) FROM PUBLIC;

-- ─── Expenses ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.salesman_create_expense(
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_category public.salesman_expense_category;
  v_note text;
  v_row public.salesman_expenses;
BEGIN
  BEGIN
    v_category := upper(btrim(COALESCE(p_category, '')))::public.salesman_expense_category;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Choose a category';
  END;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999.99 THEN
    RAISE EXCEPTION 'Enter an amount greater than zero';
  END IF;
  IF p_expense_date IS NULL OR p_expense_date > (timezone('Asia/Kolkata', now()))::date THEN
    RAISE EXCEPTION 'Expense date cannot be in the future';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or less';
  END IF;

  INSERT INTO public.salesman_expenses (
    salesman_profile_id, category, amount, expense_date, note
  ) VALUES (
    v_uid, v_category, round(p_amount, 2), p_expense_date, v_note
  )
  RETURNING * INTO v_row;

  RETURN public._salesman_expense_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_update_pending_expense(
  p_expense_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_category public.salesman_expense_category;
  v_note text;
  v_row public.salesman_expenses;
BEGIN
  BEGIN
    v_category := upper(btrim(COALESCE(p_category, '')))::public.salesman_expense_category;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Choose a category';
  END;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999.99 THEN
    RAISE EXCEPTION 'Enter an amount greater than zero';
  END IF;
  IF p_expense_date IS NULL OR p_expense_date > (timezone('Asia/Kolkata', now()))::date THEN
    RAISE EXCEPTION 'Expense date cannot be in the future';
  END IF;
  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or less';
  END IF;

  UPDATE public.salesman_expenses
  SET category = v_category,
      amount = round(p_amount, 2),
      expense_date = p_expense_date,
      note = v_note
  WHERE id = p_expense_id
    AND salesman_profile_id = v_uid
    AND status = 'PENDING'::public.salesman_claim_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a pending expense of yours can be changed';
  END IF;
  RETURN public._salesman_expense_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_set_expense_receipt(
  p_expense_id uuid,
  p_receipt_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_path text := v_uid::text || '/expenses/' || p_expense_id::text;
  v_row public.salesman_expenses;
BEGIN
  IF p_receipt_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION 'Receipt path is not allowed';
  END IF;

  UPDATE public.salesman_expenses
  SET receipt_path = v_path
  WHERE id = p_expense_id
    AND salesman_profile_id = v_uid
    AND status = 'PENDING'::public.salesman_claim_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a pending expense of yours can have a receipt';
  END IF;
  RETURN public._salesman_expense_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_salesman_expense(
  p_expense_id uuid,
  p_status text,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.salesman_claim_status;
  v_note text;
  v_row public.salesman_expenses;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  BEGIN
    v_status := upper(btrim(COALESCE(p_status, '')))::public.salesman_claim_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Choose approved or rejected';
  END;
  IF v_status NOT IN (
    'APPROVED'::public.salesman_claim_status,
    'REJECTED'::public.salesman_claim_status
  ) THEN
    RAISE EXCEPTION 'Choose approved or rejected';
  END IF;
  v_note := NULLIF(btrim(COALESCE(p_review_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or less';
  END IF;

  UPDATE public.salesman_expenses
  SET status = v_status,
      review_note = v_note,
      reviewed_by_profile_id = auth.uid(),
      reviewed_at = now()
  WHERE id = p_expense_id
    AND status = 'PENDING'::public.salesman_claim_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a pending expense can be reviewed';
  END IF;
  RETURN public._salesman_expense_json(v_row);
END;
$$;

-- ─── Returns ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.salesman_create_return_request(
  p_order_id uuid,
  p_sku_id uuid,
  p_quantity numeric,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_order public.orders%ROWTYPE;
  v_line record;
  v_shop_name text;
  v_reason text;
  v_note text;
  v_row public.salesman_return_requests;
BEGIN
  IF p_order_id IS NULL OR p_sku_id IS NULL THEN
    RAISE EXCEPTION 'Choose an order and a product';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 999999 THEN
    RAISE EXCEPTION 'Enter a quantity greater than zero';
  END IF;
  v_reason := btrim(COALESCE(p_reason, ''));
  IF char_length(v_reason) < 1 OR char_length(v_reason) > 200 THEN
    RAISE EXCEPTION 'Enter a reason up to 200 characters';
  END IF;
  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or less';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.created_by_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'That order is not yours';
  END IF;
  IF v_order.shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'This shop is not assigned to you';
  END IF;

  SELECT ol.product_name_snapshot, ol.sku_name_snapshot, ol.sku_code_snapshot, ol.quantity
  INTO v_line
  FROM public.order_lines ol
  WHERE ol.order_id = p_order_id
    AND ol.sku_id = p_sku_id
  ORDER BY ol.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That product is not on this order';
  END IF;
  IF p_quantity > v_line.quantity THEN
    RAISE EXCEPTION 'Quantity cannot be more than the order line';
  END IF;

  SELECT trade_name INTO v_shop_name FROM public.shops WHERE id = v_order.shop_id;

  INSERT INTO public.salesman_return_requests (
    salesman_profile_id, shop_id, shop_name, order_id, sku_id,
    product_name, sku_name, sku_code, quantity, reason, note
  ) VALUES (
    v_uid, v_order.shop_id, COALESCE(v_shop_name, 'Shop'), p_order_id, p_sku_id,
    v_line.product_name_snapshot, v_line.sku_name_snapshot, v_line.sku_code_snapshot,
    p_quantity, v_reason, v_note
  )
  RETURNING * INTO v_row;

  RETURN public._salesman_return_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_set_return_photo(
  p_request_id uuid,
  p_photo_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_path text := v_uid::text || '/returns/' || p_request_id::text;
  v_row public.salesman_return_requests;
BEGIN
  IF p_photo_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION 'Photo path is not allowed';
  END IF;

  UPDATE public.salesman_return_requests
  SET photo_path = v_path
  WHERE id = p_request_id
    AND salesman_profile_id = v_uid
    AND status = 'PENDING'::public.salesman_claim_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a pending request of yours can have a photo';
  END IF;
  RETURN public._salesman_return_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_return_request(
  p_request_id uuid,
  p_status text,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.salesman_claim_status;
  v_note text;
  v_row public.salesman_return_requests;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  BEGIN
    v_status := upper(btrim(COALESCE(p_status, '')))::public.salesman_claim_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Choose approved or rejected';
  END;
  IF v_status NOT IN (
    'APPROVED'::public.salesman_claim_status,
    'REJECTED'::public.salesman_claim_status
  ) THEN
    RAISE EXCEPTION 'Choose approved or rejected';
  END IF;
  v_note := NULLIF(btrim(COALESCE(p_review_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or less';
  END IF;

  UPDATE public.salesman_return_requests
  SET status = v_status,
      review_note = v_note,
      reviewed_by_profile_id = auth.uid(),
      reviewed_at = now()
  WHERE id = p_request_id
    AND status = 'PENDING'::public.salesman_claim_status
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a pending request can be reviewed';
  END IF;
  RETURN public._salesman_return_json(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_create_expense(text, numeric, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_update_pending_expense(uuid, text, numeric, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_set_expense_receipt(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_salesman_expense(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_create_return_request(uuid, uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_set_return_photo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_return_request(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.salesman_create_expense(text, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_update_pending_expense(uuid, text, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_set_expense_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_salesman_expense(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_create_return_request(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_set_return_photo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_return_request(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_review_salesman_expense(uuid, text, text) IS
  'Admin approves or rejects a pending expense. Does not create a payment.';
COMMENT ON FUNCTION public.admin_review_return_request(uuid, text, text) IS
  'Admin approves or rejects a pending return/damage request. Does not change inventory, sales, payments, or commission.';
