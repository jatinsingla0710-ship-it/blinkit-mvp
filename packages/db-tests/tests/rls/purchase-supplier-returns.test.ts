import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';
import { getPool, withUserClient } from '../../src/client';

type ReturnResult = {
  purchaseId: string;
  returnId?: string;
  idempotentReplay?: boolean;
  movementCount?: number;
  totalQuantity?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  reason?: string;
};

describe('Phase 6B.2C: supplier purchase returns', () => {
  async function seedReceivedPurchase(opts?: {
    quantity?: number;
    receiveQty?: number;
    unitCost?: number;
    taxAmount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  }) {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `974${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);
    const qty = opts?.quantity ?? 10;
    const receiveQty = opts?.receiveQty ?? qty;
    const unitCost = opts?.unitCost ?? 20;
    const taxAmount = opts?.taxAmount ?? 36;
    const cgst = opts?.cgst ?? 18;
    const sgst = opts?.sgst ?? 18;
    const igst = opts?.igst ?? 0;

    let purchaseId = '';
    let itemId = '';
    let receiptLineId: string | null = null;

    await withUserClient(admin.accessToken, async (client) => {
      const { data: supplier, error: supplierError } = await client.rpc(
        'admin_create_supplier',
        {
          p_name: `Return Rx ${Date.now()}`,
          p_mobile: null,
          p_is_active: true,
        },
      );
      expect(supplierError).toBeNull();
      const supplierId = (supplier as { id: string }).id;

      const { data: purchase, error: purchaseError } = await client.rpc(
        'admin_upsert_purchase_draft',
        {
          p_purchase_id: null,
          p_supplier_id: supplierId,
          p_operational_location_id: locationId,
          p_purchase_date: '2026-10-10',
          p_bill_number: `RET-${randomUUID().slice(0, 8)}`,
          p_tax_amount: taxAmount,
          p_notes: null,
          p_supply_type: 'INTRA',
          p_cgst_amount: cgst,
          p_sgst_amount: sgst,
          p_igst_amount: igst,
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
      expect(itemId).toBeTruthy();

      const { error: recvError } = await client.rpc(
        'admin_receive_purchase_lines',
        {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: receiveQty }],
          p_client_request_id: `recv-${randomUUID().slice(0, 8)}`,
          p_actor_profile_id: admin.id,
        },
      );
      expect(recvError).toBeNull();
    });

    const rl = await pool.query<{ id: string }>(
      `SELECT prl.id
       FROM public.purchase_receipt_lines prl
       JOIN public.purchase_receipts pr ON pr.id = prl.receipt_id
       WHERE pr.purchase_id = $1
       LIMIT 1`,
      [purchaseId],
    );
    receiptLineId = rl.rows[0]?.id ?? null;

    return {
      pool,
      admin,
      skuId,
      locationId,
      purchaseId,
      itemId,
      receiptLineId,
      qty,
      receiveQty,
      unitCost,
      taxAmount,
    };
  }

  it('returns against a partially received purchase', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId, receiveQty } =
      await seedReceivedPurchase({
        quantity: 10,
        receiveQty: 6,
        taxAmount: 36,
        cgst: 18,
        sgst: 18,
      });

    let result!: ReturnResult;
    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Damaged on arrival',
        p_client_request_id: `ret-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
      result = data as ReturnResult;
    });

    expect(result.idempotentReplay).toBe(false);
    expect(Number(result.totalQuantity)).toBe(2);
    expect(Number(result.taxableAmount)).toBe(40);

    const bal = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal.rows[0].on_hand_quantity)).toBe(receiveQty - 2);

    const status = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.purchases WHERE id = $1`,
      [purchaseId],
    );
    expect(status.rows[0].status).toBe('PARTIALLY_RECEIVED');
  });

  it('returns against a fully received purchase with GST journal balance', async () => {
    const { pool, admin, purchaseId, itemId } = await seedReceivedPurchase({
      quantity: 10,
      receiveQty: 10,
      unitCost: 100,
      taxAmount: 180,
      cgst: 90,
      sgst: 90,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
        p_reason: 'Supplier credit note',
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
      const r = data as ReturnResult;
      expect(Number(r.taxableAmount)).toBe(400);
      expect(Number(r.taxAmount)).toBe(72);
      expect(Number(r.totalAmount)).toBe(472);
    });

    const journal = await pool.query<{
      debit: string;
      credit: string;
      source_type: string;
    }>(
      `SELECT
         je.source_type,
         coalesce(sum(jl.debit),0)::text AS debit,
         coalesce(sum(jl.credit),0)::text AS credit
       FROM public.journal_entries je
       JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.source_type = 'purchase_return'
         AND je.source_id IN (
           SELECT id FROM public.purchase_returns WHERE purchase_id = $1
         )
       GROUP BY je.source_type`,
      [purchaseId],
    );
    expect(journal.rows).toHaveLength(1);
    expect(Number(journal.rows[0].debit)).toBe(Number(journal.rows[0].credit));
    expect(Number(journal.rows[0].debit)).toBe(472);

    const ap = await pool.query<{ debit: string }>(
      `SELECT coalesce(sum(jl.debit),0)::text AS debit
       FROM public.journal_entries je
       JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
       JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.source_type = 'purchase_return'
         AND je.source_id IN (
           SELECT id FROM public.purchase_returns WHERE purchase_id = $1
         )
         AND coa.code = '2000'`,
      [purchaseId],
    );
    expect(Number(ap.rows[0].debit)).toBe(472);
  });

  it('rejects over net-received; identical replay; mismatched request id', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedReceivedPurchase({
        quantity: 5,
        receiveQty: 5,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
      });

    const requestId = `idem-${randomUUID().slice(0, 8)}`;

    await withUserClient(admin.accessToken, async (client) => {
      const over = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 6 }],
        p_reason: 'Too many',
        p_actor_profile_id: admin.id,
      });
      expect(over.error?.message).toMatch(/exceeds net received/i);

      const first = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Quality issue',
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(first.error).toBeNull();
      const firstId = (first.data as ReturnResult).returnId;

      const replay = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Quality issue',
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(replay.error).toBeNull();
      expect((replay.data as ReturnResult).idempotentReplay).toBe(true);
      expect((replay.data as ReturnResult).returnId).toBe(firstId);

      const mismatch = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
        p_reason: 'Quality issue',
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(mismatch.error?.message).toMatch(/already used/i);
    });

    const moves = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.inventory_movements
       WHERE sku_id = $1 AND movement_type = 'PURCHASE_RETURN'`,
      [skuId],
    );
    expect(Number(moves.rows[0].count)).toBe(1);

    const journals = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.journal_entries
       WHERE source_type = 'purchase_return'
         AND source_id IN (
           SELECT id FROM public.purchase_returns WHERE purchase_id = $1
         )`,
      [purchaseId],
    );
    expect(Number(journals.rows[0].count)).toBe(1);

    const bal = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal.rows[0].on_hand_quantity)).toBe(3);
  });

  it('protects reserved stock and keeps WAC / movement references', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId, unitCost } =
      await seedReceivedPurchase({
        quantity: 5,
        receiveQty: 5,
        unitCost: 15,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
      });

    await pool.query(
      `UPDATE public.inventory_balances
       SET reserved_quantity = 4
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );

    await withUserClient(admin.accessToken, async (client) => {
      const blocked = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Would breach reserved',
        p_actor_profile_id: admin.id,
      });
      expect(blocked.error?.message).toMatch(/below reserved/i);

      await pool.query(
        `UPDATE public.inventory_balances
         SET reserved_quantity = 1
         WHERE sku_id = $1 AND operational_location_id = $2`,
        [skuId, locationId],
      );

      const ok = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Allowed return',
        p_actor_profile_id: admin.id,
      });
      expect(ok.error).toBeNull();
    });

    const move = await pool.query<{
      reference_type: string;
      movement_type: string;
      quantity_delta: string;
      unit_cost: string | null;
    }>(
      `SELECT reference_type, movement_type::text, quantity_delta::text, unit_cost::text
       FROM public.inventory_movements
       WHERE sku_id = $1 AND movement_type = 'PURCHASE_RETURN'`,
      [skuId],
    );
    expect(move.rows).toHaveLength(1);
    expect(move.rows[0].reference_type).toBe('purchase_return_line');
    expect(move.rows[0].movement_type).toBe('PURCHASE_RETURN');
    expect(Number(move.rows[0].quantity_delta)).toBe(-2);
    expect(Number(move.rows[0].unit_cost)).toBe(unitCost);

    const bal = await pool.query<{
      on_hand_quantity: string;
      average_unit_cost: string | null;
    }>(
      `SELECT on_hand_quantity::text, average_unit_cost::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal.rows[0].on_hand_quantity)).toBe(3);
    expect(Number(bal.rows[0].average_unit_cost)).toBe(unitCost);
  });

  it('supports multiple returns on one line; concurrent cannot over-return', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedReceivedPurchase({
        quantity: 8,
        receiveQty: 8,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
      });

    await withUserClient(admin.accessToken, async (client) => {
      const a = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
        p_reason: 'First return',
        p_client_request_id: `m1-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(a.error).toBeNull();

      const b = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 2 }],
        p_reason: 'Second return',
        p_client_request_id: `m2-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(b.error).toBeNull();
    });

    const returned = await pool.query<{ qty: string }>(
      `SELECT coalesce(sum(prl.quantity),0)::text AS qty
       FROM public.purchase_return_lines prl
       JOIN public.purchase_returns pr ON pr.id = prl.return_id
       WHERE pr.purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(returned.rows[0].qty)).toBe(5);

    const {
      purchaseId: pSame,
      itemId: iSame,
      admin: adminSame,
      skuId: skuSame,
      locationId: locSame,
      pool: poolSame,
    } = await seedReceivedPurchase({
      quantity: 6,
      receiveQty: 6,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
    });
    const sameReturnId = `ret-same-${randomUUID().slice(0, 8)}`;
    await withUserClient(adminSame.accessToken, async (client) => {
      const [a, b] = await Promise.all([
        client.rpc('admin_create_purchase_return', {
          p_purchase_id: pSame,
          p_lines: [{ purchase_item_id: iSame, quantity: 2 }],
          p_reason: 'Same concurrent return',
          p_client_request_id: sameReturnId,
          p_actor_profile_id: adminSame.id,
        }),
        client.rpc('admin_create_purchase_return', {
          p_purchase_id: pSame,
          p_lines: [{ purchase_item_id: iSame, quantity: 2 }],
          p_reason: 'Same concurrent return',
          p_client_request_id: sameReturnId,
          p_actor_profile_id: adminSame.id,
        }),
      ]);
      expect(a.error).toBeNull();
      expect(b.error).toBeNull();
      const rows = [a.data, b.data] as Array<{
        idempotentReplay?: boolean;
        returnId?: string;
      }>;
      expect(rows.filter((r) => r?.idempotentReplay === true)).toHaveLength(1);
      expect(rows.filter((r) => r?.idempotentReplay !== true)).toHaveLength(1);
      expect(rows[0]?.returnId).toBe(rows[1]?.returnId);
    });
    const balSame = await poolSame.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuSame, locSame],
    );
    expect(Number(balSame.rows[0].on_hand_quantity)).toBe(4);

    const { purchaseId: p2, itemId: i2, admin: admin2, skuId: sku2, locationId: loc2 } =
      await seedReceivedPurchase({
        quantity: 5,
        receiveQty: 5,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
      });

    await withUserClient(admin2.accessToken, async (client) => {
      const [x, y] = await Promise.all([
        client.rpc('admin_create_purchase_return', {
          p_purchase_id: p2,
          p_lines: [{ purchase_item_id: i2, quantity: 4 }],
          p_reason: 'Concurrent A',
          p_client_request_id: `ca-${randomUUID().slice(0, 8)}`,
          p_actor_profile_id: admin2.id,
        }),
        client.rpc('admin_create_purchase_return', {
          p_purchase_id: p2,
          p_lines: [{ purchase_item_id: i2, quantity: 4 }],
          p_reason: 'Concurrent B',
          p_client_request_id: `cb-${randomUUID().slice(0, 8)}`,
          p_actor_profile_id: admin2.id,
        }),
      ]);
      const successes = [x, y].filter((r) => !r.error);
      const failures = [x, y].filter((r) => r.error);
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error?.message).toMatch(/exceeds net received/i);
    });

    const bal2 = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [sku2, loc2],
    );
    expect(Number(bal2.rows[0].on_hand_quantity)).toBe(1);

    void skuId;
    void locationId;
  });

  it('rolls back return/stock/journal when journal posting fails', async () => {
    const { pool, admin, purchaseId, itemId, skuId } = await seedReceivedPurchase({
      quantity: 4,
      receiveQty: 4,
      unitCost: 10,
      taxAmount: 8,
      cgst: 4,
      sgst: 4,
    });

    await pool.query(`
      CREATE OR REPLACE FUNCTION public._test_fail_purchase_return_journal()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        IF NEW.source_type = 'purchase_return' THEN
          RAISE EXCEPTION 'forced purchase_return journal failure'
            USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $fn$;
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_test_fail_purchase_return_journal
        ON public.journal_entries;
      CREATE TRIGGER trg_test_fail_purchase_return_journal
        BEFORE INSERT ON public.journal_entries
        FOR EACH ROW
        EXECUTE FUNCTION public._test_fail_purchase_return_journal();
    `);

    try {
      await withUserClient(admin.accessToken, async (client) => {
        const fail = await client.rpc('admin_create_purchase_return', {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: 1 }],
          p_reason: 'Should roll back',
          p_actor_profile_id: admin.id,
        });
        expect(fail.error?.message).toMatch(/forced purchase_return journal failure/i);
      });

      const returns = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.purchase_returns
         WHERE purchase_id = $1`,
        [purchaseId],
      );
      expect(Number(returns.rows[0].count)).toBe(0);

      const moves = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.inventory_movements
         WHERE sku_id = $1 AND movement_type = 'PURCHASE_RETURN'`,
        [skuId],
      );
      expect(Number(moves.rows[0].count)).toBe(0);

      const journals = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.journal_entries
         WHERE source_type = 'purchase_return'
           AND source_id IN (
             SELECT id FROM public.purchase_returns WHERE purchase_id = $1
           )`,
        [purchaseId],
      );
      expect(Number(journals.rows[0].count)).toBe(0);
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS trg_test_fail_purchase_return_journal
          ON public.journal_entries;
        DROP FUNCTION IF EXISTS public._test_fail_purchase_return_journal();
      `);
    }
  });

  it('opening-stock guard remains intact after purchase return', async () => {
    const { admin, purchaseId, itemId, skuId, locationId } =
      await seedReceivedPurchase({
        quantity: 3,
        receiveQty: 3,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
      });

    await withUserClient(admin.accessToken, async (client) => {
      const ret = await client.rpc('admin_create_purchase_return', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 1 }],
        p_reason: 'Partial return before opening attempt',
        p_actor_profile_id: admin.id,
      });
      expect(ret.error).toBeNull();

      const opening = await client.rpc('admin_set_sku_opening_stock', {
        p_sku_id: skuId,
        p_operational_location_id: locationId,
        p_quantity: 1,
        p_as_of_date: '2026-10-10',
        p_unit_cost: 1,
        p_actor_profile_id: admin.id,
      });
      expect(opening.error?.message).toMatch(
        /stock already exists|without opening stock|admin_adjust/i,
      );
    });
  });
});
