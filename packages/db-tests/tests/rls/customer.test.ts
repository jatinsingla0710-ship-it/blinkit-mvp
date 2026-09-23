import { describe, expect, it } from 'vitest';
import { withUserClient } from '../../src/client';
import { expectRlsBlocksUpdate } from '../../src/rls-assertions';
import {
  createAuthUser,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  linkShopAuth,
  setOrderStatusTrusted,
} from '../../src/fixtures';
import { getPool } from '../../src/client';

describe('RLS: CUSTOMER', () => {
  it('can read linked shop data and own orders but not another customer shop/orders', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Customer RLS');
    const shopA = await insertShop(pool, { serviceAreaId });
    const shopB = await insertShop(pool, { serviceAreaId });

    const customerA = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `98100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const customerB = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `98200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await linkShopAuth(pool, shopA, customerA.id);
    await linkShopAuth(pool, shopB, customerB.id);

    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId: orderA } = await createDraftOrder(pool, {
      shopId: shopA,
      serviceAreaId,
      createdByProfileId: customerA.id,
      skuId,
      source: 'CUSTOMER_SELF_SERVE',
    });
    await createDraftOrder(pool, {
      shopId: shopB,
      serviceAreaId,
      createdByProfileId: customerB.id,
      skuId,
      source: 'CUSTOMER_SELF_SERVE',
    });

    await withUserClient(customerA.accessToken, async (client) => {
      const { data: shops, error: shopsError } = await client.from('shops').select('id');
      expect(shopsError).toBeNull();
      expect(shops?.map((s) => s.id).sort()).toEqual([shopA]);

      const { data: orders, error: ordersError } = await client
        .from('orders')
        .select('id, shop_id')
        .eq('shop_id', shopA);
      expect(ordersError).toBeNull();
      expect(orders?.map((o) => o.id)).toContain(orderA);

      const { data: foreignOrders, error: foreignError } = await client
        .from('orders')
        .select('id')
        .eq('shop_id', shopB);
      expect(foreignError).toBeNull();
      expect(foreignOrders).toEqual([]);
    });
  });

  it('cannot modify sku price history', async () => {
    const pool = getPool();
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `98300${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    await withUserClient(customer.accessToken, async (client) => {
      const { error } = await client.from('sku_prices').insert({
        sku_id: skuId,
        trade_price: 50,
      });
      expect(error).not.toBeNull();
    });
  });

  it('cannot directly force order workflow status to DELIVERED', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Customer Delivered');
    const shopId = await insertShop(pool, { serviceAreaId });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `98400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    await linkShopAuth(pool, shopId, customer.id);
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: customer.id,
      skuId,
      source: 'CUSTOMER_SELF_SERVE',
    });
    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');

    await withUserClient(customer.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client
          .from('orders')
          .update({ status: 'DELIVERED' })
          .eq('id', orderId)
          .select('id'),
      );
    });

    const { rows } = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0].status).toBe('OUT_FOR_DELIVERY');
  });
});
