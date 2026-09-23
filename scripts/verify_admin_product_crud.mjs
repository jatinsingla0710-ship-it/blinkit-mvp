/**
 * Sprint 1 Task 2 — verify Product + SKU CRUD against hosted Supabase.
 * Runs as seeded admin: create product → update → create sku → update sku → soft-delete sku → soft-delete product.
 */
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
if (!url || !anon) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  process.exit(1);
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const client = createClient(url, anon);
const { error: authError } = await client.auth.signInWithPassword({
  email: 'admin@groaurum.local',
  password: 'password123',
});
record('admin.sign_in', !authError, authError?.message ?? 'ok');

const { data: cats, error: catErr } = await client
  .from('categories')
  .select('id, name')
  .is('deleted_at', null)
  .limit(1);
record('categories.available', !catErr && (cats?.length ?? 0) > 0, catErr?.message ?? cats?.[0]?.name);

const categoryId = cats?.[0]?.id;
const stamp = Date.now().toString(36);
const productName = `QA Product ${stamp}`;

const { data: product, error: createErr } = await client
  .from('products')
  .insert({
    category_id: categoryId,
    name: productName,
    description: 'Sprint 1 Task 2 verification product',
    product_type: 'PACKED',
    is_active: true,
  })
  .select('*')
  .single();
record('product.create', !createErr && Boolean(product?.id), createErr?.message ?? product?.id);

const productId = product?.id;

const { data: updated, error: updateErr } = await client
  .from('products')
  .update({ description: 'Updated description', name: `${productName} Edited` })
  .eq('id', productId)
  .select('*')
  .single();
record(
  'product.update',
  !updateErr && updated?.description === 'Updated description',
  updateErr?.message ?? updated?.name,
);

const skuCode = `QA-${stamp}`.toUpperCase();
const { data: sku, error: skuCreateErr } = await client
  .from('skus')
  .insert({
    product_id: productId,
    sku_code: skuCode,
    name: 'QA SKU',
    product_type: 'PACKED',
    selling_unit: 'CARTON',
    packs_per_carton: 12,
    net_quantity: 1,
    net_quantity_unit: 'KG',
    moq: 1,
    quantity_step: 1,
    is_active: true,
  })
  .select('*')
  .single();
record('sku.create', !skuCreateErr && Boolean(sku?.id), skuCreateErr?.message ?? sku?.sku_code);

const { data: skuUpdated, error: skuUpdateErr } = await client
  .from('skus')
  .update({ name: 'QA SKU Edited', packs_per_carton: 24, is_active: true })
  .eq('id', sku?.id)
  .select('*')
  .single();
record(
  'sku.update',
  !skuUpdateErr && skuUpdated?.packs_per_carton === 24,
  skuUpdateErr?.message ?? skuUpdated?.name,
);

const { error: skuArchiveErr } = await client
  .from('skus')
  .update({ deleted_at: new Date().toISOString(), is_active: false })
  .eq('id', sku?.id);
record('sku.archive', !skuArchiveErr, skuArchiveErr?.message ?? 'soft-deleted');

const { data: activeSkus } = await client
  .from('skus')
  .select('id')
  .eq('product_id', productId)
  .is('deleted_at', null);
record('sku.hidden_after_archive', (activeSkus?.length ?? 0) === 0, `active=${activeSkus?.length ?? 0}`);

const { error: productArchiveErr } = await client
  .from('products')
  .update({ deleted_at: new Date().toISOString(), is_active: false })
  .eq('id', productId);
record('product.archive', !productArchiveErr, productArchiveErr?.message ?? 'soft-deleted');

const { data: activeProducts } = await client
  .from('products')
  .select('id')
  .eq('id', productId)
  .is('deleted_at', null);
record(
  'product.hidden_after_archive',
  (activeProducts?.length ?? 0) === 0,
  `active=${activeProducts?.length ?? 0}`,
);

const { data: list } = await client
  .from('products')
  .select('id, name')
  .is('deleted_at', null)
  .order('updated_at', { ascending: false })
  .limit(20);
record('product.list_refresh', Array.isArray(list), `${list?.length ?? 0} active products`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
