-- Sprint 3.4: Sales conversion schema (sales, sale_items, sales_payments, orders.sale_id).
-- Idempotent so it is safe whether Sprint 3.3 sales table exists or not.

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED',
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  discount numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'INR',
  converted_at timestamptz NOT NULL DEFAULT now(),
  converted_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoice_number_not_blank CHECK (char_length(btrim(invoice_number)) > 0),
  CONSTRAINT sales_amounts_non_negative CHECK (
    subtotal >= 0 AND discount >= 0 AND total >= 0
  )
);

-- Upgrade columns if Sprint 3.3 created a leaner sales table.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'INR';

CREATE UNIQUE INDEX IF NOT EXISTS sales_order_id_unique ON public.sales (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice_number_unique
  ON public.sales (lower(btrim(invoice_number)));
CREATE INDEX IF NOT EXISTS sales_converted_at_idx ON public.sales (converted_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sales_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_sales_set_updated_at
      BEFORE UPDATE ON public.sales
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE public.sales IS
  'Final sale / invoice created from a delivered + paid order. Line snapshots in sale_items.';

-- Snapshot lines (no live product FK required — values copied from order_lines).
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  order_line_id uuid REFERENCES public.order_lines (id) ON DELETE SET NULL,
  sku_id uuid,
  product_name text NOT NULL,
  sku_code text NOT NULL,
  sku_name text NOT NULL,
  quantity numeric(12, 3) NOT NULL,
  unit_price numeric(12, 2) NOT NULL,
  discount numeric(12, 2) NOT NULL DEFAULT 0,
  line_total numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT sale_items_amounts_non_negative CHECK (
    unit_price >= 0 AND discount >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items (sale_id);

COMMENT ON TABLE public.sale_items IS
  'Immutable line snapshot at Convert to Sale. Does not re-query catalogue prices.';

-- Payment link for the sale (usually the order payment).
CREATE TABLE IF NOT EXISTS public.sales_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PAID',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_payments_amount_non_negative CHECK (amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_payments_sale_id_unique
  ON public.sales_payments (sale_id);
CREATE INDEX IF NOT EXISTS sales_payments_payment_id_idx
  ON public.sales_payments (payment_id);

COMMENT ON TABLE public.sales_payments IS
  'Payment snapshot / link for a completed sale.';

-- Bidirectional reference: orders.sale_id ↔ sales.order_id
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sale_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sale_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_sale_id_unique
  ON public.orders (sale_id)
  WHERE sale_id IS NOT NULL;

-- RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_admin_all ON public.sales;
CREATE POLICY sales_admin_all
  ON public.sales
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS sale_items_admin_all ON public.sale_items;
CREATE POLICY sale_items_admin_all
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS sales_payments_admin_all ON public.sales_payments;
CREATE POLICY sales_payments_admin_all
  ON public.sales_payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Ensure API roles can reach new tables (matches 20260715101500 defaults).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_payments TO authenticated;
GRANT ALL ON public.sales TO service_role;
GRANT ALL ON public.sale_items TO service_role;
GRANT ALL ON public.sales_payments TO service_role;
