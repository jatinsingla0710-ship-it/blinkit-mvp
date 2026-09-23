import { describe, expect, it } from 'vitest';
import { getPool, withTrusted, withUserClient } from '../../src/client';
import {
  assignSalesman,
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('assisted order pricing aligns with resolve_sku_order_line_total', () => {
  async function seedPricedSku(options?: {
    packPrice?: number;
    packsPerCarton?: number;
    containerMode?: 'calculated' | 'custom';
    containerCustomPrice?: number;
    tiers?: Array<{ minOuter: number; discountPerOuter: number }>;
    onHand?: number;
  }) {
    const pool = getPool();
    const packPrice = options?.packPrice ?? 166;
    const packsPerCarton = options?.packsPerCarton ?? 10;
    const onHand = options?.onHand ?? 500;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `974${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `975${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    const serviceAreaId = await insertServiceArea(pool, 'Assisted Pricing');
    const shopId = await insertShop(pool, {
      serviceAreaId,
      assignedSalesmanId: salesman.id,
    });
    await assignSalesman(pool, shopId, salesman.id);

    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    await pool.query(
      `UPDATE public.skus
       SET packs_per_carton = $2,
           container_price_mode = $3::text,
           container_custom_price = $4,
           moq = 1,
           quantity_step = 1
       WHERE id = $1`,
      [
        skuId,
        packsPerCarton,
        options?.containerMode ?? 'calculated',
        options?.containerCustomPrice ?? null,
      ],
    );

    await pool.query(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, $2, $3)`,
      [skuId, packPrice, admin.id],
    );

    for (const tier of options?.tiers ?? [
      { minOuter: 5, discountPerOuter: 5 },
      { minOuter: 10, discountPerOuter: 7 },
    ]) {
      await pool.query(
        `INSERT INTO public.sku_outer_discount_tiers (
           sku_id, min_outer_quantity, discount_per_outer_unit, recorded_by_profile_id
         ) VALUES ($1, $2, $3, $4)`,
        [skuId, tier.minOuter, tier.discountPerOuter, admin.id],
      );
    }

    await pool.query(
      `INSERT INTO public.inventory_balances (
         sku_id, operational_location_id, on_hand_quantity, reserved_quantity
       ) VALUES ($1, $2, $3, 0)`,
      [skuId, locationId, onHand],
    );

    return { pool, admin, salesman, serviceAreaId, shopId, skuId, locationId };
  }

  async function expectedLine(skuId: string, qty: number) {
    const { rows } = await getPool().query<{
      line_total: string;
      unit: string;
    }>(
      `SELECT public.resolve_sku_order_line_total($1, $2)::text AS line_total,
              round(public.resolve_sku_order_line_total($1, $2) / $2, 4)::text AS unit`,
      [skuId, qty],
    );
    return {
      lineTotal: Number(rows[0].line_total),
      unit: Number(rows[0].unit),
    };
  }

  async function placeAssisted(
    admin: { accessToken: string; refreshToken: string },
    shopId: string,
    serviceAreaId: string,
    skuId: string,
    qty: number,
  ): Promise<string> {
    return withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('place_assisted_order', {
          p_shop_id: shopId,
          p_service_area_id: serviceAreaId,
          p_lines: [{ skuId, quantity: qty }],
          p_notes: 'Pricing alignment test',
        });
        if (error) throw error;
        return data as string;
      },
      { refreshToken: admin.refreshToken },
    );
  }

  async function readLine(orderId: string) {
    const { rows } = await getPool().query<{
      quantity: string;
      agreed_unit_price: string;
      line_total: string;
      status: string;
      subtotal: string;
    }>(
      `SELECT ol.quantity::text, ol.agreed_unit_price::text, ol.line_total::text,
              o.status::text, o.subtotal::text
       FROM public.order_lines ol
       JOIN public.orders o ON o.id = ol.order_id
       WHERE ol.order_id = $1`,
      [orderId],
    );
    return rows[0];
  }

  it('A: below discount tier matches self-serve (40 packs / 4 bags)', async () => {
    const { admin, serviceAreaId, shopId, skuId } = await seedPricedSku();
    const qty = 40;
    const expected = await expectedLine(skuId, qty);
    expect(expected.lineTotal).toBe(6640);

    const orderId = await placeAssisted(
      admin,
      shopId,
      serviceAreaId,
      skuId,
      qty,
    );
    const line = await readLine(orderId);
    expect(Number(line.line_total)).toBe(expected.lineTotal);
    expect(Number(line.agreed_unit_price)).toBe(expected.unit);
    expect(Number(line.subtotal)).toBe(expected.lineTotal);
  });

  it('B: first outer discount tier matches self-serve (50 packs / 5 bags)', async () => {
    const { admin, serviceAreaId, shopId, skuId } = await seedPricedSku();
    const qty = 50;
    const expected = await expectedLine(skuId, qty);
    expect(expected.lineTotal).toBe(8275);

    const orderId = await placeAssisted(
      admin,
      shopId,
      serviceAreaId,
      skuId,
      qty,
    );
    const line = await readLine(orderId);
    expect(Number(line.line_total)).toBe(expected.lineTotal);
    expect(Number(line.agreed_unit_price)).toBe(expected.unit);
  });

  it('C: higher outer discount tier matches self-serve (100 packs / 10 bags)', async () => {
    const { admin, serviceAreaId, shopId, skuId } = await seedPricedSku();
    const qty = 100;
    const expected = await expectedLine(skuId, qty);
    expect(expected.lineTotal).toBe(16530);

    const orderId = await placeAssisted(
      admin,
      shopId,
      serviceAreaId,
      skuId,
      qty,
    );
    const line = await readLine(orderId);
    expect(Number(line.line_total)).toBe(expected.lineTotal);
    expect(Number(line.agreed_unit_price)).toBe(expected.unit);
  });

  it('D: custom outer/container price matches self-serve', async () => {
    const { admin, serviceAreaId, shopId, skuId } = await seedPricedSku({
      containerMode: 'custom',
      containerCustomPrice: 1600,
      tiers: [],
    });
    const qty = 20;
    const expected = await expectedLine(skuId, qty);
    expect(expected.lineTotal).toBe(3200);

    const orderId = await placeAssisted(
      admin,
      shopId,
      serviceAreaId,
      skuId,
      qty,
    );
    const line = await readLine(orderId);
    expect(Number(line.line_total)).toBe(expected.lineTotal);
    expect(Number(line.agreed_unit_price)).toBe(expected.unit);
  });

  it('E: existing assisted order line prices remain unchanged', async () => {
    const { pool, admin, serviceAreaId, shopId, skuId } = await seedPricedSku();

    const legacyOrderId = (
      await withTrusted(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.orders (
             shop_id, service_area_id, created_by_profile_id, source, status,
             subtotal, adjustments, total
           ) VALUES ($1, $2, $3, 'SALESMAN_ASSISTED', 'AWAITING_CUSTOMER_CONFIRMATION',
                     8300, 0, 8300)
           RETURNING id`,
          [shopId, serviceAreaId, admin.id],
        );
        await client.query(
          `INSERT INTO public.order_lines (
             order_id, sku_id, product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
             selling_unit_snapshot, quantity, agreed_unit_price, line_total
           ) VALUES ($1, $2, 'Legacy', 'Legacy', 'LEG', 'KG', 50, 166, 8300)`,
          [rows[0].id, skuId],
        );
        return rows[0].id;
      })
    );

    // Place a new correctly priced order — must not touch the legacy row.
    await placeAssisted(admin, shopId, serviceAreaId, skuId, 50);

    const legacy = await readLine(legacyOrderId);
    expect(Number(legacy.agreed_unit_price)).toBe(166);
    expect(Number(legacy.line_total)).toBe(8300);
    expect(legacy.status).toBe('AWAITING_CUSTOMER_CONFIRMATION');
  });

  it('F: salesman_replace_assisted_order_lines uses same pricing', async () => {
    const { salesman, serviceAreaId, shopId, skuId } = await seedPricedSku();
    const qty = 50;
    const expected = await expectedLine(skuId, qty);

    const orderId = await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('place_assisted_order', {
          p_shop_id: shopId,
          p_service_area_id: serviceAreaId,
          p_lines: [{ skuId, quantity: 40 }],
          p_notes: 'Will replace',
        });
        if (error) throw error;
        return data as string;
      },
      { refreshToken: salesman.refreshToken },
    );

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('salesman_replace_assisted_order_lines', {
          p_order_id: orderId,
          p_lines: [{ skuId, quantity: qty }],
        });
        if (error) throw error;
      },
      { refreshToken: salesman.refreshToken },
    );

    const line = await readLine(orderId);
    expect(Number(line.line_total)).toBe(expected.lineTotal);
    expect(Number(line.agreed_unit_price)).toBe(expected.unit);
    expect(Number(line.subtotal)).toBe(expected.lineTotal);
  });

  it('G: place_assisted still does not reserve stock', async () => {
    const { admin, serviceAreaId, shopId, skuId, locationId } =
      await seedPricedSku();

    const orderId = await placeAssisted(
      admin,
      shopId,
      serviceAreaId,
      skuId,
      50,
    );
    const line = await readLine(orderId);
    expect(line.status).toBe('AWAITING_CUSTOMER_CONFIRMATION');

    const { rows: res } = await getPool().query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.stock_reservations WHERE order_id = $1`,
      [orderId],
    );
    expect(res[0].c).toBe('0');

    const { rows: bal } = await getPool().query<{ reserved_quantity: string }>(
      `SELECT reserved_quantity::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    expect(Number(bal[0].reserved_quantity)).toBe(0);
  });
});
