-- Sprint 4 / 0017: soft-delete support (deleted_at) alongside existing is_active flags.
-- Soft delete sets deleted_at; list/search queries exclude deleted rows.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.delivery_routes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.service_areas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.operational_locations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS categories_not_deleted_idx
  ON public.categories (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_not_deleted_idx
  ON public.products (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS skus_not_deleted_idx
  ON public.skus (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS shops_not_deleted_idx
  ON public.shops (id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.categories.deleted_at IS
  'Soft-delete timestamp. NULL means active row for admin CRUD.';
