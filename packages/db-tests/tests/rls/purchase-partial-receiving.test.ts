import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';
import { getPool, withUserClient } from '../../src/client';

type ReceiveResult = {
  purchaseId: string;
  status: string;
  receiptId?: string;
  alreadyReceived?: boolean;
  idempotentReplay?: boolean;
  movementCount?: number;
  totalQuantity?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
};

describe('Phase 6B.2B: partial purchase receiving', () => {
  async function seedPurchase(opts?: {
    quantity?: number;
    unitCost?: number;
    taxAmount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  }) {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `973${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);
    const qty = opts?.quantity ?? 10;
    const unitCost = opts?.unitCost ?? 20;
    const taxAmount = opts?.taxAmount ?? 36;
    const cgst = opts?.cgst ?? 18;
    const sgst = opts?.sgst ?? 18;
    const igst = opts?.igst ?? 0;
    const subtotal = Math.round(qty * unitCost * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    let purchaseId = '';
    let itemId = '';

    await withUserClient(admin.accessToken, async (client) => {
      const { data: supplier, error: supplierError } = await client.rpc(
        'admin_create_supplier',
        {
          p_name: `Partial Rx ${Date.now()}`,
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
          p_bill_number: `PR-${randomUUID().slice(0, 8)}`,
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
    });

    return {
      pool,
      admin,
      skuId,
      locationId,
      purchaseId,
      itemId,
      qty,
      unitCost,
      subtotal,
      taxAmount,
      total,
    };
  }

  it('full receipt through backward-compatible wrapper', async () => {
    const { pool, admin, skuId, locationId, purchaseId, qty, unitCost } =
      await seedPurchase({ quantity: 5, unitCost: 12, taxAmount: 0, cgst: 0, sgst: 0 });

    let result!: ReceiveResult;
    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_receive_purchase', {
        p_purchase_id: purchaseId,
      });
      expect(error).toBeNull();
      result = data as ReceiveResult;
    });

    expect(result.status).toBe('RECEIVED');
    expect(result.alreadyReceived).toBe(false);
    expect(Number(result.movementCount)).toBe(1);
    expect(Number(result.totalQuantity)).toBe(5);

    const bal = await pool.query<{
      on_hand_quantity: string;
      average_unit_cost: string | null;
    }>(
      `SELECT on_hand_quantity::text, average_unit_cost::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(bal.rows[0].on_hand_quantity).toBe('5.000');
    expect(Number(bal.rows[0].average_unit_cost)).toBe(unitCost);

    const moves = await pool.query<{
      reference_type: string;
      quantity_delta: string;
    }>(
      `SELECT reference_type, quantity_delta::text
       FROM public.inventory_movements
       WHERE sku_id = $1 AND movement_type = 'RECEIPT'`,
      [skuId],
    );
    expect(moves.rows).toHaveLength(1);
    expect(moves.rows[0].reference_type).toBe('purchase_receipt_line');

    const journals = await pool.query<{ source_type: string; count: string }>(
      `SELECT source_type, count(*)::text AS count
       FROM public.journal_entries
       WHERE source_type IN ('purchase_receipt', 'purchase_receive')
         AND source_id IN (
           SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
           UNION ALL SELECT $1::uuid
         )
       GROUP BY source_type`,
      [purchaseId],
    );
    expect(journals.rows.some((r) => r.source_type === 'purchase_receipt')).toBe(
      true,
    );
    expect(journals.rows.some((r) => r.source_type === 'purchase_receive')).toBe(
      false,
    );

    await withUserClient(admin.accessToken, async (client) => {
      const retry = await client.rpc('admin_receive_purchase', {
        p_purchase_id: purchaseId,
      });
      expect(retry.error).toBeNull();
      expect((retry.data as ReceiveResult).alreadyReceived).toBe(true);
    });

    const bal2 = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(bal2.rows[0].on_hand_quantity).toBe('5.000');
    void qty;
  });

  it('two partial receipts: status DRAFT → PARTIALLY_RECEIVED → RECEIVED', async () => {
    const { pool, admin, purchaseId, itemId, taxAmount } = await seedPurchase({
      quantity: 10,
      unitCost: 20,
      taxAmount: 36,
      cgst: 18,
      sgst: 18,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const first = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
        p_client_request_id: `recv-a-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(first.error).toBeNull();
      const a = first.data as ReceiveResult;
      expect(a.status).toBe('PARTIALLY_RECEIVED');
      expect(Number(a.taxableAmount)).toBe(80);
      expect(Number(a.taxAmount)).toBeGreaterThan(0);

      const second = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 6 }],
        p_client_request_id: `recv-b-${randomUUID().slice(0, 8)}`,
        p_actor_profile_id: admin.id,
      });
      expect(second.error).toBeNull();
      expect((second.data as ReceiveResult).status).toBe('RECEIVED');
    });

    const taxSum = await pool.query<{ tax: string; taxable: string }>(
      `SELECT coalesce(sum(tax_amount),0)::text AS tax,
              coalesce(sum(taxable_amount),0)::text AS taxable
       FROM public.purchase_receipts WHERE purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(taxSum.rows[0].tax)).toBe(taxAmount);
    expect(Number(taxSum.rows[0].taxable)).toBe(200);

    const purchase = await pool.query<{
      status: string;
      first_received_at: string | null;
      received_at: string | null;
    }>(
      `SELECT status::text, first_received_at::text, received_at::text
       FROM public.purchases WHERE id = $1`,
      [purchaseId],
    );
    expect(purchase.rows[0].status).toBe('RECEIVED');
    expect(purchase.rows[0].first_received_at).toBeTruthy();
    expect(purchase.rows[0].received_at).toBeTruthy();
  });

  it('rejects over-remaining qty; identical replay; mismatched request id', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedPurchase({ quantity: 10, taxAmount: 0, cgst: 0, sgst: 0 });
    const requestId = `recv-idemp-${randomUUID().slice(0, 8)}`;

    await withUserClient(admin.accessToken, async (client) => {
      const over = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 11 }],
        p_actor_profile_id: admin.id,
      });
      expect(over.error?.message).toMatch(/exceeds remaining/i);

      const first = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(first.error).toBeNull();
      const receiptId = (first.data as ReceiveResult).receiptId;

      const replay = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(replay.error).toBeNull();
      expect((replay.data as ReceiveResult).idempotentReplay).toBe(true);
      expect((replay.data as ReceiveResult).receiptId).toBe(receiptId);

      const mismatch = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
        p_client_request_id: requestId,
        p_actor_profile_id: admin.id,
      });
      expect(mismatch.error?.message).toMatch(
        /different receipt lines|already used/i,
      );
    });

    const bal = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(bal.rows[0].on_hand_quantity).toBe('3.000');

    const journals = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.journal_entries
       WHERE source_type = 'purchase_receipt'
         AND source_id IN (
           SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
         )`,
      [purchaseId],
    );
    expect(Number(journals.rows[0].count)).toBe(1);
  });

  it('concurrent identical client_request_id receive soft-replays once', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedPurchase({ quantity: 8, taxAmount: 0, cgst: 0, sgst: 0 });
    const requestId = `conc-same-${randomUUID().slice(0, 8)}`;

    await withUserClient(admin.accessToken, async (client) => {
      const [a, b] = await Promise.all([
        client.rpc('admin_receive_purchase_lines', {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
          p_client_request_id: requestId,
          p_actor_profile_id: admin.id,
        }),
        client.rpc('admin_receive_purchase_lines', {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: 3 }],
          p_client_request_id: requestId,
          p_actor_profile_id: admin.id,
        }),
      ]);

      expect(a.error).toBeNull();
      expect(b.error).toBeNull();
      const results = [a.data, b.data] as Array<{
        idempotentReplay?: boolean;
        receiptId?: string;
      }>;
      const fresh = results.filter((r) => r?.idempotentReplay !== true);
      const replay = results.filter((r) => r?.idempotentReplay === true);
      expect(fresh).toHaveLength(1);
      expect(replay).toHaveLength(1);
      expect(fresh[0]?.receiptId).toBe(replay[0]?.receiptId);
    });

    const bal = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal.rows[0].on_hand_quantity)).toBe(3);

    const receiptCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.purchase_receipts
       WHERE purchase_id = $1 AND client_request_id = $2`,
      [purchaseId, requestId],
    );
    expect(Number(receiptCount.rows[0].count)).toBe(1);

    const journals = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.journal_entries
       WHERE source_type = 'purchase_receipt'
         AND source_id IN (
           SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
         )`,
      [purchaseId],
    );
    expect(Number(journals.rows[0].count)).toBe(1);
  });

  it('concurrent receives cannot over-receive remaining stock', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedPurchase({ quantity: 5, taxAmount: 0, cgst: 0, sgst: 0 });

    await withUserClient(admin.accessToken, async (client) => {
      const [a, b] = await Promise.all([
        client.rpc('admin_receive_purchase_lines', {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
          p_client_request_id: `conc-a-${randomUUID().slice(0, 8)}`,
          p_actor_profile_id: admin.id,
        }),
        client.rpc('admin_receive_purchase_lines', {
          p_purchase_id: purchaseId,
          p_lines: [{ purchase_item_id: itemId, quantity: 4 }],
          p_client_request_id: `conc-b-${randomUUID().slice(0, 8)}`,
          p_actor_profile_id: admin.id,
        }),
      ]);

      const successes = [a, b].filter((r) => !r.error);
      const failures = [a, b].filter((r) => r.error);
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error?.message).toMatch(/exceeds remaining/i);
    });

    const bal = await pool.query<{ on_hand_quantity: string }>(
      `SELECT on_hand_quantity::text FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal.rows[0].on_hand_quantity)).toBe(4);

    const receiptCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.purchase_receipts
       WHERE purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(receiptCount.rows[0].count)).toBe(1);
  });

  it('legacy sync does not double-post when receipt events exist; legacy-only still posts', async () => {
    const { pool, admin, purchaseId } = await seedPurchase({
      quantity: 2,
      unitCost: 10,
      taxAmount: 0,
      cgst: 0,
      sgst: 0,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { error } = await client.rpc('admin_receive_purchase', {
        p_purchase_id: purchaseId,
      });
      expect(error).toBeNull();

      const sync1 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-01-01',
        p_date_to: '2026-12-31',
      });
      expect(sync1.error).toBeNull();

      const sync2 = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-01-01',
        p_date_to: '2026-12-31',
      });
      expect(sync2.error).toBeNull();
    });

    const counts = await pool.query<{ source_type: string; count: string }>(
      `SELECT source_type, count(*)::text AS count
       FROM public.journal_entries
       WHERE (
         source_type = 'purchase_receipt'
         AND source_id IN (SELECT id FROM public.purchase_receipts WHERE purchase_id = $1)
       ) OR (
         source_type = 'purchase_receive' AND source_id = $1
       )
       GROUP BY source_type`,
      [purchaseId],
    );
    expect(
      Number(counts.rows.find((r) => r.source_type === 'purchase_receipt')?.count),
    ).toBe(1);
    expect(
      counts.rows.find((r) => r.source_type === 'purchase_receive'),
    ).toBeUndefined();

    // Legacy-shaped row: RECEIVED with no purchase_receipts (simulate pre-6B.2B).
    const { skuId: sku2 } = await insertMinimalCatalogue(pool);
    const loc2 = await insertOperationalLocation(pool);
    const { rows: supplierRows } = await pool.query<{ id: string }>(
      `INSERT INTO public.suppliers (name, is_active)
       VALUES ('Legacy Supplier', true) RETURNING id`,
    );
    const legacyPurchaseId = randomUUID();
    await pool.query(
      `INSERT INTO public.purchases (
         id, supplier_id, operational_location_id, purchase_date, bill_number,
         status, subtotal, tax_amount, total, received_at, first_received_at,
         received_by_profile_id
       ) VALUES (
         $1, $2, $3, '2026-10-01', $4, 'RECEIVED', 50, 0, 50,
         '2026-10-01 12:00:00+00', '2026-10-01 12:00:00+00', $5
       )`,
      [
        legacyPurchaseId,
        supplierRows[0].id,
        loc2,
        `LEG-${randomUUID().slice(0, 6)}`,
        admin.id,
      ],
    );
    await pool.query(
      `INSERT INTO public.purchase_items (
         purchase_id, sku_id, quantity, unit_cost, line_total,
         product_name, sku_code, sku_name
       ) VALUES ($1, $2, 5, 10, 50, 'P', 'C', 'N')`,
      [legacyPurchaseId, sku2],
    );

    await withUserClient(admin.accessToken, async (client) => {
      const sync = await client.rpc('admin_sync_accounting_journals', {
        p_date_from: '2026-10-01',
        p_date_to: '2026-10-01',
      });
      expect(sync.error).toBeNull();
    });

    const legacyJournal = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.journal_entries
       WHERE source_type = 'purchase_receive' AND source_id = $1`,
      [legacyPurchaseId],
    );
    expect(Number(legacyJournal.rows[0].count)).toBe(1);
  });

  it('failed receive leaves no stock/receipt/journal; draft cancel and opening guard hold', async () => {
    const { pool, admin, purchaseId, itemId, skuId, locationId } =
      await seedPurchase({ quantity: 8, taxAmount: 0, cgst: 0, sgst: 0 });

    await withUserClient(admin.accessToken, async (client) => {
      const fail = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 99 }],
        p_actor_profile_id: admin.id,
      });
      expect(fail.error).toBeTruthy();
    });

    const receipts = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.purchase_receipts
       WHERE purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(receipts.rows[0].count)).toBe(0);

    const moves = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.inventory_movements
       WHERE sku_id = $1`,
      [skuId],
    );
    expect(Number(moves.rows[0].count)).toBe(0);

    await withUserClient(admin.accessToken, async (client) => {
      const cancel = await client.rpc('admin_cancel_purchase_draft', {
        p_purchase_id: purchaseId,
      });
      expect(cancel.error).toBeNull();
    });

    const { purchaseId: openPurchase, itemId: openItem, admin: admin2, skuId: sku3, locationId: loc3 } =
      await seedPurchase({ quantity: 3, taxAmount: 0, cgst: 0, sgst: 0 });

    await withUserClient(admin2.accessToken, async (client) => {
      await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: openPurchase,
        p_lines: [{ purchase_item_id: openItem, quantity: 3 }],
        p_actor_profile_id: admin2.id,
      });

      const opening = await client.rpc('admin_set_sku_opening_stock', {
        p_sku_id: sku3,
        p_operational_location_id: loc3,
        p_quantity: 1,
        p_as_of_date: '2026-10-10',
        p_unit_cost: 1,
        p_actor_profile_id: admin2.id,
      });
      expect(opening.error?.message).toMatch(
        /stock already exists|without opening stock|admin_adjust/i,
      );
    });

    void locationId;
  });

  it('journal lines balance for GST partial receipt', async () => {
    const { pool, admin, purchaseId, itemId } = await seedPurchase({
      quantity: 10,
      unitCost: 100,
      taxAmount: 180,
      cgst: 90,
      sgst: 90,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_receive_purchase_lines', {
        p_purchase_id: purchaseId,
        p_lines: [{ purchase_item_id: itemId, quantity: 5 }],
        p_actor_profile_id: admin.id,
      });
      expect(error).toBeNull();
      const r = data as ReceiveResult;
      expect(Number(r.taxableAmount)).toBe(500);
      expect(Number(r.taxAmount)).toBe(90);
      expect(Number(r.totalAmount)).toBe(590);
    });

    const journal = await pool.query<{
      debit: string;
      credit: string;
    }>(
      `SELECT
         coalesce(sum(jl.debit),0)::text AS debit,
         coalesce(sum(jl.credit),0)::text AS credit
       FROM public.journal_entries je
       JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.source_type = 'purchase_receipt'
         AND je.source_id IN (
           SELECT id FROM public.purchase_receipts WHERE purchase_id = $1
         )`,
      [purchaseId],
    );
    expect(Number(journal.rows[0].debit)).toBe(Number(journal.rows[0].credit));
    expect(Number(journal.rows[0].debit)).toBe(590);
  });
});
