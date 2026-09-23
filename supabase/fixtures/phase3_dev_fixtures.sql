-- TEST / DEVELOPMENT FIXTURES ONLY — not GroAurum launch catalogue or production data.
-- Apply manually against local Supabase after `pnpm db:reset`, e.g.:
--   pnpm exec supabase db query --local -f supabase/fixtures/phase3_dev_fixtures.sql
-- Or use packages/db-tests / scripts that insert the same shapes.

-- This file is intentionally NOT wired as supabase/seed.sql.

BEGIN;

-- Active + inactive service areas
INSERT INTO public.service_areas (id, name, description, is_active, display_order)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Test Area Active', 'Phase 3 test fixture', true, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Test Area Inactive', 'Phase 3 test fixture', false, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.serviceability_rules (id, service_area_id, rule_type, is_active, config)
VALUES
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'PIN_CODE',
    true,
    '{"pinCodes":["110017"]}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  config = EXCLUDED.config;

-- Auth user + profile + shop + link must be created via Auth admin / test helpers.
-- Catalogue test rows (empty catalogue remains valid without these):

INSERT INTO public.categories (id, name, display_order, is_active)
VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'Test Grocery', 1, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.products (id, category_id, name, product_type, is_active)
VALUES (
  'dddddddd-dddd-dddd-dddd-ddddddddddd1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'Test Atta',
  'PACKED',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  product_type = EXCLUDED.product_type;

INSERT INTO public.skus (
  id, product_id, sku_code, name, product_type, selling_unit, moq, quantity_step, is_active
)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
  'dddddddd-dddd-dddd-dddd-ddddddddddd1',
  'TEST-ATTA-BAG',
  'Test Atta 10 KG Bag',
  'PACKED',
  'BAG',
  1,
  1,
  true
)
ON CONFLICT (id) DO UPDATE SET
  sku_code = EXCLUDED.sku_code,
  name = EXCLUDED.name,
  product_type = EXCLUDED.product_type,
  selling_unit = EXCLUDED.selling_unit;

INSERT INTO public.sku_prices (id, sku_id, trade_price, currency, effective_from)
VALUES (
  'ffffffff-ffff-ffff-ffff-fffffffffff1',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
  650.00,
  'INR',
  now() - interval '1 day'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
