/**
 * Sprint 5.1 — verify ADMIN JWT mutations against local Supabase.
 * Reads apps/admin-web/.env.local (does not print secrets).
 *
 * Usage: node scripts/verify_sprint51_admin_mutations.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const path = resolve('apps/admin-web/.env.local');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    env[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return env;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  const email = env.VITE_AUTH_DEV_EMAIL || 'admin@groaurum.local';
  const password = env.VITE_AUTH_DEV_PASSWORD || 'password123';
  assert(url && anon, 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local');

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };

  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr || !authData.session) {
    record('auth.signIn', false, authErr?.message || 'no session');
    process.exit(1);
  }
  record('auth.signIn', true, `role JWT present (${authData.user.id.slice(0, 8)}…)`);

  const stamp = Date.now().toString().slice(-6);

  // Category create
  {
    const { data, error } = await sb
      .from('categories')
      .insert({
        name: `Audit Cat ${stamp}`,
        display_order: 99,
        is_active: true,
      })
      .select('id, name')
      .single();
    record('categories.insert', !error && !!data, error?.message || data?.name);
    if (data?.id) {
      const { error: updErr } = await sb
        .from('categories')
        .update({ is_active: false })
        .eq('id', data.id);
      record('categories.update', !updErr, updErr?.message);
    }
  }

  // SKU create under seed product
  const productId = 'a5000000-0000-4000-8000-000000000001';
  let skuId = null;
  {
    const { data, error } = await sb
      .from('skus')
      .insert({
        product_id: productId,
        sku_code: `AUD-${stamp}`,
        name: `Audit SKU ${stamp}`,
        product_type: 'PACKED',
        selling_unit: 'CARTON',
        packs_per_carton: 12,
        moq: 1,
        quantity_step: 1,
        is_active: true,
      })
      .select('id')
      .single();
    skuId = data?.id ?? null;
    record('skus.insert', !error && !!skuId, error?.message);
  }

  // Price create
  if (skuId) {
    const { data, error } = await sb
      .from('sku_prices')
      .insert({
        sku_id: skuId,
        trade_price: 111,
        currency: 'INR',
        effective_from: new Date().toISOString(),
      })
      .select('id')
      .single();
    record('sku_prices.insert', !error && !!data, error?.message);
  }

  // Inventory adjust
  {
    const balanceId = 'a6200000-0000-4000-8000-000000000001';
    const { data, error } = await sb
      .from('inventory_balances')
      .update({ on_hand_quantity: 42 })
      .eq('id', balanceId)
      .select('id, on_hand_quantity');
    const row = Array.isArray(data) ? data[0] : data;
    record(
      'inventory_balances.update',
      !error && row?.on_hand_quantity === 42,
      error?.message || `on_hand=${row?.on_hand_quantity}`,
    );
  }

  // Customer create
  {
    const { data, error } = await sb
      .from('shops')
      .insert({
        trade_name: `Audit Shop ${stamp}`,
        service_area_id: 'a2000000-0000-4000-8000-000000000001',
        assigned_salesman_profile_id: 'a1000000-0000-4000-8000-000000000002',
        delivery_address_line: 'Audit address',
        delivery_city: 'Gurugram',
        delivery_state: 'Haryana',
        delivery_pin_code: '122001',
        is_active: true,
      })
      .select('id')
      .single();
    record('shops.insert', !error && !!data, error?.message);
  }

  // Settings upsert-ish update
  {
    const { data, error } = await sb
      .from('settings')
      .update({
        setting_value: {
          companyName: 'GroAurum',
          auditStamp: stamp,
        },
      })
      .eq('setting_key', 'company')
      .select('id')
      .maybeSingle();
    record('settings.update', !error, error?.message || (data ? 'ok' : 'no row'));
  }

  // Delivery route create
  {
    const { data, error } = await sb
      .from('delivery_routes')
      .insert({
        service_area_id: 'a2000000-0000-4000-8000-000000000001',
        route_date: new Date().toISOString().slice(0, 10),
        status: 'DRAFT',
      })
      .select('id')
      .single();
    record('delivery_routes.insert', !error && !!data, error?.message);
  }

  // Product publish (is_active)
  {
    const { error } = await sb
      .from('products')
      .update({ is_active: true })
      .eq('id', productId);
    record('products.update', !error, error?.message);
  }

  await sb.auth.signOut();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
