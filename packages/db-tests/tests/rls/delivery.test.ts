import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { expectRlsBlocksUpdate } from '../../src/rls-assertions';
import {
  createAuthUser,
  createDeliveryRoute,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

describe('RLS: DELIVERY', () => {
  it('can access assigned route data but not unrelated routes', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Delivery RLS');
    const deliveryA = await createAuthUser({
      roles: ['DELIVERY'],
      mobile: `96100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const deliveryB = await createAuthUser({
      roles: ['DELIVERY'],
      mobile: `96200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96300${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    const { routeId: routeA } = await createDeliveryRoute(pool, {
      serviceAreaId,
      deliveryProfileId: deliveryA.id,
      orderId,
    });
    const { orderId: orderB } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    const { routeId: routeB } = await createDeliveryRoute(pool, {
      serviceAreaId,
      deliveryProfileId: deliveryB.id,
      orderId: orderB,
    });

    await withUserClient(deliveryA.accessToken, async (client) => {
      const { data: ownRoutes, error } = await client
        .from('delivery_routes')
        .select('id')
        .eq('id', routeA);
      expect(error).toBeNull();
      expect(ownRoutes).toHaveLength(1);

      const { data: foreignRoutes } = await client
        .from('delivery_routes')
        .select('id')
        .eq('id', routeB);
      expect(foreignRoutes).toEqual([]);
    });
  });

  it('cannot change SKU prices', async () => {
    const pool = getPool();
    const delivery = await createAuthUser({
      roles: ['DELIVERY'],
      mobile: `96400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    await withUserClient(delivery.accessToken, async (client) => {
      const { error } = await client.from('sku_prices').insert({
        sku_id: skuId,
        trade_price: 42,
      });
      expect(error).not.toBeNull();
    });
  });

  it('cannot arbitrarily change payable order amount', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Delivery Amount');
    const delivery = await createAuthUser({
      roles: ['DELIVERY'],
      mobile: `96500${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96600${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    await createDeliveryRoute(pool, {
      serviceAreaId,
      deliveryProfileId: delivery.id,
      orderId,
    });

    await withUserClient(delivery.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client.from('orders').update({ total: 1 }).eq('id', orderId).select('id'),
      );
    });

    const { rows } = await pool.query<{ total: string }>(
      `SELECT total::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0].total).toBe('100.00');
  });

  it('cannot bypass DELIVERED-requires-PAID through client order updates', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Delivery Paid');
    const delivery = await createAuthUser({
      roles: ['DELIVERY'],
      mobile: `96700${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96800${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    await createPaymentForOrder(pool, orderId, 'UNPAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');
    await createDeliveryRoute(pool, {
      serviceAreaId,
      deliveryProfileId: delivery.id,
      orderId,
    });

    await withUserClient(delivery.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client.from('orders').update({ status: 'DELIVERED' }).eq('id', orderId).select('id'),
      );
    });

    const { rows } = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0].status).toBe('OUT_FOR_DELIVERY');
  });
});
