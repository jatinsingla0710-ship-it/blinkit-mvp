import { describe, expect, it } from 'vitest';
import { createAuthUser, insertMinimalCatalogue } from '../../src/fixtures';
import { getPool, withUserClient } from '../../src/client';

describe('RLS: ADMIN pricing RPCs', () => {
  it('admin_set_sku_price creates the first price for a SKU', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95300${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    await withUserClient(admin.accessToken, async (client) => {
      const { data, error } = await client.rpc('admin_set_sku_price', {
        p_sku_id: skuId,
        p_trade_price: 100,
        p_currency: 'INR',
      });
      expect(error).toBeNull();
      expect((data as { sku_id?: string } | null)?.sku_id).toBe(skuId);
    });
  });

  it('admin_set_sku_price atomically replaces an open price and preserves history', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    await withUserClient(admin.accessToken, async (client) => {
      const first = await client.rpc('admin_set_sku_price', {
        p_sku_id: skuId,
        p_trade_price: 100,
        p_currency: 'INR',
      });
      expect(first.error).toBeNull();

      const second = await client.rpc('admin_set_sku_price', {
        p_sku_id: skuId,
        p_trade_price: 125,
        p_currency: 'INR',
      });
      expect(second.error).toBeNull();
    });

    const { rows } = await pool.query<{
      trade_price: string;
      effective_to: string | null;
    }>(
      `SELECT trade_price::text, effective_to::text
       FROM public.sku_prices
       WHERE sku_id = $1
       ORDER BY effective_from ASC, created_at ASC`,
      [skuId],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].trade_price).toBe('100.00');
    expect(rows[0].effective_to).not.toBeNull();
    expect(rows[1].trade_price).toBe('125.00');
    expect(rows[1].effective_to).toBeNull();

    const openCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.sku_prices
       WHERE sku_id = $1
         AND effective_to IS NULL`,
      [skuId],
    );
    expect(Number(openCount.rows[0].count)).toBe(1);
  });

  it('rejects READ_ONLY callers for admin_set_sku_price', async () => {
    const pool = getPool();
    const readOnly = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: `95700${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    await withUserClient(readOnly.accessToken, async (client) => {
      const { error } = await client.rpc('admin_set_sku_price', {
        p_sku_id: skuId,
        p_trade_price: 100,
        p_currency: 'INR',
      });
      expect(error?.message).toMatch(/Admin role required/i);
    });
  });

  it('closes an open price but rejects closing an already-closed row', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95500${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);

    let priceId = '';
    await withUserClient(admin.accessToken, async (client) => {
      const created = await client.rpc('admin_set_sku_price', {
        p_sku_id: skuId,
        p_trade_price: 100,
        p_currency: 'INR',
      });
      expect(created.error).toBeNull();
      priceId = String((created.data as { id?: string } | null)?.id ?? '');

      const closed = await client.rpc('admin_close_sku_price', {
        p_price_id: priceId,
        p_effective_to: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(closed.error).toBeNull();

      const closedAgain = await client.rpc('admin_close_sku_price', {
        p_price_id: priceId,
        p_effective_to: new Date(Date.now() + 120_000).toISOString(),
      });
      expect(closedAgain.error?.message).toContain('already closed');
    });

    const { rows } = await pool.query<{ trade_price: string; effective_to: string | null }>(
      `SELECT trade_price::text, effective_to::text
       FROM public.sku_prices
       WHERE id = $1`,
      [priceId],
    );
    expect(rows[0].trade_price).toBe('100.00');
    expect(rows[0].effective_to).not.toBeNull();
  });
});
