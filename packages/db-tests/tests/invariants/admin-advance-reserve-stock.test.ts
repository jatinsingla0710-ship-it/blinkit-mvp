import { describe, expect, it } from 'vitest';
import { getPool, withTrusted, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

describe('admin_advance_order_to reserves on STOCK_RESERVED', () => {
  async function seedConfirmedOrder(options?: {
    quantity?: number;
    onHand?: number;
    withReservation?: boolean;
  }) {
    const pool = getPool();
    const qty = options?.quantity ?? 10;
    const onHand = options?.onHand ?? 100;
    const withReservation = options?.withReservation ?? false;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `973${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Advance Reserve');
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
      [skuId, locationId, onHand, withReservation ? qty : 0],
    );

    if (withReservation) {
      await pool.query(
        `INSERT INTO public.stock_reservations (
           order_id, sku_id, operational_location_id, quantity, status
         ) VALUES ($1, $2, $3, $4, 'RESERVED')`,
        [orderId, skuId, locationId, qty],
      );
    }

    await setOrderStatusTrusted(pool, orderId, 'CONFIRMED');

    return { pool, admin, orderId, skuId, locationId, qty, onHand };
  }

  async function readStatus(orderId: string): Promise<string> {
    const { rows } = await getPool().query<{ status: string }>(
      `SELECT status::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    return rows[0].status;
  }

  async function countActiveReservations(orderId: string): Promise<number> {
    const { rows } = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.stock_reservations
       WHERE order_id = $1
         AND status IN ('PENDING', 'RESERVED')`,
      [orderId],
    );
    return Number(rows[0].c);
  }

  async function readReservedQty(
    skuId: string,
    locationId: string,
  ): Promise<number> {
    const { rows } = await getPool().query<{ reserved_quantity: string }>(
      `SELECT reserved_quantity::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    return Number(rows[0].reserved_quantity);
  }

  it('A: CONFIRMED with no reservation → PROCESSING creates real reservation', async () => {
    const { admin, orderId, skuId, locationId, qty } = await seedConfirmedOrder({
      quantity: 10,
      onHand: 100,
      withReservation: false,
    });

    expect(await countActiveReservations(orderId)).toBe(0);

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_advance_order_to', {
          p_order_id: orderId,
          p_to_status: 'PROCESSING',
          p_note: 'Packing started',
        });
        if (error) throw error;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('PROCESSING');
    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);

    const { rows: events } = await getPool().query<{ to_status: string }>(
      `SELECT to_status::text
       FROM public.order_events
       WHERE order_id = $1 AND to_status = 'STOCK_RESERVED'`,
      [orderId],
    );
    expect(events).toHaveLength(1);
  });

  it('B: CONFIRMED with insufficient inventory → fails and stays CONFIRMED', async () => {
    const { admin, orderId, skuId, locationId } = await seedConfirmedOrder({
      quantity: 10,
      onHand: 2,
      withReservation: false,
    });

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_advance_order_to', {
          p_order_id: orderId,
          p_to_status: 'PROCESSING',
          p_note: 'Packing started',
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(/Insufficient stock/i);
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('CONFIRMED');
    expect(await countActiveReservations(orderId)).toBe(0);
    expect(await readReservedQty(skuId, locationId)).toBe(0);

    const { rows: events } = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM public.order_events
       WHERE order_id = $1 AND to_status = 'STOCK_RESERVED'`,
      [orderId],
    );
    expect(events[0].c).toBe('0');
  });

  it('C: CONFIRMED already reserved → PROCESSING does not double-reserve', async () => {
    const { admin, orderId, skuId, locationId, qty } = await seedConfirmedOrder({
      quantity: 10,
      onHand: 100,
      withReservation: true,
    });

    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_advance_order_to', {
          p_order_id: orderId,
          p_to_status: 'PROCESSING',
          p_note: 'Packing started',
        });
        if (error) throw error;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('PROCESSING');
    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);
  });

  it('D: already STOCK_RESERVED → PROCESSING does not reserve again', async () => {
    const { pool, admin, orderId, skuId, locationId, qty } =
      await seedConfirmedOrder({
        quantity: 5,
        onHand: 40,
        withReservation: true,
      });

    await setOrderStatusTrusted(pool, orderId, 'STOCK_RESERVED');
    expect(await countActiveReservations(orderId)).toBe(1);

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_advance_order_to', {
          p_order_id: orderId,
          p_to_status: 'PROCESSING',
          p_note: 'Packing started',
        });
        if (error) throw error;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('PROCESSING');
    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);
  });

  it('E: admin_start_packing and admin_pack_order still work with real reserve', async () => {
    const { admin, orderId, skuId, locationId, qty } = await seedConfirmedOrder({
      quantity: 8,
      onHand: 50,
      withReservation: false,
    });

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error: packStartErr } = await client.rpc('admin_start_packing', {
          p_order_id: orderId,
        });
        if (packStartErr) throw packStartErr;
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('PROCESSING');
    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_pack_order', {
          p_order_id: orderId,
        });
        if (error) throw error;
        expect((data as Record<string, unknown>).status).toBe(
          'READY_FOR_DISPATCH',
        );
      },
      { refreshToken: admin.refreshToken },
    );

    expect(await readStatus(orderId)).toBe('READY_FOR_DISPATCH');
    expect(await countActiveReservations(orderId)).toBe(1);
    expect(await readReservedQty(skuId, locationId)).toBe(qty);
  });
});
