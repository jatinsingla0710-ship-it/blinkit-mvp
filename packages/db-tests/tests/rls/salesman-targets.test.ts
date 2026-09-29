import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPool, withTrusted, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

function mobile(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`;
}

async function salesman(label: string) {
  const user = await createAuthUser({
    roles: ['SALESMAN'],
    mobile: mobile('987'),
    displayName: label,
  });
  await getPool().query(
    `INSERT INTO public.salesman_employment (profile_id, earning_model)
     VALUES ($1, 'SALARY_PLUS_COMMISSION')`,
    [user.id],
  );
  return user;
}

describe('salesman targets and earnings', () => {
  it('lets an admin set a target, blocks salesman writes, and counts only delivered-and-paid sales', async () => {
    const pool = getPool();
    const owner = await salesman('Target Owner');
    const other = await salesman('Target Other');
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: mobile('986'),
      displayName: 'Target Admin',
    });
    const serviceAreaId = await insertServiceArea(pool, 'Target Area');
    const shopId = await insertShop(pool, { serviceAreaId, assignedSalesmanId: owner.id });
    const otherShopId = await insertShop(pool, {
      serviceAreaId,
      assignedSalesmanId: other.id,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    const counted = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 1000, total = 1000 WHERE id = $1`,
        [counted.orderId],
      );
    });
    await createPaymentForOrder(pool, counted.orderId, 'PAID');
    await setOrderStatusTrusted(pool, counted.orderId, 'DELIVERED');
    const saleId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sales (order_id, invoice_number, converted_at)
         VALUES ($1, $2, now())
         RETURNING id`,
        [counted.orderId, `TGT-${randomUUID()}`],
      )
    ).rows[0].id;
    await pool.query(`UPDATE public.orders SET sale_id = $1 WHERE id = $2`, [
      saleId,
      counted.orderId,
    ]);
    const saleItemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sale_items (
           sale_id, sku_id, product_name, sku_code, sku_name, quantity, unit_price, line_total
         ) VALUES ($1, $2, 'Almonds', 'ALM-1KG', 'Almond 1kg', 1, 1000, 1000)
         RETURNING id`,
        [saleId, skuId],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO public.salesman_commission_entries (
         salesman_profile_id, sale_id, sale_item_id, order_id, sku_id,
         quantity, unit_commission, commission_amount, status
       ) VALUES ($1, $2, $3, $4, $5, 1, 40, 40, 'EARNED')`,
      [owner.id, saleId, saleItemId, counted.orderId, skuId],
    );

    const paidWithoutSale = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 200, total = 200 WHERE id = $1`,
        [paidWithoutSale.orderId],
      );
    });
    await createPaymentForOrder(pool, paidWithoutSale.orderId, 'PAID');
    await setOrderStatusTrusted(pool, paidWithoutSale.orderId, 'DELIVERED');

    const pending = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 5000, total = 5000 WHERE id = $1`,
        [pending.orderId],
      );
    });

    const confirmed = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 800, total = 800 WHERE id = $1`,
        [confirmed.orderId],
      );
    });
    await setOrderStatusTrusted(pool, confirmed.orderId, 'CONFIRMED');

    const lastMonth = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders
         SET subtotal = 9000, total = 9000, created_at = now() - interval '40 days'
         WHERE id = $1`,
        [lastMonth.orderId],
      );
    });
    const oldPaymentId = await createPaymentForOrder(pool, lastMonth.orderId, 'PAID');
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.payments SET paid_at = now() - interval '40 days' WHERE id = $1`,
        [oldPaymentId],
      );
    });
    await setOrderStatusTrusted(pool, lastMonth.orderId, 'DELIVERED');
    const oldSaleId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sales (order_id, invoice_number, converted_at)
         VALUES ($1, $2, now() - interval '40 days')
         RETURNING id`,
        [lastMonth.orderId, `OLD-${randomUUID()}`],
      )
    ).rows[0].id;
    await pool.query(`UPDATE public.orders SET sale_id = $1 WHERE id = $2`, [
      oldSaleId,
      lastMonth.orderId,
    ]);

    const someoneElse = await createDraftOrder(pool, {
      shopId: otherShopId,
      serviceAreaId,
      createdByProfileId: other.id,
      skuId,
    });
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 3000, total = 3000 WHERE id = $1`,
        [someoneElse.orderId],
      );
    });
    await createPaymentForOrder(pool, someoneElse.orderId, 'PAID');
    await setOrderStatusTrusted(pool, someoneElse.orderId, 'DELIVERED');

    await pool.query(
      `INSERT INTO public.salesman_salary_terms (
         profile_id, monthly_salary, daily_allowance, other_allowance, effective_from
       ) VALUES ($1, 15000, 50, 0, DATE '2026-01-01')`,
      [owner.id],
    );

    await withUserClient(
      owner.accessToken,
      async (client) => {
        const missing = await client.rpc('salesman_month_target', { p_month: null });
        expect(missing.error).toBeNull();
        expect(missing.data).toBeNull();

        const denied = await client.rpc('admin_set_salesman_target', {
          p_profile_id: owner.id,
          p_month: new Date().toISOString().slice(0, 10),
          p_target_amount: 1,
        });
        expect(denied.error).not.toBeNull();
      },
      { refreshToken: owner.refreshToken },
    );

    const created = await withUserClient(
      admin.accessToken,
      async (client) =>
        client.rpc('admin_set_salesman_target', {
          p_profile_id: owner.id,
          p_month: new Date().toISOString().slice(0, 10),
          p_target_amount: 4000,
        }),
      { refreshToken: admin.refreshToken },
    );
    expect(created.error).toBeNull();
    const createdBody = created.data as {
      targetAmount: number;
      achievedAmount: number;
      remainingAmount: number;
      progressPercent: number;
    };
    expect(Number(createdBody.targetAmount)).toBe(4000);
    expect(Number(createdBody.achievedAmount)).toBe(1200);
    expect(Number(createdBody.remainingAmount)).toBe(2800);
    expect(Number(createdBody.progressPercent)).toBe(30);

    await withUserClient(
      owner.accessToken,
      async (client) => {
        const inserted = await client.from('salesman_targets').insert({
          salesman_profile_id: owner.id,
          target_month: '2026-10-01',
          target_amount: 9,
        });
        expect(inserted.error).not.toBeNull();

        const updated = await client
          .from('salesman_targets')
          .update({ target_amount: 1 })
          .eq('salesman_profile_id', owner.id)
          .select('id');
        expect(updated.error !== null || (updated.data ?? []).length === 0).toBe(true);

        const own = await client.rpc('salesman_month_target', { p_month: null });
        expect(own.error).toBeNull();
        const body = own.data as { achievedAmount: number; targetAmount: number };
        expect(Number(body.targetAmount)).toBe(4000);
        expect(Number(body.achievedAmount)).toBe(1200);

        const earnings = await client.rpc('salesman_earnings_month', { p_month: null });
        expect(earnings.error).toBeNull();
        const earned = earnings.data as {
          earnedCommission: number;
          totalEarnings: number;
          totalIncludesSalary: boolean;
          payslipsAvailable: boolean;
          entries: Array<{ commissionAmount: number; orderId: string }>;
          awaitingOrders: Array<Record<string, unknown>>;
          awaitingOrderValue: number;
        };
        expect(Number(earned.earnedCommission)).toBe(40);
        expect(earned.entries).toHaveLength(1);
        expect(Number(earned.entries[0].commissionAmount)).toBe(40);
        expect(earned.entries[0].orderId).toBe(counted.orderId);
        expect(Number(earned.totalEarnings)).toBe(15040);
        expect(earned.totalIncludesSalary).toBe(true);
        expect(earned.payslipsAvailable).toBe(false);
        expect(earned.awaitingOrders.some((row) => row.orderId === pending.orderId)).toBe(true);
        expect(earned.awaitingOrders.every((row) => !('commissionAmount' in row))).toBe(true);
        expect(Number(earned.awaitingOrderValue)).toBe(6000);
      },
      { refreshToken: owner.refreshToken },
    );

    const stored = (
      await pool.query<{ target_amount: string }>(
        `SELECT target_amount::text
         FROM public.salesman_targets
         WHERE salesman_profile_id = $1`,
        [owner.id],
      )
    ).rows[0];
    expect(Number(stored.target_amount)).toBe(4000);

    await withUserClient(
      other.accessToken,
      async (client) => {
        const rows = await client.from('salesman_targets').select('id, target_amount');
        expect(rows.error).toBeNull();
        expect(rows.data ?? []).toEqual([]);
        const own = await client.rpc('salesman_month_target', { p_month: null });
        expect(own.error).toBeNull();
        expect(own.data).toBeNull();
      },
      { refreshToken: other.refreshToken },
    );

    const updatedTarget = await withUserClient(
      admin.accessToken,
      async (client) =>
        client.rpc('admin_set_salesman_target', {
          p_profile_id: owner.id,
          p_month: new Date().toISOString().slice(0, 10),
          p_target_amount: 2400,
        }),
      { refreshToken: admin.refreshToken },
    );
    expect(updatedTarget.error).toBeNull();
    const updatedBody = updatedTarget.data as {
      targetAmount: number;
      remainingAmount: number;
      progressPercent: number;
    };
    expect(Number(updatedBody.targetAmount)).toBe(2400);
    expect(Number(updatedBody.remainingAmount)).toBe(1200);
    expect(Number(updatedBody.progressPercent)).toBe(50);
  });
});
