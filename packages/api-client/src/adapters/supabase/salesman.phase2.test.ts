import { describe, expect, it, vi } from 'vitest';
import { createSupabaseSalesmanService, formatOrderNumber } from './salesman';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type QueryResult = { data?: unknown; error?: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

/** Every `from(table)` pops the next queued result; any chained call is recorded. */
function makeFakeClient(
  results: Record<string, QueryResult[]>,
  rpcResult: QueryResult = { data: null, error: null },
) {
  const calls: RecordedCall[] = [];
  const from = vi.fn((table: string) => {
    const queue = results[table] ?? [];
    const result = queue.shift() ?? { data: [], error: null };
    const settle = Promise.resolve({ data: null, error: null, ...result });
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') return settle.then.bind(settle);
          return (...args: unknown[]) => {
            calls.push({ table, method: String(prop), args });
            return builder;
          };
        },
      },
    );
    return builder;
  });
  const rpc = vi.fn(async () => ({ data: null, error: null, ...rpcResult }));
  const client = { from, rpc } as unknown as GroAurumSupabaseClient;
  return { client, calls, rpc };
}

const ORDER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const dbError = { message: 'permission denied', code: '42501' };
const nowIso = new Date().toISOString();

function deletedAtFilters(calls: RecordedCall[], table: string) {
  return calls.filter(
    (c) => c.table === table && (c.method === 'is' || c.method === 'eq') && c.args[0] === 'deleted_at',
  );
}

describe('salesman adapter Phase 2 — order history (A, E)', () => {
  it('listOrders adds a short order number and date-time without orders.deleted_at', async () => {
    const { client, calls } = makeFakeClient({
      orders: [
        {
          data: [
            {
              id: ORDER_ID,
              shop_id: 'shop-1',
              total: 8275,
              status: 'AWAITING_CUSTOMER_CONFIRMATION',
              created_at: '2026-09-20T10:30:00.000Z',
            },
          ],
        },
      ],
      shops: [{ data: [{ id: 'shop-1', trade_name: 'Sharma Stores' }] }],
    });
    const [order] = await createSupabaseSalesmanService(client).listOrders('p1');
    expect(order.orderNumber).toBe('A1B2C3D4');
    expect(order.status).toBe('AWAITING_CUSTOMER_CONFIRMATION');
    expect(order.dateTimeLabel).toMatch(/20 Sept?/);
    expect(deletedAtFilters(calls, 'orders')).toEqual([]);
  });
});

describe('salesman adapter Phase 2 — getOrder (B, C, E)', () => {
  const orderRow = {
    id: ORDER_ID,
    shop_id: 'shop-1',
    total: 8773,
    subtotal: 8773,
    adjustments: 0,
    status: 'CONFIRMED',
    source: 'SALESMAN_ASSISTED',
    created_at: nowIso,
    updated_at: nowIso,
  };
  const lineRow = {
    id: 'line-1',
    sku_id: 'sku-1',
    product_name_snapshot: 'Basmati Rice',
    sku_name_snapshot: 'Basmati 1kg',
    sku_code_snapshot: 'BAS-1KG',
    specification_snapshot: null,
    selling_unit_snapshot: 'PACK',
    quantity: '50.000',
    agreed_unit_price: '165.50',
    line_total: '8275.00',
    created_at: nowIso,
  };

  it('returns header, shop and snapshot lines', async () => {
    const { client, calls } = makeFakeClient({
      orders: [{ data: orderRow }],
      order_lines: [{ data: [lineRow] }],
      shops: [{ data: { id: 'shop-1', trade_name: 'Sharma Stores' } }],
    });
    const order = await createSupabaseSalesmanService(client).getOrder(ORDER_ID);
    expect(order).not.toBeNull();
    expect(order!.orderNumber).toBe('A1B2C3D4');
    expect(order!.shopName).toBe('Sharma Stores');
    expect(order!.lines).toEqual([
      {
        id: 'line-1',
        skuId: 'sku-1',
        productName: 'Basmati Rice',
        skuName: 'Basmati 1kg',
        skuCode: 'BAS-1KG',
        specification: null,
        sellingUnit: 'PACK',
        quantity: 50,
        unitPrice: 165.5,
        lineTotal: 8275,
      },
    ]);
    expect(deletedAtFilters(calls, 'orders')).toEqual([]);
    expect(calls).toContainEqual({ table: 'order_lines', method: 'eq', args: ['order_id', ORDER_ID] });
  });

  it('returns null when the order is missing or hidden by RLS', async () => {
    const { client } = makeFakeClient({ orders: [{ data: null }] });
    await expect(createSupabaseSalesmanService(client).getOrder(ORDER_ID)).resolves.toBeNull();
  });

  it('throws on order, line or shop read errors instead of showing an empty order', async () => {
    const orderFail = makeFakeClient({ orders: [{ error: dbError }] });
    await expect(createSupabaseSalesmanService(orderFail.client).getOrder(ORDER_ID)).rejects.toBe(dbError);

    const linesFail = makeFakeClient({
      orders: [{ data: orderRow }],
      order_lines: [{ error: dbError }],
      shops: [{ data: { id: 'shop-1', trade_name: 'Sharma Stores' } }],
    });
    await expect(createSupabaseSalesmanService(linesFail.client).getOrder(ORDER_ID)).rejects.toBe(dbError);

    const shopFail = makeFakeClient({
      orders: [{ data: orderRow }],
      order_lines: [{ data: [lineRow] }],
      shops: [{ error: dbError }],
    });
    await expect(createSupabaseSalesmanService(shopFail.client).getOrder(ORDER_ID)).rejects.toBe(dbError);
  });
});

describe('salesman adapter Phase 2 — previewOrderLines (J)', () => {
  it('sends only skuId + quantity to the read-only RPC and maps the server totals', async () => {
    const { client, rpc } = makeFakeClient(
      {},
      {
        data: {
          lines: [
            {
              skuId: 'sku-1',
              quantity: 50,
              unitPrice: 165.5,
              lineTotal: 8275,
              availableQuantity: 500,
              ok: true,
              errorCode: null,
              message: null,
            },
          ],
          itemCount: 1,
          subtotal: 8275,
          total: 8275,
          currency: 'INR',
          allValid: true,
          pricedAt: nowIso,
        },
      },
    );
    const preview = await createSupabaseSalesmanService(client).previewOrderLines([
      { skuId: 'sku-1', quantity: 50, agreedUnitPrice: 1 } as never,
    ]);
    expect(rpc).toHaveBeenCalledWith('preview_assisted_order_lines', {
      p_lines: [{ skuId: 'sku-1', quantity: 50 }],
    });
    expect(preview.total).toBe(8275);
    expect(preview.allValid).toBe(true);
    expect(preview.lines[0].lineTotal).toBe(8275);
  });

  it('throws on RPC error (never reports ₹0)', async () => {
    const { client } = makeFakeClient({}, { error: dbError });
    await expect(
      createSupabaseSalesmanService(client).previewOrderLines([{ skuId: 's', quantity: 1 }]),
    ).rejects.toBe(dbError);
  });
});

describe('salesman adapter Phase 2 — listOrderableSkus pricing window', () => {
  const category = {
    id: 'cat-1',
    name: 'Rice',
    description: null,
    display_order: 1,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const product = {
    id: 'prod-1',
    category_id: 'cat-1',
    name: 'Basmati Rice',
    description: null,
    product_type: 'PACKED',
    image_urls: ['https://example.test/rice.jpg'],
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const sku = {
    id: 'sku-1',
    product_id: 'prod-1',
    sku_code: 'BAS-1KG',
    name: 'Basmati 1kg',
    specification: null,
    grade: null,
    product_type: 'PACKED',
    selling_unit: 'PACK',
    net_quantity: 1,
    net_quantity_unit: 'kg',
    packs_per_carton: 10,
    outer_type: 'bag',
    moq: 1,
    quantity_step: 1,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const past = '2026-01-01T00:00:00.000Z';
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();

  it('keeps a current price that has a future effective_to (matches the server resolver)', async () => {
    const { client, calls } = makeFakeClient({
      categories: [{ data: [category] }],
      products: [{ data: [product] }],
      skus: [{ data: [sku] }],
      sku_prices: [
        {
          data: [
            {
              id: 'price-1',
              sku_id: 'sku-1',
              trade_price: 166,
              currency: 'INR',
              effective_from: past,
              effective_to: future,
              created_at: past,
            },
          ],
        },
      ],
      inventory_balances: [{ data: [{ sku_id: 'sku-1', available_quantity: 120 }] }],
    });
    const rows = await createSupabaseSalesmanService(client).listOrderableSkus();
    expect(rows).toHaveLength(1);
    expect(rows[0].unitPrice).toBe(166);
    expect(rows[0].availableQuantity).toBe(120);
    expect(rows[0].sku.outerType).toBe('bag');
    expect(rows[0].product.imageUrls).toEqual(['https://example.test/rice.jpg']);
    expect(calls.filter((c) => c.table === 'sku_prices' && c.args[0] === 'effective_to')).toEqual([]);
    expect(calls.filter((c) => c.table === 'sku_prices' && c.method === 'in')).toHaveLength(1);
    expect(deletedAtFilters(calls, 'skus')).toHaveLength(1);
  });

  it('throws when prices or stock fail to load instead of hiding products', async () => {
    const base = {
      categories: [{ data: [category] }],
      products: [{ data: [product] }],
      skus: [{ data: [sku] }],
    };
    const pricesFail = makeFakeClient({
      ...base,
      sku_prices: [{ error: dbError }],
      inventory_balances: [{ data: [] }],
    });
    await expect(createSupabaseSalesmanService(pricesFail.client).listOrderableSkus()).rejects.toBe(dbError);

    const skusFail = makeFakeClient({
      categories: [{ data: [category] }],
      products: [{ data: [product] }],
      skus: [{ error: dbError }],
    });
    await expect(createSupabaseSalesmanService(skusFail.client).listOrderableSkus()).rejects.toBe(dbError);
  });
});

describe('formatOrderNumber', () => {
  it('uses the first 8 id characters, upper-cased', () => {
    expect(formatOrderNumber('abcdef12-3456')).toBe('ABCDEF12');
  });
});
