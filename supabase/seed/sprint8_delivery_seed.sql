-- Sprint 8 delivery PWA seed: delivery executive + today's route + COD payments.
-- Depends on sprint4 (shops, skus, service area, sample orders).

BEGIN;

-- Auth user: delivery1@groaurum.local / password123
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data
)
VALUES (
  'a1000000-0000-4000-8000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'delivery1@groaurum.local',
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
  raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, EXCLUDED.raw_app_meta_data);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES (
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000004',
  jsonb_build_object(
    'sub', 'a1000000-0000-4000-8000-000000000004',
    'email', 'delivery1@groaurum.local',
    'email_verified', true
  ),
  'email',
  'a1000000-0000-4000-8000-000000000004',
  now(), now(), now()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (
  id, display_name, mobile, roles, is_active
)
VALUES (
  'a1000000-0000-4000-8000-000000000004',
  'Delivery Exec One',
  public.normalize_mobile('+919800000055'),
  ARRAY['DELIVERY']::public.staff_role[],
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  display_name = EXCLUDED.display_name,
  is_active = true;

SELECT set_config('groaurum.trusted_server_action', 'true', true);

UPDATE public.orders
SET status = 'ASSIGNED_TO_ROUTE',
    updated_at = now()
WHERE id IN (
  'a8000000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000002'
)
AND status NOT IN ('DELIVERED', 'CANCELLED', 'DELIVERY_FAILED');

INSERT INTO public.payments (
  id, order_id, status, method_intent, collection_method, amount, currency
)
VALUES
  (
    'a8500000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001',
    'UNPAID',
    'PAY_ON_DELIVERY',
    NULL,
    4250.00,
    'INR'
  ),
  (
    'a8500000-0000-4000-8000-000000000002',
    'a8000000-0000-4000-8000-000000000002',
    'UNPAID',
    'PAY_ON_DELIVERY',
    NULL,
    8400.00,
    'INR'
  )
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.orders o
SET payment_id = p.id
FROM public.payments p
WHERE p.order_id = o.id
  AND o.id IN (
    'a8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000002'
  )
  AND o.payment_id IS NULL;

INSERT INTO public.delivery_routes (
  id,
  service_area_id,
  route_date,
  assigned_delivery_profile_id,
  status
)
VALUES (
  'a8600000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  CURRENT_DATE,
  'a1000000-0000-4000-8000-000000000004',
  'PLANNED'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.route_stops (id, route_id, order_id, sequence, status)
VALUES
  (
    'a8700000-0000-4000-8000-000000000001',
    'a8600000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000001',
    1,
    'PENDING'
  ),
  (
    'a8700000-0000-4000-8000-000000000002',
    'a8600000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000002',
    2,
    'PENDING'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
