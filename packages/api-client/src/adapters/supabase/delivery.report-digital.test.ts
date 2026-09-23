import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const migration = join(
  root,
  'supabase/migrations/20260831230000_delivery_report_digital_payment.sql',
);

describe('delivery_report_digital_payment migration', () => {
  const sql = readFileSync(migration, 'utf8');

  it('defines report / verify / reject RPCs', () => {
    expect(sql).toMatch(/delivery_report_digital_payment/);
    expect(sql).toMatch(/admin_verify_reported_payment/);
    expect(sql).toMatch(/admin_reject_reported_payment/);
  });

  it('report sets PAYMENT_PENDING and does not invent PAID/online collected', () => {
    expect(sql).toMatch(/'PAYMENT_PENDING'::public\.payment_status/);
    expect(sql).toMatch(/REPORTED_AWAITING_VERIFICATION/);
    expect(sql).toMatch(/Do NOT credit online_collected until admin verifies/);
  });

  it('complete stop allows digital reported pending without requiring PAID', () => {
    expect(sql).toMatch(/v_digital_reported/);
    expect(sql).toMatch(/Record the customer payment before completing delivery/);
  });

  it('verify marks PAID; reject returns UNPAID', () => {
    expect(sql).toMatch(/admin_verify_reported_payment/);
    expect(sql).toMatch(/status = 'PAID'::public\.payment_status/);
    expect(sql).toMatch(/status = 'UNPAID'::public\.payment_status/);
  });
});
