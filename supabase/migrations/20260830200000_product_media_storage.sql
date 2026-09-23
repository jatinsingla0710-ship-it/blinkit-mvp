-- Product media: images (max 4) + video (max 1) via product_images + Storage.
-- Reuses product_images; does NOT store binary in DB rows.
-- products.image_urls remains a synced convenience array (cover = first image).

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'IMAGE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_media_kind_check'
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_media_kind_check
      CHECK (media_kind IN ('IMAGE', 'VIDEO'));
  END IF;
END $$;

COMMENT ON COLUMN public.product_images.media_kind IS
  'IMAGE (max 4 per product) or VIDEO (max 1 per product). URLs point to Storage.';

-- One primary among images only (video is never primary cover).
DROP INDEX IF EXISTS public.product_images_one_primary_per_product;
CREATE UNIQUE INDEX product_images_one_primary_per_product
  ON public.product_images (product_id)
  WHERE is_primary AND deleted_at IS NULL AND media_kind = 'IMAGE';

CREATE OR REPLACE FUNCTION public._enforce_product_media_limits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_images integer;
  v_videos integer;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.media_kind = 'VIDEO' AND NEW.is_primary THEN
    RAISE EXCEPTION 'Video cannot be the cover/primary product image';
  END IF;

  SELECT
    count(*) FILTER (WHERE media_kind = 'IMAGE' AND deleted_at IS NULL),
    count(*) FILTER (WHERE media_kind = 'VIDEO' AND deleted_at IS NULL)
  INTO v_images, v_videos
  FROM public.product_images
  WHERE product_id = NEW.product_id
    AND (TG_OP = 'INSERT' OR id IS DISTINCT FROM NEW.id);

  IF NEW.media_kind = 'IMAGE' THEN
    v_images := v_images + 1;
  ELSIF NEW.media_kind = 'VIDEO' THEN
    v_videos := v_videos + 1;
  END IF;

  IF v_images > 4 THEN
    RAISE EXCEPTION 'Maximum 4 product images allowed';
  END IF;
  IF v_videos > 1 THEN
    RAISE EXCEPTION 'Maximum 1 product video allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_media_limits ON public.product_images;
CREATE TRIGGER trg_product_images_media_limits
  BEFORE INSERT OR UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public._enforce_product_media_limits();

-- Sync products.image_urls from active IMAGE rows (display_order, primary first).
CREATE OR REPLACE FUNCTION public.sync_product_image_urls(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_urls text[];
BEGIN
  SELECT coalesce(array_agg(url ORDER BY
    CASE WHEN is_primary THEN 0 ELSE 1 END,
    display_order ASC,
    created_at ASC
  ), '{}'::text[])
  INTO v_urls
  FROM public.product_images
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
    AND media_kind = 'IMAGE';

  UPDATE public.products
  SET image_urls = v_urls,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_sync_product_image_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_product_image_urls(
    coalesce(NEW.product_id, OLD.product_id)
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_sync_urls ON public.product_images;
CREATE TRIGGER trg_product_images_sync_urls
  AFTER INSERT OR UPDATE OR DELETE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_sync_product_image_urls();

-- Reorder + set cover (Admin). Soft-deletes ignored.
CREATE OR REPLACE FUNCTION public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_ord integer := 0;
  v_first uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF p_image_ids IS NULL OR cardinality(p_image_ids) = 0 THEN
    RAISE EXCEPTION 'image ids required';
  END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  FOREACH v_id IN ARRAY p_image_ids
  LOOP
    UPDATE public.product_images
    SET display_order = v_ord,
        is_primary = false,
        updated_at = now()
    WHERE id = v_id
      AND product_id = p_product_id
      AND media_kind = 'IMAGE'
      AND deleted_at IS NULL;
    v_ord := v_ord + 1;
  END LOOP;

  v_first := p_image_ids[1];
  UPDATE public.product_images
  SET is_primary = true,
      updated_at = now()
  WHERE id = v_first
    AND product_id = p_product_id
    AND media_kind = 'IMAGE'
    AND deleted_at IS NULL;

  PERFORM public.sync_product_image_urls(p_product_id);

  RETURN jsonb_build_object(
    'productId', p_product_id,
    'coverImageId', v_first,
    'count', cardinality(p_image_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reorder_product_images(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reorder_product_images(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_product_media(p_media_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.product_images%ROWTYPE;
  v_next uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;

  PERFORM set_config('groaurum.trusted_server_action', 'true', true);

  SELECT * INTO v_row FROM public.product_images WHERE id = p_media_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Media not found'; END IF;

  UPDATE public.product_images
  SET deleted_at = now(),
      is_primary = false,
      updated_at = now()
  WHERE id = p_media_id;

  IF v_row.media_kind = 'IMAGE' THEN
    SELECT id INTO v_next
    FROM public.product_images
    WHERE product_id = v_row.product_id
      AND media_kind = 'IMAGE'
      AND deleted_at IS NULL
    ORDER BY display_order ASC, created_at ASC
    LIMIT 1;

    IF v_next IS NOT NULL THEN
      UPDATE public.product_images
      SET is_primary = true, updated_at = now()
      WHERE id = v_next;
    END IF;
  END IF;

  PERFORM public.sync_product_image_urls(v_row.product_id);

  RETURN jsonb_build_object(
    'mediaId', p_media_id,
    'productId', v_row.product_id,
    'mediaKind', v_row.media_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_soft_delete_product_media(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_product_media(uuid) TO authenticated;

-- Public Storage bucket for product media (URLs stored in product_images.url).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800, -- 50 MB (video); images validated client-side to ≤5 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS product_media_public_read ON storage.objects;
CREATE POLICY product_media_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS product_media_admin_insert ON storage.objects;
CREATE POLICY product_media_admin_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS product_media_admin_update ON storage.objects;
CREATE POLICY product_media_admin_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-media' AND public.is_admin());

DROP POLICY IF EXISTS product_media_admin_delete ON storage.objects;
CREATE POLICY product_media_admin_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-media' AND public.is_admin());
