import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';

describe('Phase 7B.1: supplier payment delete journal consistency', () => {
  async function seedReceivedPurchaseWithPayment() {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `978${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `979${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    let supplierId = '';
    let purchaseId = '';
    let paymentId = '';

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: supplier, error: supplierError } = await client.rpc(
          'admin_create_supplier',
          {
            p_name: `PayDel ${Date.now()}`,
            p_mobile: null,
            p_is_active: true,
          },
        );
        expect(supplierError).toBeNull();
        supplierId = (supplier as { id: string }).id;

        const { data: purchase, error: purchaseError } = await client.rpc(
          'admin_upsert_purchase_draft',
          {
            p_purchase_id: null,
            p_supplier_id: supplierId,
            p_operational_location_id: locationId,
            p_purchase_date: '2026-10-12',
            p_bill_number: `PD-${randomUUID().slice(0, 8)}`,
            p_tax_amount: 0,
            p_notes: null,
            p_supply_type: 'UNSET',
            p_cgst_amount: 0,
            p_sgst_amount: 0,
            p_igst_amount: 0,
            p_items: [{ sku_id: skuId, quantity: 2, unit_cost: 50 }],
          },
        );
        expect(purchaseError).toBeNull();
        purchaseId = (purchase as { id: string }).id;

        const { error: receiveError } = await client.rpc(
          'admin_receive_purchase',
          { p_purchase_id: purchaseId },
        );
        expect(receiveError).toBeNull();

        const { data: payment, error: paymentError } = await client.rpc(
          'admin_record_supplier_payment',
          {
            p_supplier_id: supplierId,
            p_payment_date: '2026-10-12',
            p_amount: 40,
            p_payment_method: 'UPI',
            p_reference_number: 'UTR-DEL',
            p_notes: 'Partial',
            p_purchase_id: purchaseId,
          },
        );
        expect(paymentError).toBeNull();
        paymentId = (payment as { id: string }).id;

        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: '2026-10-01',
          p_date_to: '2026-10-31',
        });
        expect(sync.error).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    return { pool, admin, salesman, supplierId, purchaseId, paymentId };
  }

  it('delete posts balanced reversal then removes payment; retry is not found; non-admin blocked', async () => {
    const { pool, admin, salesman, purchaseId, paymentId } =
      await seedReceivedPurchaseWithPayment();

    const before = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(before.rows[0].c)).toBe(1);

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_delete_supplier_payment', {
          p_payment_id: paymentId,
        });
        expect(error).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const afterPay = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.supplier_payments WHERE id = $1`,
      [paymentId],
    );
    expect(Number(afterPay.rows[0].c)).toBe(0);

    const reversal = await pool.query<{
      c: string;
      balanced: boolean;
      ap_net: string;
      bank_net: string;
    }>(
      `SELECT
         count(*)::text AS c,
         coalesce(bool_and(abs(d - c2) < 0.001), false) AS balanced,
         coalesce((
           SELECT sum(jl.debit - jl.credit)::text
           FROM public.journal_entries je2
           JOIN public.journal_lines jl ON jl.journal_entry_id = je2.id
           JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
           WHERE je2.source_type = 'supplier_payment_reversal'
             AND je2.source_id = $1
             AND coa.code = '2000'
         ), '0') AS ap_net,
         coalesce((
           SELECT sum(jl.debit - jl.credit)::text
           FROM public.journal_entries je2
           JOIN public.journal_lines jl ON jl.journal_entry_id = je2.id
           JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
           WHERE je2.source_type = 'supplier_payment_reversal'
             AND je2.source_id = $1
             AND coa.code = '1010'
         ), '0') AS bank_net
       FROM (
         SELECT sum(jl.debit) AS d, sum(jl.credit) AS c2
         FROM public.journal_entries je
         JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
         WHERE je.source_type = 'supplier_payment_reversal'
           AND je.source_id = $1
         GROUP BY je.id
       ) x`,
      [paymentId],
    );
    expect(Number(reversal.rows[0].c)).toBe(1);
    expect(reversal.rows[0].balanced).toBe(true);
    // Original: Dr 2000 / Cr 1010 → reversal Cr 2000 / Dr 1010
    expect(Number(reversal.rows[0].ap_net)).toBe(-40);
    expect(Number(reversal.rows[0].bank_net)).toBe(40);

    // Original supplier_payment journal preserved.
    const original = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(original.rows[0].c)).toBe(1);

    // Payable no longer includes deleted payment.
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('purchase_payable_amounts', {
          p_purchase_id: purchaseId,
        });
        expect(error).toBeNull();
        const row = (data as Array<{ remaining: number | string }>)[0];
        expect(Number(row.remaining)).toBe(100);
      },
      { refreshToken: admin.refreshToken },
    );

    // Retry delete → not found (no duplicate reversal).
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_delete_supplier_payment', {
          p_payment_id: paymentId,
        });
        expect(error).not.toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const revCount = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment_reversal' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(revCount.rows[0].c)).toBe(1);

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_delete_supplier_payment', {
          p_payment_id: randomUUID(),
        });
        expect(error).not.toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('delete without prior journal still succeeds (no orphan invent)', async () => {
    const { pool, admin, supplierId, purchaseId } =
      await seedReceivedPurchaseWithPayment();

    // Create a second payment and delete BEFORE sync → no journal to reverse.
    let unpaidId = '';
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: payment, error } = await client.rpc(
          'admin_record_supplier_payment',
          {
            p_supplier_id: supplierId,
            p_payment_date: '2026-10-13',
            p_amount: 5,
            p_payment_method: 'CASH',
            p_reference_number: null,
            p_notes: 'unsynced',
            p_purchase_id: purchaseId,
          },
        );
        expect(error).toBeNull();
        unpaidId = (payment as { id: string }).id;

        const { error: delError } = await client.rpc(
          'admin_delete_supplier_payment',
          { p_payment_id: unpaidId },
        );
        expect(delError).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const { rows } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_id = $1
         AND source_type IN ('supplier_payment', 'supplier_payment_reversal')`,
      [unpaidId],
    );
    expect(Number(rows[0].c)).toBe(0);
  });
});
