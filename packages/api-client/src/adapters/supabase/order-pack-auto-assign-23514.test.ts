import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const brokenLifecycle = join(
  root,
  'supabase/migrations/20260827150000_order_lifecycle_automation.sql',
);
const saleFixMigration = join(
  root,
  'supabase/migrations/20260827210000_fix_complete_stop_sale_event_23514.sql',
);
const packFixMigration = join(
  root,
  'supabase/migrations/20260831140000_fix_pack_auto_assign_order_events_23514.sql',
);

/**
 * Regression for PostgREST/Postgres 23514 on Pack Order:
 * try_auto_assign_delivery inserted READY_FOR_DISPATCH → READY_FOR_DISPATCH
 * NEEDS_ATTENTION notes when auto-assign could not complete.
 */
describe('admin_pack_order / try_auto_assign_delivery 23514 regression', () => {
  it('historical try_auto_assign_delivery used same from/to status (cause)', () => {
    const sql = readFileSync(brokenLifecycle, 'utf8');
    const fnStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.try_auto_assign_delivery');
    const fnEnd = sql.indexOf(
      'REVOKE ALL ON FUNCTION public.try_auto_assign_delivery',
      fnStart,
    );
    const fnBody = sql.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/v_order\.status, v_order\.status/);
  });

  it('sale conversion fix migration does not patch try_auto_assign_delivery', () => {
    const sql = readFileSync(saleFixMigration, 'utf8');
    expect(sql).not.toMatch(/try_auto_assign_delivery/);
    expect(sql).not.toMatch(/admin_pack_order/);
  });

  it('pack fix migration uses NULL from_status for NEEDS_ATTENTION in auto-assign', () => {
    const sql = readFileSync(packFixMigration, 'utf8');
    expect(sql).toMatch(/NULL, v_order\.status/);
    expect(sql).not.toMatch(/v_order\.status, v_order\.status/);
    expect(sql).toMatch(/order_events_status_changed/);
    expect(sql).toMatch(/alreadyPacked/);
  });

  it('admin_pack_order skips advance when already at READY_FOR_DISPATCH or later', () => {
    const sql = readFileSync(packFixMigration, 'utf8');
    expect(sql).toMatch(/v_already_packed boolean := false/);
    expect(sql).toMatch(/order_status_happy_path_index\(v_order\.status\) >= v_ready_idx/);
  });
});
