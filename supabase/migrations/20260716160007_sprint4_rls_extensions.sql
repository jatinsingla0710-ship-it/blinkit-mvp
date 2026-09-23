-- Sprint 4 / 0023: RLS for new tables + READ_ONLY select grants on catalogue/ops reads.

CREATE OR REPLACE FUNCTION public.is_read_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_has_role('READ_ONLY');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_read_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_read_only();
$$;

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------

CREATE POLICY product_images_select_visible
  ON public.product_images
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.is_admin_or_read_only()
      OR public.profile_has_role('SALESMAN')
      OR public.profile_has_role('CUSTOMER')
      OR public.profile_has_role('DELIVERY')
    )
  );

CREATE POLICY product_images_admin_write
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- customer_addresses
-- ---------------------------------------------------------------------------

CREATE POLICY customer_addresses_select
  ON public.customer_addresses
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.is_admin_or_read_only()
      OR public.can_read_shop(shop_id)
    )
  );

CREATE POLICY customer_addresses_admin_write
  ON public.customer_addresses
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY customer_addresses_salesman_insert
  ON public.customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_role('SALESMAN')
    AND shop_id IN (SELECT public.salesman_shop_ids())
  );

-- ---------------------------------------------------------------------------
-- settings (admin write; admin + read_only select)
-- ---------------------------------------------------------------------------

CREATE POLICY settings_select_admin_or_ro
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND public.is_admin_or_read_only());

CREATE POLICY settings_admin_write
  ON public.settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- reports_snapshot
-- ---------------------------------------------------------------------------

CREATE POLICY reports_snapshot_select_admin_or_ro
  ON public.reports_snapshot
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND public.is_admin_or_read_only());

CREATE POLICY reports_snapshot_admin_write
  ON public.reports_snapshot
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Broaden catalogue / ops SELECT for READ_ONLY (writes remain admin-only)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS categories_select_active ON public.categories;
CREATE POLICY categories_select_active
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL AND is_active)
    OR public.is_admin_or_read_only()
  );

DROP POLICY IF EXISTS products_select_active ON public.products;
CREATE POLICY products_select_active
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL AND is_active)
    OR public.is_admin_or_read_only()
  );

DROP POLICY IF EXISTS skus_select_active ON public.skus;
CREATE POLICY skus_select_active
  ON public.skus
  FOR SELECT
  TO authenticated
  USING (
    (deleted_at IS NULL AND is_active)
    OR public.is_admin_or_read_only()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports_snapshot TO authenticated;

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.inventory TO authenticated;

GRANT ALL ON public.product_images TO service_role;
GRANT ALL ON public.customer_addresses TO service_role;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.reports_snapshot TO service_role;
