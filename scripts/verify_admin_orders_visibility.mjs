// Sprint 1 Task 1 verification: admin orders visibility + realtime.
// 1. Sign in as seeded admin, run the exact ordersSnapshot base query.
// 2. Subscribe to postgres_changes on orders, touch a row via service role,
//    and assert the event arrives (drives instant Admin invalidation).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadRootEnv() {
  const out = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadRootEnv();
const url = env.SUPABASE_URL;
const anon = env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const adminClient = createClient(url, anon);
const { data: auth, error: authError } = await adminClient.auth.signInWithPassword({
  email: 'admin@groaurum.local',
  password: 'password123',
});
record('admin.sign_in', !authError, authError?.message ?? auth.user.email);

// Exact base query used by LiveAdminApi.ordersSnapshot after the fix.
const { data: orders, error: ordersError } = await adminClient
  .from('orders')
  .select('*')
  .order('created_at', { ascending: false });
record(
  'admin.orders_snapshot_query',
  !ordersError && (orders?.length ?? 0) > 0,
  ordersError?.message ?? `${orders?.length ?? 0} orders visible`,
);

const customerOrder = (orders ?? []).find((o) => o.source === 'CUSTOMER_SELF_SERVE');
record(
  'admin.customer_order_visible',
  Boolean(customerOrder),
  customerOrder ? `${customerOrder.id} status=${customerOrder.status}` : 'no CUSTOMER_SELF_SERVE order found',
);

// Realtime: admin subscription must receive orders changes.
const eventReceived = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), 15000);
  const channel = adminClient
    .channel('verify-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      clearTimeout(timer);
      resolve(true);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const svc = createClient(url, service, { auth: { persistSession: false } });
        // No-op touch (same value) to fire an UPDATE event without changing data.
        const target = customerOrder ?? orders[0];
        const { error: touchError } = await svc
          .from('orders')
          .update({ expected_delivery_at: target.expected_delivery_at })
          .eq('id', target.id);
        if (touchError) console.log(`  touch failed: ${touchError.message}`);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        resolve(false);
      }
    });
  void channel;
});

record('admin.realtime_orders_event', await eventReceived, 'postgres_changes on orders');

await adminClient.removeAllChannels();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
