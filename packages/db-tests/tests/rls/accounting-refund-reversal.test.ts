import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

type CounterResult = {
  orderId: string;
  saleId: string;
  paymentId: string;
  total: number;
  amountPaid: number;
};

describe('Phase 7B.1: sale refund journal reversal', () => {
  async function seedCounterSale(opts?: {
    packPrice?: number;
    amountPaid?: number;
    unitCost?: number;
  }) {
    const pool = getPool();
    const packPrice = opts?.packPrice ?? 500;
    const amountPaid = opts?.amountPaid ?? packPrice;
    const unitCost = opts?.unitCost ?? 200;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `976${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `977${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Refund Journals');
    const shopId = await insertShop(pool, { serviceAreaId });
    const locationId = await insertOperationalLocation(pool);
    const { skuId } = await insertMinimalCatalogue(pool);

    await pool.query(
      `UPDATE public.skus
       SET moq = 1, quantity_step = 1, packs_per_carton = 1
       WHERE id = $1`,
      [skuId],
    );
    await pool.query(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, $2, $3)`,
      [skuId, packPrice, admin.id],
    );
    await pool.query(
      `INSERT INTO public.inventory_balances (
         sku_id, operational_location_id, on_hand_quantity, reserved_quantity,
         average_unit_cost, stock_value
       ) VALUES ($1, $2, 50, 0, $3::numeric, round(50 * $3::numeric, 2))`,
      [skuId, locationId, unitCost],
    );

    const sale = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_complete_counter_sale', {
          p_shop: { shopId },
          p_lines: [{ kind: 'CATALOGUE', skuId, quantity: 1 }],
          p_payment: { amountPaid, method: 'CASH' },
          p_client_request_id: `ref-${randomUUID()}`,
        });
        if (error) throw error;
        return data as CounterResult;
      },
      { refreshToken: admin.refreshToken },
    );

    return { pool, admin, salesman, shopId, skuId, locationId, sale, packPrice };
  }

  async function journalBalanceOk(sourceType: string, sourceId: string) {
    const { rows } = await getPool().query<{ ok: boolean }>(
      `SELECT coalesce(bool_and(abs(d - c) < 0.001), false) AS ok
       FROM (
         SELECT sum(jl.debit) AS d, sum(jl.credit) AS c
         FROM public.journal_entries je
         JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
         WHERE je.source_type = $1 AND je.source_id = $2
         GROUP BY je.id
       ) x`,
      [sourceType, sourceId],
    );
    return rows[0]?.ok === true;
  }

  async function accountNet(
    sourceType: string,
    sourceId: string,
    accountCode: string,
  ): Promise<number> {
    const { rows } = await getPool().query<{ net: string }>(
      `SELECT coalesce(sum(jl.debit - jl.credit), 0)::text AS net
       FROM public.journal_entries je
       JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
       JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.source_type = $1
         AND je.source_id = $2
         AND coa.code = $3`,
      [sourceType, sourceId, accountCode],
    );
    return Number(rows[0]?.net ?? 0);
  }

  it('refund with restock reverses sale + collection_event journals (balanced, idempotent)', async () => {
    const { admin, sale, salesman } = await seedCounterSale({
      packPrice: 500,
      amountPaid: 500,
      unitCost: 200,
    });

    expect(await journalBalanceOk('sale', sale.saleId)).toBe(true);

    const first = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: 'Customer returned goods',
          p_restock: true,
        });
        if (error) throw error;
        return data as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );
    expect(first.alreadyRefunded).toBe(false);
    expect(first.restockedItemCount).toBe(1);

    expect(await journalBalanceOk('sale_refund', sale.saleId)).toBe(true);
    // Sale Dr 1100 / Cr 4000 → refund Dr 4000 / Cr 1100
    expect(await accountNet('sale_refund', sale.saleId, '1100')).toBe(-500);
    expect(await accountNet('sale_refund', sale.saleId, '4000')).toBe(500);
    // COGS was posted (unit_cost present) and restocked → reverse COGS/Inventory
    expect(await accountNet('sale_refund', sale.saleId, '5000')).toBe(-200);
    expect(await accountNet('sale_refund', sale.saleId, '1200')).toBe(200);

    const { rows: eventIds } = await getPool().query<{ id: string }>(
      `SELECT id::text FROM public.payment_events WHERE payment_id = $1`,
      [sale.paymentId],
    );
    expect(eventIds.length).toBeGreaterThan(0);
    for (const ev of eventIds) {
      const { rows: rev } = await getPool().query<{ c: string }>(
        `SELECT count(*)::text AS c FROM public.journal_entries
         WHERE source_type = 'collection_event_refund' AND source_id = $1`,
        [ev.id],
      );
      // Only events that had collection_event journals get reversals.
      if (Number(rev[0].c) > 0) {
        expect(await journalBalanceOk('collection_event_refund', ev.id)).toBe(
          true,
        );
      }
    }

    const second = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: 'Retry refund',
          p_restock: true,
        });
        if (error) throw error;
        return data as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );
    expect(second.alreadyRefunded).toBe(true);

    const { rows: refundJournals } = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'sale_refund' AND source_id = $1`,
      [sale.saleId],
    );
    expect(Number(refundJournals[0].c)).toBe(1);

    // Non-admin cannot refund.
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: 'Nope',
          p_restock: false,
        });
        expect(error).not.toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('refund without restock keeps COGS/Inventory journals', async () => {
    const { admin, sale } = await seedCounterSale({
      packPrice: 400,
      amountPaid: 400,
      unitCost: 150,
    });

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: 'Refund without goods return',
          p_restock: false,
        });
        if (error) throw error;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await journalBalanceOk('sale_refund', sale.saleId)).toBe(true);
    expect(await accountNet('sale_refund', sale.saleId, '1100')).toBe(-400);
    expect(await accountNet('sale_refund', sale.saleId, '4000')).toBe(400);
    expect(await accountNet('sale_refund', sale.saleId, '5000')).toBe(0);
    expect(await accountNet('sale_refund', sale.saleId, '1200')).toBe(0);
  });

  it('failed refund leaves payment unrefunded and posts no reversal journal', async () => {
    const { admin, sale } = await seedCounterSale({
      packPrice: 300,
      amountPaid: 300,
      unitCost: 100,
    });

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: sale.orderId,
          p_reason: '   ',
          p_restock: false,
        });
        expect(error).not.toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    const { rows: payment } = await getPool().query<{ status: string }>(
      `SELECT status::text FROM public.payments WHERE id = $1`,
      [sale.paymentId],
    );
    expect(payment[0]?.status).toBe('PAID');

    const { rows: refundJournals } = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.journal_entries
       WHERE source_type = 'sale_refund' AND source_id = $1`,
      [sale.saleId],
    );
    expect(Number(refundJournals[0].c)).toBe(0);
  });
});
