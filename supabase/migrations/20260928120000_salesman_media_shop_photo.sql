-- Private shop photos for the Sales PWA.
-- salesman-media did not exist (only the public product-media bucket).
-- Object path: {auth.uid}/{shop_id}/shop
-- No shops column: the path is deterministic, so replace is an upsert.
-- Does not change orders, payments, commission, inventory, or product-media.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salesman-media',
  'salesman-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
    AND CASE
      WHEN (storage.foldername(p_name))[2]
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (storage.foldername(p_name))[2]::uuid IN (SELECT public.salesman_shop_ids())
      ELSE false
    END;
$$;

REVOKE ALL ON FUNCTION public.salesman_media_object_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_media_object_allowed(text) TO authenticated;

DROP POLICY IF EXISTS salesman_media_salesman_select ON storage.objects;
CREATE POLICY salesman_media_salesman_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_allowed(name)
  );

DROP POLICY IF EXISTS salesman_media_salesman_insert ON storage.objects;
CREATE POLICY salesman_media_salesman_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_allowed(name)
  );

DROP POLICY IF EXISTS salesman_media_salesman_update ON storage.objects;
CREATE POLICY salesman_media_salesman_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_allowed(name)
  )
  WITH CHECK (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_allowed(name)
  );

DROP POLICY IF EXISTS salesman_media_salesman_delete ON storage.objects;
CREATE POLICY salesman_media_salesman_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'salesman-media'
    AND public.salesman_media_object_allowed(name)
  );

DROP POLICY IF EXISTS salesman_media_admin_all ON storage.objects;
CREATE POLICY salesman_media_admin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'salesman-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'salesman-media' AND public.is_admin());
