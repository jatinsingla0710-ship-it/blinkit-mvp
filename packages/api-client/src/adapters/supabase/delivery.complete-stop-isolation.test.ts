import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixMigration = join(
  root,
  'supabase/migrations/20260831220000_fix_delivery_complete_stop_sale_isolation.sql',
);
const lifecycle = join(
  root,
  'supabase/migrations/20260827150000_order_lifecycle_automation.sql',
);

/**
 * Complete Delivery must not roll back when sale conversion fails.
 * Prior lifecycle body called try_auto_convert without isolation; convert
 * failures (23514 / audit signature) aborted the entire stop completion.
 */
describe('delivery_complete_stop sale isolation (20260831220000)', () => {
  const sql = readFileSync(fixMigration, 'utf8');

  it('redefines delivery_complete_stop after lifecycle automation', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.delivery_complete_stop\(/,
    );
    expect(fixMigration > lifecycle.replace(/\\/g, '/')).toBeTruthy();
  });

  it('isolates try_auto_convert so exceptions cannot abort delivery', () => {
    expect(sql).toMatch(
      /Sale conversion must NEVER roll back a successful delivery/,
    );
    expect(sql).toMatch(
      /BEGIN\s+PERFORM public\.try_auto_convert_order_to_sale\(v_order\.id\);\s+EXCEPTION WHEN OTHERS THEN/s,
    );
  });

  it('sale-created informational event uses NULL from_status (not DELIVERED→DELIVERED)', () => {
    expect(sql).toMatch(/NULL,\s*'DELIVERED'::public\.order_status/);
    expect(sql).not.toMatch(/'DELIVERED',\s*'DELIVERED'/);
  });

  it('write_audit_log uses staff_role variable', () => {
    expect(sql).toMatch(/v_actor_role public\.staff_role/);
    expect(sql).toMatch(/'DELIVERY'::public\.staff_role/);
    expect(sql).toMatch(/PERFORM public\.write_audit_log\([\s\S]*v_actor_role\s*\)/);
  });

  it('complete is idempotent when stop already COMPLETED', () => {
    expect(sql).toMatch(/IF v_stop\.status = 'COMPLETED'/);
    expect(sql).toMatch(/RETURN p_stop_id;/);
  });

  it('payment gate requires PAID with clear collect message', () => {
    expect(sql).toMatch(/Collect ₹% cash before completing delivery/);
    expect(sql).toMatch(/Payment must be PAID before completing delivery/);
  });

  it('try_auto_convert NEEDS_ATTENTION path uses NULL from_status', () => {
    expect(sql).toMatch(
      /NULL,\s*v_order\.status,\s*format\('NEEDS_ATTENTION: Sale conversion failed/s,
    );
  });
});
