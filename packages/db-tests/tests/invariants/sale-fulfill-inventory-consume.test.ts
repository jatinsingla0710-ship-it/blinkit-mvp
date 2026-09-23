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

describe('sale convert consumes reserved inventory', () => {
  async function seedDeliveredPaidOrder(options?: {
    quantity?: number;
    onHand?: number;
    locationCount?: 1 | 2;
  }) {
    const pool = getPool();
    const qty = options?.quantity ?? 10;
    const onHand = options?.onHand ?? 100;
    const locationCount = options?.locationCount ?? 1;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `962${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Inv Fulfill');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationA = await insertOperationalLocation(pool);
    const locationB =
      locationCount === 2 ? await insertOperationalLocation(pool) : null;

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
      [skuId, locationA, onHand, qty],
    );

    if (locationB) {
      await pool.query(
        `INSERT INTO public.inventory_balances (
           sku_id, operational_location_id, on_hand_quantity, reserved_quantity
         ) VALUES ($1, $2, $3, 0)`,
        [skuId, locationB, 50],
      );
    }

    await pool.query(
      `INSERT INTO public.stock_reservations (
         order_id, sku_id, operational_location_id, quantity, status
       ) VALUES ($1, $2, $3, $4, 'RESERVED')`,
      [orderId, skuId, locationA, qty],
    );

    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');
    await setOrderStatusTrusted(pool, orderId, 'DELIVERED');

    return {
      pool,
      admin,
      orderId,
      skuId,
      locationA,
      locationB,
      qty,
      onHand,
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

  async function convertAsAdmin(
    admin: { accessToken: string; refreshToken: string },
    orderId: string,
  ) {
    return withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_convert_order_to_sale', {
          p_order_id: orderId,
        });
        if (error) throw error;
        return data as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );
  }

  it('reserve → fulfill decreases on_hand, clears reserved, writes ORDER_DISPATCH', async () => {
    const { pool, admin, orderId, skuId, locationA, qty, onHand } =
      await seedDeliveredPaidOrder({ quantity: 10, onHand: 100 });

    const before = await readBalance(pool, skuId, locationA);
    expect(before.on_hand_quantity).toBe('100.000');
    expect(before.reserved_quantity).toBe('10.000');
    expect(before.available_quantity).toBe('90.000');

    const result = await convertAsAdmin(admin, orderId);
    expect(result.alreadyConverted).toBe(false);

    const after = await readBalance(pool, skuId, locationA);
    expect(after.on_hand_quantity).toBe('90.000');
    expect(after.reserved_quantity).toBe('0.000');
    expect(after.available_quantity).toBe('90.000');

    const { rows: movements } = await pool.query<{
      movement_type: string;
      quantity_delta: string;
      reference_id: string;
    }>(
      `SELECT movement_type::text, quantity_delta::text, reference_id::text
       FROM public.inventory_movements
       WHERE reference_type = 'order' AND reference_id = $1
       ORDER BY created_at ASC`,
      [orderId],
    );
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe('ORDER_DISPATCH');
    expect(movements[0].quantity_delta).toBe((-qty).toFixed(3));

    const { rows: reservations } = await pool.query<{ status: string }>(
      `SELECT status::text FROM public.stock_reservations WHERE order_id = $1`,
      [orderId],
    );
    expect(reservations[0].status).toBe('FULFILLED');
    expect(onHand - qty).toBe(90);
  });

  it('running conversion twice does not deduct inventory twice', async () => {
    const { pool, admin, orderId, skuId, locationA } =
      await seedDeliveredPaidOrder({ quantity: 10, onHand: 100 });

    const first = await convertAsAdmin(admin, orderId);
    expect(first.alreadyConverted).toBe(false);

    const second = await convertAsAdmin(admin, orderId);
    expect(second.alreadyConverted).toBe(true);

    const after = await readBalance(pool, skuId, locationA);
    expect(after.on_hand_quantity).toBe('90.000');
    expect(after.reserved_quantity).toBe('0.000');

    const { rows: movements } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.inventory_movements
       WHERE reference_type = 'order'
         AND reference_id = $1
         AND movement_type = 'ORDER_DISPATCH'`,
      [orderId],
    );
    expect(movements[0].c).toBe('1');
  });

  it('multi-warehouse reservation deducts only from the reserved warehouse', async () => {
    const { pool, admin, orderId, skuId, locationA, locationB } =
      await seedDeliveredPaidOrder({
        quantity: 10,
        onHand: 100,
        locationCount: 2,
      });

    await convertAsAdmin(admin, orderId);

    const a = await readBalance(pool, skuId, locationA!);
    const b = await readBalance(pool, skuId, locationB!);
    expect(a.on_hand_quantity).toBe('90.000');
    expect(a.reserved_quantity).toBe('0.000');
    expect(b.on_hand_quantity).toBe('50.000');
    expect(b.reserved_quantity).toBe('0.000');

    const { rows: movements } = await pool.query<{
      operational_location_id: string;
    }>(
      `SELECT operational_location_id::text
       FROM public.inventory_movements
       WHERE reference_id = $1 AND movement_type = 'ORDER_DISPATCH'`,
      [orderId],
    );
    expect(movements).toHaveLength(1);
    expect(movements[0].operational_location_id).toBe(locationA);
  });

  it('failed conversion does not partially consume stock', async () => {
    const { pool, admin, orderId, skuId, locationA } =
      await seedDeliveredPaidOrder({ quantity: 10, onHand: 100 });

    // Remove reservation so convert fails after status/payment checks.
    await withTrusted(async (client) => {
      await client.query(`DELETE FROM public.stock_reservations WHERE order_id = $1`, [
        orderId,
      ]);
      await client.query(
        `UPDATE public.inventory_balances
         SET reserved_quantity = 0
         WHERE sku_id = $1 AND operational_location_id = $2`,
        [skuId, locationA],
      );
    });

    await expect(convertAsAdmin(admin, orderId)).rejects.toThrow(
      /no active stock reservations/i,
    );

    const after = await readBalance(pool, skuId, locationA);
    expect(after.on_hand_quantity).toBe('100.000');
    expect(after.reserved_quantity).toBe('0.000');

    const { rows: sales } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.sales WHERE order_id = $1`,
      [orderId],
    );
    expect(sales[0].c).toBe('0');

    const { rows: movements } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.inventory_movements
       WHERE reference_id = $1 AND movement_type = 'ORDER_DISPATCH'`,
      [orderId],
    );
    expect(movements[0].c).toBe('0');
  });

  it('refund after fulfilled sale restores stock exactly once', async () => {
    const { pool, admin, orderId, skuId, locationA } =
      await seedDeliveredPaidOrder({ quantity: 10, onHand: 100 });

    await convertAsAdmin(admin, orderId);
    const mid = await readBalance(pool, skuId, locationA);
    expect(mid.on_hand_quantity).toBe('90.000');

    const firstRefund = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: orderId,
          p_reason: 'Customer return',
          p_restock: true,
        });
        if (error) throw error;
        return data as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );
    expect(firstRefund.alreadyRefunded).toBe(false);
    expect(firstRefund.restockedItemCount).toBe(1);

    const restored = await readBalance(pool, skuId, locationA);
    expect(restored.on_hand_quantity).toBe('100.000');
    expect(restored.reserved_quantity).toBe('0.000');

    const secondRefund = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_refund_converted_sale', {
          p_order_id: orderId,
          p_reason: 'Customer return again',
          p_restock: true,
        });
        if (error) throw error;
        return data as Record<string, unknown>;
      },
      { refreshToken: admin.refreshToken },
    );
    expect(secondRefund.alreadyRefunded).toBe(true);
    expect(secondRefund.restockedItemCount).toBe(0);

    const finalBal = await readBalance(pool, skuId, locationA);
    expect(finalBal.on_hand_quantity).toBe('100.000');

    const { rows: returns } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.inventory_movements
       WHERE reference_id = $1 AND movement_type = 'RETURN'`,
      [orderId],
    );
    expect(returns[0].c).toBe('1');
  });

  it('trusted consume helper is idempotent when already dispatched', async () => {
    const { pool, admin, orderId, skuId, locationA } =
      await seedDeliveredPaidOrder({ quantity: 5, onHand: 40 });

    await convertAsAdmin(admin, orderId);

    await withTrusted(async (client) => {
      const { rows } = await client.query<{ alreadyConsumed: boolean }>(
        `SELECT (public._consume_reserved_inventory_for_order($1, $2) ->> 'alreadyConsumed')::boolean
           AS "alreadyConsumed"`,
        [orderId, admin.id],
      );
      expect(rows[0].alreadyConsumed).toBe(true);
    });

    const after = await readBalance(pool, skuId, locationA);
    expect(after.on_hand_quantity).toBe('35.000');
    expect(after.reserved_quantity).toBe('0.000');
  });
});
