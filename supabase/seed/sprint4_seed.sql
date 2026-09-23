-- Sprint 4 seed: categories, products, SKUs, prices, inventory, warehouse,
-- one admin, two salesmen, five customers, sample orders.
--
-- All IDs are valid RFC-4122 UUIDs (hex only: 0-9, a-f).
--
-- Apply after migrations:
--   pnpm db:reset
--   pnpm exec supabase db query --local -f supabase/seed/sprint4_seed.sql
--   # or: pnpm db:seed:sprint4
--
-- Auth users must exist before profile inserts (seed creates via auth.users).

BEGIN;

-- ---------------------------------------------------------------------------
-- Stable UUID map (hex-only)
--   admin          a1000000-0000-4000-8000-000000000001
--   salesman1      a1000000-0000-4000-8000-000000000002
--   salesman2      a1000000-0000-4000-8000-000000000003
--   service_area   a2000000-0000-4000-8000-000000000001
--   warehouse      a3000000-0000-4000-8000-000000000001
--   categories     a4000000-0000-4000-8000-000000000001..6
--   products       a5000000-0000-4000-8000-000000000001..7
--   product_image  a5100000-0000-4000-8000-000000000001
--   skus           a6000000-0000-4000-8000-000000000001..7
--   sku_prices     a6100000-0000-4000-8000-000000000001..7
--   inv_balances   a6200000-0000-4000-8000-000000000001..7
--   shops          a7000000-0000-4000-8000-000000000001..5
--   addresses      a7100000-0000-4000-8000-000000000001..5
--   orders         a8000000-0000-4000-8000-000000000001..2
--   order_lines    a8100000-0000-4000-8000-000000000001..2
--   settings       a9000000-0000-4000-8000-000000000001
--   reports        a9000000-0000-4000-8000-000000000002
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Auth users + profiles
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@groaurum.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'salesman1@groaurum.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'salesman2@groaurum.local',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  confirmation_token = COALESCE(auth.users.confirmation_token, ''),
  recovery_token = COALESCE(auth.users.recovery_token, ''),
  email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
  email_change = COALESCE(auth.users.email_change, ''),
  raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, EXCLUDED.raw_app_meta_data),
  raw_user_meta_data = COALESCE(auth.users.raw_user_meta_data, EXCLUDED.raw_user_meta_data);

-- GoTrue requires email identities for password grant.
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'sub', 'a1000000-0000-4000-8000-000000000001',
      'email', 'admin@groaurum.local',
      'email_verified', true
    ),
    'email',
    'a1000000-0000-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'sub', 'a1000000-0000-4000-8000-000000000002',
      'email', 'salesman1@groaurum.local',
      'email_verified', true
    ),
    'email',
    'a1000000-0000-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000003',
    jsonb_build_object(
      'sub', 'a1000000-0000-4000-8000-000000000003',
      'email', 'salesman2@groaurum.local',
      'email_verified', true
    ),
    'email',
    'a1000000-0000-4000-8000-000000000003',
    now(), now(), now()
  )
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.profiles (id, display_name, mobile, roles, is_active)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'GroAurum Admin',
    '+919999999999',
    ARRAY['ADMIN']::public.staff_role[],
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Salesman One',
    '+919810000001',
    ARRAY['SALESMAN']::public.staff_role[],
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Salesman Two',
    '+919810000002',
    ARRAY['SALESMAN']::public.staff_role[],
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Territory + warehouse
-- ---------------------------------------------------------------------------

INSERT INTO public.service_areas (id, name, description, is_active, display_order)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'South Delhi',
  'GroAurum launch service area — South Delhi grocery + FMCG wholesale',
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  display_order = EXCLUDED.display_order;

INSERT INTO public.operational_locations (
  id, name, kind, address_line, city, state, pin_code, is_active
)
VALUES (
  'a3000000-0000-4000-8000-000000000001',
  'South Delhi Warehouse 1',
  'WAREHOUSE',
  'Okhla Industrial Area Phase 1',
  'New Delhi',
  'Delhi',
  '110020',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  address_line = EXCLUDED.address_line,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  pin_code = EXCLUDED.pin_code,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

INSERT INTO public.categories (id, name, description, display_order, is_active)
VALUES
  ('a4000000-0000-4000-8000-000000000001', 'Dry Fruits', 'Almonds, cashews and other dry fruits', 1, true),
  ('a4000000-0000-4000-8000-000000000002', 'Atta / Flour', 'Wheat atta and other flours', 2, true),
  ('a4000000-0000-4000-8000-000000000003', 'Rice', 'Basmati and other rice', 3, true),
  ('a4000000-0000-4000-8000-000000000004', 'Sugar', 'Sugar for wholesale restock', 4, true),
  ('a4000000-0000-4000-8000-000000000005', 'Spices', 'Whole and packed spices', 5, true),
  ('a4000000-0000-4000-8000-000000000006', 'FMCG', 'Packed grocery and FMCG staples', 6, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = true;

INSERT INTO public.products (id, category_id, name, product_type, is_active)
VALUES
  (
    'a5000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'California Almonds',
    'BULK',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000001',
    'W320 Cashews',
    'PACKED',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000003',
    'a4000000-0000-4000-8000-000000000002',
    'Chakki Fresh Atta',
    'PACKED',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000004',
    'a4000000-0000-4000-8000-000000000003',
    'India Gate Basmati Rice',
    'PACKED',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000005',
    'a4000000-0000-4000-8000-000000000004',
    'Refined Sugar',
    'BULK',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000006',
    'a4000000-0000-4000-8000-000000000005',
    'Garam Masala',
    'PACKED',
    true
  ),
  (
    'a5000000-0000-4000-8000-000000000007',
    'a4000000-0000-4000-8000-000000000006',
    'Glucose Biscuits',
    'PACKED',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  product_type = EXCLUDED.product_type,
  is_active = true;

INSERT INTO public.product_images (id, product_id, url, display_order, is_primary)
VALUES (
  'a5100000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'https://cdn.groaurum.local/almonds.jpg',
  0,
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.skus (
  id, product_id, sku_code, name, product_type, selling_unit,
  moq, quantity_step, packs_per_carton, is_active
)
VALUES
  (
    'a6000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000001',
    'ALM-CAL-KG',
    'California Almond KG',
    'BULK',
    'KG',
    5,
    1,
    NULL,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000002',
    'a5000000-0000-4000-8000-000000000002',
    'CAS-W320-CTN',
    'W320 Cashew Carton',
    'PACKED',
    'CARTON',
    1,
    1,
    20,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000003',
    'a5000000-0000-4000-8000-000000000003',
    'ATTA-CHK-10KG',
    'Chakki Atta 10 KG Bag',
    'PACKED',
    'BAG',
    5,
    1,
    NULL,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    'a5000000-0000-4000-8000-000000000004',
    'RICE-IG-25KG',
    'India Gate Basmati 25 KG Bag',
    'PACKED',
    'BAG',
    2,
    1,
    NULL,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000005',
    'a5000000-0000-4000-8000-000000000005',
    'SUG-REF-KG',
    'Refined Sugar KG',
    'BULK',
    'KG',
    25,
    5,
    NULL,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000006',
    'a5000000-0000-4000-8000-000000000006',
    'SPC-GM-PACK',
    'Garam Masala 200 g Pack',
    'PACKED',
    'PACK',
    10,
    10,
    NULL,
    true
  ),
  (
    'a6000000-0000-4000-8000-000000000007',
    'a5000000-0000-4000-8000-000000000007',
    'FMCG-GB-PCS',
    'Glucose Biscuits Pack',
    'PACKED',
    'PCS',
    24,
    12,
    NULL,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  sku_code = EXCLUDED.sku_code,
  name = EXCLUDED.name,
  product_type = EXCLUDED.product_type,
  selling_unit = EXCLUDED.selling_unit,
  moq = EXCLUDED.moq,
  quantity_step = EXCLUDED.quantity_step,
  packs_per_carton = EXCLUDED.packs_per_carton,
  is_active = true;

INSERT INTO public.sku_prices (id, sku_id, trade_price, currency, effective_from, recorded_by_profile_id)
VALUES
  (
    'a6100000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    850.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000002',
    4200.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000003',
    'a6000000-0000-4000-8000-000000000003',
    385.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000004',
    'a6000000-0000-4000-8000-000000000004',
    2150.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000005',
    'a6000000-0000-4000-8000-000000000005',
    46.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000006',
    'a6000000-0000-4000-8000-000000000006',
    62.00,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6100000-0000-4000-8000-000000000007',
    'a6000000-0000-4000-8000-000000000007',
    9.50,
    'INR',
    now() - interval '7 days',
    'a1000000-0000-4000-8000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory_balances (
  id, sku_id, operational_location_id, on_hand_quantity, reserved_quantity
)
VALUES
  (
    'a6200000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    500,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    120,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000003',
    'a6000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000001',
    400,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000004',
    'a6000000-0000-4000-8000-000000000004',
    'a3000000-0000-4000-8000-000000000001',
    180,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000005',
    'a6000000-0000-4000-8000-000000000005',
    'a3000000-0000-4000-8000-000000000001',
    2000,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000006',
    'a6000000-0000-4000-8000-000000000006',
    'a3000000-0000-4000-8000-000000000001',
    800,
    0
  ),
  (
    'a6200000-0000-4000-8000-000000000007',
    'a6000000-0000-4000-8000-000000000007',
    'a3000000-0000-4000-8000-000000000001',
    2400,
    0
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory_movements (
  sku_id, operational_location_id, movement_type, quantity_delta, reason, actor_profile_id
)
VALUES
  (
    'a6000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    500,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    120,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    400,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    180,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000005',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    2000,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000006',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    800,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  ),
  (
    'a6000000-0000-4000-8000-000000000007',
    'a3000000-0000-4000-8000-000000000001',
    'RECEIPT',
    2400,
    'Sprint 4 seed receipt',
    'a1000000-0000-4000-8000-000000000001'
  );

-- ---------------------------------------------------------------------------
-- Customers (shops) + addresses
-- ---------------------------------------------------------------------------

INSERT INTO public.shops (
  id, trade_name, legal_name, lifecycle_status, service_area_id,
  assigned_salesman_profile_id,
  delivery_address_line, delivery_city, delivery_state, delivery_pin_code, is_active
)
VALUES
  (
    'a7000000-0000-4000-8000-000000000001',
    'Sharma Kirana',
    'Sharma Kirana Pvt',
    'ACTIVATED',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    '12 Press Enclave Road, Saket',
    'New Delhi',
    'Delhi',
    '110017',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000002',
    'Gupta Traders',
    NULL,
    'FIRST_ORDER',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    '45 Okhla Industrial Area Phase 2',
    'New Delhi',
    'Delhi',
    '110020',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000003',
    'Anand General Store',
    NULL,
    'LEAD',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    '8 M-Block Market, Greater Kailash I',
    'New Delhi',
    'Delhi',
    '110048',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000004',
    'City Mart',
    NULL,
    'INVITED',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    '22 Main Market, Malviya Nagar',
    'New Delhi',
    'Delhi',
    '110017',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000005',
    'Royal Wholesale',
    NULL,
    'REPEAT_CUSTOMER',
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    '3 Krishna Market, Kalkaji',
    'New Delhi',
    'Delhi',
    '110019',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  trade_name = EXCLUDED.trade_name,
  service_area_id = EXCLUDED.service_area_id,
  delivery_address_line = EXCLUDED.delivery_address_line,
  delivery_city = EXCLUDED.delivery_city,
  delivery_state = EXCLUDED.delivery_state,
  delivery_pin_code = EXCLUDED.delivery_pin_code,
  is_active = true;

INSERT INTO public.customer_addresses (
  id, shop_id, label, address_line, city, state, pin_code, is_default
)
VALUES
  (
    'a7100000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    'Primary',
    '12 Press Enclave Road, Saket',
    'New Delhi',
    'Delhi',
    '110017',
    true
  ),
  (
    'a7100000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000002',
    'Primary',
    '45 Okhla Industrial Area Phase 2',
    'New Delhi',
    'Delhi',
    '110020',
    true
  ),
  (
    'a7100000-0000-4000-8000-000000000003',
    'a7000000-0000-4000-8000-000000000003',
    'Primary',
    '8 M-Block Market, Greater Kailash I',
    'New Delhi',
    'Delhi',
    '110048',
    true
  ),
  (
    'a7100000-0000-4000-8000-000000000004',
    'a7000000-0000-4000-8000-000000000004',
    'Primary',
    '22 Main Market, Malviya Nagar',
    'New Delhi',
    'Delhi',
    '110017',
    true
  ),
  (
    'a7100000-0000-4000-8000-000000000005',
    'a7000000-0000-4000-8000-000000000005',
    'Primary',
    '3 Krishna Market, Kalkaji',
    'New Delhi',
    'Delhi',
    '110019',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  address_line = EXCLUDED.address_line,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  pin_code = EXCLUDED.pin_code;

-- ---------------------------------------------------------------------------
-- Sample orders
-- ---------------------------------------------------------------------------

INSERT INTO public.orders (
  id, shop_id, status, source, created_by_profile_id, service_area_id,
  subtotal, adjustments, total, currency
)
VALUES
  (
    'a8000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    'CONFIRMED',
    'SALESMAN_ASSISTED',
    'a1000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000001',
    4250.00,
    0,
    4250.00,
    'INR'
  ),
  (
    'a8000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000005',
    'PROCESSING',
    'CUSTOMER_SELF_SERVE',
    'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    8400.00,
    0,
    8400.00,
    'INR'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_lines (
  id, order_id, sku_id, product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
  selling_unit_snapshot, quantity, agreed_unit_price, line_total
)
VALUES
  (
    'a8100000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    'California Almonds',
    'California Almond KG',
    'ALM-CAL-KG',
    'KG',
    5,
    850.00,
    4250.00
  ),
  (
    'a8100000-0000-4000-8000-000000000002',
    'a8000000-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000002',
    'W320 Cashews',
    'W320 Cashew Carton',
    'CAS-W320-CTN',
    'CARTON',
    2,
    4200.00,
    8400.00
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Settings + reports placeholder
-- ---------------------------------------------------------------------------

INSERT INTO public.settings (id, setting_key, setting_value, description, updated_by_profile_id)
VALUES (
  'a9000000-0000-4000-8000-000000000001',
  'company',
  '{"name":"GroAurum","city":"New Delhi"}'::jsonb,
  'Company profile',
  'a1000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description;

INSERT INTO public.reports_snapshot (id, snapshot_key, payload, generated_by_profile_id)
VALUES (
  'a9000000-0000-4000-8000-000000000002',
  'current',
  '{"status":"placeholder","note":"Analytics sprint pending"}'::jsonb,
  'a1000000-0000-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
