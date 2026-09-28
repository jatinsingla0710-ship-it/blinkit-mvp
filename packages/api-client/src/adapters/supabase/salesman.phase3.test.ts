import { describe, expect, it, vi } from 'vitest';
import {
  SALESMAN_MEDIA_BUCKET,
  createSupabaseSalesmanService,
  shopPhotoObjectPath,
} from './salesman';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type QueryResult = { data?: unknown; error?: unknown };

function makeClient(options: {
  tables?: Record<string, QueryResult[]>;
  userId?: string;
  userError?: unknown;
  uploadError?: unknown;
  signed?: QueryResult;
  list?: QueryResult;
}) {
  const uploads: { bucket: string; path: string; contentType?: string; upsert?: boolean }[] = [];
  const from = vi.fn((table: string) => {
    const queue = options.tables?.[table] ?? [];
    const result = queue.shift() ?? { data: [], error: null };
    const settle = Promise.resolve({ data: null, error: null, ...result });
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') return settle.then.bind(settle);
          return () => builder;
        },
      },
    );
    return builder;
  });
  const storage = {
    from: (bucket: string) => ({
      upload: async (
        path: string,
        _bytes: ArrayBuffer,
        fileOptions?: { contentType?: string; upsert?: boolean },
      ) => {
        uploads.push({
          bucket,
          path,
          contentType: fileOptions?.contentType,
          upsert: fileOptions?.upsert,
        });
        if (options.uploadError) return { data: null, error: options.uploadError };
        return { data: { path }, error: null };
      },
      list: async () => options.list ?? { data: [{ name: 'shop' }], error: null },
      createSignedUrl: async (path: string) =>
        options.signed ?? {
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        },
    }),
  };
  const auth = {
    getUser: async () =>
      options.userError
        ? { data: { user: null }, error: options.userError }
        : { data: { user: { id: options.userId ?? 'sales-1' } }, error: null },
  };
  const client = { from, auth, storage } as unknown as GroAurumSupabaseClient;
  return { client, uploads };
}

const jpeg = new ArrayBuffer(8);
const dbError = { message: 'permission denied', code: '42501' };

describe('salesman adapter Phase 3 — shop orders and visits', () => {
  it('listShopOrders throws on failure instead of returning an empty list', async () => {
    const { client } = makeClient({ tables: { orders: [{ error: dbError }] } });
    await expect(createSupabaseSalesmanService(client).listShopOrders('shop-1')).rejects.toBe(
      dbError,
    );
  });

  it('listShopOrders maps the existing order summary', async () => {
    const { client } = makeClient({
      tables: {
        orders: [
          {
            data: [
              {
                id: 'a1b2c3d4-0000-4000-8000-000000000001',
                shop_id: 'shop-1',
                total: 1200,
                status: 'CONFIRMED',
                created_at: '2026-09-20T10:30:00.000Z',
              },
            ],
          },
        ],
        shops: [{ data: { id: 'shop-1', trade_name: 'Sharma Stores' } }],
      },
    });
    const [order] = await createSupabaseSalesmanService(client).listShopOrders('shop-1');
    expect(order.orderNumber).toBe('A1B2C3D4');
    expect(order.shopName).toBe('Sharma Stores');
    expect(order.totalLabel).toMatch(/1,200|1200/);
  });

  it('listShopVisits keeps notes and visited time, and throws on failure', async () => {
    const { client } = makeClient({
      tables: {
        sales_visits: [
          {
            data: [
              {
                id: 'visit-1',
                shop_id: 'shop-1',
                planned_at: '2026-09-20T09:00:00.000Z',
                status: 'VISITED',
                notes: 'Bring samples',
                visited_at: '2026-09-20T09:20:00.000Z',
              },
            ],
          },
        ],
        shops: [{ data: { id: 'shop-1', trade_name: 'Sharma Stores', delivery_city: 'Delhi' } }],
      },
    });
    const [visit] = await createSupabaseSalesmanService(client).listShopVisits('shop-1');
    expect(visit.notes).toBe('Bring samples');
    expect(visit.visitedAt).toBe('2026-09-20T09:20:00.000Z');
    expect(visit.visitedAtLabel).toBeTruthy();

    const failing = makeClient({ tables: { sales_visits: [{ error: dbError }] } });
    await expect(
      createSupabaseSalesmanService(failing.client).listShopVisits('shop-1'),
    ).rejects.toBe(dbError);
  });
});

describe('salesman adapter Phase 3 — shop photo (Q, R, S)', () => {
  it('uploads only under the signed-in salesman and assigned shop, replacing in place', async () => {
    const { client, uploads } = makeClient({
      userId: 'sales-1',
      tables: { shops: [{ data: { id: 'shop-1' } }] },
    });
    const result = await createSupabaseSalesmanService(client).uploadShopPhoto('shop-1', {
      bytes: jpeg,
      contentType: 'image/jpeg',
    });
    expect(result.path).toBe(shopPhotoObjectPath('sales-1', 'shop-1'));
    expect(uploads).toEqual([
      {
        bucket: SALESMAN_MEDIA_BUCKET,
        path: 'sales-1/shop-1/shop',
        contentType: 'image/jpeg',
        upsert: true,
      },
    ]);
    expect(uploads[0].bucket).not.toBe('product-media');
  });

  it('does not report success when storage rejects the upload', async () => {
    const { client } = makeClient({
      tables: { shops: [{ data: { id: 'shop-1' } }] },
      uploadError: { message: 'payload too large' },
    });
    await expect(
      createSupabaseSalesmanService(client).uploadShopPhoto('shop-1', {
        bytes: jpeg,
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ message: 'payload too large' });
  });

  it('rejects a shop the salesman cannot see, and never uploads into another folder', async () => {
    const hidden = makeClient({
      userId: 'sales-1',
      tables: { shops: [{ data: null }] },
    });
    await expect(
      createSupabaseSalesmanService(hidden.client).uploadShopPhoto('other-shop', {
        bytes: jpeg,
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow(/not assigned/);
    expect(hidden.uploads).toEqual([]);

    const signed = makeClient({
      userId: 'sales-1',
      tables: { shops: [{ data: { id: 'shop-1' } }] },
    });
    const { path } = await createSupabaseSalesmanService(signed.client).uploadShopPhoto('shop-1', {
      bytes: jpeg,
      contentType: 'image/png',
    });
    expect(path.startsWith('sales-1/')).toBe(true);
    expect(path.startsWith('other-salesman/')).toBe(false);
  });

  it('returns a signed URL, null when missing, and throws on other storage errors', async () => {
    const ok = makeClient({ userId: 'sales-1' });
    await expect(createSupabaseSalesmanService(ok.client).getShopPhotoUrl('shop-1')).resolves.toBe(
      'https://signed.example/sales-1/shop-1/shop',
    );

    const missing = makeClient({ list: { data: [], error: null } });
    await expect(
      createSupabaseSalesmanService(missing.client).getShopPhotoUrl('shop-1'),
    ).resolves.toBeNull();

    const denied = makeClient({
      list: { data: null, error: { message: 'permission denied', statusCode: '403' } },
    });
    await expect(
      createSupabaseSalesmanService(denied.client).getShopPhotoUrl('shop-1'),
    ).rejects.toMatchObject({ message: 'permission denied' });
  });
});
