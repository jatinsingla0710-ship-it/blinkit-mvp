import { randomUUID } from 'node:crypto';
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

type CounterResult = {
  orderId: string;
  saleId: string;
  paymentId: string;
  invoiceNumber: string;
  shopId: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  itemCount: number;
  idempotentReplay?: boolean;
};

describe('counter sale backend (admin_complete_counter_sale)', () => {
  async function seedAdminShop(options?: {
    skuCount?: 1 | 2;
    packPrice?: number;
    onHand?: number;
  }) {
    const pool = getPool();
    const skuCount = options?.skuCount ?? 2;
    const packPrice = options?.packPrice ?? 500;
    const onHand = options?.onHand ?? 100;

    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `981${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Counter Sale');
    const shopId = await insertShop(pool, { serviceAreaId });
    const locationId = await insertOperationalLocation(pool);

    const skus: string[] = [];
    for (let i = 0; i < skuCount; i += 1) {
      const { skuId } = await insertMinimalCatalogue(pool);
      await pool.query(
        `UPDATE public.skus
         SET moq = 1, quantity_step = 1, packs_per_carton = 1
         WHERE id = $1`,
        [skuId],
      );
      await pool.query(
        `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
         VALUES ($1, $2, $3)`,
        [skuId, packPrice, admin.id],
      );
      await pool.query(
        `INSERT INTO public.inventory_balances (
           sku_id, operational_location_id, on_hand_quantity, reserved_quantity
         ) VALUES ($1, $2, $3, 0)`,
        [skuId, locationId, onHand],
      );
      skus.push(skuId);
    }

    return { pool, admin, serviceAreaId, shopId, locationId, skus, packPrice };
  }

  async function completeAsAdmin(
    admin: { accessToken: string; refreshToken: string },
    args: {
      shop: Record<string, unknown>;
      lines: Array<Record<string, unknown>>;
      payment: { amountPaid: number; method: string };
      billDiscount?: number;
      clientRequestId?: string;
    },
  ): Promise<CounterResult> {
    return withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_complete_counter_sale', {
          p_shop: args.shop,
          p_lines: args.lines,
          p_payment: args.payment,
          p_bill_discount: args.billDiscount ?? 0,
          p_notes: 'db-test counter sale',
          p_client_request_id: args.clientRequestId ?? null,
        });
        if (error) throw error;
        return data as CounterResult;
      },
      { refreshToken: admin.refreshToken },
    );
  }

  async function readBalance(skuId: string, locationId: string) {
    const { rows } = await getPool().query<{
      on_hand_quantity: string;
      reserved_quantity: string;
    }>(
      `SELECT on_hand_quantity::text, reserved_quantity::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [skuId, locationId],
    );
    return rows[0];
  }

  it('TEST 1: 2 catalogue SKUs + full cash', async () => {
    const { admin, shopId, skus, locationId, packPrice } = await seedAdminShop({
      skuCount: 2,
      packPrice: 500,
      onHand: 50,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [
        { kind: 'CATALOGUE', skuId: skus[0], quantity: 2 },
        { kind: 'CATALOGUE', skuId: skus[1], quantity: 1 },
      ],
      payment: { amountPaid: packPrice * 3, method: 'CASH' },
    });

    expect(result.paymentStatus).toBe('PAID');
    expect(Number(result.total)).toBe(packPrice * 3);
    expect(Number(result.amountDue)).toBe(0);
    expect(result.invoiceNumber).toMatch(/^INV-/);

    const { rows: orders } = await getPool().query<{ source: string }>(
      `SELECT source::text FROM public.orders WHERE id = $1`,
      [result.orderId],
    );
    expect(orders[0].source).toBe('COUNTER_SALE');

    const { rows: sales } = await getPool().query(
      `SELECT id FROM public.sales WHERE id = $1`,
      [result.saleId],
    );
    expect(sales).toHaveLength(1);

    const bal0 = await readBalance(skus[0], locationId);
    const bal1 = await readBalance(skus[1], locationId);
    expect(bal0.on_hand_quantity).toBe('48.000');
    expect(bal0.reserved_quantity).toBe('0.000');
    expect(bal1.on_hand_quantity).toBe('49.000');
  });

  it('TEST 2: catalogue + custom — stock only for catalogue', async () => {
    const { admin, shopId, skus, locationId, packPrice } = await seedAdminShop({
      skuCount: 2,
      packPrice: 200,
      onHand: 20,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [
        { kind: 'CATALOGUE', skuId: skus[0], quantity: 1 },
        { kind: 'CATALOGUE', skuId: skus[1], quantity: 1 },
        {
          kind: 'CUSTOM',
          name: 'Special Grocery Item',
          unit: 'Kg',
          quantity: 2,
          unitPrice: 180,
          discount: 10,
        },
      ],
      payment: { amountPaid: packPrice * 2 + 350, method: 'CASH' },
    });

    expect(Number(result.total)).toBe(packPrice * 2 + 350);

    const { rows: custom } = await getPool().query<{
      sku_id: string | null;
      product_name: string;
      quantity: string;
      unit_price: string;
      discount: string;
    }>(
      `SELECT sku_id::text, product_name, quantity::text, unit_price::text, discount::text
       FROM public.sale_items
       WHERE sale_id = $1 AND sku_id IS NULL`,
      [result.saleId],
    );
    expect(custom).toHaveLength(1);
    expect(custom[0].product_name).toBe('Special Grocery Item');
    expect(custom[0].quantity).toBe('2.000');
    expect(custom[0].unit_price).toBe('180.00');
    expect(custom[0].discount).toBe('10.00');

    const bal0 = await readBalance(skus[0], locationId);
    expect(bal0.on_hand_quantity).toBe('19.000');

    const { rows: movements } = await getPool().query(
      `SELECT id FROM public.inventory_movements
       WHERE reference_type = 'order' AND reference_id = $1`,
      [result.orderId],
    );
    expect(movements).toHaveLength(2);
  });

  it('TEST 3: ₹1800 sale, ₹500 UPI partial', async () => {
    const { admin, shopId, skus } = await seedAdminShop({
      skuCount: 1,
      packPrice: 900,
      onHand: 10,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [
        { kind: 'CATALOGUE', skuId: skus[0], quantity: 1 },
        {
          kind: 'CUSTOM',
          name: 'Extra',
          unit: 'Pc',
          quantity: 1,
          unitPrice: 900,
        },
      ],
      payment: { amountPaid: 500, method: 'UPI' },
    });

    expect(Number(result.total)).toBe(1800);
    expect(Number(result.amountPaid)).toBe(500);
    expect(Number(result.amountDue)).toBe(1300);
    expect(result.paymentStatus).toBe('PAYMENT_PENDING');

    const { rows: pay } = await getPool().query<{
      status: string;
      online: string;
      cash: string;
    }>(
      `SELECT status::text,
              online_collected_amount::text AS online,
              cash_collected_amount::text AS cash
       FROM public.payments WHERE id = $1`,
      [result.paymentId],
    );
    expect(pay[0].status).toBe('PAYMENT_PENDING');
    expect(pay[0].online).toBe('500.00');
    expect(pay[0].cash).toBe('0.00');
  });

  it('TEST 4: credit sale unpaid', async () => {
    const { admin, shopId, skus } = await seedAdminShop({
      skuCount: 1,
      packPrice: 1800,
      onHand: 5,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 1 }],
      payment: { amountPaid: 0, method: 'CASH' },
    });

    expect(result.paymentStatus).toBe('UNPAID');
    expect(Number(result.amountPaid)).toBe(0);
    expect(Number(result.amountDue)).toBe(1800);

    const { rows: sales } = await getPool().query(
      `SELECT id FROM public.sales WHERE id = $1`,
      [result.saleId],
    );
    expect(sales).toHaveLength(1);
  });

  it('TEST 5: insufficient stock rolls back everything', async () => {
    const { pool, admin, shopId, skus } = await seedAdminShop({
      skuCount: 1,
      packPrice: 100,
      onHand: 1,
    });

    await expect(
      completeAsAdmin(admin, {
        shop: { shopId },
        lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 5 }],
        payment: { amountPaid: 500, method: 'CASH' },
      }),
    ).rejects.toThrow(/Insufficient stock|No inventory/i);

    const { rows: orders } = await pool.query(
      `SELECT id FROM public.orders
       WHERE shop_id = $1 AND source = 'COUNTER_SALE'`,
      [shopId],
    );
    expect(orders).toHaveLength(0);

    const { rows: sales } = await pool.query(
      `SELECT s.id
       FROM public.sales s
       JOIN public.orders o ON o.id = s.order_id
       WHERE o.shop_id = $1`,
      [shopId],
    );
    expect(sales).toHaveLength(0);

    const { rows: movements } = await pool.query(
      `SELECT id FROM public.inventory_movements WHERE sku_id = $1`,
      [skus[0]],
    );
    expect(movements).toHaveLength(0);
  });

  it('TEST 6: custom-only sale — no inventory movement', async () => {
    const { admin, shopId, skus, locationId } = await seedAdminShop({
      skuCount: 1,
      onHand: 10,
    });
    const before = await readBalance(skus[0], locationId);

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [
        {
          kind: 'CUSTOM',
          name: 'Service charge',
          unit: 'Job',
          quantity: 1,
          unitPrice: 250,
        },
      ],
      payment: { amountPaid: 250, method: 'CASH' },
    });

    expect(Number(result.total)).toBe(250);
    const after = await readBalance(skus[0], locationId);
    expect(after.on_hand_quantity).toBe(before.on_hand_quantity);

    const { rows: movements } = await getPool().query(
      `SELECT id FROM public.inventory_movements
       WHERE reference_type = 'order' AND reference_id = $1`,
      [result.orderId],
    );
    expect(movements).toHaveLength(0);
  });

  it('TEST 7: catalogue price override persists; wholesale still authoritative', async () => {
    const { pool, admin, shopId, skus, packPrice } = await seedAdminShop({
      skuCount: 1,
      packPrice: 100,
      onHand: 20,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [
        { kind: 'CATALOGUE', skuId: skus[0], quantity: 2, unitPrice: 150 },
      ],
      payment: { amountPaid: 300, method: 'CASH' },
    });

    expect(Number(result.total)).toBe(300);
    const { rows: lines } = await pool.query<{ agreed: string }>(
      `SELECT agreed_unit_price::text AS agreed
       FROM public.order_lines WHERE order_id = $1`,
      [result.orderId],
    );
    expect(lines[0].agreed).toBe('150.00');

    // Wholesale place_assisted_order still ignores client agreedUnitPrice.
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `982${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await pool.query(
      `UPDATE public.shops SET assigned_salesman_profile_id = $1 WHERE id = $2`,
      [salesman.id, shopId],
    );
    await assignSalesman(pool, shopId, salesman.id);

    const serviceAreaId = (
      await pool.query<{ service_area_id: string }>(
        `SELECT service_area_id::text FROM public.shops WHERE id = $1`,
        [shopId],
      )
    ).rows[0].service_area_id;

    const assistedOrderId = await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('place_assisted_order', {
          p_shop_id: shopId,
          p_service_area_id: serviceAreaId,
          p_lines: [{ skuId: skus[0], quantity: 1, agreedUnitPrice: 999 }],
          p_notes: 'wholesale regression',
        });
        if (error) throw error;
        return data as string;
      },
      { refreshToken: salesman.refreshToken },
    );

    const { rows: assistedLines } = await pool.query<{ agreed: string }>(
      `SELECT agreed_unit_price::text AS agreed
       FROM public.order_lines WHERE order_id = $1`,
      [assistedOrderId],
    );
    expect(Number(assistedLines[0].agreed)).toBe(packPrice);
    expect(Number(assistedLines[0].agreed)).not.toBe(999);
  });

  it('TEST 8: partial then later collection', async () => {
    const { admin, shopId, skus } = await seedAdminShop({
      skuCount: 1,
      packPrice: 1000,
      onHand: 5,
    });

    const result = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 1 }],
      payment: { amountPaid: 400, method: 'UPI' },
    });
    expect(result.paymentStatus).toBe('PAYMENT_PENDING');

    const second = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('admin_record_order_collection', {
          p_order_id: result.orderId,
          p_amount: 600,
          p_method: 'CASH',
          p_note: 'remainder at counter',
        });
        if (error) throw error;
        return data as {
          paymentStatus: string;
          amountDue: number;
          cashCollected: number;
          onlineCollected: number;
        };
      },
      { refreshToken: admin.refreshToken },
    );

    expect(second.paymentStatus).toBe('PAID');
    expect(Number(second.amountDue)).toBe(0);
    expect(Number(second.cashCollected)).toBe(600);
    expect(Number(second.onlineCollected)).toBe(400);

    const { rows: events } = await getPool().query(
      `SELECT id FROM public.payment_events WHERE payment_id = $1`,
      [result.paymentId],
    );
    expect(events.length).toBeGreaterThanOrEqual(2);

    const { rows: journals } = await getPool().query(
      `SELECT source_type FROM public.journal_entries
       WHERE source_type = 'collection_event'
         AND source_id IN (
           SELECT id FROM public.payment_events WHERE payment_id = $1
         )`,
      [result.paymentId],
    );
    expect(journals.length).toBeGreaterThanOrEqual(2);

    const { rows: salePay } = await getPool().query<{
      status: string;
      amount: string;
    }>(
      `SELECT status, amount::text FROM public.sales_payments WHERE sale_id = $1`,
      [result.saleId],
    );
    expect(salePay[0].status).toBe('PAID');
    expect(salePay[0].amount).toBe('1000.00');
  });

  it('TEST 9: idempotent double-submit', async () => {
    const { pool, admin, shopId, skus } = await seedAdminShop({
      skuCount: 1,
      packPrice: 100,
      onHand: 10,
    });
    const requestId = `req-${randomUUID()}`;

    const first = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 1 }],
      payment: { amountPaid: 100, method: 'CASH' },
      clientRequestId: requestId,
    });

    const second = await completeAsAdmin(admin, {
      shop: { shopId },
      lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 1 }],
      payment: { amountPaid: 100, method: 'CASH' },
      clientRequestId: requestId,
    });

    expect(second.idempotentReplay).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    expect(second.saleId).toBe(first.saleId);
    expect(second.invoiceNumber).toBe(first.invoiceNumber);

    const { rows: sales } = await pool.query(
      `SELECT s.id FROM public.sales s
       JOIN public.orders o ON o.id = s.order_id
       WHERE o.shop_id = $1 AND o.source = 'COUNTER_SALE'`,
      [shopId],
    );
    expect(sales).toHaveLength(1);

    const { rows: movements } = await pool.query(
      `SELECT id FROM public.inventory_movements
       WHERE reference_type = 'order' AND reference_id = $1`,
      [first.orderId],
    );
    expect(movements).toHaveLength(1);

    const { rows: saleJournals } = await pool.query(
      `SELECT id FROM public.journal_entries
       WHERE source_type = 'sale' AND source_id = $1`,
      [first.saleId],
    );
    expect(saleJournals).toHaveLength(1);
  });

  it('TEST 10: wholesale assisted create still works (regression)', async () => {
    const { pool, admin, shopId, skus, packPrice } = await seedAdminShop({
      skuCount: 1,
      packPrice: 166,
      onHand: 100,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `983${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await pool.query(
      `UPDATE public.shops SET assigned_salesman_profile_id = $1 WHERE id = $2`,
      [salesman.id, shopId],
    );
    await assignSalesman(pool, shopId, salesman.id);
    const serviceAreaId = (
      await pool.query<{ id: string }>(
        `SELECT service_area_id::text AS id FROM public.shops WHERE id = $1`,
        [shopId],
      )
    ).rows[0].id;

    const orderId = await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client.rpc('place_assisted_order', {
          p_shop_id: shopId,
          p_service_area_id: serviceAreaId,
          p_lines: [{ skuId: skus[0], quantity: 2 }],
        });
        if (error) throw error;
        return data as string;
      },
      { refreshToken: admin.refreshToken },
    );

    const { rows } = await pool.query<{
      source: string;
      status: string;
      total: string;
    }>(
      `SELECT source::text, status::text, total::text
       FROM public.orders WHERE id = $1`,
      [orderId],
    );
    expect(rows[0].source).toBe('SALESMAN_ASSISTED');
    expect(rows[0].status).toBe('AWAITING_CUSTOMER_CONFIRMATION');
    expect(Number(rows[0].total)).toBe(packPrice * 2);
  });

  it('walk-in shop resolve does not duplicate walk-in rows', async () => {
    const { pool, admin, skus } = await seedAdminShop({ skuCount: 1, packPrice: 50 });

    const a = await completeAsAdmin(admin, {
      shop: { walkIn: true },
      lines: [{ kind: 'CATALOGUE', skuId: skus[0], quantity: 1 }],
      payment: { amountPaid: 50, method: 'CASH' },
    });
    const b = await completeAsAdmin(admin, {
      shop: { walkIn: true },
      lines: [
        {
          kind: 'CUSTOM',
          name: 'Bag',
          unit: 'Pc',
          quantity: 1,
          unitPrice: 10,
        },
      ],
      payment: { amountPaid: 10, method: 'CASH' },
    });

    expect(a.shopId).toBe(b.shopId);
    const { rows } = await pool.query(
      `SELECT id FROM public.shops WHERE is_walk_in = true AND deleted_at IS NULL`,
    );
    expect(rows).toHaveLength(1);
  });
});
