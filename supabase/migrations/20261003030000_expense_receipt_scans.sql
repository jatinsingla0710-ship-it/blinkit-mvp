-- Phase 14 foundation: expense receipt photo scans (no AI provider yet).
-- Owner reviews editable extract → creates company expense only after confirm.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.expense_receipt_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADED', 'REVIEWING', 'CONFIRMED', 'DISCARDED')),
  image_path text,
  extract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_label text NOT NULL DEFAULT 'manual',
  expense_id uuid REFERENCES public.company_expenses (id) ON DELETE SET NULL,
  notes text,
  created_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT expense_receipt_scans_confirmed_has_expense CHECK (
    status <> 'CONFIRMED'
    OR expense_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS expense_receipt_scans_status_idx
  ON public.expense_receipt_scans (status, created_at DESC);

CREATE INDEX IF NOT EXISTS expense_receipt_scans_expense_idx
  ON public.expense_receipt_scans (expense_id)
  WHERE expense_id IS NOT NULL;

COMMENT ON TABLE public.expense_receipt_scans IS
  'Phase 14: receipt photo + optional extract JSON. Confirm creates a company expense only after owner review.';

CREATE TRIGGER trg_expense_receipt_scans_set_updated_at
  BEFORE UPDATE ON public.expense_receipt_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expense_receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipt_scans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_receipt_scans_admin_all ON public.expense_receipt_scans;
CREATE POLICY expense_receipt_scans_admin_all
  ON public.expense_receipt_scans
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_receipt_scans TO authenticated;
GRANT ALL ON public.expense_receipt_scans TO service_role;

DROP POLICY IF EXISTS expense_receipts_admin_all ON storage.objects;
CREATE POLICY expense_receipts_admin_all
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'expense-receipts' AND public.is_admin())
  WITH CHECK (bucket_id = 'expense-receipts' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_create_expense_receipt_scan(
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.expense_receipt_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  INSERT INTO public.expense_receipt_scans (
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
    'expenseId', v_row.expense_id,
    'notes', v_row.notes,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_expense_receipt_scan_image(
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
  v_row public.expense_receipt_scans%ROWTYPE;
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

  UPDATE public.expense_receipt_scans
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
    'expenseId', v_row.expense_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_expense_receipt_scan_extract(
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
  v_row public.expense_receipt_scans%ROWTYPE;
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

  UPDATE public.expense_receipt_scans
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
    'expenseId', v_row.expense_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_expense_receipt_scan(
  p_scan_id uuid,
  p_expense_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.expense_receipt_scans%ROWTYPE;
  v_expense public.company_expenses%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF p_scan_id IS NULL OR p_expense_id IS NULL THEN
    RAISE EXCEPTION 'scan_id and expense_id are required';
  END IF;

  SELECT * INTO v_expense
  FROM public.company_expenses
  WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  UPDATE public.expense_receipt_scans
  SET
    expense_id = p_expense_id,
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
    'expenseId', v_row.expense_id,
    'confirmedAt', v_row.confirmed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_discard_expense_receipt_scan(
  p_scan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.expense_receipt_scans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE public.expense_receipt_scans
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

REVOKE ALL ON FUNCTION public.admin_create_expense_receipt_scan(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_expense_receipt_scan_image(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_expense_receipt_scan_extract(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_expense_receipt_scan(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_discard_expense_receipt_scan(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_create_expense_receipt_scan(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_expense_receipt_scan_image(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_expense_receipt_scan_extract(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_confirm_expense_receipt_scan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_discard_expense_receipt_scan(uuid) TO authenticated, service_role;
