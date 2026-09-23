-- Commission foundation: earning model + SKU commission terms + ledger.
-- Schema/constraints/RLS only. Does NOT accrue commission or change sale conversion.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.salesman_earning_model AS ENUM (
    'SALARY',
    'COMMISSION',
    'SALARY_PLUS_COMMISSION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.salesman_commission_entry_status AS ENUM (
    'EARNED',
    'REVERSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── PART 1: earning model on salesman_employment ────────────────────────────
-- Default SALARY so existing employment rows + admin_upsert_salesman_employment
-- continue unchanged (RPC does not need to set this column).

ALTER TABLE public.salesman_employment
  ADD COLUMN IF NOT EXISTS earning_model public.salesman_earning_model
    NOT NULL DEFAULT 'SALARY'::public.salesman_earning_model;

COMMENT ON COLUMN public.salesman_employment.earning_model IS
  'How the salesman is paid: SALARY, COMMISSION, or SALARY_PLUS_COMMISSION. Salary amounts stay on salesman_salary_terms.';

-- ─── PART 2: sku_commission_terms (append-only) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.sku_commission_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE CASCADE,
  fixed_amount_per_unit numeric(12, 2) NOT NULL
    CHECK (fixed_amount_per_unit >= 0),
  effective_from date NOT NULL,
  effective_to date,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_commission_terms_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

-- One open (active) term per SKU — same convention as sku_prices / salary terms.
CREATE UNIQUE INDEX IF NOT EXISTS sku_commission_terms_one_open_per_sku
  ON public.sku_commission_terms (sku_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS sku_commission_terms_sku_from_idx
  ON public.sku_commission_terms (sku_id, effective_from DESC);

COMMENT ON TABLE public.sku_commission_terms IS
  'Append-only fixed ₹-per-selling-unit commission for a SKU. Not stored on sku_prices.';

-- ─── PART 3: salesman_commission_entries (ledger) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.salesman_commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE RESTRICT,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items (id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  sku_id uuid REFERENCES public.skus (id) ON DELETE SET NULL,
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_commission numeric(12, 2) NOT NULL CHECK (unit_commission >= 0),
  commission_amount numeric(12, 2) NOT NULL CHECK (commission_amount >= 0),
  status public.salesman_commission_entry_status NOT NULL
    DEFAULT 'EARNED'::public.salesman_commission_entry_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_of_entry_id uuid REFERENCES public.salesman_commission_entries (id) ON DELETE SET NULL,
  CONSTRAINT salesman_commission_entries_amount_matches CHECK (
    commission_amount = round(quantity * unit_commission, 2)
  ),
  CONSTRAINT salesman_commission_entries_reversal_consistency CHECK (
    (
      status = 'EARNED'::public.salesman_commission_entry_status
      AND reversed_at IS NULL
    )
    OR (
      status = 'REVERSED'::public.salesman_commission_entry_status
      AND reversed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS salesman_commission_entries_salesman_idx
  ON public.salesman_commission_entries (salesman_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS salesman_commission_entries_sale_idx
  ON public.salesman_commission_entries (sale_id);

CREATE INDEX IF NOT EXISTS salesman_commission_entries_order_idx
  ON public.salesman_commission_entries (order_id);

CREATE INDEX IF NOT EXISTS salesman_commission_entries_status_idx
  ON public.salesman_commission_entries (status);

COMMENT ON TABLE public.salesman_commission_entries IS
  'Commission ledger. Accrual will be written by trusted convert/refund logic later — not by salesman clients.';

-- ─── RLS (match salesman payroll conventions) ────────────────────────────────

ALTER TABLE public.sku_commission_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_commission_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_commission_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sku_commission_terms_select ON public.sku_commission_terms;
CREATE POLICY sku_commission_terms_select
  ON public.sku_commission_terms
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.profile_has_role('SALESMAN'));

DROP POLICY IF EXISTS sku_commission_terms_admin_write ON public.sku_commission_terms;
CREATE POLICY sku_commission_terms_admin_write
  ON public.sku_commission_terms
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_commission_entries_select ON public.salesman_commission_entries;
CREATE POLICY salesman_commission_entries_select
  ON public.salesman_commission_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR salesman_profile_id = auth.uid()
  );

-- Writes intended for SECURITY DEFINER / service_role later; admin may correct.
DROP POLICY IF EXISTS salesman_commission_entries_admin_write ON public.salesman_commission_entries;
CREATE POLICY salesman_commission_entries_admin_write
  ON public.salesman_commission_entries
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.sku_commission_terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sku_commission_terms TO authenticated;
GRANT SELECT ON public.salesman_commission_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_commission_entries TO authenticated;

GRANT ALL ON public.sku_commission_terms TO service_role;
GRANT ALL ON public.salesman_commission_entries TO service_role;
