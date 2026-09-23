-- Sprint 6 customer seed: CUSTOMER auth user, shop link, invitation, serviceability, addresses.
-- Apply after sprint4_seed.sql.
-- Login: customer@groaurum.local / password123
-- Phone (profile): +919811122233
-- Invitation token: sprint6-customer-invite-token

BEGIN;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, phone, phone_confirmed_at
)
VALUES (
  'a1100000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'customer@groaurum.local',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '+919811122233',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  confirmation_token = COALESCE(auth.users.confirmation_token, ''),
  recovery_token = COALESCE(auth.users.recovery_token, ''),
  email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
  email_change = COALESCE(auth.users.email_change, ''),
  phone = COALESCE(auth.users.phone, EXCLUDED.phone),
  phone_confirmed_at = COALESCE(auth.users.phone_confirmed_at, EXCLUDED.phone_confirmed_at),
  raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, EXCLUDED.raw_app_meta_data);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES (
  'a1100000-0000-4000-8000-000000000001',
  'a1100000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', 'a1100000-0000-4000-8000-000000000001',
    'email', 'customer@groaurum.local',
    'email_verified', true,
    'phone', '+919811122233',
    'phone_verified', true
  ),
  'email',
  'a1100000-0000-4000-8000-000000000001',
  now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.profiles (id, display_name, mobile, roles, is_active)
VALUES (
  'a1100000-0000-4000-8000-000000000001',
  'Seed Retail Owner',
  '+919811122233',
  ARRAY['CUSTOMER']::public.staff_role[],
  true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  mobile = EXCLUDED.mobile,
  roles = EXCLUDED.roles,
  is_active = true;

-- Link to first seed shop (South Delhi retailer)
INSERT INTO public.shop_auth_links (id, shop_id, auth_user_id, linked_at)
VALUES (
  'a1200000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a1100000-0000-4000-8000-000000000001',
  now()
)
ON CONFLICT (auth_user_id) DO UPDATE
  SET shop_id = EXCLUDED.shop_id,
      linked_at = now();

-- Pending invitation for onboarding demo (same shop / mobile)
INSERT INTO public.shop_invitations (
  id, shop_id, mobile, token, status, expires_at, sent_at
)
VALUES (
  'a1300000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  '+919811122233',
  'sprint6-customer-invite-token',
  'PENDING',
  now() + interval '30 days',
  now()
)
ON CONFLICT (token) DO NOTHING;

-- Serviceability for South Delhi seed shop PINs
INSERT INTO public.serviceability_rules (
  id, service_area_id, rule_type, config, is_active
)
VALUES (
  'a1400000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'PIN_CODE',
  '{"pinCodes":["110017","110019","110020","110024","110048","110062"]}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  config = EXCLUDED.config,
  is_active = true;

COMMIT;
