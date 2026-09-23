import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const verifyInitial = join(
  root,
  'supabase/migrations/20260831230000_delivery_report_digital_payment.sql',
);
const verifyHarden = join(
  root,
  'supabase/migrations/20260831240000_harden_verify_payment_auto_sale.sql',
);
const lifecycle = join(
  root,
  'supabase/migrations/20260827150000_order_lifecycle_automation.sql',
);
const completeIsolation = join(
  root,
  'supabase/migrations/20260831220000_fix_delivery_complete_stop_sale_isolation.sql',
);
const completeDigital = join(
  root,
  'supabase/migrations/20260831230000_delivery_report_digital_payment.sql',
);

/**
 * End-to-end auto-sale after UPI/bank verify — two orderings.
 *
 * Scenario A: unpaid → report → DELIVERED → admin verify PAID → auto sale
 * Scenario B: unpaid → report → admin verify PAID → DELIVERED → auto sale
 */
describe('UPI verify ↔ deliver auto-sale chain', () => {
  const lifecycleSql = readFileSync(lifecycle, 'utf8');
  const hardenSql = readFileSync(verifyHarden, 'utf8');
  const completeSql = readFileSync(completeDigital, 'utf8');
  const isolationSql = readFileSync(completeIsolation, 'utf8');
  const initialVerifySql = readFileSync(verifyInitial, 'utf8');

  it('Scenario A path: admin_verify → _lifecycle_after_payment_or_delivery → try_auto_convert', () => {
    expect(hardenSql).toMatch(
      /PERFORM public\._lifecycle_after_payment_or_delivery\(p_order_id\)/,
    );
    expect(lifecycleSql).toMatch(
      /IF v_status = 'DELIVERED' THEN\s+PERFORM public\.try_auto_convert_order_to_sale\(p_order_id\);/s,
    );
  });

  it('Scenario A: already-PAID verify still retries lifecycle (idempotent conversion)', () => {
    expect(hardenSql).toMatch(/v_already := true/);
    expect(hardenSql).toMatch(
      /Always attempt auto-convert when DELIVERED\+PAID/,
    );
    // Must NOT return before lifecycle on already PAID
    expect(hardenSql).not.toMatch(
      /IF v_payment\.status = 'PAID'[\s\S]*RETURN jsonb_build_object\([\s\S]*alreadyVerified',\s*true[\s\S]*\);\s*END IF;/,
    );
  });

  it('Scenario A: conversion failure must not roll back PAID verification', () => {
    expect(hardenSql).toMatch(
      /BEGIN\s+PERFORM public\._lifecycle_after_payment_or_delivery\(p_order_id\);\s+EXCEPTION WHEN OTHERS THEN/s,
    );
    expect(hardenSql).toMatch(
      /NULL,\s*v_order\.status,\s*format\('NEEDS_ATTENTION: Sale conversion failed after payment verify/s,
    );
  });

  it('Scenario B path: delivery_complete_stop → try_auto_convert when already PAID', () => {
    expect(completeSql).toMatch(
      /PERFORM public\.try_auto_convert_order_to_sale\(v_order\.id\)/,
    );
    expect(isolationSql).toMatch(
      /IF v_payment_status IS DISTINCT FROM 'PAID' THEN[\s\S]*Payment not PAID/s,
    );
  });

  it('try_auto_convert is idempotent (sale_id / existing sales) and uses NULL from_status on failure', () => {
    expect(isolationSql).toMatch(/IF v_order\.sale_id IS NOT NULL/);
    expect(isolationSql).toMatch(/alreadyConverted',\s*true/);
    expect(isolationSql).toMatch(
      /NULL,\s*v_order\.status,\s*format\('NEEDS_ATTENTION: Sale conversion failed/s,
    );
  });

  it('reported pending delivery does not require PAID before complete (Scenario A mid-state)', () => {
    expect(initialVerifySql).toMatch(/v_digital_reported/);
    expect(completeSql).toMatch(/v_digital_reported/);
  });
});
