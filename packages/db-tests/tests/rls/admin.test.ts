import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool, withUserClient } from '../../src/client';
import { createAuthUser, insertMinimalCatalogue } from '../../src/fixtures';

describe('RLS: ADMIN', () => {
  it('can perform intended catalogue writes', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client
        .from('categories')
        .insert({ name: `Admin Cat ${Date.now()}` })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });
  });

  it('still cannot mutate append-only sku_prices trade fields', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, 80, $2) RETURNING id`,
      [skuId, admin.id],
    );

    await expect(
      pool.query(`UPDATE public.sku_prices SET trade_price = 90 WHERE id = $1`, [rows[0].id]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));
  });
});
