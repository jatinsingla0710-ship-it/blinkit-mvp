import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';

async function assertNoUnrepairedOrphan(paymentId: string) {
  const pool = getPool();
  const { rows } = await pool.query<{
    payment_exists: boolean;
    has_journal: boolean;
    has_reversal: boolean;
  }>(
    `SELECT
       EXISTS (SELECT 1 FROM public.supplier_payments WHERE id = $1) AS payment_exists,
       EXISTS (
         SELECT 1 FROM public.journal_entries
         WHERE source_type = 'supplier_payment' AND source_id = $1
       ) AS has_journal,
       EXISTS (
         SELECT 1 FROM public.journal_entries
         WHERE source_type = 'supplier_payment_reversal' AND source_id = $1
       ) AS has_reversal`,
    [paymentId],
  );
  const r = rows[0];
  if (!r.payment_exists && r.has_journal) {
    expect(r.has_reversal).toBe(true);
  }
  return r;
}

describe('Phase 7B.3B: supplier-payment sync/delete race', () => {
  async function seedUnsyncedPayment() {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `981${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    let supplierId = '';
    let purchaseId = '';
    let paymentId = '';
    const paymentDate = '2026-10-14';
    const amount = 35;

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: supplier, error: supplierError } = await client.rpc(
          'admin_create_supplier',
          {
            p_name: `SyncRace ${Date.now()}`,
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
            p_purchase_date: paymentDate,
            p_bill_number: `SR-${randomUUID().slice(0, 8)}`,
            p_tax_amount: 0,
            p_notes: null,
            p_supply_type: 'UNSET',
            p_cgst_amount: 0,
            p_sgst_amount: 0,
            p_igst_amount: 0,
            p_items: [{ sku_id: skuId, quantity: 1, unit_cost: 80 }],
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
            p_payment_date: paymentDate,
            p_amount: amount,
            p_payment_method: 'UPI',
            p_reference_number: null,
            p_notes: 'unsynced race seed',
            p_purchase_id: purchaseId,
          },
        );
        expect(paymentError).toBeNull();
        paymentId = (payment as { id: string }).id;
      },
      { refreshToken: admin.refreshToken },
    );

    const journalBefore = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(journalBefore.rows[0].c)).toBe(0);

    return { pool, admin, paymentId, paymentDate, amount };
  }

  it('Scenario A: sync-held row lock blocks delete until journal posts; delete then reverses', async () => {
    const { pool, admin, paymentId, paymentDate, amount } =
      await seedUnsyncedPayment();

    const holder = await pool.connect();
    let holderCommitted = false;
    try {
      await holder.query('BEGIN');
      const locked = await holder.query<{ id: string }>(
        `SELECT id FROM public.supplier_payments WHERE id = $1 FOR UPDATE`,
        [paymentId],
      );
      expect(locked.rows.length).toBe(1);

      // Mirror sync critical section: post journal while holding the payment lock.
      await holder.query(
        `SELECT public._accounting_post_journal(
           $1::date,
           'supplier_payment',
           $2::uuid,
           'Supplier payment',
           jsonb_build_array(
             jsonb_build_object('account_code', '2000', 'debit', $3::numeric, 'credit', 0),
             jsonb_build_object('account_code', '1010', 'debit', 0, 'credit', $3::numeric)
           ),
           NULL
         )`,
        [paymentDate, paymentId, amount],
      );

      // Prove delete cannot finish while the lock is held (lock_timeout).
      const waiter = await pool.connect();
      let timedOut = false;
      try {
        await waiter.query('BEGIN');
        await waiter.query(`SET LOCAL lock_timeout = '200ms'`);
        try {
          await waiter.query(
            `SELECT id FROM public.supplier_payments WHERE id = $1 FOR UPDATE`,
            [paymentId],
          );
        } catch (err) {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code: unknown }).code)
              : '';
          timedOut =
            code === '55P03' || String(err).includes('lock_timeout');
        }
      } finally {
        await waiter.query('ROLLBACK').catch(() => undefined);
        waiter.release();
      }
      expect(timedOut).toBe(true);

      const stillPresent = await pool.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM public.supplier_payments WHERE id = $1`,
        [paymentId],
      );
      expect(Number(stillPresent.rows[0].c)).toBe(1);

      await holder.query('COMMIT');
      holderCommitted = true;
    } finally {
      // Clear checked-out txn on failure so assertions cannot poison the pool.
      if (!holderCommitted) {
        await holder.query('ROLLBACK').catch(() => undefined);
      }
      holder.release();
    }

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

    const state = await assertNoUnrepairedOrphan(paymentId);
    expect(state.payment_exists).toBe(false);
    expect(state.has_journal).toBe(true);
    expect(state.has_reversal).toBe(true);
  });

  it('Scenario B: delete commits first; sync skips and creates no orphan journal', async () => {
    const { admin, paymentId, paymentDate } = await seedUnsyncedPayment();

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error: delError } = await client.rpc(
          'admin_delete_supplier_payment',
          { p_payment_id: paymentId },
        );
        expect(delError).toBeNull();

        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: paymentDate,
          p_date_to: paymentDate,
        });
        expect(sync.error).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const state = await assertNoUnrepairedOrphan(paymentId);
    expect(state.payment_exists).toBe(false);
    expect(state.has_journal).toBe(false);
    expect(state.has_reversal).toBe(false);
  });

  it('real sync RPC after seed posts journal; delete reverses under invariant', async () => {
    const { admin, paymentId, paymentDate } = await seedUnsyncedPayment();

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: paymentDate,
          p_date_to: paymentDate,
        });
        expect(sync.error).toBeNull();

        const { error: delError } = await client.rpc(
          'admin_delete_supplier_payment',
          { p_payment_id: paymentId },
        );
        expect(delError).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const state = await assertNoUnrepairedOrphan(paymentId);
    expect(state.payment_exists).toBe(false);
    expect(state.has_journal).toBe(true);
    expect(state.has_reversal).toBe(true);
  });
});
