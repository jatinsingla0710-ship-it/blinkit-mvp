import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function mobile(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`;
}

async function salesman(label: string) {
  return createAuthUser({
    roles: ['SALESMAN'],
    mobile: mobile('987'),
    displayName: label,
  });
}

describe('salesman expense and return claims', () => {
  it('keeps claims private, reviews them without touching stock or payments, and limits photos', async () => {
    const pool = getPool();
    const owner = await salesman('Claim Owner');
    const other = await salesman('Claim Other');
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: mobile('986'),
      displayName: 'Claim Admin',
    });
    const serviceAreaId = await insertServiceArea(pool, 'Claims Area');
    const shopId = await insertShop(pool, { serviceAreaId, assignedSalesmanId: owner.id });
    const { skuId } = await insertMinimalCatalogue(pool);
    const order = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: owner.id,
      skuId,
    });
    const foreignOrder = await createDraftOrder(pool, {
      shopId: await insertShop(pool, { serviceAreaId, assignedSalesmanId: other.id }),
      serviceAreaId,
      createdByProfileId: other.id,
      skuId,
    });
    const today = (
      await pool.query<{ day: string }>(
        `SELECT (timezone('Asia/Kolkata', now()))::date::text AS day`,
      )
    ).rows[0].day;
    const movementsBefore = Number(
      (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.inventory_movements`))
        .rows[0].n,
    );
    const paymentsBefore = Number(
      (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.payments`)).rows[0].n,
    );
    const commissionBefore = Number(
      (
        await pool.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM public.salesman_commission_entries`,
        )
      ).rows[0].n,
    );

    let expenseId = '';
    let returnId = '';

    await withUserClient(
      owner.accessToken,
      async (client) => {
        const zero = await client.rpc('salesman_create_expense', {
          p_category: 'TRAVEL',
          p_amount: 0,
          p_expense_date: today,
        });
        expect(zero.error?.message ?? '').toMatch(/greater than zero/);

        const future = await client.rpc('salesman_create_expense', {
          p_category: 'FOOD',
          p_amount: 10,
          p_expense_date: '2099-01-01',
        });
        expect(future.error?.message ?? '').toMatch(/future/);

        const created = await client.rpc('salesman_create_expense', {
          p_category: 'travel',
          p_amount: 125.5,
          p_expense_date: today,
          p_note: 'Bus',
        });
        expect(created.error).toBeNull();
        expenseId = (created.data as { id: string; status: string }).id;
        expect((created.data as { status: string }).status).toBe('PENDING');

        const direct = await client.from('salesman_expenses').insert({
          salesman_profile_id: owner.id,
          category: 'FOOD',
          amount: 10,
          expense_date: today,
        });
        expect(direct.error).not.toBeNull();

        const tooMany = await client.rpc('salesman_create_return_request', {
          p_order_id: order.orderId,
          p_sku_id: skuId,
          p_quantity: 2,
          p_reason: 'Damaged',
        });
        expect(tooMany.error?.message ?? '').toMatch(/order line/);

        const missingProduct = await client.rpc('salesman_create_return_request', {
          p_order_id: order.orderId,
          p_sku_id: randomUUID(),
          p_quantity: 1,
          p_reason: 'Damaged',
        });
        expect(missingProduct.error?.message ?? '').toMatch(/not on this order/);

        const notMine = await client.rpc('salesman_create_return_request', {
          p_order_id: foreignOrder.orderId,
          p_sku_id: skuId,
          p_quantity: 1,
          p_reason: 'Damaged',
        });
        expect(notMine.error?.message ?? '').toMatch(/not yours/);

        const request = await client.rpc('salesman_create_return_request', {
          p_order_id: order.orderId,
          p_sku_id: skuId,
          p_quantity: 1,
          p_reason: 'Damaged pack',
        });
        expect(request.error).toBeNull();
        returnId = (request.data as { id: string; productName: string }).id;
        expect((request.data as { productName: string }).productName).toBe('Almonds');

        const receiptPath = `${owner.id}/expenses/${expenseId}`;
        const uploaded = await client.storage
          .from('salesman-media')
          .upload(receiptPath, jpeg, { contentType: 'image/jpeg', upsert: true });
        expect(uploaded.error).toBeNull();
        const saved = await client.rpc('salesman_set_expense_receipt', {
          p_expense_id: expenseId,
          p_receipt_path: receiptPath,
        });
        expect(saved.error).toBeNull();

        const foreignPath = `${other.id}/expenses/${expenseId}`;
        const foreignUpload = await client.storage
          .from('salesman-media')
          .upload(foreignPath, jpeg, { contentType: 'image/jpeg' });
        expect(foreignUpload.error).not.toBeNull();

        const selfReview = await client.rpc('admin_review_salesman_expense', {
          p_expense_id: expenseId,
          p_status: 'APPROVED',
        });
        expect(selfReview.error).not.toBeNull();
      },
      { refreshToken: owner.refreshToken },
    );

    await withUserClient(
      other.accessToken,
      async (client) => {
        const hidden = await client
          .from('salesman_expenses')
          .select('id')
          .eq('id', expenseId);
        expect(hidden.error).toBeNull();
        expect(hidden.data ?? []).toEqual([]);
        const hiddenReturn = await client
          .from('salesman_return_requests')
          .select('id')
          .eq('id', returnId);
        expect(hiddenReturn.data ?? []).toEqual([]);
        const photo = await client.storage
          .from('salesman-media')
          .download(`${owner.id}/expenses/${expenseId}`);
        expect(photo.error).not.toBeNull();
        const stolen = await client.rpc('salesman_update_pending_expense', {
          p_expense_id: expenseId,
          p_category: 'FOOD',
          p_amount: 1,
          p_expense_date: today,
        });
        expect(stolen.error).not.toBeNull();
      },
      { refreshToken: other.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const listed = await client
          .from('salesman_expenses')
          .select('id, receipt_path, status')
          .eq('id', expenseId);
        expect(listed.error).toBeNull();
        expect(listed.data).toEqual([
          {
            id: expenseId,
            receipt_path: `${owner.id}/expenses/${expenseId}`,
            status: 'PENDING',
          },
        ]);
        const receipt = await client.storage
          .from('salesman-media')
          .download(`${owner.id}/expenses/${expenseId}`);
        expect(receipt.error).toBeNull();

        const approved = await client.rpc('admin_review_salesman_expense', {
          p_expense_id: expenseId,
          p_status: 'APPROVED',
          p_review_note: 'Ok',
        });
        expect(approved.error).toBeNull();
        expect((approved.data as { status: string }).status).toBe('APPROVED');

        const again = await client.rpc('admin_review_salesman_expense', {
          p_expense_id: expenseId,
          p_status: 'REJECTED',
        });
        expect(again.error?.message ?? '').toMatch(/pending/);

        const rejected = await client.rpc('admin_review_return_request', {
          p_request_id: returnId,
          p_status: 'REJECTED',
          p_review_note: 'Not a stock movement',
        });
        expect(rejected.error).toBeNull();
        expect((rejected.data as { status: string }).status).toBe('REJECTED');
      },
      { refreshToken: admin.refreshToken },
    );

    await withUserClient(
      owner.accessToken,
      async (client) => {
        const still = await client
          .from('salesman_expenses')
          .select('status')
          .eq('id', expenseId)
          .maybeSingle();
        expect(still.data).toEqual({ status: 'APPROVED' });
        const rewrite = await client.storage
          .from('salesman-media')
          .upload(`${owner.id}/expenses/${expenseId}`, jpeg, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        expect(rewrite.error).not.toBeNull();
        const readable = await client.storage
          .from('salesman-media')
          .download(`${owner.id}/expenses/${expenseId}`);
        expect(readable.error).toBeNull();
      },
      { refreshToken: owner.refreshToken },
    );

    const orderTotal = (
      await pool.query<{ total: string }>(`SELECT total::text FROM public.orders WHERE id = $1`, [
        order.orderId,
      ])
    ).rows[0].total;
    expect(Number(orderTotal)).toBe(100);
    expect(
      Number(
        (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.inventory_movements`))
          .rows[0].n,
      ),
    ).toBe(movementsBefore);
    expect(
      Number(
        (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.payments`)).rows[0].n,
      ),
    ).toBe(paymentsBefore);
    expect(
      Number(
        (
          await pool.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM public.salesman_commission_entries`,
          )
        ).rows[0].n,
      ),
    ).toBe(commissionBefore);
  });
});
