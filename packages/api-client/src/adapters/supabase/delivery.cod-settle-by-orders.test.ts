import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const settleByIds = join(
  root,
  'supabase/migrations/20260831250000_cod_custody_settle_by_order_ids.sql',
);
const amountMatch = join(
  root,
  'supabase/migrations/20260830210000_cod_custody_manager_owner.sql',
);
const recordCash = join(
  root,
  'supabase/migrations/20260827200000_fix_delivery_record_cash_payment_42804.sql',
);

describe('COD custody settle by order_ids (20260831250000)', () => {
  const sql = readFileSync(settleByIds, 'utf8');
  const legacy = readFileSync(amountMatch, 'utf8');
  const cashSql = readFileSync(recordCash, 'utf8');

  it('Collect Cash inserts WITH_DRIVER custody (prerequisite)', () => {
    expect(cashSql).toMatch(/INSERT INTO public\.delivery_cod_custody/);
    expect(cashSql).toMatch(/'WITH_DRIVER'::public\.delivery_cod_custody_status/);
    expect(cashSql).toMatch(/ON CONFLICT \(order_id\)/);
  });

  it('legacy amount RPC matched full rows with amount <= remaining (root cause)', () => {
    expect(legacy).toMatch(
      /No matching WITH_DRIVER COD custody found for this amount/,
    );
    expect(legacy).toMatch(/IF v_row\.amount <= v_remaining THEN/);
  });

  it('adds selected-order settle and owner confirm RPCs', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_settle_delivery_cod_selected\(/,
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_confirm_owner_cod_receipt_selected\(/,
    );
    expect(sql).toMatch(/p_order_ids uuid\[\]/);
  });

  it('validates driver + WITH_DRIVER before updating selected rows', () => {
    expect(sql).toMatch(
      /belong to another delivery boy/,
    );
    expect(sql).toMatch(
      /status = 'WITH_DRIVER'::public\.delivery_cod_custody_status/,
    );
    expect(sql).toMatch(/Duplicate receive blocked/);
  });

  it('owner confirm uses custody IDs and RECEIVED_BY_MANAGER gate', () => {
    expect(sql).toMatch(
      /status = 'RECEIVED_BY_MANAGER'::public\.delivery_cod_custody_status/,
    );
    expect(sql).toMatch(/Duplicate owner confirm blocked/);
    expect(sql).toMatch(/toStatus', 'RECEIVED_BY_OWNER'/);
  });

  it('does not invent partial custody split logic', () => {
    expect(sql).toMatch(/Partial split of a single custody row is NOT supported/);
    expect(sql).not.toMatch(/INSERT INTO public\.delivery_cod_custody/);
    expect(sql).toMatch(/p_order_ids uuid\[\]/);
  });
});
