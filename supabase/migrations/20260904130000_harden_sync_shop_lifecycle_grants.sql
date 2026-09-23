-- P0 security: stop authenticated clients from directly invoking shop lifecycle sync.
--
-- Before: GRANT EXECUTE ON sync_shop_lifecycle_from_orders TO authenticated, service_role
--   → any logged-in user could force-update shops.lifecycle_status for any shop_id.
--
-- After: internal helper only (same pattern as try_auto_convert / _consume_reserved_inventory).
-- Sole legitimate caller: trg_orders_sync_shop_lifecycle (AFTER INSERT ON orders),
-- which is SECURITY DEFINER and runs as the function owner.
--
-- Does NOT change activation, OTP, order creation, or lifecycle business rules — grants only.

REVOKE ALL ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) FROM service_role;

COMMENT ON FUNCTION public.sync_shop_lifecycle_from_orders(uuid) IS
  'Customers H2: ACTIVATED + 1 order → FIRST_ORDER; 2+ → REPEAT_CUSTOMER. Internal only — invoked by trg_orders_sync_shop_lifecycle; not executable by authenticated clients.';
