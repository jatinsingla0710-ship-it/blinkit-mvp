import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

describe('DELIVERED requires PAID', () => {
  it('rejects OUT_FOR_DELIVERY + UNPAID -> DELIVERED via trusted workflow', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Delivered Guard');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `98${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });

    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    await createPaymentForOrder(pool, orderId, 'UNPAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');

    await expect(setOrderStatusTrusted(pool, orderId, 'DELIVERED')).rejects.toSatisfy(
      (error: unknown) => isPgError(error, '23514'),
    );
  });

  it('allows OUT_FOR_DELIVERY + PAID -> DELIVERED via trusted workflow', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Delivered OK');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });

    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');

    await expect(setOrderStatusTrusted(pool, orderId, 'DELIVERED')).resolves.toBeUndefined();

    const { rows } = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0].status).toBe('DELIVERED');
  });
});
