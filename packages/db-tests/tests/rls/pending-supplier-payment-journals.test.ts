import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  getDbTestConfig,
  getPool,
  getServiceClient,
  withUserClient,
} from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';

type PendingResult = {
  pendingTotal: number;
  pendingCount: number;
};

async function pendingViaSql(): Promise<PendingResult> {
  const pool = getPool();
  const { rows } = await pool.query<{
    pending_total: string;
    pending_count: string;
  }>(
    `SELECT
       coalesce(round(sum(sp.amount), 2), 0)::text AS pending_total,
       count(*)::text AS pending_count
     FROM public.supplier_payments sp
     WHERE NOT EXISTS (
       SELECT 1
       FROM public.journal_entries je
       WHERE je.source_type = 'supplier_payment'
         AND je.source_id = sp.id
     )`,
  );
  return {
    pendingTotal: Number(rows[0].pending_total),
    pendingCount: Number(rows[0].pending_count),
  };
}

async function pendingViaRpc(
  accessToken: string,
  refreshToken?: string,
): Promise<PendingResult> {
  let result: PendingResult | null = null;
  await withUserClient(
    accessToken,
    async (client) => {
      const { data, error } = await client.rpc(
        'admin_pending_supplier_payment_journals',
      );
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      const raw = data as { pendingTotal: unknown; pendingCount: unknown };
      result = {
        pendingTotal: Number(raw.pendingTotal),
        pendingCount: Number(raw.pendingCount),
      };
    },
    refreshToken ? { refreshToken } : undefined,
  );
  expect(result).not.toBeNull();
  return result!;
}

describe('Phase 7B.4: admin_pending_supplier_payment_journals', () => {
  async function seedUnsyncedPayment() {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `983${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    let supplierId = '';
    let purchaseId = '';
    let paymentId = '';
    const paymentDate = '2026-10-16';
    const amount = 42.5;

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: supplier, error: supplierError } = await client.rpc(
          'admin_create_supplier',
          {
            p_name: `PendingJnl ${Date.now()}`,
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
            p_bill_number: `PJ-${randomUUID().slice(0, 8)}`,
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
            p_notes: 'pending journal seed',
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

  it('unsynced payment increases pending total and count; RPC matches SQL', async () => {
    const baselineSql = await pendingViaSql();
    const { admin, amount, paymentId } = await seedUnsyncedPayment();

    const sql = await pendingViaSql();
    expect(sql.pendingTotal).toBeCloseTo(baselineSql.pendingTotal + amount, 2);
    expect(sql.pendingCount).toBe(baselineSql.pendingCount + 1);

    const rpc = await pendingViaRpc(admin.accessToken, admin.refreshToken);
    expect(rpc.pendingTotal).toBeCloseTo(sql.pendingTotal, 2);
    expect(rpc.pendingCount).toBe(sql.pendingCount);

    const ours = await getPool().query<{ pending: boolean }>(
      `SELECT NOT EXISTS (
         SELECT 1 FROM public.journal_entries
         WHERE source_type = 'supplier_payment' AND source_id = $1
       ) AS pending`,
      [paymentId],
    );
    expect(ours.rows[0].pending).toBe(true);
  });

  it('after sync, pending contribution is zero; double-sync stays zero', async () => {
    const { admin, paymentId, paymentDate, amount } =
      await seedUnsyncedPayment();
    const beforeSync = await pendingViaRpc(
      admin.accessToken,
      admin.refreshToken,
    );
    expect(beforeSync.pendingTotal).toBeGreaterThanOrEqual(amount);
    expect(beforeSync.pendingCount).toBeGreaterThanOrEqual(1);

    let afterFirst: PendingResult = { pendingTotal: 0, pendingCount: 0 };
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const sync1 = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: paymentDate,
          p_date_to: paymentDate,
        });
        expect(sync1.error).toBeNull();

        const firstResp = await client.rpc(
          'admin_pending_supplier_payment_journals',
        );
        expect(firstResp.error).toBeNull();
        afterFirst = {
          pendingTotal: Number(
            (firstResp.data as PendingResult).pendingTotal,
          ),
          pendingCount: Number(
            (firstResp.data as PendingResult).pendingCount,
          ),
        };
        // This payment's amount is no longer pending (same-date siblings may sync too).
        expect(afterFirst.pendingTotal).toBeLessThanOrEqual(
          beforeSync.pendingTotal - amount + 0.001,
        );
        expect(afterFirst.pendingCount).toBeLessThanOrEqual(
          beforeSync.pendingCount - 1,
        );

        const sync2 = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: paymentDate,
          p_date_to: paymentDate,
        });
        expect(sync2.error).toBeNull();

        const afterSecond = await client.rpc(
          'admin_pending_supplier_payment_journals',
        );
        expect(afterSecond.error).toBeNull();
        const second = afterSecond.data as PendingResult;
        expect(Number(second.pendingTotal)).toBeCloseTo(
          afterFirst.pendingTotal,
          2,
        );
        expect(Number(second.pendingCount)).toBe(afterFirst.pendingCount);
      },
      { refreshToken: admin.refreshToken },
    );

    const journal = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'supplier_payment' AND source_id = $1`,
      [paymentId],
    );
    expect(Number(journal.rows[0].c)).toBe(1);

    const oursPending = await getPool().query<{ pending: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.supplier_payments sp
         WHERE sp.id = $1
           AND NOT EXISTS (
             SELECT 1 FROM public.journal_entries je
             WHERE je.source_type = 'supplier_payment' AND je.source_id = sp.id
           )
       ) AS pending`,
      [paymentId],
    );
    expect(oursPending.rows[0].pending).toBe(false);

    const sql = await pendingViaSql();
    const rpc = await pendingViaRpc(admin.accessToken, admin.refreshToken);
    expect(rpc.pendingTotal).toBeCloseTo(sql.pendingTotal, 2);
    expect(rpc.pendingCount).toBe(sql.pendingCount);
  });

  it('deleting a synchronized payment does not count the reversal as pending', async () => {
    const { admin, paymentId, paymentDate, amount } =
      await seedUnsyncedPayment();

    let afterSync: PendingResult = { pendingTotal: 0, pendingCount: 0 };
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: paymentDate,
          p_date_to: paymentDate,
        });
        expect(sync.error).toBeNull();

        const pending = await client.rpc(
          'admin_pending_supplier_payment_journals',
        );
        expect(pending.error).toBeNull();
        afterSync = {
          pendingTotal: Number(
            (pending.data as PendingResult).pendingTotal,
          ),
          pendingCount: Number(
            (pending.data as PendingResult).pendingCount,
          ),
        };

        const { error: delError } = await client.rpc(
          'admin_delete_supplier_payment',
          { p_payment_id: paymentId },
        );
        expect(delError).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const state = await getPool().query<{
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
    expect(state.rows[0].payment_exists).toBe(false);
    expect(state.rows[0].has_journal).toBe(true);
    expect(state.rows[0].has_reversal).toBe(true);

    const rpc = await pendingViaRpc(admin.accessToken, admin.refreshToken);
    const sql = await pendingViaSql();
    expect(rpc.pendingTotal).toBeCloseTo(sql.pendingTotal, 2);
    expect(rpc.pendingCount).toBe(sql.pendingCount);
    // Reversal must not re-introduce the deleted payment amount as pending.
    expect(rpc.pendingTotal).toBeCloseTo(afterSync.pendingTotal, 2);
    expect(rpc.pendingCount).toBe(afterSync.pendingCount);
    expect(rpc.pendingTotal).not.toBeCloseTo(
      afterSync.pendingTotal + amount,
      2,
    );
  });

  it('rejects non-admin callers with 42501', async () => {
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `984${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await withUserClient(salesman.accessToken, async (client) => {
      const { error } = await client.rpc(
        'admin_pending_supplier_payment_journals',
      );
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(
        /only admin|42501|permission/i,
      );
    });
  });

  it('anon lacks EXECUTE; authenticated and service_role retain EXECUTE', async () => {
    const pool = getPool();
    const fn = 'public.admin_pending_supplier_payment_journals()';
    const { rows } = await pool.query<{
      anon_exec: boolean;
      auth_exec: boolean;
      service_exec: boolean;
    }>(
      `SELECT
         has_function_privilege('anon', $1, 'EXECUTE') AS anon_exec,
         has_function_privilege('authenticated', $1, 'EXECUTE') AS auth_exec,
         has_function_privilege('service_role', $1, 'EXECUTE') AS service_exec`,
      [fn],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].anon_exec).toBe(false);
    expect(rows[0].auth_exec).toBe(true);
    expect(rows[0].service_exec).toBe(true);
  });

  it('anon PostgREST client cannot call admin_pending_supplier_payment_journals', async () => {
    const { supabaseUrl, anonKey } = getDbTestConfig();
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await anon.rpc(
      'admin_pending_supplier_payment_journals',
    );

    expect(error).toBeTruthy();
    expect(error?.message ?? '').toMatch(
      /permission denied|not authorized|42501|Could not find/i,
    );
  });

  it('service_role retains EXECUTE but non-admin call is rejected by is_admin', async () => {
    const service = getServiceClient();
    const { error } = await service.rpc(
      'admin_pending_supplier_payment_journals',
    );
    // Privilege exists; admin gate should still block service_role without admin JWT.
    expect(error).toBeTruthy();
    expect(error?.message ?? '').toMatch(
      /Only admin can view pending supplier-payment journals/i,
    );
  });
});

