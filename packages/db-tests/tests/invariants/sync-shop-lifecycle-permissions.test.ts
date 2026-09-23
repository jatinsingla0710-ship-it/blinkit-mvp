import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('sync_shop_lifecycle_from_orders permissions', () => {
  async function seedActivatedShop() {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `966${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `967${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `968${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    const serviceAreaId = await insertServiceArea(pool, 'Lifecycle Perms');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);

    // Sync only advances ACTIVATED / FIRST_ORDER / REPEAT_CUSTOMER (not LEAD).
    await pool.query(
      `UPDATE public.shops
       SET lifecycle_status = 'ACTIVATED'::public.shop_lifecycle_status
       WHERE id = $1`,
      [shopId],
    );

    return { pool, admin, customer, salesman, serviceAreaId, shopId, skuId };
  }

  async function readLifecycle(
    pool: ReturnType<typeof getPool>,
    shopId: string,
  ): Promise<string> {
    const { rows } = await pool.query<{ lifecycle_status: string }>(
      `SELECT lifecycle_status::text FROM public.shops WHERE id = $1`,
      [shopId],
    );
    return rows[0].lifecycle_status;
  }

  it('authenticated customer cannot execute sync_shop_lifecycle_from_orders', async () => {
    const { customer, shopId } = await seedActivatedShop();

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const { error } = await client.rpc('sync_shop_lifecycle_from_orders', {
          p_shop_id: shopId,
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: customer.refreshToken },
    );
  });

  it('authenticated salesman cannot execute sync_shop_lifecycle_from_orders', async () => {
    const { salesman, shopId } = await seedActivatedShop();

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const { error } = await client.rpc('sync_shop_lifecycle_from_orders', {
          p_shop_id: shopId,
        });
        expect(error).toBeTruthy();
        expect(error?.message ?? '').toMatch(
          /permission denied|not authorized|42501/i,
        );
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('authenticated role has no EXECUTE on sync_shop_lifecycle_from_orders', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ ok: boolean }>(
      `SELECT has_function_privilege(
         'authenticated',
         'public.sync_shop_lifecycle_from_orders(uuid)',
         'EXECUTE'
       ) AS ok`,
    );
    expect(rows[0].ok).toBe(false);
  });

  it('order insert trigger still advances ACTIVATED → FIRST_ORDER → REPEAT_CUSTOMER', async () => {
    const { pool, admin, serviceAreaId, shopId, skuId } =
      await seedActivatedShop();

    expect(await readLifecycle(pool, shopId)).toBe('ACTIVATED');

    await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });
    expect(await readLifecycle(pool, shopId)).toBe('FIRST_ORDER');

    await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });
    expect(await readLifecycle(pool, shopId)).toBe('REPEAT_CUSTOMER');
  });

  it('LEAD shops are not advanced by order insert (business rule preserved)', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `969${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const serviceAreaId = await insertServiceArea(pool, 'Lifecycle Lead');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);

    expect(await readLifecycle(pool, shopId)).toBe('LEAD');

    await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });

    expect(await readLifecycle(pool, shopId)).toBe('LEAD');
  });

  it('owner can still invoke sync directly for repair / internal use', async () => {
    const { pool, admin, serviceAreaId, shopId, skuId } =
      await seedActivatedShop();

    await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: admin.id,
      skuId,
    });
    expect(await readLifecycle(pool, shopId)).toBe('FIRST_ORDER');

    // Reset and re-sync as DB owner (mirrors SECURITY DEFINER trigger caller).
    await pool.query(
      `UPDATE public.shops
       SET lifecycle_status = 'ACTIVATED'::public.shop_lifecycle_status
       WHERE id = $1`,
      [shopId],
    );
    expect(await readLifecycle(pool, shopId)).toBe('ACTIVATED');

    await pool.query(`SELECT public.sync_shop_lifecycle_from_orders($1)`, [
      shopId,
    ]);
    expect(await readLifecycle(pool, shopId)).toBe('FIRST_ORDER');
  });
});
