-- P0 security: stop authenticated clients from directly invoking auto sale conversion.
--
-- Before: GRANT EXECUTE ON try_auto_convert_order_to_sale TO authenticated
--   → any logged-in user could force convert a DELIVERED+PAID order and consume inventory.
--
-- After: same pattern as _consume_reserved_inventory_for_order — REVOKE from PUBLIC /
-- authenticated / anon. No body changes. Legitimate callers remain SECURITY DEFINER
-- functions owned by the same role:
--   - delivery_complete_stop → try_auto_convert_order_to_sale
--   - _lifecycle_after_payment_or_delivery → try_auto_convert_order_to_sale
--     (admin_verify_reported_payment, delivery cash paths, admin_mark_payment_received)
--   - admin_convert_order_to_sale → _convert_order_to_sale_core (unchanged, admin-gated)
--
-- Does NOT change convert/inventory/payment/delivery logic — grants only.

REVOKE ALL ON FUNCTION public.try_auto_convert_order_to_sale(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_auto_convert_order_to_sale(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.try_auto_convert_order_to_sale(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public._lifecycle_after_payment_or_delivery(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._lifecycle_after_payment_or_delivery(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._lifecycle_after_payment_or_delivery(uuid) FROM authenticated;

COMMENT ON FUNCTION public.try_auto_convert_order_to_sale(uuid) IS
  'Internal best-effort auto sale conversion (DELIVERED+PAID). Not executable by authenticated clients; invoked only from trusted SECURITY DEFINER workflows.';

COMMENT ON FUNCTION public._convert_order_to_sale_core(uuid, uuid) IS
  'Internal sale conversion + inventory consume. Not executable by authenticated clients; used by admin_convert_order_to_sale and try_auto_convert_order_to_sale.';

COMMENT ON FUNCTION public._lifecycle_after_payment_or_delivery(uuid) IS
  'Internal hook: when order is DELIVERED, best-effort try_auto_convert_order_to_sale. Not executable by authenticated clients.';
