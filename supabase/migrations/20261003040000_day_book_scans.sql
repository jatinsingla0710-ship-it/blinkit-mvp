-- Phase 15 foundation: daily book / rojnama scans (no AI provider yet).
-- Owner pastes or uploads lines → reviews proposed entries → confirms creates
-- only expense / supplier payment. Collections stay guided (need an order).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'day-book-scans',
  'day-book-scans',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.day_book_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADED', 'REVIEWING', 'CONFIRMED', 'DISCARDED')),
  image_path text,
  source_text text,
  extract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_label text NOT NULL DEFAULT 'manual',
  notes text,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS day_book_scans_status_idx
  ON public.day_book_scans (status, created_at DESC);

COMMENT ON TABLE public.day_book_scans IS
  'Phase 15: pasted/photographed daily book lines. Confirm posts expense/supplier payment only after owner review; collections are proposals.';

CREATE TRIGGER trg_day_book_scans_set_updated_at
  BEFORE UPDATE ON public.day_book_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.day_book_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_book_scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS day_book_scans_admin_all ON public.day_book_scans;
CREATE POLICY day_book_scans_admin_all
  ON public.day_book_scans
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_book_scans TO authenticated;
GRANT ALL ON public.day_book_scans TO service_role;

DROP POLICY IF EXISTS day_book_scans_storage_admin_all ON storage.objects;
CREATE POLICY day_book_scans_storage_admin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'day-book-scans' AND public.is_admin())
  WITH CHECK (bucket_id = 'day-book-scans' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_create_day_book_scan(
  p_source_text text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.day_book_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  INSERT INTO public.day_book_scans (
    status,
    source_text,
    notes,
    created_by_profile_id,
    extractor_label
  )
  VALUES (
    'UPLOADED',
    NULLIF(btrim(COALESCE(p_source_text, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_uid,
    'manual'
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'imagePath', v_row.image_path,
    'sourceText', v_row.source_text,
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label,
    'notes', v_row.notes,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_day_book_scan_image(
  p_scan_id uuid,
  p_image_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.day_book_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_scan_id IS NULL OR NULLIF(btrim(COALESCE(p_image_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'scan_id and image_path are required';
  END IF;
  IF split_part(p_image_path, '/', 1) IS DISTINCT FROM p_scan_id::text THEN
    RAISE EXCEPTION 'image_path must start with scan id folder';
  END IF;

  UPDATE public.day_book_scans
  SET
    image_path = btrim(p_image_path),
    status = CASE
      WHEN status = 'UPLOADED' THEN 'REVIEWING'
      ELSE status
    END
  WHERE id = p_scan_id
    AND status IN ('UPLOADED', 'REVIEWING')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan not found or not editable';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'imagePath', v_row.image_path,
    'sourceText', v_row.source_text,
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_day_book_scan_extract(
  p_scan_id uuid,
  p_extract_json jsonb,
  p_extractor_label text DEFAULT 'line-rules',
  p_source_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.day_book_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_scan_id IS NULL THEN
    RAISE EXCEPTION 'scan_id is required';
  END IF;

  UPDATE public.day_book_scans
  SET
    extract_json = COALESCE(p_extract_json, '{}'::jsonb),
    extractor_label = COALESCE(NULLIF(btrim(p_extractor_label), ''), 'line-rules'),
    source_text = CASE
      WHEN p_source_text IS NULL THEN source_text
      ELSE NULLIF(btrim(p_source_text), '')
    END,
    status = CASE
      WHEN status = 'UPLOADED' THEN 'REVIEWING'
      ELSE status
    END
  WHERE id = p_scan_id
    AND status IN ('UPLOADED', 'REVIEWING')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan not found or not editable';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'imagePath', v_row.image_path,
    'sourceText', v_row.source_text,
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_day_book_scan(
  p_scan_id uuid,
  p_extract_json jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.day_book_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_scan_id IS NULL THEN
    RAISE EXCEPTION 'scan_id is required';
  END IF;

  UPDATE public.day_book_scans
  SET
    extract_json = COALESCE(p_extract_json, extract_json),
    status = 'CONFIRMED',
    confirmed_at = now()
  WHERE id = p_scan_id
    AND status IN ('UPLOADED', 'REVIEWING')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan not found or already confirmed/discarded';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'extractJson', v_row.extract_json,
    'confirmedAt', v_row.confirmed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_discard_day_book_scan(
  p_scan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.day_book_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE public.day_book_scans
  SET status = 'DISCARDED'
  WHERE id = p_scan_id
    AND status IN ('UPLOADED', 'REVIEWING')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan not found or not discardable';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_day_book_scan(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_day_book_scan_image(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_day_book_scan_extract(uuid, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_day_book_scan(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_discard_day_book_scan(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_day_book_scan(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_day_book_scan_image(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_day_book_scan_extract(uuid, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_confirm_day_book_scan(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_discard_day_book_scan(uuid) TO authenticated, service_role;
