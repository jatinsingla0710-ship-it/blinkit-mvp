import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { expectRlsBlocksUpdate } from '../../src/rls-assertions';
import {
  assignSalesman,
  createAuthUser,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  linkShopAuth,
  setOrderStatusTrusted,
} from '../../src/fixtures';

describe('RLS: SALESMAN', () => {
  it('can access assigned shop but not unrelated shop', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Salesman RLS');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const assignedShop = await insertShop(pool, { serviceAreaId });
    const otherShop = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, assignedShop, salesman.id);

    await withUserClient(salesman.accessToken, async (client) => {
      const { data: allowed, error: allowedError } = await client
        .from('shops')
        .select('id')
        .eq('id', assignedShop);
      expect(allowedError).toBeNull();
      expect(allowed).toHaveLength(1);

      const { data: denied, error: deniedError } = await client
        .from('shops')
        .select('id')
        .eq('id', otherShop);
      expect(deniedError).toBeNull();
      expect(denied).toEqual([]);
    });
  });

  it('cannot directly mark an order DELIVERED', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Salesman Delivered');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, shopId, salesman.id);
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');

    await withUserClient(salesman.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client.from('orders').update({ status: 'DELIVERED' }).eq('id', orderId).select('id'),
      );
    });
  });

  it('cannot write trusted payment completion fields', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Salesman Payment');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97300${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, shopId, salesman.id);
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });
    const paymentId = await createPaymentForOrder(pool, orderId, 'UNPAID');

    await withUserClient(salesman.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client
          .from('payments')
          .update({
            status: 'PAID',
            collection_method: 'CASH_ON_DELIVERY',
            paid_at: new Date().toISOString(),
          })
          .eq('id', paymentId)
          .select('id'),
      );
    });

    const { rows } = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.payments WHERE id = $1`,
      [paymentId],
    );
    expect(rows[0].status).toBe('UNPAID');
  });

  it('cannot complete customer OTP confirmation through direct client writes', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Salesman OTP');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `97500${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, shopId, salesman.id);
    await linkShopAuth(pool, shopId, customer.id);
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.order_confirmation_challenges (order_id, token, otp_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 hour')
       RETURNING id`,
      [orderId, `challenge-${orderId.replace(/-/g, '')}`, 'a'.repeat(64)],
    );
    const challengeId = rows[0].id;

    await withUserClient(salesman.accessToken, async (client) => {
      await expectRlsBlocksUpdate(async () =>
        client
          .from('order_confirmation_challenges')
          .update({
            status: 'CUSTOMER_CONFIRMED',
            payment_method_intent: 'PAY_ON_DELIVERY',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', challengeId)
          .select('id'),
      );
    });

    await withUserClient(customer.accessToken, async (client) => {
      const { data, error } = await client
        .from('order_confirmation_challenges')
        .update({
          status: 'CUSTOMER_CONFIRMED',
          payment_method_intent: 'PAY_ON_DELIVERY',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', challengeId)
        .select('status');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.status).toBe('CUSTOMER_CONFIRMED');
    });
  });

  it('cannot grant credit via client payment writes', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Salesman Credit');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97600${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, shopId, salesman.id);
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    await withUserClient(salesman.accessToken, async (client) => {
      const { error } = await client.from('payments').insert({
        order_id: orderId,
        status: 'UNPAID',
        method_intent: 'CREDIT',
        amount: 100,
      });
      expect(error).not.toBeNull();
    });
  });
});
