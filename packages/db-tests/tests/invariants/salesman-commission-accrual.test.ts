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
};

describe('salesman commission accrual on sale convert', () => {
  async function seedAssistedDeliveredPaid(options: {
    salesmanId: string;
    quantity: number;
    skuId?: string;
    source?: 'CUSTOMER_SELF_SERVE' | 'SALESMAN_ASSISTED';
    onHand?: number;
  }) {
    const pool = getPool();
    const onHand = options.onHand ?? 500;
    const qty = options.quantity;
    const serviceAreaId = await insertServiceArea(pool, 'Commission Accrue');
    const shopId = await insertShop(pool, { serviceAreaId });
    const skuId = options.skuId ?? (await insertMinimalCatalogue(pool)).skuId;
    const locationId = await insertOperationalLocation(pool);

    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: options.salesmanId,
      skuId,
      source: options.source ?? 'SALESMAN_ASSISTED',
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

    return { pool, orderId, lineId, skuId, locationId, qty, onHand };
  }

  async function ensureEmployment(
    profileId: string,
    model: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION',
  ) {
    await getPool().query(
      `INSERT INTO public.salesman_employment (profile_id, earning_model)
       VALUES ($1, $2::public.salesman_earning_model)
       ON CONFLICT (profile_id) DO UPDATE
       SET earning_model = EXCLUDED.earning_model`,
      [profileId, model],
    );
  }

  async function convertAsAdmin(admin: {
    accessToken: string;
    refreshToken: string;
    id: string;
  }, orderId: string) {
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

  it('A: COMMISSION + 50 units × ₹2 → ₹100 EARNED', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `987${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `988${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 2.00, '2026-01-01')`,
      [skuId],
    );

    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 50,
      skuId,
    });

    const result = await convertAsAdmin(admin, orderId);
    expect(result.alreadyConverted).toBe(false);

    const { rows } = await pool.query<{
      commission_amount: string;
      quantity: string;
      unit_commission: string;
      status: string;
      salesman_profile_id: string;
    }>(
      `SELECT commission_amount::text, quantity::text, unit_commission::text,
              status::text, salesman_profile_id::text
       FROM public.salesman_commission_entries
       WHERE order_id = $1 AND status = 'EARNED'`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].salesman_profile_id).toBe(salesman.id);
    expect(Number(rows[0].quantity)).toBe(50);
    expect(Number(rows[0].unit_commission)).toBe(2);
    expect(Number(rows[0].commission_amount)).toBe(100);
    expect(rows[0].status).toBe('EARNED');
  });

  it('B: SALARY salesman → no commission entry', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `989${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `990${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'SALARY');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 2.00, '2026-01-01')`,
      [skuId],
    );
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 10,
      skuId,
    });
    await convertAsAdmin(admin, orderId);
    const { rows } = await pool.query(
      `SELECT id FROM public.salesman_commission_entries WHERE order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(0);
  });

  it('C: SALARY_PLUS_COMMISSION → commission entry', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `991${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `992${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'SALARY_PLUS_COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 3.00, '2026-01-01')`,
      [skuId],
    );
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 4,
      skuId,
    });
    await convertAsAdmin(admin, orderId);
    const { rows } = await pool.query<{ commission_amount: string }>(
      `SELECT commission_amount::text
       FROM public.salesman_commission_entries
       WHERE order_id = $1 AND status = 'EARNED'`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].commission_amount)).toBe(12);
  });

  it('D: no commission term → sale succeeds with no entry', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `993${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `994${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 8,
    });
    const result = await convertAsAdmin(admin, orderId);
    expect(result.saleId).toBeTruthy();
    const { rows: sales } = await pool.query(
      `SELECT id FROM public.sales WHERE order_id = $1`,
      [orderId],
    );
    expect(sales).toHaveLength(1);
    const { rows: entries } = await pool.query(
      `SELECT id FROM public.salesman_commission_entries WHERE order_id = $1`,
      [orderId],
    );
    expect(entries).toHaveLength(0);
  });

  it('E: multiple sale_items use each SKU rate', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `995${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `996${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const a = await insertMinimalCatalogue(pool);
    const b = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (sku_id, fixed_amount_per_unit, effective_from)
       VALUES ($1, 2.00, '2026-01-01'), ($2, 5.00, '2026-01-01')`,
      [a.skuId, b.skuId],
    );

    const serviceAreaId = await insertServiceArea(pool, 'Multi SKU Comm');
    const shopId = await insertShop(pool, { serviceAreaId });
    const locationId = await insertOperationalLocation(pool);
    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId: a.skuId,
    });
    await pool.query(
      `UPDATE public.order_lines
       SET quantity = 10, line_total = round(10 * agreed_unit_price, 2)
       WHERE id = $1`,
      [lineId],
    );
    await pool.query(
      `INSERT INTO public.order_lines (
         order_id, sku_id, product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
         selling_unit_snapshot, quantity, agreed_unit_price, line_total
       ) VALUES ($1, $2, 'B', 'B', 'B', 'KG', 3, 100, 300)`,
      [orderId, b.skuId],
    );
    await withTrusted(async (client) => {
      await client.query(
        `UPDATE public.orders SET subtotal = 1300, total = 1300 WHERE id = $1`,
        [orderId],
      );
    });
    for (const [skuId, qty] of [
      [a.skuId, 10],
      [b.skuId, 3],
    ] as const) {
      await pool.query(
        `INSERT INTO public.inventory_balances (
           sku_id, operational_location_id, on_hand_quantity, reserved_quantity
         ) VALUES ($1, $2, 100, $3)
         ON CONFLICT (sku_id, operational_location_id)
         DO UPDATE SET
           on_hand_quantity = GREATEST(public.inventory_balances.on_hand_quantity, 100),
           reserved_quantity = public.inventory_balances.reserved_quantity + EXCLUDED.reserved_quantity`,
        [skuId, locationId, qty],
      );
      await pool.query(
        `INSERT INTO public.stock_reservations (
           order_id, sku_id, operational_location_id, quantity, status
         ) VALUES ($1, $2, $3, $4, 'RESERVED')`,
        [orderId, skuId, locationId, qty],
      );
    }
    await createPaymentForOrder(pool, orderId, 'PAID');
    await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');
    await setOrderStatusTrusted(pool, orderId, 'DELIVERED');

    await convertAsAdmin(admin, orderId);

    const { rows } = await pool.query<{
      sku_id: string;
      commission_amount: string;
    }>(
      `SELECT sku_id::text, commission_amount::text
       FROM public.salesman_commission_entries
       WHERE order_id = $1 AND status = 'EARNED'
       ORDER BY commission_amount ASC`,
      [orderId],
    );
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].commission_amount)).toBe(15); // 3 × 5
    expect(Number(rows[1].commission_amount)).toBe(20); // 10 × 2
  });

  it('F: selects current term over historical closed term', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `997${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `998${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from, effective_to
       ) VALUES
         ($1, 1.00, '2026-01-01', '2026-08-31'),
         ($1, 7.00, '2026-09-01', NULL)`,
      [skuId],
    );
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 2,
      skuId,
    });
    await convertAsAdmin(admin, orderId);
    const { rows } = await pool.query<{ unit_commission: string }>(
      `SELECT unit_commission::text
       FROM public.salesman_commission_entries WHERE order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].unit_commission)).toBe(7);
  });

  it('G: idempotent convert does not duplicate commission', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `999${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `980${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 2.00, '2026-01-01')`,
      [skuId],
    );
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 5,
      skuId,
    });
    const first = await convertAsAdmin(admin, orderId);
    expect(first.alreadyConverted).toBe(false);
    const second = await convertAsAdmin(admin, orderId);
    expect(second.alreadyConverted).toBe(true);

    const { rows } = await pool.query(
      `SELECT id FROM public.salesman_commission_entries
       WHERE order_id = $1 AND status = 'EARNED'`,
      [orderId],
    );
    expect(rows).toHaveLength(1);
  });

  it('H: non-SALESMAN_ASSISTED → no commission', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `979${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `978${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 2.00, '2026-01-01')`,
      [skuId],
    );
    const { orderId } = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 6,
      skuId,
      source: 'CUSTOMER_SELF_SERVE',
    });
    await convertAsAdmin(admin, orderId);
    const { rows } = await pool.query(
      `SELECT id FROM public.salesman_commission_entries WHERE order_id = $1`,
      [orderId],
    );
    expect(rows).toHaveLength(0);
  });

  it('I: inventory consumption still works with commission accrual', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `977${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `976${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    await ensureEmployment(salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from
       ) VALUES ($1, 1.00, '2026-01-01')`,
      [skuId],
    );
    const seeded = await seedAssistedDeliveredPaid({
      salesmanId: salesman.id,
      quantity: 10,
      skuId,
      onHand: 100,
    });
    await convertAsAdmin(admin, seeded.orderId);

    const { rows } = await pool.query<BalanceRow>(
      `SELECT on_hand_quantity::text, reserved_quantity::text
       FROM public.inventory_balances
       WHERE sku_id = $1 AND operational_location_id = $2`,
      [seeded.skuId, seeded.locationId],
    );
    expect(rows[0].on_hand_quantity).toBe('90.000');
    expect(rows[0].reserved_quantity).toBe('0.000');
  });
});
