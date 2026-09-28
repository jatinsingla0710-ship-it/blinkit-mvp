import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  assignSalesman,
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

type PreviewLine = {
  skuId: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  availableQuantity: number | null;
  ok: boolean;
  errorCode: string | null;
  message: string | null;
};

type Preview = {
  lines: PreviewLine[];
  itemCount: number;
  subtotal: number;
  total: number;
  allValid: boolean;
};

function randomMobile(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`;
}

describe('preview_assisted_order_lines is read-only and matches order pricing', () => {
  async function seed(options?: {
    containerMode?: 'calculated' | 'custom';
    containerCustomPrice?: number;
    moq?: number;
    step?: number;
    onHand?: number;
  }) {
    const pool = getPool();
    const admin = await createAuthUser({ roles: ['ADMIN'], mobile: randomMobile('976') });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: randomMobile('977'),
    });
    const serviceAreaId = await insertServiceArea(pool, 'Preview Pricing');
    const shopId = await insertShop(pool, {
      serviceAreaId,
      assignedSalesmanId: salesman.id,
    });
    await assignSalesman(pool, shopId, salesman.id);

    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    await pool.query(
      `UPDATE public.skus
       SET packs_per_carton = 10,
           container_price_mode = $2::text,
           container_custom_price = $3,
           moq = $4,
           quantity_step = $5
       WHERE id = $1`,
      [
        skuId,
        options?.containerMode ?? 'calculated',
        options?.containerCustomPrice ?? null,
        options?.moq ?? 1,
        options?.step ?? 1,
      ],
    );
    await pool.query(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, 166, $2)`,
      [skuId, admin.id],
    );
    for (const tier of [
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
      [skuId, locationId, options?.onHand ?? 500],
    );

    return { pool, admin, salesman, serviceAreaId, shopId, skuId, locationId };
  }

  async function preview(
    user: { accessToken: string; refreshToken: string },
    lines: { skuId: string; quantity: number }[],
  ): Promise<Preview> {
    return withUserClient(
      user.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('preview_assisted_order_lines', {
          p_lines: lines,
        });
        if (error) throw error;
        return data as unknown as Preview;
      },
      { refreshToken: user.refreshToken },
    );
  }

  async function place(
    user: { accessToken: string; refreshToken: string },
    shopId: string,
    serviceAreaId: string,
    lines: { skuId: string; quantity: number }[],
  ): Promise<string> {
    return withUserClient(
      user.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('place_assisted_order', {
          p_shop_id: shopId,
          p_service_area_id: serviceAreaId,
          p_lines: lines,
          p_notes: 'Preview parity test',
        });
        if (error) throw error;
        return data as string;
      },
      { refreshToken: user.refreshToken },
    );
  }

  async function counts(skuId: string, shopId: string) {
    const { rows } = await getPool().query<{
      orders: string;
      lines: string;
      reservations: string;
      commission: string;
      reserved: string;
      on_hand: string;
    }>(
      `SELECT
         (SELECT count(*) FROM public.orders WHERE shop_id = $2)::text AS orders,
         (SELECT count(*) FROM public.order_lines WHERE sku_id = $1)::text AS lines,
         (SELECT count(*) FROM public.stock_reservations sr
            JOIN public.orders o ON o.id = sr.order_id WHERE o.shop_id = $2)::text AS reservations,
         (SELECT count(*) FROM public.salesman_commission_entries sce
            JOIN public.orders o ON o.id = sce.order_id WHERE o.shop_id = $2)::text AS commission,
         (SELECT coalesce(sum(reserved_quantity), 0) FROM public.inventory_balances WHERE sku_id = $1)::text AS reserved,
         (SELECT coalesce(sum(on_hand_quantity), 0) FROM public.inventory_balances WHERE sku_id = $1)::text AS on_hand`,
      [skuId, shopId],
    );
    return rows[0];
  }

  it.each([
    { qty: 7, label: 'loose packs only' },
    { qty: 40, label: '4 bags, below tier' },
    { qty: 50, label: '5 bags, first tier' },
    { qty: 100, label: '10 bags, higher tier' },
  ])('K: preview equals placed order line ($label)', async ({ qty }) => {
    const { salesman, serviceAreaId, shopId, skuId } = await seed();

    const p = await preview(salesman, [{ skuId, quantity: qty }]);
    expect(p.allValid).toBe(true);
    expect(p.lines).toHaveLength(1);

    const orderId = await place(salesman, shopId, serviceAreaId, [
      { skuId, quantity: qty },
    ]);
    const { rows } = await getPool().query<{
      agreed_unit_price: string;
      line_total: string;
      total: string;
    }>(
      `SELECT ol.agreed_unit_price::text, ol.line_total::text, o.total::text
       FROM public.order_lines ol JOIN public.orders o ON o.id = ol.order_id
       WHERE ol.order_id = $1`,
      [orderId],
    );
    expect(Number(p.lines[0].lineTotal)).toBe(Number(rows[0].line_total));
    expect(Number(p.lines[0].unitPrice)).toBe(Number(rows[0].agreed_unit_price));
    expect(Number(p.total)).toBe(Number(rows[0].total));
  });

  it('K: custom container price preview equals placed order', async () => {
    const { salesman, serviceAreaId, shopId, skuId } = await seed({
      containerMode: 'custom',
      containerCustomPrice: 1600,
    });
    const p = await preview(salesman, [{ skuId, quantity: 20 }]);
    const orderId = await place(salesman, shopId, serviceAreaId, [
      { skuId, quantity: 20 },
    ]);
    const { rows } = await getPool().query<{ total: string }>(
      `SELECT total::text FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(Number(p.total)).toBe(Number(rows[0].total));
  });

  it('preview writes nothing: no order, lines, reservation, commission or stock change', async () => {
    const { salesman, shopId, skuId } = await seed();
    const before = await counts(skuId, shopId);
    await preview(salesman, [{ skuId, quantity: 50 }]);
    await preview(salesman, [{ skuId, quantity: 100 }]);
    const after = await counts(skuId, shopId);
    expect(after).toEqual(before);
    expect(after.orders).toBe('0');
    expect(after.commission).toBe('0');
  });

  it('assisted order itself creates no commission entries', async () => {
    const { salesman, serviceAreaId, shopId, skuId } = await seed();
    await place(salesman, shopId, serviceAreaId, [{ skuId, quantity: 50 }]);
    const after = await counts(skuId, shopId);
    expect(after.orders).toBe('1');
    expect(after.commission).toBe('0');
    expect(after.reservations).toBe('0');
  });

  it('reports MOQ, step and stock problems per line without raising', async () => {
    const { salesman, skuId } = await seed({ moq: 10, step: 5, onHand: 30 });

    const belowMoq = await preview(salesman, [{ skuId, quantity: 5 }]);
    expect(belowMoq.allValid).toBe(false);
    expect(belowMoq.lines[0].errorCode).toBe('BELOW_MOQ');

    const badStep = await preview(salesman, [{ skuId, quantity: 12 }]);
    expect(badStep.lines[0].errorCode).toBe('INVALID_STEP');

    const tooMuch = await preview(salesman, [{ skuId, quantity: 35 }]);
    expect(tooMuch.lines[0].errorCode).toBe('INSUFFICIENT_STOCK');
    expect(Number(tooMuch.lines[0].availableQuantity)).toBe(30);

    const ok = await preview(salesman, [{ skuId, quantity: 30 }]);
    expect(ok.allValid).toBe(true);
    expect(ok.lines[0].ok).toBe(true);
  });

  it('K: flags quantities that place_assisted_order would reject on unit-price rounding', async () => {
    const { salesman, serviceAreaId, shopId, skuId } = await seed();
    // 5 bags + 3 packs = 8773.00; 8773 / 53 = 165.53 and 53 * 165.53 = 8773.09.
    const p = await preview(salesman, [{ skuId, quantity: 53 }]);
    expect(p.allValid).toBe(false);
    expect(p.lines[0].errorCode).toBe('PRICE_SPLIT');
    expect(Number(p.lines[0].lineTotal)).toBe(8773);

    await expect(
      place(salesman, shopId, serviceAreaId, [{ skuId, quantity: 53 }]),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/order_lines_line_total_matches/),
    });
    const after = await counts(skuId, shopId);
    expect(after.orders).toBe('0');
  });

  it('flags duplicate SKUs (order_lines allows one line per SKU)', async () => {
    const { salesman, skuId } = await seed();
    const p = await preview(salesman, [
      { skuId, quantity: 10 },
      { skuId, quantity: 10 },
    ]);
    expect(p.allValid).toBe(false);
    expect(p.lines[1].errorCode).toBe('DUPLICATE_SKU');
  });

  it('rejects callers without salesman or admin role', async () => {
    const { skuId } = await seed();
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: randomMobile('978'),
    });
    await expect(preview(customer, [{ skuId, quantity: 10 }])).rejects.toMatchObject({
      message: expect.stringMatching(/Salesman or admin role required/),
    });
  });
});
