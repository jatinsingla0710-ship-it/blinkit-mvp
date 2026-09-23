-- Sprint 4 / 0021: compatibility views matching Sprint 4 naming vocabulary.
-- Underlying physical tables remain the source of truth.

CREATE OR REPLACE VIEW public.user_profiles
  WITH (security_invoker = true)
AS
SELECT * FROM public.profiles;

CREATE OR REPLACE VIEW public.customers
  WITH (security_invoker = true)
AS
SELECT * FROM public.shops;

CREATE OR REPLACE VIEW public.price_history
  WITH (security_invoker = true)
AS
SELECT * FROM public.sku_prices;

CREATE OR REPLACE VIEW public.order_items
  WITH (security_invoker = true)
AS
SELECT * FROM public.order_lines;

CREATE OR REPLACE VIEW public.inventory
  WITH (security_invoker = true)
AS
SELECT * FROM public.inventory_balances;

COMMENT ON VIEW public.user_profiles IS 'Alias of profiles for admin data-layer vocabulary.';
COMMENT ON VIEW public.customers IS 'Alias of shops for admin data-layer vocabulary.';
COMMENT ON VIEW public.price_history IS 'Alias of sku_prices (append-only trade price history).';
COMMENT ON VIEW public.order_items IS 'Alias of order_lines.';
COMMENT ON VIEW public.inventory IS 'Alias of inventory_balances.';
