-- Phase 13 foundation: purchase bill photo scans (no AI provider yet).
-- Owner reviews editable extract → creates purchase DRAFT only (never auto-receive).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-bills',
  'purchase-bills',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.purchase_bill_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADED', 'REVIEWING', 'CONFIRMED', 'DISCARDED')),
  image_path text,
  extract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_label text NOT NULL DEFAULT 'manual',
  purchase_id uuid REFERENCES public.purchases (id) ON DELETE SET NULL,
  notes text,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT purchase_bill_scans_confirmed_has_purchase CHECK (
    status <> 'CONFIRMED'
    OR purchase_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS purchase_bill_scans_status_idx
  ON public.purchase_bill_scans (status, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_bill_scans_purchase_idx
  ON public.purchase_bill_scans (purchase_id)
  WHERE purchase_id IS NOT NULL;

COMMENT ON TABLE public.purchase_bill_scans IS
  'Phase 13: bill photo + optional extract JSON. Confirm creates a purchase draft only; never receives stock.';

CREATE TRIGGER trg_purchase_bill_scans_set_updated_at
  BEFORE UPDATE ON public.purchase_bill_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.purchase_bill_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bill_scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_bill_scans_admin_all ON public.purchase_bill_scans;
CREATE POLICY purchase_bill_scans_admin_all
  ON public.purchase_bill_scans
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_bill_scans TO authenticated;
GRANT ALL ON public.purchase_bill_scans TO service_role;

DROP POLICY IF EXISTS purchase_bills_admin_all ON storage.objects;
CREATE POLICY purchase_bills_admin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'purchase-bills' AND public.is_admin())
  WITH CHECK (bucket_id = 'purchase-bills' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_create_purchase_bill_scan(
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.purchase_bill_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  INSERT INTO public.purchase_bill_scans (
    status,
    notes,
    created_by_profile_id,
    extractor_label
  )
  VALUES (
    'UPLOADED',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_uid,
    'manual'
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'imagePath', v_row.image_path,
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label,
    'purchaseId', v_row.purchase_id,
    'notes', v_row.notes,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_purchase_bill_scan_image(
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
  v_row public.purchase_bill_scans%ROWTYPE;
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

  UPDATE public.purchase_bill_scans
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
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label,
    'purchaseId', v_row.purchase_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_purchase_bill_scan_extract(
  p_scan_id uuid,
  p_extract_json jsonb,
  p_extractor_label text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.purchase_bill_scans%ROWTYPE;
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

  UPDATE public.purchase_bill_scans
  SET
    extract_json = COALESCE(p_extract_json, '{}'::jsonb),
    extractor_label = COALESCE(NULLIF(btrim(p_extractor_label), ''), 'manual'),
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
    'extractJson', v_row.extract_json,
    'extractorLabel', v_row.extractor_label,
    'purchaseId', v_row.purchase_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_purchase_bill_scan(
  p_scan_id uuid,
  p_purchase_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.purchase_bill_scans%ROWTYPE;
  v_purchase public.purchases%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_scan_id IS NULL OR p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'scan_id and purchase_id are required';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_purchase.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Purchase must be DRAFT when linking a bill scan';
  END IF;

  UPDATE public.purchase_bill_scans
  SET
    purchase_id = p_purchase_id,
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
    'purchaseId', v_row.purchase_id,
    'confirmedAt', v_row.confirmed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_discard_purchase_bill_scan(
  p_scan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.purchase_bill_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE public.purchase_bill_scans
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

REVOKE ALL ON FUNCTION public.admin_create_purchase_bill_scan(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_purchase_bill_scan_image(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_purchase_bill_scan_extract(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_purchase_bill_scan(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_discard_purchase_bill_scan(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_purchase_bill_scan(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_purchase_bill_scan_image(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_purchase_bill_scan_extract(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_confirm_purchase_bill_scan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_discard_purchase_bill_scan(uuid) TO authenticated, service_role;
