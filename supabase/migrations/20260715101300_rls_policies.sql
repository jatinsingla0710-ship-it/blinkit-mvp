-- GroAurum B2B: restrictive RLS policies for CUSTOMER, SALESMAN, DELIVERY, and ADMIN roles.
-- No USING (true) on sensitive tables. Trusted workflow writes use service_role or
-- set_config('groaurum.trusted_server_action', 'true', true) inside SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.profile_has_role(p_role public.staff_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active
      AND p_role = ANY (p.roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_has_role('ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.customer_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sal.shop_id
  FROM public.shop_auth_links sal
  WHERE sal.auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.salesman_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ssa.shop_id
  FROM public.shop_salesman_assignments ssa
  WHERE ssa.salesman_profile_id = auth.uid()
    AND ssa.effective_to IS NULL
  UNION
  SELECT s.id
  FROM public.shops s
  WHERE s.assigned_salesman_profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.delivery_route_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dr.id
  FROM public.delivery_routes dr
  WHERE dr.assigned_delivery_profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_read_shop(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR p_shop_id IN (SELECT public.customer_shop_ids())
    OR p_shop_id IN (SELECT public.salesman_shop_ids());
$$;

CREATE OR REPLACE FUNCTION public.can_read_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = p_order_id
        AND (
          o.shop_id IN (SELECT public.customer_shop_ids())
          OR o.shop_id IN (SELECT public.salesman_shop_ids())
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.route_stops rs
      JOIN public.delivery_routes dr ON dr.id = rs.route_id
      WHERE rs.order_id = p_order_id
        AND dr.assigned_delivery_profile_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own_display_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND roles = (SELECT p.roles FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    AND mobile = (SELECT p.mobile FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY profiles_admin_manage
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- service territory (read for authenticated staff; admin writes)
-- ---------------------------------------------------------------------------

CREATE POLICY service_areas_select_authenticated
  ON public.service_areas
  FOR SELECT
  TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY service_areas_admin_write
  ON public.service_areas
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY serviceability_rules_select_authenticated
  ON public.serviceability_rules
  FOR SELECT
  TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY serviceability_rules_admin_write
  ON public.serviceability_rules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY operational_locations_select_staff
  ON public.operational_locations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.profile_has_role('DELIVERY')
    OR public.profile_has_role('SALESMAN')
  );

CREATE POLICY operational_locations_admin_write
  ON public.operational_locations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- shops and related entities
-- ---------------------------------------------------------------------------

CREATE POLICY shops_select_scoped
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (public.can_read_shop(id));

CREATE POLICY shops_admin_write
  ON public.shops
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shop_contacts_select_scoped
  ON public.shop_contacts
  FOR SELECT
  TO authenticated
  USING (public.can_read_shop(shop_id));

CREATE POLICY shop_contacts_admin_write
  ON public.shop_contacts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shop_invitations_select_scoped
  ON public.shop_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_read_shop(shop_id)
    OR public.normalize_mobile(mobile) = (
      SELECT p.mobile FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY shop_invitations_admin_write
  ON public.shop_invitations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shop_auth_links_select_scoped
  ON public.shop_auth_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR auth_user_id = auth.uid()
    OR public.can_read_shop(shop_id)
  );

CREATE POLICY shop_auth_links_admin_write
  ON public.shop_auth_links
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shop_salesman_assignments_select_scoped
  ON public.shop_salesman_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_read_shop(shop_id)
    OR salesman_profile_id = auth.uid()
  );

CREATE POLICY shop_salesman_assignments_admin_write
  ON public.shop_salesman_assignments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- catalogue (read active catalogue; admin manages)
-- ---------------------------------------------------------------------------

CREATE POLICY categories_select_active
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY categories_admin_write
  ON public.categories
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY products_select_active
  ON public.products
  FOR SELECT
  TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY products_admin_write
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY skus_select_active
  ON public.skus
  FOR SELECT
  TO authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY skus_admin_write
  ON public.skus
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY sku_prices_select_authenticated
  ON public.sku_prices
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.profile_has_role('SALESMAN')
    OR public.profile_has_role('CUSTOMER')
  );

CREATE POLICY sku_prices_admin_insert
  ON public.sku_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- inventory (read for staff; no direct client writes)
-- ---------------------------------------------------------------------------

CREATE POLICY inventory_balances_select_staff
  ON public.inventory_balances
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.profile_has_role('SALESMAN')
    OR public.profile_has_role('DELIVERY')
  );

CREATE POLICY inventory_movements_select_admin
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY stock_reservations_select_scoped
  ON public.stock_reservations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_read_order(order_id)
  );

-- ---------------------------------------------------------------------------
-- orders and children (scoped read; no direct status/payment writes from clients)
-- ---------------------------------------------------------------------------

CREATE POLICY orders_select_scoped
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.can_read_order(id));

CREATE POLICY orders_salesman_insert_draft
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_role('SALESMAN')
    AND shop_id IN (SELECT public.salesman_shop_ids())
    AND created_by_profile_id = auth.uid()
    AND status = 'DRAFT_ASSISTED'
    AND source = 'SALESMAN_ASSISTED'
    AND payment_id IS NULL
  );

CREATE POLICY orders_customer_insert_self_serve
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_role('CUSTOMER')
    AND shop_id IN (SELECT public.customer_shop_ids())
    AND created_by_profile_id = auth.uid()
    AND status = 'DRAFT_ASSISTED'
    AND source = 'CUSTOMER_SELF_SERVE'
    AND payment_id IS NULL
  );

CREATE POLICY order_lines_select_scoped
  ON public.order_lines
  FOR SELECT
  TO authenticated
  USING (public.can_read_order(order_id));

CREATE POLICY order_lines_insert_draft_only
  ON public.order_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.status = 'DRAFT_ASSISTED'
        AND public.can_read_order(o.id)
    )
  );

CREATE POLICY order_events_select_scoped
  ON public.order_events
  FOR SELECT
  TO authenticated
  USING (public.can_read_order(order_id));

CREATE POLICY order_confirmation_challenges_select_scoped
  ON public.order_confirmation_challenges
  FOR SELECT
  TO authenticated
  USING (public.can_read_order(order_id));

CREATE POLICY order_confirmation_challenges_customer_confirm_update
  ON public.order_confirmation_challenges
  FOR UPDATE
  TO authenticated
  USING (
    public.profile_has_role('CUSTOMER')
    AND public.can_read_order(order_id)
    AND status = 'PENDING'
  )
  WITH CHECK (
    public.profile_has_role('CUSTOMER')
    AND public.can_read_order(order_id)
    AND status IN (
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_REQUESTED_CHANGES',
      'CUSTOMER_REJECTED'
    )
    AND payment_method_intent IN ('PAY_ONLINE_NOW', 'PAY_ON_DELIVERY')
    AND otp_hash IS NOT DISTINCT FROM (
      SELECT c.otp_hash
      FROM public.order_confirmation_challenges c
      WHERE c.id = order_confirmation_challenges.id
    )
  );

-- ---------------------------------------------------------------------------
-- payments (scoped read only for clients)
-- ---------------------------------------------------------------------------

CREATE POLICY payments_select_scoped
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_read_order(order_id)
  );

CREATE POLICY payment_events_select_scoped
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.id = payment_id
        AND public.can_read_order(p.order_id)
    )
  );

-- ---------------------------------------------------------------------------
-- delivery (delivery staff read assigned routes; scoped inserts for attempts)
-- ---------------------------------------------------------------------------

CREATE POLICY delivery_routes_select_scoped
  ON public.delivery_routes
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR id IN (SELECT public.delivery_route_ids())
    OR public.profile_has_role('SALESMAN')
  );

CREATE POLICY route_stops_select_scoped
  ON public.route_stops
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR route_id IN (SELECT public.delivery_route_ids())
    OR public.can_read_order(order_id)
  );

CREATE POLICY delivery_attempts_select_scoped
  ON public.delivery_attempts
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.can_read_order(order_id)
    OR EXISTS (
      SELECT 1
      FROM public.route_stops rs
      WHERE rs.id = route_stop_id
        AND rs.route_id IN (SELECT public.delivery_route_ids())
    )
  );

CREATE POLICY delivery_attempts_insert_assigned_delivery
  ON public.delivery_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.profile_has_role('DELIVERY')
    AND EXISTS (
      SELECT 1
      FROM public.route_stops rs
      JOIN public.delivery_routes dr ON dr.id = rs.route_id
      WHERE rs.id = route_stop_id
        AND rs.order_id = order_id
        AND dr.assigned_delivery_profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- audit logs (admin read only; inserts via service_role / trusted RPC)
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select_admin
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMENT ON FUNCTION public.can_read_order(uuid) IS
  'Customers and salesmen see shop orders; delivery staff see routed orders.';
