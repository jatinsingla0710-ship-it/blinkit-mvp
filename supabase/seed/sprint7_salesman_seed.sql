-- Sprint 7 salesman PWA seed: today's visits + pending invitation for salesman1.
-- Depends on sprint4_seed (salesman1, shops 1–3 assigned to salesman1).

-- Today's route for salesman1 (Sharma / Gupta / Verma style shops)
INSERT INTO public.sales_visits (
  id,
  salesman_profile_id,
  shop_id,
  planned_at,
  status,
  notes,
  visited_at
)
VALUES
  (
    'a9100000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000001',
    date_trunc('day', now()) + interval '9 hours',
    'VISITED',
    'Restock discussion completed',
    date_trunc('day', now()) + interval '9 hours 40 minutes'
  ),
  (
    'a9100000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000002',
    date_trunc('day', now()) + interval '11 hours',
    'PENDING',
    'Awaiting owner availability',
    NULL
  ),
  (
    'a9100000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000005',
    date_trunc('day', now()) + interval '15 hours',
    'PLANNED',
    NULL,
    NULL
  ),
  (
    'a9100000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000005',
    date_trunc('day', now()) - interval '1 day' + interval '14 hours',
    'MISSED',
    'Shop closed — reschedule',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Pending invitation for shop 2 (assisted onboarding demo token)
INSERT INTO public.shop_invitations (
  id,
  shop_id,
  mobile,
  token,
  status,
  expires_at,
  sent_at
)
VALUES (
  'a9200000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000002',
  public.normalize_mobile('+919811100002'),
  'sprint7-salesman-invite-token',
  'PENDING',
  now() + interval '14 days',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Ensure primary contact exists for invitation / profile display
INSERT INTO public.shop_contacts (id, shop_id, name, mobile, is_primary)
VALUES (
  'a9300000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000002',
  'Gupta Owner',
  public.normalize_mobile('+919811100002'),
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shop_contacts (id, shop_id, name, mobile, is_primary)
VALUES
  (
    'a9300000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    'Sharma Owner',
    public.normalize_mobile('+919811100001'),
    true
  ),
  (
    'a9300000-0000-4000-8000-000000000005',
    'a7000000-0000-4000-8000-000000000005',
    'Royal Owner',
    public.normalize_mobile('+919811100005'),
    true
  )
ON CONFLICT (id) DO NOTHING;
