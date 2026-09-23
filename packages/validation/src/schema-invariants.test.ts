import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(__dirname, '../../../supabase/migrations');

function readAllMigrations(): string {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');
}

describe('supabase schema migrations', () => {
  const sql = readAllMigrations();

  it('has forward-only ordered migration files', () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(23);
    expect(files[0]).toMatch(/^20260715100000_/);
    expect(files).toContain('20260715101500_api_role_grants.sql');
    expect(files).toContain('20260820121500_sprint92_pricing_admin_rpcs.sql');
    expect(files).toContain('20260820143000_sprint92_admin_set_sku_price.sql');
    expect(files).toContain('20260820190000_sprint93_admin_adjust_inventory.sql');
    expect(files.at(-1)).toBe('20260830210000_cod_custody_manager_owner.sql');
  });

  it('defines trusted admin_set_sku_price for current-price writes', () => {
    expect(sql).toContain('admin_set_sku_price');
    expect(sql).toContain("set_config('groaurum.trusted_server_action', 'true', true)");
  });

  it('defines trusted admin_adjust_inventory_balance for atomic adjustments', () => {
    expect(sql).toContain('admin_adjust_inventory_balance');
    expect(sql).toContain('ADMIN_ADJUSTMENT');
    expect(sql).toMatch(/FOR UPDATE/);
  });

  it('adds Sprint 4 soft-delete and CRUD support tables', () => {
    expect(sql).toContain('product_images');
    expect(sql).toContain('customer_addresses');
    expect(sql).toContain('reports_snapshot');
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'READ_ONLY'");
    expect(sql).toMatch(/CREATE TABLE public\.settings/);
  });

  it('separates order status from payment status', () => {
    expect(sql).toContain('order_status');
    expect(sql).toContain('payment_status');
    expect(sql).toMatch(/CREATE TABLE public\.orders/);
    expect(sql).toMatch(/CREATE TABLE public\.payments/);
  });

  it('enforces delivered requires paid at database level', () => {
    expect(sql).toContain('enforce_delivered_requires_paid');
    expect(sql).toContain('cannot be DELIVERED unless payment status is PAID');
  });

  it('represents zero-credit launch payment choices', () => {
    expect(sql).toContain('PAY_ONLINE_NOW');
    expect(sql).toContain('PAY_ON_DELIVERY');
    expect(sql).not.toMatch(/'CREDIT'/);
    expect(sql).not.toMatch(/payment_method_intent.*CREDIT/);
  });

  it('models service area independently from pin codes', () => {
    expect(sql).toMatch(/CREATE TABLE public\.service_areas/);
    expect(sql).toMatch(/CREATE TABLE public\.serviceability_rules/);
    expect(sql).toContain('rule_type');
    expect(sql).toContain('config');
  });

  it('supports empty catalogue (no product seeds)', () => {
    expect(sql).toMatch(/CREATE TABLE public\.categories/);
    expect(sql).toMatch(/CREATE TABLE public\.products/);
    expect(sql).toMatch(/CREATE TABLE public\.skus/);
    expect(sql).not.toMatch(/INSERT INTO public\.products/);
    expect(sql).not.toMatch(/INSERT INTO public\.skus/);
  });

  it('uses append-only inventory movement and audit concepts', () => {
    expect(sql).toContain('inventory_movements');
    expect(sql).toContain('audit_logs');
    expect(sql).toContain('prevent_modification');
  });

  it('preserves order line commercial snapshots', () => {
    expect(sql).toContain('product_name_snapshot');
    expect(sql).toContain('sku_code_snapshot');
    expect(sql).toContain('agreed_unit_price');
    expect(sql).toContain('enforce_confirmed_order_line_immutability');
  });

  it('enables row level security without permissive true policies on orders', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(withoutComments).not.toMatch(
      /CREATE POLICY[\s\S]{0,400}ON public\.orders[\s\S]{0,400}USING\s*\(\s*true\s*\)/i
    );
  });
});
