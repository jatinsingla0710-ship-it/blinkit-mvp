import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('salesman commission foundation', () => {
  it('A: stores all three earning models on salesman_employment', async () => {
    const pool = getPool();
    const models = [
      'SALARY',
      'COMMISSION',
      'SALARY_PLUS_COMMISSION',
    ] as const;

    for (const model of models) {
      const salesman = await createAuthUser({
        roles: ['SALESMAN'],
        mobile: `981${Math.floor(Math.random() * 1e7)
          .toString()
          .padStart(7, '0')}`,
      });

      await pool.query(
        `INSERT INTO public.salesman_employment (profile_id, earning_model)
         VALUES ($1, $2::public.salesman_earning_model)`,
        [salesman.id, model],
      );

      const { rows } = await pool.query<{ earning_model: string }>(
        `SELECT earning_model::text AS earning_model
         FROM public.salesman_employment WHERE profile_id = $1`,
        [salesman.id],
      );
      expect(rows[0]?.earning_model).toBe(model);
    }
  });

  it('B: existing salary terms still work with earning_model present', async () => {
    const pool = getPool();
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `982${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `983${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await pool.query(
      `INSERT INTO public.salesman_employment (profile_id)
       VALUES ($1)`,
      [salesman.id],
    );

    const { rows: emp } = await pool.query<{ earning_model: string }>(
      `SELECT earning_model::text AS earning_model
       FROM public.salesman_employment WHERE profile_id = $1`,
      [salesman.id],
    );
    expect(emp[0]?.earning_model).toBe('SALARY');

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_set_salesman_salary_terms', {
        p_profile_id: salesman.id,
        p_monthly_salary: 25000,
        p_daily_allowance: 200,
        p_other_allowance: 0,
        p_effective_from: '2026-09-01',
      });
      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    const { rows } = await pool.query<{ monthly_salary: string }>(
      `SELECT monthly_salary::text
       FROM public.salesman_salary_terms
       WHERE profile_id = $1 AND effective_to IS NULL`,
      [salesman.id],
    );
    expect(Number(rows[0]?.monthly_salary)).toBe(25000);
  });

  it('C/D: valid SKU commission term created; negative rejected', async () => {
    const pool = getPool();
    const { skuId } = await insertMinimalCatalogue(pool);
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `984${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const ok = await client.from('sku_commission_terms').insert({
        sku_id: skuId,
        fixed_amount_per_unit: 5.5,
        effective_from: '2026-09-01',
        created_by_profile_id: admin.id,
      }).select('id, fixed_amount_per_unit').single();
      expect(ok.error).toBeNull();
      expect(Number(ok.data?.fixed_amount_per_unit)).toBe(5.5);

      const bad = await client.from('sku_commission_terms').insert({
        sku_id: skuId,
        fixed_amount_per_unit: -1,
        effective_from: '2026-10-01',
        effective_to: '2026-10-31',
        created_by_profile_id: admin.id,
      });
      expect(bad.error).toBeTruthy();
    });
  });

  it('E/F: ledger accepts valid EARNED entry; invalid status rejected', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Commission Ledger');
    const shopId = await insertShop(pool, { serviceAreaId });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `985${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    const saleId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sales (
           order_id, invoice_number, status, subtotal, discount, total, currency,
           converted_by_profile_id
         ) VALUES (
           $1, $2, 'COMPLETED', 100, 0, 100, 'INR', $3
         ) RETURNING id`,
        [orderId, `INV-COMM-${Date.now()}`, salesman.id],
      )
    ).rows[0].id;

    const saleItemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sale_items (
           sale_id, order_line_id, sku_id, product_name, sku_code, sku_name,
           quantity, unit_price, discount, line_total
         ) VALUES (
           $1, $2, $3, 'Item', 'SKU', 'Item', 10, 10, 0, 100
         ) RETURNING id`,
        [saleId, lineId, skuId],
      )
    ).rows[0].id;

    const ok = await pool.query(
      `INSERT INTO public.salesman_commission_entries (
         salesman_profile_id, sale_id, sale_item_id, order_id, sku_id,
         quantity, unit_commission, commission_amount, status
       ) VALUES (
         $1, $2, $3, $4, $5,
         10, 2.50, 25.00, 'EARNED'
       ) RETURNING id`,
      [salesman.id, saleId, saleItemId, orderId, skuId],
    );
    expect(ok.rows[0].id).toBeTruthy();

    await expect(
      pool.query(
        `INSERT INTO public.salesman_commission_entries (
           salesman_profile_id, sale_id, sale_item_id, order_id, sku_id,
           quantity, unit_commission, commission_amount, status
         ) VALUES (
           $1, $2, $3, $4, $5,
           1, 1, 1, 'PAID'
         )`,
        [salesman.id, saleId, saleItemId, orderId, skuId],
      ),
    ).rejects.toThrow();
  });

  it('G: salesman client cannot insert commission ledger entries', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Commission RLS');
    const shopId = await insertShop(pool, { serviceAreaId });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `986${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    const saleId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sales (
           order_id, invoice_number, status, subtotal, discount, total, currency
         ) VALUES ($1, $2, 'COMPLETED', 50, 0, 50, 'INR') RETURNING id`,
        [orderId, `INV-RLS-${Date.now()}`],
      )
    ).rows[0].id;

    const saleItemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sale_items (
           sale_id, order_line_id, sku_id, product_name, sku_code, sku_name,
           quantity, unit_price, discount, line_total
         ) VALUES ($1, $2, $3, 'Item', 'SKU', 'Item', 5, 10, 0, 50)
         RETURNING id`,
        [saleId, lineId, skuId],
      )
    ).rows[0].id;

    await withUserClient(salesman.accessToken, async (client) => {
      const { data, error } = await client
        .from('salesman_commission_entries')
        .insert({
          salesman_profile_id: salesman.id,
          sale_id: saleId,
          sale_item_id: saleItemId,
          order_id: orderId,
          sku_id: skuId,
          quantity: 5,
          unit_commission: 1,
          commission_amount: 5,
          status: 'EARNED',
        })
        .select('id');

      // RLS denies write: either error or zero rows returned.
      const blocked =
        error != null || data == null || (Array.isArray(data) && data.length === 0);
      expect(blocked).toBe(true);
    });
  });

  it('H: historical commission terms coexist for the same SKU', async () => {
    const pool = getPool();
    const { skuId } = await insertMinimalCatalogue(pool);

    await pool.query(
      `INSERT INTO public.sku_commission_terms (
         sku_id, fixed_amount_per_unit, effective_from, effective_to
       ) VALUES
         ($1, 1.00, '2026-01-01', '2026-03-31'),
         ($1, 2.00, '2026-04-01', '2026-06-30'),
         ($1, 3.00, '2026-07-01', NULL)`,
      [skuId],
    );

    const { rows } = await pool.query<{
      fixed_amount_per_unit: string;
      effective_to: string | null;
    }>(
      `SELECT fixed_amount_per_unit::text, effective_to::text
       FROM public.sku_commission_terms
       WHERE sku_id = $1
       ORDER BY effective_from ASC`,
      [skuId],
    );
    expect(rows).toHaveLength(3);
    expect(Number(rows[0].fixed_amount_per_unit)).toBe(1);
    expect(Number(rows[1].fixed_amount_per_unit)).toBe(2);
    expect(Number(rows[2].fixed_amount_per_unit)).toBe(3);
    expect(rows[2].effective_to).toBeNull();

    // Second open term for same SKU must fail.
    await expect(
      pool.query(
        `INSERT INTO public.sku_commission_terms (
           sku_id, fixed_amount_per_unit, effective_from, effective_to
         ) VALUES ($1, 9.00, '2026-08-01', NULL)`,
        [skuId],
      ),
    ).rejects.toThrow();
  });
});
