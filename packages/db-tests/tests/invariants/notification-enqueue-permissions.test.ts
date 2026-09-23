import { describe, expect, it } from 'vitest';
import { getPool, getServiceClient, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('notification enqueue permissions', () => {
  async function seedShopWithContact() {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `970${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `971${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `972${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    const serviceAreaId = await insertServiceArea(pool, 'Notif Perms');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);

    await pool.query(
      `INSERT INTO public.shop_contacts (shop_id, name, mobile, is_primary)
       VALUES ($1, 'Primary Contact', $2, true)`,
      [shopId, customer.mobile],
    );

    return { pool, admin, customer, salesman, serviceAreaId, shopId, skuId };
  }

  it('authenticated customer cannot execute _enqueue_shop_notification', async () => {
    const { customer, shopId } = await seedShopWithContact();

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('_enqueue_shop_notification', {
          p_shop_id: shopId,
          p_template_key: 'spam_test',
          p_payload: {},
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501|Could not find/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('authenticated customer cannot execute enqueue_notification', async () => {
    const { customer } = await seedShopWithContact();

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('enqueue_notification', {
          p_channel: 'WHATSAPP',
          p_template_key: 'spam_test',
          p_recipient: '9999999999',
          p_payload: { hello: 'world' },
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('authenticated salesman cannot execute enqueue_notification', async () => {
    const { salesman } = await seedShopWithContact();

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('enqueue_notification', {
          p_channel: 'SMS',
          p_template_key: 'spam_test',
          p_recipient: '8888888888',
          p_payload: {},
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('authenticated customer cannot execute _delivery_record_notification', async () => {
    const { pool, customer, admin, serviceAreaId, shopId, skuId } =
      await seedShopWithContact();
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('_delivery_record_notification', {
          p_order_id: orderId,
          p_kind: 'DELIVERY_COMPLETED',
          p_message: 'spam',
          p_payload: {},
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501|Could not find/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('authenticated has no EXECUTE on shop/enqueue helpers', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ shop: boolean; enqueue: boolean; delivery: boolean }>(
      `SELECT
         has_function_privilege(
           'authenticated',
           'public._enqueue_shop_notification(uuid, text, jsonb, text, uuid, public.notification_channel)',
           'EXECUTE'
         ) AS shop,
         has_function_privilege(
           'authenticated',
           'public.enqueue_notification(public.notification_channel, text, text, jsonb, text, uuid)',
           'EXECUTE'
         ) AS enqueue,
         has_function_privilege(
           'authenticated',
           'public._delivery_record_notification(uuid, public.delivery_notification_event_kind, text, jsonb)',
           'EXECUTE'
         ) AS delivery`,
    );
    expect(rows[0].shop).toBe(false);
    expect(rows[0].enqueue).toBe(false);
    expect(rows[0].delivery).toBe(false);
  });

  it('internal _enqueue_shop_notification still writes outbox for a shop', async () => {
    const { pool, shopId, customer } = await seedShopWithContact();

    const { rows } = await pool.query<{ id: string }>(
      `SELECT public._enqueue_shop_notification(
         $1,
         'order_approval_requested',
         jsonb_build_object('test', true),
         'shop',
         $1,
         'WHATSAPP'::public.notification_channel
       ) AS id`,
      [shopId],
    );
    expect(rows[0].id).toBeTruthy();

    const { rows: outbox } = await pool.query<{
      template_key: string;
      recipient: string;
      status: string;
      channel: string;
    }>(
      `SELECT template_key, recipient, status::text, channel::text
       FROM public.notification_outbox
       WHERE id = $1`,
      [rows[0].id],
    );
    expect(outbox[0].template_key).toBe('order_approval_requested');
    expect(outbox[0].status).toBe('PENDING');
    expect(outbox[0].channel).toBe('WHATSAPP');
    expect(outbox[0].recipient).toBe(customer.mobile);
  });

  it('service_role can still enqueue_notification (edge worker path)', async () => {
    const service = getServiceClient();
    const { data, error } = await service.rpc('enqueue_notification', {
      p_channel: 'SMS',
      p_template_key: 'edge_worker_test',
      p_recipient: '9111111111',
      p_payload: { source: 'test' },
      p_related_entity_type: null,
      p_related_entity_id: null,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const pool = getPool();
    const { rows } = await pool.query<{ template_key: string; status: string }>(
      `SELECT template_key, status::text
       FROM public.notification_outbox
       WHERE id = $1`,
      [data],
    );
    expect(rows[0].template_key).toBe('edge_worker_test');
    expect(rows[0].status).toBe('PENDING');
  });

  it('internal _delivery_record_notification still records a delivery event', async () => {
    const { pool, admin, serviceAreaId, shopId, skuId } =
      await seedShopWithContact();
    const { orderId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });

    const { rows } = await pool.query<{ id: string }>(
      `SELECT public._delivery_record_notification(
         $1,
         'DELIVERY_COMPLETED'::public.delivery_notification_event_kind,
         'Your order has been delivered successfully.',
         jsonb_build_object('test', true)
       ) AS id`,
      [orderId],
    );
    expect(rows[0].id).toBeTruthy();

    const { rows: events } = await pool.query<{ kind: string; order_id: string }>(
      `SELECT kind::text, order_id::text
       FROM public.delivery_notification_events
       WHERE id = $1`,
      [rows[0].id],
    );
    expect(events[0].kind).toBe('DELIVERY_COMPLETED');
    expect(events[0].order_id).toBe(orderId);
  });
});
