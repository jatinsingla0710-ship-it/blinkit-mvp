import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool, withTrusted } from '../../src/client';
import { createAuthUser, insertMinimalCatalogue } from '../../src/fixtures';

describe('price history append-only', () => {
  it('rejects UPDATE and DELETE on sku_prices', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, 120.00, $2)
       RETURNING id`,
      [skuId, admin.id],
    );
    const priceId = rows[0].id;

    await expect(
      pool.query(`UPDATE public.sku_prices SET trade_price = 150.00 WHERE id = $1`, [priceId]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));

    await expect(pool.query(`DELETE FROM public.sku_prices WHERE id = $1`, [priceId])).rejects.toSatisfy(
      (error: unknown) => isPgError(error, '23001'),
    );
  });

  it('represents a new price as a new history row', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `94${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    const first = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
         VALUES ($1, 100.00, $2) RETURNING id`,
        [skuId, admin.id],
      )
    ).rows[0].id;

    await withTrusted(async (client) => {
      await client.query(`UPDATE public.sku_prices SET effective_to = now() WHERE id = $1`, [first]);
    });

    const second = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
         VALUES ($1, 110.00, $2) RETURNING id`,
        [skuId, admin.id],
      )
    ).rows[0].id;

    expect(first).not.toBe(second);

    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.sku_prices WHERE sku_id = $1`,
      [skuId],
    );
    expect(Number(rows[0].count)).toBe(2);
  });
});
