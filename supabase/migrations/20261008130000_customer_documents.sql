-- Phase 4B: private customer bill photo / document attachments.
-- Mirrors purchase-bills private admin scan architecture.
-- No OCR. No UI. No public URLs. Never use product-media.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  document_type text NOT NULL DEFAULT 'BILL_PHOTO'
    CHECK (document_type IN ('BILL_PHOTO', 'GST', 'OTHER')),
  storage_path text,
  mime_type text,
  byte_size bigint,
  title text,
  notes text,
  bill_date date,
  bill_number text,
  ocr_status text NOT NULL DEFAULT 'NONE'
    CHECK (ocr_status IN ('NONE', 'PENDING', 'DONE', 'FAILED')),
  extract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customer_documents_mime_allowed CHECK (
    mime_type IS NULL
    OR mime_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT customer_documents_byte_size_non_negative CHECK (
    byte_size IS NULL OR byte_size >= 0
  ),
  CONSTRAINT customer_documents_byte_size_max CHECK (
    byte_size IS NULL OR byte_size <= 10485760
  )
);

CREATE INDEX IF NOT EXISTS customer_documents_shop_active_idx
  ON public.customer_documents (shop_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_documents_type_idx
  ON public.customer_documents (document_type)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.customer_documents IS
  'Phase 4B: private customer bill photos / documents. Admin-only; signed URLs only; no OCR yet.';

CREATE TRIGGER trg_customer_documents_set_updated_at
  BEFORE UPDATE ON public.customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_documents_admin_all ON public.customer_documents;
CREATE POLICY customer_documents_admin_all
  ON public.customer_documents
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;

DROP POLICY IF EXISTS customer_documents_storage_admin_all ON storage.objects;
CREATE POLICY customer_documents_storage_admin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'customer-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'customer-documents' AND public.is_admin());

-- ─── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._customer_document_json(
  p_row public.customer_documents
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'shopId', p_row.shop_id,
    'documentType', p_row.document_type,
    'storagePath', p_row.storage_path,
    'mimeType', p_row.mime_type,
    'byteSize', p_row.byte_size,
    'title', p_row.title,
    'notes', p_row.notes,
    'billDate', p_row.bill_date,
    'billNumber', p_row.bill_number,
    'ocrStatus', p_row.ocr_status,
    'extractJson', p_row.extract_json,
    'uploadedByProfileId', p_row.uploaded_by_profile_id,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at,
    'deletedAt', p_row.deleted_at
  );
$$;

REVOKE ALL ON FUNCTION public._customer_document_json(public.customer_documents) FROM PUBLIC;

-- ─── admin_create_customer_document ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_customer_document(
  p_shop_id uuid,
  p_document_type text DEFAULT 'BILL_PHOTO',
  p_title text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_bill_date date DEFAULT NULL,
  p_bill_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_type text;
  v_shop_id uuid;
  v_row public.customer_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required'
      USING ERRCODE = '22023';
  END IF;

  v_type := upper(btrim(coalesce(p_document_type, 'BILL_PHOTO')));
  IF v_type NOT IN ('BILL_PHOTO', 'GST', 'OTHER') THEN
    RAISE EXCEPTION 'document_type must be BILL_PHOTO, GST, or OTHER'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_shop_id
  FROM public.shops
  WHERE id = p_shop_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  INSERT INTO public.customer_documents (
    shop_id,
    document_type,
    title,
    notes,
    bill_date,
    bill_number,
    ocr_status,
    uploaded_by_profile_id
  )
  VALUES (
    v_shop_id,
    v_type,
    nullif(btrim(coalesce(p_title, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_bill_date,
    nullif(btrim(coalesce(p_bill_number, '')), ''),
    'NONE',
    v_uid
  )
  RETURNING * INTO v_row;

  RETURN public._customer_document_json(v_row);
END;
$$;

-- ─── admin_set_customer_document_image ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_customer_document_image(
  p_document_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_path text;
  v_mime text;
  v_row public.customer_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'document_id is required'
      USING ERRCODE = '22023';
  END IF;

  v_path := nullif(btrim(coalesce(p_storage_path, '')), '');
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'storage_path is required'
      USING ERRCODE = '22023';
  END IF;
  IF split_part(v_path, '/', 1) IS DISTINCT FROM p_document_id::text THEN
    RAISE EXCEPTION 'storage_path must start with document id folder'
      USING ERRCODE = '22023';
  END IF;

  v_mime := lower(btrim(coalesce(p_mime_type, '')));
  IF v_mime NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'mime_type must be image/jpeg, image/png, or image/webp'
      USING ERRCODE = '22023';
  END IF;

  IF p_byte_size IS NULL OR p_byte_size < 0 THEN
    RAISE EXCEPTION 'byte_size is required'
      USING ERRCODE = '22023';
  END IF;
  IF p_byte_size > 10485760 THEN
    RAISE EXCEPTION 'File size cannot exceed 10 MB'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_documents
  SET
    storage_path = v_path,
    mime_type = v_mime,
    byte_size = p_byte_size,
    uploaded_by_profile_id = coalesce(uploaded_by_profile_id, v_uid)
  WHERE id = p_document_id
    AND deleted_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or deleted';
  END IF;

  RETURN public._customer_document_json(v_row);
END;
$$;

-- ─── admin_soft_delete_customer_document ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_soft_delete_customer_document(
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.customer_documents%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'document_id is required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_documents
  SET deleted_at = now()
  WHERE id = p_document_id
    AND deleted_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or already deleted';
  END IF;

  -- Storage object left in place (same as discard pattern for scans — no async cleanup).
  RETURN public._customer_document_json(v_row);
END;
$$;

-- ─── admin_list_customer_documents ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_customer_documents(
  p_shop_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_shop_id
  FROM public.shops
  WHERE id = p_shop_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(public._customer_document_json(d) ORDER BY d.created_at DESC, d.id DESC)
      FROM public.customer_documents d
      WHERE d.shop_id = v_shop_id
        AND d.deleted_at IS NULL
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_customer_document(uuid, text, text, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_customer_document_image(uuid, text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_soft_delete_customer_document(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_customer_documents(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_customer_document(uuid, text, text, text, date, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_document_image(uuid, text, text, bigint)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_customer_document(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_customer_documents(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_create_customer_document(uuid, text, text, text, date, text) IS
  'Admin creates a customer document row (no storage_path yet).';
COMMENT ON FUNCTION public.admin_set_customer_document_image(uuid, text, text, bigint) IS
  'Admin attaches a private customer-documents object; path must be {document_id}/…; MIME/size validated.';
COMMENT ON FUNCTION public.admin_soft_delete_customer_document(uuid) IS
  'Admin soft-deletes a customer document (deleted_at). Does not purge storage in v1.';
COMMENT ON FUNCTION public.admin_list_customer_documents(uuid) IS
  'Admin lists active (non-deleted) documents for one shop. Signed URLs generated in the client.';
