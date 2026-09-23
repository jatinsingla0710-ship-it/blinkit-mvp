-- GroAurum B2B: catalogue schema. Empty catalogue is valid — no seed products required.

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT categories_display_order_non_negative CHECK (display_order >= 0)
);

CREATE UNIQUE INDEX categories_name_unique ON public.categories (lower(btrim(name)));

CREATE TRIGGER trg_categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  -- Extensible text, not a DB enum. Launch values: PACKED, BULK.
  product_type text NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT products_product_type_not_blank CHECK (char_length(btrim(product_type)) > 0)
);

CREATE INDEX products_category_idx ON public.products (category_id);
CREATE INDEX products_product_type_idx ON public.products (product_type);
CREATE UNIQUE INDEX products_category_name_unique
  ON public.products (category_id, lower(btrim(name)));

CREATE TRIGGER trg_products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  sku_code text NOT NULL,
  name text NOT NULL,
  specification text,
  grade text,
  product_type text NOT NULL,
  -- Extensible text, not a DB enum. Launch values: CARTON, KG.
  selling_unit text NOT NULL,
  net_quantity numeric(12, 3),
  net_quantity_unit text,
  packs_per_carton integer,
  moq numeric(12, 3) NOT NULL DEFAULT 1,
  quantity_step numeric(12, 3) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skus_sku_code_not_blank CHECK (char_length(btrim(sku_code)) > 0),
  CONSTRAINT skus_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT skus_product_type_not_blank CHECK (char_length(btrim(product_type)) > 0),
  CONSTRAINT skus_selling_unit_not_blank CHECK (char_length(btrim(selling_unit)) > 0),
  CONSTRAINT skus_moq_positive CHECK (moq > 0),
  CONSTRAINT skus_quantity_step_positive CHECK (quantity_step > 0),
  CONSTRAINT skus_net_quantity_positive CHECK (net_quantity IS NULL OR net_quantity > 0),
  CONSTRAINT skus_packs_per_carton_positive CHECK (
    packs_per_carton IS NULL OR packs_per_carton > 0
  ),
  CONSTRAINT skus_packed_carton_requires_packs CHECK (
    product_type <> 'PACKED'
    OR selling_unit <> 'CARTON'
    OR packs_per_carton IS NOT NULL
  )
);

CREATE UNIQUE INDEX skus_sku_code_unique ON public.skus (lower(btrim(sku_code)));
CREATE INDEX skus_product_idx ON public.skus (product_id);
CREATE INDEX skus_selling_unit_idx ON public.skus (selling_unit);

CREATE TRIGGER trg_skus_set_updated_at
  BEFORE UPDATE ON public.skus
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sku_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus (id) ON DELETE RESTRICT,
  trade_price numeric(12, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'INR',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  recorded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sku_prices_trade_price_non_negative CHECK (trade_price >= 0),
  CONSTRAINT sku_prices_currency_uppercase CHECK (currency = upper(currency)),
  CONSTRAINT sku_prices_effective_range CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

CREATE UNIQUE INDEX sku_prices_one_open_per_sku
  ON public.sku_prices (sku_id)
  WHERE effective_to IS NULL;

CREATE INDEX sku_prices_sku_effective_idx
  ON public.sku_prices (sku_id, effective_from DESC);

COMMENT ON TABLE public.categories IS 'Product catalogue grouping. May be empty at launch.';
COMMENT ON COLUMN public.products.product_type IS 'Extensible text. Launch values: PACKED, BULK.';
COMMENT ON COLUMN public.skus.selling_unit IS 'Extensible text. Launch values: CARTON, KG.';
COMMENT ON TABLE public.sku_prices IS
  'Append-only commercial price history. Close prior row via effective_to; never mutate historical rows.';
