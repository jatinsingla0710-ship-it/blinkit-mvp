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
  type TestUser,
} from '../../src/fixtures';

function uniqueMobile(): string {
  return `9${Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, '0')}`;
}

async function adminUser(): Promise<TestUser> {
  return createAuthUser({ roles: ['ADMIN'], mobile: uniqueMobile() });
}

async function salesmanUser(): Promise<TestUser> {
  return createAuthUser({ roles: ['SALESMAN'], mobile: uniqueMobile() });
}

async function setEarningModel(
  admin: TestUser,
  profileId: string,
  model: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION',
) {
  return withUserClient(
    admin.accessToken,
    async (client) => {
      const { data, error } = await client.rpc('admin_set_salesman_earning_model', {
        p_profile_id: profileId,
        p_earning_model: model,
      });
      if (error) throw error;
      return data as { earningModel: string };
    },
    { refreshToken: admin.refreshToken },
  );
}

async function setCommission(
  admin: TestUser,
  skuId: string,
  amount: number,
  effectiveFrom?: string,
) {
  return withUserClient(
    admin.accessToken,
    async (client) => {
      const { data, error } = await client.rpc('admin_set_sku_commission_term', {
        p_sku_id: skuId,
        p_fixed_amount_per_unit: amount,
        p_effective_from: effectiveFrom ?? null,
      });
      if (error) throw error;
      return data as {
        fixedAmountPerUnit: number;
        effectiveFrom: string;
        closedOpenTerms: number;
      };
    },
    { refreshToken: admin.refreshToken },
  );
}

async function seedDelivered(options: {
  salesmanId: string;
  skuId: string;
  quantity: number;
}) {
  const pool = getPool();
  const serviceAreaId = await insertServiceArea(pool, 'Commission Admin');
  const shopId = await insertShop(pool, { serviceAreaId });
  const locationId = await insertOperationalLocation(pool);
  const { orderId, lineId } = await createDraftOrder(pool, {
    shopId,
    serviceAreaId,
    createdByProfileId: options.salesmanId,
    skuId: options.skuId,
  });
  const qty = options.quantity;
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
     ) VALUES ($1, $2, 500, $3)`,
    [options.skuId, locationId, qty],
  );
  await pool.query(
    `INSERT INTO public.stock_reservations (
       order_id, sku_id, operational_location_id, quantity, status
     ) VALUES ($1, $2, $3, $4, 'RESERVED')`,
    [orderId, options.skuId, locationId, qty],
  );
  await createPaymentForOrder(pool, orderId, 'PAID');
  await setOrderStatusTrusted(pool, orderId, 'OUT_FOR_DELIVERY');
  await setOrderStatusTrusted(pool, orderId, 'DELIVERED');
  return { orderId };
}

async function convert(admin: TestUser, orderId: string) {
  return withUserClient(
    admin.accessToken,
    async (client) => {
      const { data, error } = await client.rpc('admin_convert_order_to_sale', {
        p_order_id: orderId,
      });
      if (error) throw error;
      return data as { alreadyConverted: boolean };
    },
    { refreshToken: admin.refreshToken },
  );
}

async function earnedForOrder(orderId: string) {
  const { rows } = await getPool().query<{
    id: string;
    unit_commission: string;
    commission_amount: string;
    quantity: string;
  }>(
    `SELECT id::text, unit_commission::text, commission_amount::text, quantity::text
     FROM public.salesman_commission_entries
     WHERE order_id = $1 AND status = 'EARNED'`,
    [orderId],
  );
  return rows;
}

describe('admin commission management', () => {
  it('1: admin can set earning model to SALARY without changing salary terms', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_set_salesman_salary_terms', {
          p_profile_id: salesman.id,
          p_monthly_salary: 25000,
          p_effective_from: '2026-01-01',
        });
        if (error) throw error;
      },
      { refreshToken: admin.refreshToken },
    );

    const result = await setEarningModel(admin, salesman.id, 'SALARY');
    expect(result.earningModel).toBe('SALARY');

    const { rows } = await getPool().query<{
      earning_model: string;
      monthly_salary: string;
    }>(
      `SELECT e.earning_model::text, s.monthly_salary::text
       FROM public.salesman_employment e
       JOIN public.salesman_salary_terms s ON s.profile_id = e.profile_id
       WHERE e.profile_id = $1 AND s.effective_to IS NULL`,
      [salesman.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].earning_model).toBe('SALARY');
    expect(Number(rows[0].monthly_salary)).toBe(25000);
  });

  it('2: admin can set earning model to COMMISSION', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    const result = await setEarningModel(admin, salesman.id, 'COMMISSION');
    expect(result.earningModel).toBe('COMMISSION');
    const { rows } = await getPool().query<{ earning_model: string }>(
      `SELECT earning_model::text FROM public.salesman_employment WHERE profile_id = $1`,
      [salesman.id],
    );
    expect(rows[0].earning_model).toBe('COMMISSION');
  });

  it('3: admin can set earning model to SALARY_PLUS_COMMISSION', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    const result = await setEarningModel(
      admin,
      salesman.id,
      'SALARY_PLUS_COMMISSION',
    );
    expect(result.earningModel).toBe('SALARY_PLUS_COMMISSION');
  });

  it('4: salesman cannot change earning model', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await setEarningModel(admin, salesman.id, 'COMMISSION');

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const rpc = await client.rpc('admin_set_salesman_earning_model', {
          p_profile_id: salesman.id,
          p_earning_model: 'SALARY',
        });
        expect(rpc.error).toBeTruthy();

        const updated = await client
          .from('salesman_employment')
          .update({ earning_model: 'SALARY' })
          .eq('profile_id', salesman.id)
          .select('earning_model');
        const blocked =
          updated.error != null ||
          updated.data == null ||
          (Array.isArray(updated.data) && updated.data.length === 0);
        expect(blocked).toBe(true);
      },
      { refreshToken: salesman.refreshToken },
    );

    const { rows } = await getPool().query<{ earning_model: string }>(
      `SELECT earning_model::text FROM public.salesman_employment WHERE profile_id = $1`,
      [salesman.id],
    );
    expect(rows[0].earning_model).toBe('COMMISSION');
  });

  it('5: admin can create an SKU commission term', async () => {
    const admin = await adminUser();
    const { skuId } = await insertMinimalCatalogue(getPool());
    const result = await setCommission(admin, skuId, 4, '2026-09-01');
    expect(Number(result.fixedAmountPerUnit)).toBe(4);
    const { rows } = await getPool().query<{ fixed_amount_per_unit: string }>(
      `SELECT fixed_amount_per_unit::text
       FROM public.sku_commission_terms
       WHERE sku_id = $1 AND effective_to IS NULL`,
      [skuId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].fixed_amount_per_unit)).toBe(4);
  });

  it('6: salesman cannot create an SKU commission term', async () => {
    const salesman = await salesmanUser();
    const { skuId } = await insertMinimalCatalogue(getPool());
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const rpc = await client.rpc('admin_set_sku_commission_term', {
          p_sku_id: skuId,
          p_fixed_amount_per_unit: 4,
          p_effective_from: '2026-09-01',
        });
        expect(rpc.error).toBeTruthy();

        const inserted = await client
          .from('sku_commission_terms')
          .insert({
            sku_id: skuId,
            fixed_amount_per_unit: 4,
            effective_from: '2026-09-01',
          })
          .select('id');
        const blocked =
          inserted.error != null ||
          inserted.data == null ||
          (Array.isArray(inserted.data) && inserted.data.length === 0);
        expect(blocked).toBe(true);
      },
      { refreshToken: salesman.refreshToken },
    );
    const { rows } = await getPool().query(
      `SELECT 1 FROM public.sku_commission_terms WHERE sku_id = $1`,
      [skuId],
    );
    expect(rows).toHaveLength(0);
  });

  it('7: changing commission closes the previous open term', async () => {
    const admin = await adminUser();
    const { skuId } = await insertMinimalCatalogue(getPool());
    await setCommission(admin, skuId, 4, '2026-04-01');
    const today = (
      await getPool().query<{ today: string }>(`SELECT CURRENT_DATE::text AS today`)
    ).rows[0].today;
    const result = await setCommission(admin, skuId, 5, today);
    expect(Number(result.closedOpenTerms)).toBe(1);

    const { rows } = await getPool().query<{
      fixed_amount_per_unit: string;
      effective_to: string | null;
    }>(
      `SELECT fixed_amount_per_unit::text, effective_to::text
       FROM public.sku_commission_terms
       WHERE sku_id = $1 AND effective_from = '2026-04-01'`,
      [skuId],
    );
    expect(Number(rows[0].fixed_amount_per_unit)).toBe(4);
    expect(rows[0].effective_to).not.toBeNull();
  });

  it('8: only one open commission term exists per SKU', async () => {
    const admin = await adminUser();
    const { skuId } = await insertMinimalCatalogue(getPool());
    await setCommission(admin, skuId, 3, '2026-01-01');
    await setCommission(admin, skuId, 4, '2026-06-01');
    const { rows } = await getPool().query(
      `SELECT 1 FROM public.sku_commission_terms
       WHERE sku_id = $1 AND effective_to IS NULL`,
      [skuId],
    );
    expect(rows).toHaveLength(1);
  });

  it('9: historical commission terms remain unchanged', async () => {
    const admin = await adminUser();
    const pool = getPool();
    const { skuId } = await insertMinimalCatalogue(pool);
    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from, effective_to
       ) VALUES ($1, 1.00, '2026-01-01', '2026-03-31')`,
      [skuId],
    );
    await setCommission(admin, skuId, 4, '2026-04-01');
    await setCommission(admin, skuId, 5, '2026-08-01');

    const { rows } = await pool.query<{
      fixed_amount_per_unit: string;
      effective_from: string;
      effective_to: string | null;
    }>(
      `SELECT fixed_amount_per_unit::text, effective_from::text, effective_to::text
       FROM public.sku_commission_terms
       WHERE sku_id = $1 AND effective_from = '2026-01-01'`,
      [skuId],
    );
    expect(Number(rows[0].fixed_amount_per_unit)).toBe(1);
    expect(rows[0].effective_from).toBe('2026-01-01');
    expect(rows[0].effective_to).toBe('2026-03-31');
  });

  it('10: existing salesman_commission_entries stay unchanged when the rate changes', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await setEarningModel(admin, salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(getPool());
    await setCommission(admin, skuId, 4, '2026-01-01');
    const { orderId } = await seedDelivered({
      salesmanId: salesman.id,
      skuId,
      quantity: 100,
    });
    await convert(admin, orderId);
    const before = await earnedForOrder(orderId);
    expect(before).toHaveLength(1);
    expect(Number(before[0].unit_commission)).toBe(4);
    expect(Number(before[0].commission_amount)).toBe(400);

    const today = (
      await getPool().query<{ today: string }>(`SELECT CURRENT_DATE::text AS today`)
    ).rows[0].today;
    await setCommission(admin, skuId, 5, today);

    const after = await earnedForOrder(orderId);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
    expect(Number(after[0].unit_commission)).toBe(4);
    expect(Number(after[0].commission_amount)).toBe(400);
  });

  it('11: a new sale conversion uses the new commission rate', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await setEarningModel(admin, salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(getPool());
    await setCommission(admin, skuId, 4, '2026-01-01');
    const today = (
      await getPool().query<{ today: string }>(`SELECT CURRENT_DATE::text AS today`)
    ).rows[0].today;
    await setCommission(admin, skuId, 5, today);
    const { orderId } = await seedDelivered({
      salesmanId: salesman.id,
      skuId,
      quantity: 100,
    });
    await convert(admin, orderId);
    const rows = await earnedForOrder(orderId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].unit_commission)).toBe(5);
    expect(Number(rows[0].commission_amount)).toBe(500);
  });

  it('12: an earlier sale keeps its snapshotted rate after a later rate change', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await setEarningModel(admin, salesman.id, 'SALARY_PLUS_COMMISSION');
    const { skuId } = await insertMinimalCatalogue(getPool());
    await setCommission(admin, skuId, 4, '2026-01-01');
    const first = await seedDelivered({
      salesmanId: salesman.id,
      skuId,
      quantity: 100,
    });
    await convert(admin, first.orderId);
    const today = (
      await getPool().query<{ today: string }>(`SELECT CURRENT_DATE::text AS today`)
    ).rows[0].today;
    await setCommission(admin, skuId, 5, today);
    const second = await seedDelivered({
      salesmanId: salesman.id,
      skuId,
      quantity: 100,
    });
    await convert(admin, second.orderId);

    const oldRows = await earnedForOrder(first.orderId);
    const newRows = await earnedForOrder(second.orderId);
    expect(Number(oldRows[0].commission_amount)).toBe(400);
    expect(Number(oldRows[0].unit_commission)).toBe(4);
    expect(Number(newRows[0].commission_amount)).toBe(500);
    expect(Number(newRows[0].unit_commission)).toBe(5);
  });

  it('13: zero commission is stored and accrued as zero', async () => {
    const admin = await adminUser();
    const salesman = await salesmanUser();
    await setEarningModel(admin, salesman.id, 'COMMISSION');
    const { skuId } = await insertMinimalCatalogue(getPool());
    const saved = await setCommission(admin, skuId, 0, '2026-01-01');
    expect(Number(saved.fixedAmountPerUnit)).toBe(0);
    const { orderId } = await seedDelivered({
      salesmanId: salesman.id,
      skuId,
      quantity: 10,
    });
    await convert(admin, orderId);
    const rows = await earnedForOrder(orderId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].unit_commission)).toBe(0);
    expect(Number(rows[0].commission_amount)).toBe(0);
  });

  it('14: negative commission is rejected', async () => {
    const admin = await adminUser();
    const { skuId } = await insertMinimalCatalogue(getPool());
    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { error } = await client.rpc('admin_set_sku_commission_term', {
          p_sku_id: skuId,
          p_fixed_amount_per_unit: -1,
          p_effective_from: '2026-09-01',
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(/must be >= 0/i);
      },
      { refreshToken: admin.refreshToken },
    );
    const { rows } = await getPool().query(
      `SELECT 1 FROM public.sku_commission_terms WHERE sku_id = $1`,
      [skuId],
    );
    expect(rows).toHaveLength(0);
  });

  it('15: a non-admin cannot perform commission-management writes', async () => {
    const reader = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: uniqueMobile(),
    });
    const salesman = await salesmanUser();
    const { skuId } = await insertMinimalCatalogue(getPool());

    await withUserClient(
      reader.accessToken,
      async (client) => {
        const model = await client.rpc('admin_set_salesman_earning_model', {
          p_profile_id: salesman.id,
          p_earning_model: 'COMMISSION',
        });
        expect(model.error).toBeTruthy();
        const term = await client.rpc('admin_set_sku_commission_term', {
          p_sku_id: skuId,
          p_fixed_amount_per_unit: 2,
          p_effective_from: '2026-09-01',
        });
        expect(term.error).toBeTruthy();
      },
      { refreshToken: reader.refreshToken },
    );
  });
});
