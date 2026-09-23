import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixMigration = join(
  root,
  'supabase/migrations/20260827200000_fix_delivery_record_cash_payment_42804.sql',
);
const brokenMigration = join(
  root,
  'supabase/migrations/20260827160000_payment_cash_remaining_dashboard.sql',
);

/**
 * Regression for PostgREST/Postgres 42804:
 * payment_events.actor_role is staff_role; inserting a text variable fails with:
 *   column "actor_role" is of type staff_role but expression is of type text
 */
describe('delivery_record_cash_payment 42804 regression', () => {
  it('broken migration declared v_actor_role as text (historical cause)', () => {
    const sql = readFileSync(brokenMigration, 'utf8');
    const fnStart = sql.indexOf(
      'CREATE OR REPLACE FUNCTION public.delivery_record_cash_payment',
    );
    const fnBody = sql.slice(fnStart, fnStart + 2500);
    expect(fnBody).toMatch(/v_actor_role\s+text\s*;/);
  });

  it('fix migration types v_actor_role as public.staff_role with explicit casts', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/v_actor_role\s+public\.staff_role\s*;/);
    expect(sql).toMatch(/'ADMIN'::public\.staff_role/);
    expect(sql).toMatch(/'DELIVERY'::public\.staff_role/);
    expect(sql).not.toMatch(/v_actor_role\s+text\s*;/);
  });

  it('fix migration casts custody status and numeric branches explicitly', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(
      /'WITH_DRIVER'::public\.delivery_cod_custody_status/,
    );
    expect(sql).toMatch(/0::numeric/);
    expect(sql).toMatch(/v_new_status::text/);
    expect(sql).toMatch(/v_can_complete/);
  });

  it('fix keeps RETURNS jsonb and cash/remaining keys for the PWA', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/RETURNS jsonb/);
    expect(sql).toMatch(/'amountDue'/);
    expect(sql).toMatch(/'cashCollected'/);
    expect(sql).toMatch(/'remaining'/);
    expect(sql).toMatch(/'canCompleteDelivery'/);
    expect(sql).toMatch(/'onlineAction'/);
    expect(sql).toMatch(/cash_collected_amount\s*=\s*v_cash/);
    expect(sql).toMatch(/INSERT INTO public\.delivery_cod_custody/);
  });
});
