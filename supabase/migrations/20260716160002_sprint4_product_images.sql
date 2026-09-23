-- Sprint 4 / 0018: normalized product_images (complements products.image_urls[]).

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  display_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_images_url_not_blank CHECK (char_length(btrim(url)) > 0),
  CONSTRAINT product_images_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX product_images_product_idx
  ON public.product_images (product_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX product_images_one_primary_per_product
  ON public.product_images (product_id)
  WHERE is_primary AND deleted_at IS NULL;

CREATE TRIGGER trg_product_images_set_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.product_images IS
  'Catalogue product media. products.image_urls remains for customer-app convenience.';

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
