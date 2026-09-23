-- Sprint 4.0: customers may read available inventory so the live catalogue
-- and cart can validate stock without mixing mock data.

DROP POLICY IF EXISTS inventory_balances_select_customer ON public.inventory_balances;
CREATE POLICY inventory_balances_select_customer
  ON public.inventory_balances
  FOR SELECT
  TO authenticated
  USING (public.profile_has_role('CUSTOMER'));

COMMENT ON POLICY inventory_balances_select_customer ON public.inventory_balances IS
  'Customers may read on-hand / available quantity for catalogue and checkout stock checks.';
