-- Sprint 5.1: Admin write policies required for Live Admin ERP mutations.
-- Prior policies were intentionally read-scoped for some ops tables;
-- Admin ERP CRUD under is_admin() needs matching write policies.

-- Inventory
DROP POLICY IF EXISTS inventory_balances_admin_write ON public.inventory_balances;
CREATE POLICY inventory_balances_admin_write
  ON public.inventory_balances
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS inventory_movements_admin_insert ON public.inventory_movements;
CREATE POLICY inventory_movements_admin_insert
  ON public.inventory_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Pricing close / schedule adjustments
DROP POLICY IF EXISTS sku_prices_admin_write ON public.sku_prices;
CREATE POLICY sku_prices_admin_write
  ON public.sku_prices
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Orders (admin ops console)
DROP POLICY IF EXISTS orders_admin_write ON public.orders;
CREATE POLICY orders_admin_write
  ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS order_lines_admin_write ON public.order_lines;
CREATE POLICY order_lines_admin_write
  ON public.order_lines
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS order_events_admin_insert ON public.order_events;
CREATE POLICY order_events_admin_insert
  ON public.order_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Delivery routes
DROP POLICY IF EXISTS delivery_routes_admin_write ON public.delivery_routes;
CREATE POLICY delivery_routes_admin_write
  ON public.delivery_routes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS route_stops_admin_write ON public.route_stops;
CREATE POLICY route_stops_admin_write
  ON public.route_stops
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
