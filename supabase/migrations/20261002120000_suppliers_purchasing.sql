-- Phase 5A: Suppliers + Purchasing + purchase-to-inventory RECEIPT foundation.
-- Reuses inventory_balances, inventory_movements (RECEIPT), operational_locations, skus.
-- Does NOT create a second inventory system, Day Book entries, supplier ledger, or COGS.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.purchase_status AS ENUM (
    'DRAFT',
    'RECEIVED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Suppliers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  mobile text,
  email extensions.citext,
  address_line text,
  city text,
  state text,
  gstin text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT suppliers_name_length CHECK (char_length(btrim(name)) <= 200),
  CONSTRAINT suppliers_contact_person_length CHECK (
    contact_person IS NULL OR char_length(btrim(contact_person)) BETWEEN 1 AND 120
  ),
  CONSTRAINT suppliers_mobile_normalized CHECK (
    mobile IS NULL OR mobile = public.normalize_mobile(mobile)
  ),
  CONSTRAINT suppliers_gstin_length CHECK (
    gstin IS NULL OR char_length(btrim(gstin)) BETWEEN 1 AND 20
  ),
  CONSTRAINT suppliers_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 1000
  ),
  CONSTRAINT suppliers_address_length CHECK (
    address_line IS NULL OR char_length(btrim(address_line)) BETWEEN 1 AND 300
  ),
  CONSTRAINT suppliers_city_length CHECK (
    city IS NULL OR char_length(btrim(city)) BETWEEN 1 AND 80
  ),
  CONSTRAINT suppliers_state_length CHECK (
    state IS NULL OR char_length(btrim(state)) BETWEEN 1 AND 80
  )
);

CREATE INDEX IF NOT EXISTS suppliers_name_idx
  ON public.suppliers (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS suppliers_active_idx
  ON public.suppliers (is_active, updated_at DESC);

DROP TRIGGER IF EXISTS trg_suppliers_set_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.suppliers IS
  'Phase 5A supplier master for purchasing. No supplier login/app/ledger.';

-- ─── Purchases ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  operational_location_id uuid NOT NULL
    REFERENCES public.operational_locations (id) ON DELETE RESTRICT,
  purchase_date date NOT NULL,
  bill_number text NOT NULL,
  status public.purchase_status NOT NULL DEFAULT 'DRAFT',
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  received_at timestamptz,
  received_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_bill_number_not_blank CHECK (
    char_length(btrim(bill_number)) > 0
  ),
  CONSTRAINT purchases_bill_number_length CHECK (
    char_length(btrim(bill_number)) <= 80
  ),
  CONSTRAINT purchases_amounts_non_negative CHECK (
    subtotal >= 0 AND tax_amount >= 0 AND total >= 0
  ),
  CONSTRAINT purchases_total_matches CHECK (
    total = round(subtotal + tax_amount, 2)
  ),
  CONSTRAINT purchases_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 1000
  ),
  CONSTRAINT purchases_received_state CHECK (
    (
      status = 'RECEIVED'::public.purchase_status
      AND received_at IS NOT NULL
    )
    OR (
      status <> 'RECEIVED'::public.purchase_status
      AND received_at IS NULL
      AND received_by_profile_id IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS purchases_supplier_bill_unique
  ON public.purchases (supplier_id, lower(btrim(bill_number)))
  WHERE status <> 'CANCELLED'::public.purchase_status;

CREATE INDEX IF NOT EXISTS purchases_date_idx
  ON public.purchases (purchase_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS purchases_supplier_idx
  ON public.purchases (supplier_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS purchases_status_idx
  ON public.purchases (status, purchase_date DESC);

CREATE INDEX IF NOT EXISTS purchases_location_idx
  ON public.purchases (operational_location_id);

DROP TRIGGER IF EXISTS trg_purchases_set_updated_at ON public.purchases;
CREATE TRIGGER trg_purchases_set_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.purchases IS
  'Phase 5A purchase bills. RECEIVED locks stock history; no Day Book entry (credit purchase).';

-- ─── Purchase items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  quantity numeric(12, 3) NOT NULL,
  unit_cost numeric(12, 2) NOT NULL,
  line_total numeric(12, 2) NOT NULL,
  product_name text NOT NULL,
  sku_code text NOT NULL,
  sku_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT purchase_items_line_total_non_negative CHECK (line_total >= 0),
  CONSTRAINT purchase_items_line_total_matches CHECK (
    line_total = round(quantity * unit_cost, 2)
  ),
  CONSTRAINT purchase_items_product_name_not_blank CHECK (
    char_length(btrim(product_name)) > 0
  ),
  CONSTRAINT purchase_items_sku_code_not_blank CHECK (
    char_length(btrim(sku_code)) > 0
  ),
  CONSTRAINT purchase_items_sku_name_not_blank CHECK (
    char_length(btrim(sku_name)) > 0
  )
);

CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx
  ON public.purchase_items (purchase_id);

CREATE INDEX IF NOT EXISTS purchase_items_sku_idx
  ON public.purchase_items (sku_id);

COMMENT ON TABLE public.purchase_items IS
  'Purchase lines with purchase-time unit_cost. Snapshots product/SKU labels; FK to skus.';

-- Idempotent RECEIPT movements: one movement per purchase line.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_purchase_item_receipt_unique
  ON public.inventory_movements (reference_id)
  WHERE reference_type = 'purchase_item'
    AND movement_type = 'RECEIPT'::public.inventory_movement_type;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_admin_select ON public.suppliers;
CREATE POLICY suppliers_admin_select
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS suppliers_admin_write ON public.suppliers;
CREATE POLICY suppliers_admin_write
  ON public.suppliers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchases_admin_select ON public.purchases;
CREATE POLICY purchases_admin_select
  ON public.purchases
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchases_admin_write ON public.purchases;
CREATE POLICY purchases_admin_write
  ON public.purchases
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_items_admin_select ON public.purchase_items;
CREATE POLICY purchase_items_admin_select
  ON public.purchase_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS purchase_items_admin_write ON public.purchase_items;
CREATE POLICY purchase_items_admin_write
  ON public.purchase_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
GRANT ALL ON public.purchases TO service_role;
GRANT ALL ON public.purchase_items TO service_role;

-- ─── Supplier RPCs ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_supplier(
  p_name text,
  p_contact_person text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_gstin text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.suppliers;
  v_name text := btrim(coalesce(p_name, ''));
  v_mobile text := NULLIF(btrim(coalesce(p_mobile, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create suppliers' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) < 1 OR char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'Supplier name is required (max 200 characters)'
      USING ERRCODE = '22023';
  END IF;

  IF v_mobile IS NOT NULL THEN
    v_mobile := public.normalize_mobile(v_mobile);
  END IF;

  INSERT INTO public.suppliers (
    name,
    contact_person,
    mobile,
    email,
    address_line,
    city,
    state,
    gstin,
    notes,
    is_active,
    created_by_profile_id
  )
  VALUES (
    v_name,
    NULLIF(btrim(coalesce(p_contact_person, '')), ''),
    v_mobile,
    NULLIF(btrim(coalesce(p_email, '')), ''),
    NULLIF(btrim(coalesce(p_address_line, '')), ''),
    NULLIF(btrim(coalesce(p_city, '')), ''),
    NULLIF(btrim(coalesce(p_state, '')), ''),
    NULLIF(btrim(coalesce(p_gstin, '')), ''),
    NULLIF(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_is_active, true),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_supplier(
  p_supplier_id uuid,
  p_name text,
  p_contact_person text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_gstin text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.suppliers;
  v_name text := btrim(coalesce(p_name, ''));
  v_mobile text := NULLIF(btrim(coalesce(p_mobile, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update suppliers' USING ERRCODE = '42501';
  END IF;

  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier id is required' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) < 1 OR char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'Supplier name is required (max 200 characters)'
      USING ERRCODE = '22023';
  END IF;

  IF v_mobile IS NOT NULL THEN
    v_mobile := public.normalize_mobile(v_mobile);
  END IF;

  UPDATE public.suppliers
  SET
    name = v_name,
    contact_person = NULLIF(btrim(coalesce(p_contact_person, '')), ''),
    mobile = v_mobile,
    email = NULLIF(btrim(coalesce(p_email, '')), ''),
    address_line = NULLIF(btrim(coalesce(p_address_line, '')), ''),
    city = NULLIF(btrim(coalesce(p_city, '')), ''),
    state = NULLIF(btrim(coalesce(p_state, '')), ''),
    gstin = NULLIF(btrim(coalesce(p_gstin, '')), ''),
    notes = NULLIF(btrim(coalesce(p_notes, '')), ''),
    is_active = coalesce(p_is_active, true)
  WHERE id = p_supplier_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_supplier(
  text, text, text, text, text, text, text, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_supplier(
  text, text, text, text, text, text, text, text, text, boolean
) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_supplier(
  uuid, text, text, text, text, text, text, text, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_supplier(
  uuid, text, text, text, text, text, text, text, text, text, boolean
) TO authenticated;

-- ─── Purchase draft upsert ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_upsert_purchase_draft(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_operational_location_id uuid,
  p_purchase_date date,
  p_bill_number text,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
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
  v_bill text := btrim(coalesce(p_bill_number, ''));
  v_item_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage purchases' USING ERRCODE = '42501';
  END IF;

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

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one purchase item is required'
      USING ERRCODE = '22023';
  END IF;

  -- Validate + total items first
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
  uuid, uuid, uuid, date, text, numeric, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_purchase_draft(
  uuid, uuid, uuid, date, text, numeric, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.admin_upsert_purchase_draft IS
  'Create or replace a DRAFT purchase and its lines. RECEIVED purchases are locked.';

-- ─── Cancel draft (optional safety) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_cancel_purchase_draft(p_purchase_id uuid)
RETURNS public.purchases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can cancel purchases' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_purchase.status <> 'DRAFT'::public.purchase_status THEN
    RAISE EXCEPTION 'Only draft purchases can be cancelled'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.purchases
  SET status = 'CANCELLED'::public.purchase_status
  WHERE id = p_purchase_id
  RETURNING * INTO v_purchase;

  RETURN v_purchase;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_purchase_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_purchase_draft(uuid) TO authenticated;

-- ─── Receive purchase → inventory RECEIPT ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_receive_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases;
  v_item public.purchase_items%ROWTYPE;
  v_balance public.inventory_balances%ROWTYPE;
  v_actor uuid := auth.uid();
  v_movements integer := 0;
  v_qty_total numeric(12, 3) := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can receive purchases' USING ERRCODE = '42501';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already received → return success without adding stock again.
  IF v_purchase.status = 'RECEIVED'::public.purchase_status THEN
    RETURN jsonb_build_object(
      'purchaseId', v_purchase.id,
      'status', v_purchase.status,
      'alreadyReceived', true,
      'movementCount', 0,
      'totalQuantity', 0
    );
  END IF;

  IF v_purchase.status <> 'DRAFT'::public.purchase_status THEN
    RAISE EXCEPTION 'Only draft purchases can be received'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_items pi WHERE pi.purchase_id = p_purchase_id
  ) THEN
    RAISE EXCEPTION 'Purchase has no items' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.operational_locations ol
    WHERE ol.id = v_purchase.operational_location_id
      AND ol.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_item IN
    SELECT *
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id
    ORDER BY created_at ASC, id ASC
  LOOP
    -- Ensure balance row exists
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE sku_id = v_item.sku_id
      AND operational_location_id = v_purchase.operational_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.inventory_balances (
        sku_id,
        operational_location_id,
        on_hand_quantity,
        reserved_quantity
      )
      VALUES (
        v_item.sku_id,
        v_purchase.operational_location_id,
        0,
        0
      )
      RETURNING * INTO v_balance;

      -- Re-lock
      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE id = v_balance.id
      FOR UPDATE;
    END IF;

    UPDATE public.inventory_balances
    SET on_hand_quantity = on_hand_quantity + v_item.quantity
    WHERE id = v_balance.id
    RETURNING * INTO v_balance;

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
      v_purchase.operational_location_id,
      'RECEIPT'::public.inventory_movement_type,
      v_item.quantity,
      format(
        'Purchase bill %s · cost %s',
        v_purchase.bill_number,
        v_item.unit_cost::text
      ),
      'purchase_item',
      v_item.id,
      v_actor
    );

    v_movements := v_movements + 1;
    v_qty_total := v_qty_total + v_item.quantity;
  END LOOP;

  UPDATE public.purchases
  SET
    status = 'RECEIVED'::public.purchase_status,
    received_at = now(),
    received_by_profile_id = v_actor
  WHERE id = p_purchase_id
  RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'purchaseId', v_purchase.id,
    'status', v_purchase.status,
    'alreadyReceived', false,
    'movementCount', v_movements,
    'totalQuantity', v_qty_total,
    'receivedAt', v_purchase.received_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_receive_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_receive_purchase(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_receive_purchase IS
  'Atomically marks DRAFT purchase RECEIVED and writes inventory RECEIPT movements '
  'per purchase_item (reference_type=purchase_item). Idempotent on retry.';
