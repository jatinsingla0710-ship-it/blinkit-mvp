import { describe, expect, it, vi } from 'vitest';
import { createSupabaseSalesmanService } from './salesman';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type RecordedCall = { table: string; method: string; args: unknown[] };

const CHAIN_METHODS = [
  'select',
  'in',
  'eq',
  'is',
  'gte',
  'lte',
  'order',
  'limit',
  'update',
] as const;

/**
 * Minimal PostgREST-like fake: every `from(table)` pops the next queued result
 * for that table, and every chained filter call is recorded.
 */
function makeFakeClient(results: Record<string, QueryResult[]>) {
  const calls: RecordedCall[] = [];
  const from = vi.fn((table: string) => {
    const queue = results[table] ?? [];
    const result = queue.shift() ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({ data: null, error: null, count: null, ...result }).then(
        resolve,
        reject,
      );
    return builder;
  });
  const client = { from, rpc: vi.fn() } as unknown as GroAurumSupabaseClient;
  return { client, calls };
}

function ordersDeletedAtFilters(calls: RecordedCall[]) {
  return calls.filter(
    (c) =>
      c.table === 'orders' &&
      (c.method === 'is' || c.method === 'eq') &&
      c.args[0] === 'deleted_at',
  );
}

const PROFILE_ID = 'profile-1';
const nowIso = new Date().toISOString();

const shopRow = {
  id: 'shop-1',
  trade_name: 'Sharma Stores',
  legal_name: null,
  lifecycle_status: 'ACTIVATED',
  is_active: true,
  last_app_link_sent_at: null,
  service_area_id: 'area-1',
  delivery_pin_code: '110001',
  delivery_address_line: '1 Main Rd',
  delivery_city: 'Delhi',
  delivery_state: 'DL',
  delivery_lat: null,
  delivery_lng: null,
  created_at: nowIso,
};

const dbError = { message: 'permission denied for table orders', code: '42501' };

describe('salesman adapter — dashboard orders (A)', () => {
  it('counts this month orders without filtering orders.deleted_at', async () => {
    const { client, calls } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_auth_links: [{ data: [], error: null }],
      sales_visits: [{ count: 2, error: null }],
      orders: [
        {
          data: [
            { id: 'o1', total: 1200, created_by_profile_id: PROFILE_ID, created_at: nowIso },
            { id: 'o2', total: 800, created_by_profile_id: PROFILE_ID, created_at: nowIso },
          ],
          error: null,
        },
      ],
    });

    const dashboard = await createSupabaseSalesmanService(client).getDashboard(PROFILE_ID);

    expect(dashboard.ordersCollected).toBe(2);
    expect(dashboard.revenueThisMonth).toBe(2000);
    expect(dashboard.todaysVisits).toBe(2);
    expect(ordersDeletedAtFilters(calls)).toEqual([]);
    expect(calls).toContainEqual({
      table: 'orders',
      method: 'eq',
      args: ['created_by_profile_id', PROFILE_ID],
    });
  });
});

describe('salesman adapter — performance (B)', () => {
  it('computes orders and repeat customers without orders.deleted_at', async () => {
    const { client, calls } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      orders: [
        {
          data: [
            { id: 'o1', total: 500, shop_id: 'shop-1', created_at: nowIso },
            { id: 'o2', total: 700, shop_id: 'shop-1', created_at: nowIso },
          ],
          error: null,
        },
      ],
    });

    const perf = await createSupabaseSalesmanService(client).getPerformance(PROFILE_ID);

    expect(perf.ordersThisMonth).toBe(2);
    expect(perf.repeatCustomers).toBe(1);
    expect(perf.newRetailers).toBe(1);
    expect(perf.activationRateLabel).toBe('100%');
    expect(ordersDeletedAtFilters(calls)).toEqual([]);
  });
});

describe('salesman adapter — retailer last order (C)', () => {
  it('derives lastOrderLabel from orders without orders.deleted_at', async () => {
    const { client, calls } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_contacts: [
        {
          data: [{ shop_id: 'shop-1', name: 'Ravi', mobile: '9876543210', is_primary: true }],
          error: null,
        },
      ],
      service_areas: [{ data: [{ id: 'area-1', name: 'North' }], error: null }],
      shop_invitations: [{ data: [], error: null }],
      shop_auth_links: [{ data: [{ shop_id: 'shop-1' }], error: null }],
      orders: [
        { data: [{ shop_id: 'shop-1', created_at: '2026-09-20T10:00:00.000Z' }], error: null },
      ],
    });

    const [retailer] = await createSupabaseSalesmanService(client).listRetailers();

    expect(retailer.lastOrderLabel).not.toBe('—');
    expect(retailer.areaLabel).toBe('North');
    expect(retailer.activationStatus).toBe('activated');
    expect(ordersDeletedAtFilters(calls)).toEqual([]);
  });

  it('listOrders reads only real order columns and no deleted_at', async () => {
    const { client, calls } = makeFakeClient({
      orders: [
        {
          data: [{ id: 'o1', shop_id: 'shop-1', total: 900, status: 'PENDING', created_at: nowIso }],
          error: null,
        },
      ],
      shops: [{ data: [{ id: 'shop-1', trade_name: 'Sharma Stores' }], error: null }],
    });

    const orders = await createSupabaseSalesmanService(client).listOrders(PROFILE_ID);

    expect(orders).toHaveLength(1);
    expect(orders[0].shopName).toBe('Sharma Stores');
    expect(ordersDeletedAtFilters(calls)).toEqual([]);
    expect(calls).toContainEqual({
      table: 'orders',
      method: 'select',
      args: ['id, shop_id, total, status, created_at'],
    });
  });
});

describe('salesman adapter — read errors surface (D)', () => {
  it('getDashboard throws when the orders read fails instead of reporting zero', async () => {
    const { client } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_auth_links: [{ data: [], error: null }],
      sales_visits: [{ count: 0, error: null }],
      orders: [{ data: null, error: dbError }],
    });
    await expect(
      createSupabaseSalesmanService(client).getDashboard(PROFILE_ID),
    ).rejects.toBe(dbError);
  });

  it('getDashboard throws when the visits count fails', async () => {
    const { client } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_auth_links: [{ data: [], error: null }],
      sales_visits: [{ count: null, error: dbError }],
    });
    await expect(
      createSupabaseSalesmanService(client).getDashboard(PROFILE_ID),
    ).rejects.toBe(dbError);
  });

  it('getDashboard throws when shop_auth_links fails', async () => {
    const { client } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_auth_links: [{ data: null, error: dbError }],
    });
    await expect(
      createSupabaseSalesmanService(client).getDashboard(PROFILE_ID),
    ).rejects.toBe(dbError);
  });

  it('getPerformance throws when the orders read fails', async () => {
    const { client } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      orders: [{ data: null, error: dbError }],
    });
    await expect(
      createSupabaseSalesmanService(client).getPerformance(PROFILE_ID),
    ).rejects.toBe(dbError);
  });

  it('listRetailers throws when any related read fails', async () => {
    const { client } = makeFakeClient({
      shops: [{ data: [shopRow], error: null }],
      shop_contacts: [{ data: [], error: null }],
      service_areas: [{ data: [], error: null }],
      shop_invitations: [{ data: [], error: null }],
      shop_auth_links: [{ data: [], error: null }],
      orders: [{ data: null, error: dbError }],
    });
    await expect(createSupabaseSalesmanService(client).listRetailers()).rejects.toBe(
      dbError,
    );
  });

  it('listOrders throws when the orders read or shop-name lookup fails', async () => {
    const ordersFail = makeFakeClient({ orders: [{ data: null, error: dbError }] });
    await expect(
      createSupabaseSalesmanService(ordersFail.client).listOrders(PROFILE_ID),
    ).rejects.toBe(dbError);

    const shopsFail = makeFakeClient({
      orders: [
        {
          data: [{ id: 'o1', shop_id: 'shop-1', total: 1, status: 'PENDING', created_at: nowIso }],
          error: null,
        },
      ],
      shops: [{ data: null, error: dbError }],
    });
    await expect(
      createSupabaseSalesmanService(shopsFail.client).listOrders(PROFILE_ID),
    ).rejects.toBe(dbError);
  });
});

describe('salesman adapter — updateVisitStatus notes (E)', () => {
  function updatePatches(calls: RecordedCall[]) {
    return calls
      .filter((c) => c.table === 'sales_visits' && c.method === 'update')
      .map((c) => c.args[0] as Record<string, unknown>);
  }

  it('omits notes from the patch on a status-only update', async () => {
    const { client, calls } = makeFakeClient({ sales_visits: [{ error: null }] });
    await createSupabaseSalesmanService(client).updateVisitStatus('visit-1', 'PENDING');
    const [patch] = updatePatches(calls);
    expect(patch).toEqual({ status: 'PENDING' });
    expect('notes' in patch).toBe(false);
  });

  it('writes notes when provided and clears them only with explicit null', async () => {
    const { client, calls } = makeFakeClient({
      sales_visits: [{ error: null }, { error: null }],
    });
    const service = createSupabaseSalesmanService(client);
    await service.updateVisitStatus('visit-1', 'VISITED', 'Met owner');
    await service.updateVisitStatus('visit-1', 'MISSED', null);
    const [withNotes, cleared] = updatePatches(calls);
    expect(withNotes).toMatchObject({ status: 'VISITED', notes: 'Met owner' });
    expect(typeof withNotes.visited_at).toBe('string');
    expect(cleared).toEqual({ status: 'MISSED', notes: null });
  });

  it('throws when the update fails', async () => {
    const { client } = makeFakeClient({ sales_visits: [{ error: dbError }] });
    await expect(
      createSupabaseSalesmanService(client).updateVisitStatus('visit-1', 'PENDING'),
    ).rejects.toBe(dbError);
  });
});
