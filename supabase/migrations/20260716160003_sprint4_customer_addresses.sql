-- Sprint 4 / 0019: customer_addresses (shops = customers entity).

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Delivery',
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pin_code text NOT NULL,
  lat double precision,
  lng double precision,
  is_default boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_label_not_blank CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT customer_addresses_address_not_blank CHECK (char_length(btrim(address_line)) > 0),
  CONSTRAINT customer_addresses_pin_code_format CHECK (pin_code ~ '^[0-9]{6}$'),
  CONSTRAINT customer_addresses_lat_range CHECK (
    lat IS NULL OR (lat >= -90 AND lat <= 90)
  ),
  CONSTRAINT customer_addresses_lng_range CHECK (
    lng IS NULL OR (lng >= -180 AND lng <= 180)
  )
);

CREATE INDEX customer_addresses_shop_idx
  ON public.customer_addresses (shop_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX customer_addresses_one_default_per_shop
  ON public.customer_addresses (shop_id)
  WHERE is_default AND deleted_at IS NULL;

CREATE TRIGGER trg_customer_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.customer_addresses IS
  'Additional / historical delivery addresses for a shop (customer). '
  'shops.delivery_* remains the primary operational address.';

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
