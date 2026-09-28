import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  assignSalesman,
  createAuthUser,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function photoPath(profileId: string, shopId: string): string {
  return `${profileId}/${shopId}/shop`;
}

describe('storage: salesman-media shop photos', () => {
  it('lets a salesman upload only for an assigned shop, in their own folder', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, `Photo ${Date.now()}`);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const other = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97500${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `97600${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const assignedShop = await insertShop(pool, { serviceAreaId });
    const otherShop = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, assignedShop, salesman.id);

    const bucket = await pool.query<{ id: string; public: boolean }>(
      `SELECT id, public FROM storage.buckets WHERE id IN ('salesman-media', 'product-media')`,
    );
    const flags = new Map(bucket.rows.map((row) => [row.id, row.public]));
    expect(flags.get('salesman-media')).toBe(false);
    expect(flags.get('product-media')).toBe(true);

    const allowedPath = photoPath(salesman.id, assignedShop);

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const ok = await client.storage.from('salesman-media').upload(allowedPath, jpeg, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        expect(ok.error).toBeNull();

        const otherFolder = await client.storage
          .from('salesman-media')
          .upload(photoPath(other.id, assignedShop), jpeg, { contentType: 'image/jpeg' });
        expect(otherFolder.error).not.toBeNull();

        const otherShopUpload = await client.storage
          .from('salesman-media')
          .upload(photoPath(salesman.id, otherShop), jpeg, { contentType: 'image/jpeg' });
        expect(otherShopUpload.error).not.toBeNull();

        const product = await client.storage
          .from('product-media')
          .upload(`${salesman.id}/shop.jpg`, jpeg, { contentType: 'image/jpeg' });
        expect(product.error).not.toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );

    await withUserClient(
      other.accessToken,
      async (client) => {
        const denied = await client.storage.from('salesman-media').download(allowedPath);
        expect(denied.error).not.toBeNull();
        expect(denied.data).toBeNull();
      },
      { refreshToken: other.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const allowed = await client.storage.from('salesman-media').download(allowedPath);
        expect(allowed.error).toBeNull();
        expect(allowed.data).not.toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );
  });

  it('does not change salesman order or payment write rules', async () => {
    const { rows } = await getPool().query<{ proname: string }>(
      `SELECT proname FROM pg_proc
       WHERE proname IN ('place_assisted_order', 'resolve_sku_order_line_total')`,
    );
    expect(rows.map((row) => row.proname).sort()).toEqual([
      'place_assisted_order',
      'resolve_sku_order_line_total',
    ]);
  });
});
