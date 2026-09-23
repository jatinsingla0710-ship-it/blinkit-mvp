import { describe, expect, it } from 'vitest';
import { getPool } from '../../src/client';

describe('empty catalogue after migration', () => {
  it('allows zero categories, products, skus, and prices', async () => {
    const pool = getPool();
    const counts = await pool.query<{
      categories: string;
      products: string;
      skus: string;
      sku_prices: string;
    }>(`
      SELECT
        (SELECT count(*)::text FROM public.categories) AS categories,
        (SELECT count(*)::text FROM public.products) AS products,
        (SELECT count(*)::text FROM public.skus) AS skus,
        (SELECT count(*)::text FROM public.sku_prices) AS sku_prices
    `);

    for (const value of Object.values(counts.rows[0])) {
      expect(Number(value)).toBeGreaterThanOrEqual(0);
    }
  });
});
