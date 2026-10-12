import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';
import { getPool, withUserClient } from '../../src/client';

type PayableRow = {
  path: string;
  bill_total: string;
  receipt_total: string;
  return_total: string;
  payable_basis: string;
  linked_payments: string;
  remaining: string;
  credit_on_bill: string;
  has_receipt_events: boolean;
  status: string;
};

describe('Phase 6B.2D: purchase payables consistency', () => {
  async function seedDraft(opts?: {
    quantity?: number;
    unitCost?: number;
    taxAmount?: number;
    cgst?: number;
    sgst?: number;
  }) {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `975${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);
    const qty = opts?.quantity ?? 10;
    const unitCost = opts?.unitCost ?? 100;
    const taxAmount = opts?.taxAmount ?? 180;
    const cgst = opts?.cgst ?? 90;
    const sgst = opts?.sgst ?? 90;

    let purchaseId = '';
    let itemId = '';
    let supplierId = '';

    await withUserClient(admin.accessToken, async (client) => {
      const { data: supplier, error: supplierError } = await client.rpc(
        'admin_create_supplier',
        {
          p_name: `Payables ${Date.now()}`,
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
          p_purchase_date: '2026-10-10',
          p_bill_number: `PAYB-${randomUUID().slice(0, 8)}`,
          p_tax_amount: taxAmount,
          p_notes: null,
          p_supply_type: 'INTRA',
          p_cgst_amount: cgst,
          p_sgst_amount: sgst,
          p_igst_amount: 0,
          p_items: [{ sku_id: skuId, quantity: qty, unit_cost: unitCost }],
        },
      );
      expect(purchaseError).toBeNull();
      purchaseId = (purchase as { id: string }).id;

      const { data: items } = await client
        .from('purchase_items')
        .select('id')
        .eq('purchase_id', purchaseId);
      itemId = (items ?? [])[0]?.id as string;
    });

    return {
      pool,
      admin,
      skuId,
      locationId,
      purchaseId,
      itemId,
      supplierId,
      qty,
      unitCost,
      taxAmount,
    };
  }

  async function payableAmounts(
    accessToken: string,
    purchaseId: string,
  ): Promise<PayableRow> {
    return withUserClient(accessToken, async (client) => {
      const { data, error } = await client.rpc('purchase_payable_amounts', {
        p_purchase_id: purchaseId,
      });
      expect(error).toBeNull();
      const row = Array.isArray(data) ? data[0] : data;
      expect(row).toBeTruthy();
      return row as PayableRow;
    });
  }

  it('draft has no payable; partial then full receipts reconcile; return + payment credit', async () => {
    const { pool, admin, purchaseId, itemId, supplierId, taxAmount } =
      await seedDraft({
        quantity: 10,
        unitCost: 100,
        taxAmount: 180,
        cgst: 90,
        sgst: 90,
      });

    let amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(amounts.path).toBe('none');
    expect(Number(amounts.payable_basis)).toBe(0);
    expect(Number(amounts.bill_total)).toBe(1180);

    await withUserClient(admin.accessToken, async (client) => {
      const r1 = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
        p_client_request_id: `pr1-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(r1.error).toBeNull();
    });

    amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(amounts.status).toBe('PARTIALLY_RECEIVED');
    expect(amounts.path).toBe('receipt_events');
    expect(Number(amounts.payable_basis)).toBe(472);
    expect(Number(amounts.bill_total)).toBe(1180);

    await withUserClient(admin.accessToken, async (client) => {
      const pay = await client.rpc('admin_record_supplier_payment', {
        p_supplier_id: supplierId,
        p_payment_date: '2026-10-10',
        p_amount: 200,
        p_payment_method: 'UPI',
        p_reference_number: 'PARTIAL-OK',
        p_notes: null,
        p_purchase_id: purchaseId,
      });
      expect(pay.error).toBeNull();

      const r2 = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 6 }],
        p_client_request_id: `pr2-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(r2.error).toBeNull();
    });

    amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(amounts.status).toBe('RECEIVED');
    expect(Number(amounts.receipt_total)).toBe(1180);
    expect(Number(amounts.payable_basis)).toBe(1180);
    expect(Number(amounts.linked_payments)).toBe(200);
    expect(Number(amounts.remaining)).toBe(980);

    // Cumulative receipt tax reconciles to bill tax.
    const receiptTax = await pool.query<{ tax: string }>(
      `SELECT coalesce(sum(tax_amount),0)::text AS tax
       FROM public.purchase_receipts WHERE purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(receiptTax.rows[0].tax)).toBe(taxAmount);

    await withUserClient(admin.accessToken, async (client) => {
      const payFull = await client.rpc('admin_record_supplier_payment', {
        p_supplier_id: supplierId,
        p_payment_date: '2026-10-11',
        p_amount: 980,
        p_payment_method: 'BANK',
        p_purchase_id: purchaseId,
      });
      expect(payFull.error).toBeNull();

      const ret = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Credit after payment',
        p_client_request_id: `ret-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(ret.error).toBeNull();
    });

    amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(Number(amounts.return_total)).toBeGreaterThan(0);
    expect(Number(amounts.payable_basis)).toBeLessThan(1180);
    expect(Number(amounts.remaining)).toBeLessThan(0);
    expect(Number(amounts.credit_on_bill)).toBeGreaterThan(0);

    // Bill total never shrinks.
    const bill = await pool.query<{ total: string }>(
      `SELECT total::text FROM public.purchases WHERE id = $1`,
      [purchaseId],
    );
    expect(Number(bill.rows[0].total)).toBe(1180);
  });

  it('accepts overpayment as credit; supplier-level payment preserved; journals unique', async () => {
    const { pool, admin, purchaseId, itemId, supplierId } = await seedDraft({
      quantity: 5,
      unitCost: 20,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
    });

    await withUserClient(admin.accessToken, async (client) => {
      await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 5 }],
        p_actor_profile_id: admin.id,
      });

      const over = await client.rpc('admin_record_supplier_payment', {
        p_supplier_id: supplierId,
        p_payment_date: '2026-10-10',
        p_amount: 150,
        p_payment_method: 'CASH',
        p_purchase_id: purchaseId,
      });
      expect(over.error).toBeNull();

      const unlinked = await client.rpc('admin_record_supplier_payment', {
        p_supplier_id: supplierId,
        p_payment_date: '2026-10-10',
        p_amount: 25,
        p_payment_method: 'UPI',
        p_purchase_id: null,
      });
      expect(unlinked.error).toBeNull();
    });

    const amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(Number(amounts.payable_basis)).toBe(100);
    expect(Number(amounts.linked_payments)).toBe(150);
    expect(Number(amounts.remaining)).toBe(-50);
    expect(Number(amounts.credit_on_bill)).toBe(50);

    const unlinkedCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.supplier_payments
       WHERE supplier_id = $1 AND purchase_id IS NULL`,
      [supplierId],
    );
    expect(Number(unlinkedCount.rows[0].count)).toBe(1);

    await withUserClient(admin.accessToken, async (client) => {
      const sync1 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-10-01',
        p_date_to: '2026-10-31',
      });
      expect(sync1.error).toBeNull();
      const sync2 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-10-01',
        p_date_to: '2026-10-31',
      });
      expect(sync2.error).toBeNull();
    });

    const journals = await pool.query<{ source_type: string; count: string }>(
      `SELECT source_type, count(*)::text AS count
       FROM public.journal_entries
       WHERE (
         source_type = 'purchase_receipt'
         AND source_id IN (
           SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
         )
       ) OR (
         source_type = 'supplier_payment'
         AND source_id IN (
           SELECT id FROM public.supplier_payments WHERE supplier_id = $2
         )
       )
       GROUP BY source_type`,
      [purchaseId, supplierId],
    );
    const byType = Object.fromEntries(
      journals.rows.map((r) => [r.source_type, Number(r.count)]),
    );
    expect(byType.purchase_receipt).toBe(1);
    expect(byType.supplier_payment).toBe(2);

    const balanced = await pool.query<{ ok: boolean }>(
      `SELECT bool_and(abs(d - c) < 0.001) AS ok
       FROM (
         SELECT je.id, sum(jl.debit) AS d, sum(jl.credit) AS c
         FROM public.journal_entries je
         JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
         WHERE je.source_type IN ('purchase_receipt', 'supplier_payment')
           AND (
             (je.source_type = 'purchase_receipt' AND je.source_id IN (
               SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
             ))
             OR (je.source_type = 'supplier_payment' AND je.source_id IN (
               SELECT id FROM public.supplier_payments WHERE supplier_id = $2
             ))
           )
         GROUP BY je.id
       ) x`,
      [purchaseId, supplierId],
    );
    expect(balanced.rows[0].ok).toBe(true);
  });

  it('legacy RECEIVED without receipt rows keeps bill-total payable; no double journal', async () => {
    const { pool, admin, purchaseId, supplierId } = await seedDraft({
      quantity: 2,
      unitCost: 50,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
    });

    // Force legacy path: receive via wrapper, then delete receipt-event rows
    // is not allowed if FK/movements exist — instead insert a RECEIVED purchase
    // with purchase_item RECEIPT only (simulate pre-6B.2B) via SQL trusted path.
    await withUserClient(admin.accessToken, async (client) => {
      const recv = await client.rpc('admin_receive_purchase', {
        p_purchase_id: purchaseId,
      });
      expect(recv.error).toBeNull();
    });

    // New-path purchase has receipt events.
    let amounts = await payableAmounts(admin.accessToken, purchaseId);
    expect(amounts.path).toBe('receipt_events');
    expect(Number(amounts.payable_basis)).toBe(100);

    // Build a true legacy row: RECEIVED, no purchase_receipts.
    const legacy = await pool.query<{ id: string }>(
      `WITH s AS (
         SELECT supplier_id, operational_location_id FROM public.purchases WHERE id = $1
       )
       INSERT INTO public.purchases (
         supplier_id, operational_location_id, purchase_date, bill_number,
         status, subtotal, tax_amount, total, received_at, first_received_at,
         supply_type, cgst_amount, sgst_amount, igst_amount
       )
       SELECT
         s.supplier_id, s.operational_location_id, '2026-09-01', $2,
         'RECEIVED', 200, 0, 200, now(), now(),
         'UNSET', 0, 0, 0
       FROM s
       RETURNING id`,
      [purchaseId, `LEG-${randomUUID().slice(0, 8)}`],
    );
    const legacyId = legacy.rows[0].id;

    amounts = await payableAmounts(admin.accessToken, legacyId);
    expect(amounts.path).toBe('legacy');
    expect(Number(amounts.payable_basis)).toBe(200);
    expect(amounts.has_receipt_events).toBe(false);

    await withUserClient(admin.accessToken, async (client) => {
      const pay = await client.rpc('admin_record_supplier_payment', {
        p_supplier_id: supplierId,
        p_payment_date: '2026-09-02',
        p_amount: 50,
        p_payment_method: 'CASH',
        p_purchase_id: legacyId,
      });
      expect(pay.error).toBeNull();

      const sync1 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-09-01',
        p_date_to: '2026-10-31',
      });
      expect(sync1.error).toBeNull();
      const sync2 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-09-01',
        p_date_to: '2026-10-31',
      });
      expect(sync2.error).toBeNull();
    });

    const legacyJournals = await pool.query<{
      receive_count: string;
      receipt_count: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM public.journal_entries
          WHERE source_type = 'purchase_receive' AND source_id = $1) AS receive_count,
         (SELECT count(*)::text FROM public.journal_entries
          WHERE source_type = 'purchase_receipt'
            AND source_id IN (
              SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
            )) AS receipt_count`,
      [legacyId],
    );
    expect(Number(legacyJournals.rows[0].receive_count)).toBe(1);
    expect(Number(legacyJournals.rows[0].receipt_count)).toBe(0);

    amounts = await payableAmounts(admin.accessToken, legacyId);
    expect(Number(amounts.remaining)).toBe(150);
  });

  it('blocks non-admin from purchase_payable_amounts', async () => {
    const { purchaseId } = await seedDraft({ quantity: 2, taxAmount: 0 });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `976${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await withUserClient(salesman.accessToken, async (client) => {
      const { error } = await client.rpc('purchase_payable_amounts', {
        p_purchase_id: purchaseId,
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/only admin|42501|permission/i);
    });
  });
});
