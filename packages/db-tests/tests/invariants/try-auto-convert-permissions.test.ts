import { describe, expect, it } from 'vitest';
import { getPool, withTrusted, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  createPaymentForOrder,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

type BalanceRow = {
  on_hand_quantity: string;
  reserved_quantity: string;
  available_quantity: string;
};

describe('try_auto_convert_order_to_sale permissions', () => {
  async function seedDeliveredPaidOrder() {
    const pool = getPool();
    const qty = 10;
    const onHand = 100;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `963${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `964${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `965${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    const serviceAreaId = await insertServiceArea(pool, 'Auto Convert Perms');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });

    await pool.query(
      `UPDATE public.order_lines
       SET quantity = $1, line_total = round(($1::numeric) * agreed_unit_price, 2)
       WHERE id = $2`,
      [qty, lineId],
    );
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders
         SET subtotal = round(($1::numeric) * 100, 2),
             total = round(($1::numeric) * 100, 2)
         WHERE id = $2`,
        [qty, orderId],
      );
    });

    await pool.query(
      `INSERT INTO public.inventory_balances (
         sku_id, operational_location_id, on_hand_quantity, reserved_quantity
       ) VALUES ($1, $2, $3, $4)`,
      [skuId, locationId, onHand, qty],
    );
    await pool.query(
      `INSERT INTO public.stock_reservations (
         order_id, sku_id, operational_location_id, quantity, status
       ) VALUES ($1, $2, $3, $4, 'RESERVED')`,
      [orderId, skuId, locationId, qty],
    );

    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');
    await setOrderStatusTrusted(pool, orderId, 'DELIVERED');

    return {
      pool,
      admin,
      customer,
      salesman,
      orderId,
      skuId,
      locationId,
      qty,
    };
  }

  async function readBalance(
    pool: ReturnType<typeof getPool>,
    skuId: string,
    locationId: string,
  ): Promise<BalanceRow> {
    const { rows } = await pool.query<BalanceRow>(
      `SELECT on_hand_quantity::text, reserved_quantity::text, available_quantity::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    return rows[0];
  }

  it('authenticated customer cannot execute try_auto_convert_order_to_sale', async () => {
    const { customer, orderId } = await seedDeliveredPaidOrder();

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('try_auto_convert_order_to_sale', {
          p_order_id: orderId,
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('authenticated salesman cannot execute try_auto_convert_order_to_sale', async () => {
    const { salesman, orderId } = await seedDeliveredPaidOrder();

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('try_auto_convert_order_to_sale', {
          p_order_id: orderId,
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('authenticated customer cannot execute _convert_order_to_sale_core', async () => {
    const { customer, orderId } = await seedDeliveredPaidOrder();

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('_convert_order_to_sale_core', {
          p_order_id: orderId,
          p_actor_profile_id: customer.id,
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501|Could not find/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('owner/internal try_auto_convert still converts, consumes inventory once, stays idempotent', async () => {
    const { pool, orderId, skuId, locationId, qty } =
      await seedDeliveredPaidOrder();

    const before = await readBalance(pool, skuId, locationId);
    expect(before.on_hand_quantity).toBe('100.000');
    expect(before.reserved_quantity).toBe('10.000');

    // DB owner path mirrors SECURITY DEFINER callers (delivery_complete_stop, etc.).
    const { rows: first } = await pool.query<{ result: Record<string, unknown> }>(
      `SELECT public.try_auto_convert_order_to_sale($1) AS result`,
      [orderId],
    );
    expect(first[0].result.converted).toBe(true);
    expect(first[0].result.alreadyConverted).not.toBe(true);

    const after = await readBalance(pool, skuId, locationId);
    expect(after.on_hand_quantity).toBe('90.000');
    expect(after.reserved_quantity).toBe('0.000');

    const { rows: movements } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.inventory_movements
       WHERE reference_id = $1 AND movement_type = 'ORDER_DISPATCH'`,
      [orderId],
    );
    expect(movements[0].c).toBe('1');

    const { rows: second } = await pool.query<{
      result: Record<string, unknown>;
    }>(`SELECT public.try_auto_convert_order_to_sale($1) AS result`, [orderId]);
    expect(second[0].result.converted).toBe(true);
    expect(second[0].result.alreadyConverted).toBe(true);

    const finalBal = await readBalance(pool, skuId, locationId);
    expect(finalBal.on_hand_quantity).toBe('90.000');
    expect(finalBal.reserved_quantity).toBe('0.000');

    const { rows: movementsAfter } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.inventory_movements
       WHERE reference_id = $1 AND movement_type = 'ORDER_DISPATCH'`,
      [orderId],
    );
    expect(movementsAfter[0].c).toBe('1');
    expect(qty).toBe(10);
  });

  it('admin_convert_order_to_sale remains callable and converts correctly', async () => {
    const { pool, admin, orderId, skuId, locationId } =
      await seedDeliveredPaidOrder();

    const data = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data: result, error } = await client.rpc(
          'admin_convert_order_to_sale',
          { p_order_id: orderId },
        );
        if (error) throw error;
        return result as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(data.alreadyConverted).toBe(false);
    expect(data.saleId).toBeTruthy();

    const after = await readBalance(pool, skuId, locationId);
    expect(after.on_hand_quantity).toBe('90.000');
    expect(after.reserved_quantity).toBe('0.000');
  });

  it('authenticated role has no EXECUTE on try_auto_convert', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ ok: boolean }>(
      `SELECT has_function_privilege(
         'authenticated',
         'public.try_auto_convert_order_to_sale(uuid)',
         'EXECUTE'
       ) AS ok`,
    );
    expect(rows[0].ok).toBe(false);
  });
});
