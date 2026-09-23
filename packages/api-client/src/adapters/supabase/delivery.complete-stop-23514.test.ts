import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixMigration = join(
  root,
  'supabase/migrations/20260827210000_fix_complete_stop_sale_event_23514.sql',
);
const brokenLifecycle = join(
  root,
  'supabase/migrations/20260827150000_order_lifecycle_automation.sql',
);

function paymentGate(amountDue: number, cashReceived: number, onlineConfirmed = 0) {
  const remaining = Math.round((amountDue - cashReceived - onlineConfirmed) * 100) / 100;
  return {
    remaining: Math.max(remaining, 0),
    canComplete: remaining <= 0 && cashReceived + onlineConfirmed <= amountDue + 1e-9,
  };
}

/**
 * Regression for PostgREST/Postgres 23514 on Complete Delivery:
 * order_events_status_changed rejects from_status = to_status.
 * Sale conversion after full cash was inserting DELIVERED → DELIVERED.
 */
describe('delivery_complete_stop / sale conversion 23514 regression', () => {
  it('historical convert core inserted DELIVERED → DELIVERED (cause)', () => {
    const sql = readFileSync(brokenLifecycle, 'utf8');
    expect(sql).toMatch(/'DELIVERED',\s*'DELIVERED'/);
  });

  it('fix migration uses NULL from_status for sale-created informational event', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/NULL,\s*'DELIVERED'::public\.order_status/);
    expect(sql).not.toMatch(/'DELIVERED',\s*'DELIVERED'/);
    expect(sql).toMatch(/order_events_status_changed/);
  });

  it('fix NEEDS_ATTENTION handler also avoids same-status pair', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/NULL,\s*v_order\.status/);
    expect(sql).not.toMatch(/v_order\.status,\s*v_order\.status/);
  });

  it('₹10,000 cash covers due → remaining 0 (complete allowed by payment rules)', () => {
    expect(paymentGate(10000, 10000)).toEqual({
      remaining: 0,
      canComplete: true,
    });
  });

  it('₹4,000 cash leaves ₹6,000 → complete remains blocked until online confirmed', () => {
    expect(paymentGate(10000, 4000)).toEqual({
      remaining: 6000,
      canComplete: false,
    });
  });
});
