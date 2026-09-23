import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi, mapShopLocation } from './LiveAdminApi';

type QueryRecord = {
  table: string;
  isCalls: Array<{ column: string; value: unknown }>;
  limitCalls: number[];
};

function createQuery(
  table: string,
  result: unknown,
  records: QueryRecord[],
  single = false,
) {
  const record: QueryRecord = { table, isCalls: [], limitCalls: [] };
  records.push(record);

  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn((column: string, value: unknown) => {
      record.isCalls.push({ column, value });
      return builder;
    }),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn((n: number) => {
      record.limitCalls.push(n);
      return builder;
    }),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve(single ? { data: result, error: null } : { data: result, error: null })),
  };

  return builder;
}

function createSupabaseStub(results: Record<string, unknown>) {
  const records: QueryRecord[] = [];
  return {
    client: {
      from(table: string) {
        const result = results[table] ?? [];
        return createQuery(table, result, records, !Array.isArray(result));
      },
    },
    records,
  };
}

describe('mapShopLocation', () => {
  it('maps saved coordinates from database rows', () => {
    expect(
      mapShopLocation({
        delivery_lat: '28.6139',
        delivery_lng: '77.209',
      }),
    ).toEqual({
      deliveryLat: 28.6139,
      deliveryLng: 77.209,
    });
  });

  it('preserves missing coordinates as null', () => {
    expect(
      mapShopLocation({
        delivery_lat: null,
        delivery_lng: undefined,
      }),
    ).toEqual({
      deliveryLat: null,
      deliveryLng: null,
    });
  });
});

describe('LiveAdminApi pricing queries', () => {
  it('priceList does not filter sku_prices by deleted_at', async () => {
    const { client, records } = createSupabaseStub({
      skus: [
        {
          id: 'sku-1',
          product_id: 'prod-1',
          sku_code: 'ALM-1KG',
          name: 'Almond 1kg',
          net_quantity: 1,
          net_quantity_unit: 'kg',
          updated_at: '2026-08-20T06:30:00.000Z',
        },
      ],
      products: [{ id: 'prod-1', name: 'Almonds' }],
      sku_prices: [
        {
          id: 'price-1',
          sku_id: 'sku-1',
          trade_price: 240,
          currency: 'INR',
          effective_from: '2026-08-20T06:30:00.000Z',
          effective_to: null,
          created_at: '2026-08-20T06:31:00.000Z',
        },
      ],
    });

    const api = new LiveAdminApi(client as never);
    const rows = await api.priceList();

    const priceQuery = records.find((entry) => entry.table === 'sku_prices');
    expect(priceQuery?.isCalls).not.toContainEqual({
      column: 'deleted_at',
      value: null,
    });
    expect(rows[0]).toMatchObject({
      skuId: 'sku-1',
      currentPriceLabel: '₹240',
      unitPriceLabel: '₹240 · Per kg',
      status: 'live',
    });
    expect(rows[0]).not.toHaveProperty('futurePriceLabel');
  });

  it('priceDetail maps current price and pack fields for unit price', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { client } = createSupabaseStub({
      skus: {
        id: 'sku-1',
        product_id: 'prod-1',
        sku_code: 'ALM-30KG',
        name: 'Almond 30kg',
        selling_unit: 'BAG',
        net_quantity: 30,
        net_quantity_unit: 'kg',
        updated_at: now.toISOString(),
      },
      products: { id: 'prod-1', name: 'Almonds' },
      sku_prices: [
        {
          id: 'price-live',
          sku_id: 'sku-1',
          trade_price: 1500,
          currency: 'INR',
          effective_from: yesterday,
          effective_to: null,
          recorded_by_profile_id: 'profile-1',
          created_at: yesterday,
        },
        {
          id: 'price-old',
          sku_id: 'sku-1',
          trade_price: 1400,
          currency: 'INR',
          effective_from: lastWeek,
          effective_to: yesterday,
          recorded_by_profile_id: 'profile-2',
          created_at: lastWeek,
        },
      ],
      profiles: [
        { id: 'profile-1', display_name: 'Priya' },
        { id: 'profile-2', display_name: 'Aman' },
      ],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.priceDetail('sku-1');

    expect(detail?.current?.createdByLabel).toBe('Priya');
    expect(detail?.current?.status).toBe('live');
    expect(detail?.current?.tradePrice).toBe(1500);
    expect(detail?.netQuantity).toBe(30);
    expect(detail?.netQuantityUnit).toBe('kg');
    expect(detail?.history).toHaveLength(1);
    expect(detail?.history[0]?.tradePrice).toBe(1400);
    expect(detail?.listStatus).toBe('live');
    expect(detail).not.toHaveProperty('scheduled');
  });
});

describe('LiveAdminApi inventory movement mapping', () => {
  it('inventoryDetail maps schema columns and includes ADMIN_ADJUSTMENT in adjustments', async () => {
    const { client } = createSupabaseStub({
      inventory_balances: [
        {
          id: 'bal-1',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          on_hand_quantity: 50,
          reserved_quantity: 8,
          available_quantity: 42,
          updated_at: '2026-07-15T12:00:00.000Z',
        },
      ],
      skus: {
        id: 'sku-1',
        product_id: 'prod-1',
        sku_code: 'AKH-LA-10',
        name: 'Akhrot Giri · Light Amber',
        selling_unit: 'KG',
      },
      products: { id: 'prod-1', name: 'Akhrot Giri' },
      operational_locations: [
        { id: 'loc-1', name: 'Hub — CP', is_active: true, deleted_at: null },
        { id: 'loc-2', name: 'Hub — Okhla', is_active: true, deleted_at: null },
      ],
      inventory_movements: [
        {
          id: 'mov-adj',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'ADMIN_ADJUSTMENT',
          quantity_delta: 4,
          reason: 'Cycle count correction',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-08T11:45:00.000Z',
        },
        {
          id: 'mov-damage',
          sku_id: 'sku-1',
          operational_location_id: 'loc-2',
          movement_type: 'DAMAGE',
          quantity_delta: -2,
          reason: 'Moisture damage',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-07T10:00:00.000Z',
        },
        {
          id: 'mov-return',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'RETURN',
          quantity_delta: 3,
          reason: 'Customer return',
          actor_profile_id: 'actor-2',
          created_at: '2026-07-06T09:30:00.000Z',
        },
        {
          id: 'mov-dispatch',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'ORDER_DISPATCH',
          quantity_delta: -10,
          reason: 'Order GA-14K2',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-05T14:00:00.000Z',
        },
        {
          id: 'mov-rcpt',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'RECEIPT',
          quantity_delta: 50,
          reason: 'Initial receipt',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-01T09:00:00.000Z',
        },
      ],
      stock_reservations: [],
      profiles: [
        { id: 'actor-1', display_name: 'Warehouse Lead' },
        { id: 'actor-2', display_name: 'Ops Clerk' },
      ],
      orders: [],
      shops: [],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.inventoryDetail('sku-1');

    expect(detail?.warehouses).toHaveLength(1);
    expect(detail?.warehouseName).toBe('Hub — CP');
    expect(detail?.onHandLabel).toBe('50 kg');
    expect(detail?.availableLabel).toBe('42 kg');
    expect(detail?.reservedLabel).toBe('8 kg');
    // Warehouse-scoped: damage at loc-2 must not appear for loc-1 selection
    expect(detail?.movements.map((m) => m.type)).toEqual([
      'manual_adjustment',
      'return',
      'customer_order',
      'supplier_receipt',
    ]);
    expect(detail?.movements[0]).toMatchObject({
      type: 'manual_adjustment',
      quantityLabel: '+4',
      warehouseName: 'Hub — CP',
      note: 'Cycle count correction',
      recordedByLabel: 'Warehouse Lead',
    });
    expect(detail?.adjustments).toHaveLength(1);
    expect(detail?.adjustments[0]).toMatchObject({
      id: 'mov-adj',
      quantityLabel: '+4',
      warehouseName: 'Hub — CP',
      note: 'Cycle count correction',
      recordedByLabel: 'Warehouse Lead',
    });
  });

  it('inventoryDetail scopes quantities, movements, and reservations by warehouse', async () => {
    const { client, records } = createSupabaseStub({
      inventory_balances: [
        {
          id: 'bal-cp',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          on_hand_quantity: 500,
          reserved_quantity: 100,
          available_quantity: 400,
          updated_at: '2026-07-15T12:00:00.000Z',
        },
        {
          id: 'bal-okhla',
          sku_id: 'sku-1',
          operational_location_id: 'loc-2',
          on_hand_quantity: 200,
          reserved_quantity: 50,
          available_quantity: 150,
          updated_at: '2026-07-14T12:00:00.000Z',
        },
      ],
      skus: {
        id: 'sku-1',
        product_id: 'prod-1',
        sku_code: 'AKH-LA-10',
        name: 'Akhrot Giri · Light Amber',
        selling_unit: 'KG',
      },
      products: { id: 'prod-1', name: 'Akhrot Giri' },
      operational_locations: [
        { id: 'loc-1', name: 'Warehouse 1', is_active: true, deleted_at: null },
        { id: 'loc-2', name: 'Warehouse 2', is_active: true, deleted_at: null },
      ],
      inventory_movements: [
        {
          id: 'mov-cp',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'RECEIPT',
          quantity_delta: 500,
          reason: 'CP receipt',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-01T09:00:00.000Z',
        },
        {
          id: 'mov-okhla',
          sku_id: 'sku-1',
          operational_location_id: 'loc-2',
          movement_type: 'ADMIN_ADJUSTMENT',
          quantity_delta: -5,
          reason: 'Okhla count',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-02T09:00:00.000Z',
        },
      ],
      stock_reservations: [
        {
          id: 'rsv-cp',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          order_id: 'ord-1',
          quantity: 100,
          status: 'RESERVED',
          created_at: '2026-07-15T10:00:00.000Z',
        },
        {
          id: 'rsv-okhla',
          sku_id: 'sku-1',
          operational_location_id: 'loc-2',
          order_id: 'ord-2',
          quantity: 50,
          status: 'RESERVED',
          created_at: '2026-07-15T11:00:00.000Z',
        },
      ],
      profiles: [{ id: 'actor-1', display_name: 'Warehouse Lead' }],
      orders: [
        { id: 'ord-1', shop_id: 'shop-1' },
        { id: 'ord-2', shop_id: 'shop-2' },
      ],
      shops: [
        { id: 'shop-1', trade_name: 'Sharma Kirana' },
        { id: 'shop-2', trade_name: 'Gupta Traders' },
      ],
    });

    const api = new LiveAdminApi(client as never);

    const defaultDetail = await api.inventoryDetail('sku-1');
    expect(defaultDetail?.warehouses).toHaveLength(2);
    expect(defaultDetail?.warehouses.map((w) => w.availableLabel)).toEqual([
      '400 kg',
      '150 kg',
    ]);
    expect(defaultDetail?.balanceId).toBe('bal-cp');
    expect(defaultDetail?.availableLabel).toBe('400 kg');
    expect(defaultDetail?.onHandLabel).toBe('500 kg');
    expect(defaultDetail?.reservedLabel).toBe('100 kg');
    expect(defaultDetail?.movements).toHaveLength(1);
    expect(defaultDetail?.movements[0]?.note).toBe('CP receipt');
    expect(defaultDetail?.reservations).toHaveLength(1);
    expect(defaultDetail?.reservations[0]?.quantityLabel).toBe('100');
    expect(defaultDetail?.adjustments).toHaveLength(0);

    const okhla = await api.inventoryDetail('sku-1', 'bal-okhla');
    expect(okhla?.balanceId).toBe('bal-okhla');
    expect(okhla?.warehouseName).toBe('Warehouse 2');
    expect(okhla?.availableLabel).toBe('150 kg');
    expect(okhla?.onHandLabel).toBe('200 kg');
    expect(okhla?.reservedLabel).toBe('50 kg');
    expect(okhla?.movements).toHaveLength(1);
    expect(okhla?.movements[0]?.note).toBe('Okhla count');
    expect(okhla?.adjustments).toHaveLength(1);
    expect(okhla?.reservations).toHaveLength(1);
    expect(okhla?.reservations[0]?.quantityLabel).toBe('50');

    // No arbitrary .limit(1) on inventory_balances in the detail path
    const balanceQueries = records.filter((r) => r.table === 'inventory_balances');
    expect(balanceQueries.length).toBeGreaterThan(0);
    for (const q of balanceQueries) {
      expect(q.limitCalls).not.toContain(1);
    }
  });

  it('productDetail maps inventory movements from schema columns', async () => {
    const { client } = createSupabaseStub({
      products: {
        id: 'prod-1',
        name: 'Akhrot Giri',
        category_id: 'cat-1',
        product_type: 'BULK',
        is_active: true,
        updated_at: '2026-07-15T12:00:00.000Z',
      },
      categories: { id: 'cat-1', name: 'Dry Fruits' },
      skus: [
        {
          id: 'sku-1',
          product_id: 'prod-1',
          sku_code: 'AKH-LA-10',
          name: 'Akhrot Giri · Light Amber',
          selling_unit: 'KG',
          moq: 1,
          quantity_step: 1,
          is_active: true,
        },
      ],
      sku_prices: [],
      inventory_balances: [],
      inventory_movements: [
        {
          id: 'mov-dispatch',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'ORDER_DISPATCH',
          quantity_delta: -5,
          reason: 'Order GA-14K2',
          created_at: '2026-07-15T17:10:00.000Z',
        },
        {
          id: 'mov-adj',
          sku_id: 'sku-1',
          operational_location_id: 'loc-1',
          movement_type: 'ADMIN_ADJUSTMENT',
          quantity_delta: 2,
          reason: 'Correction',
          actor_profile_id: 'actor-1',
          created_at: '2026-07-14T12:00:00.000Z',
        },
      ],
      operational_locations: [{ id: 'loc-1', name: 'Hub — CP' }],
      product_images: [],
      profiles: [{ id: 'actor-1', display_name: 'Warehouse Lead' }],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.productDetail('prod-1');

    expect(detail?.inventoryMovements).toHaveLength(2);
    expect(detail?.inventoryMovements[0]).toMatchObject({
      skuCode: 'AKH-LA-10',
      typeLabel: 'Stock Deducted',
      quantityLabel: '-5',
      locationLabel: 'Hub — CP',
      note: 'Order GA-14K2',
    });
    expect(detail?.inventoryMovements[1]).toMatchObject({
      skuCode: 'AKH-LA-10',
      typeLabel: 'Manual Adjustment',
      quantityLabel: '+2',
      locationLabel: 'Hub — CP',
      note: 'Correction',
    });
  });
});

describe('LiveAdminApi product publish readiness', () => {
  it('allows publish without image or inventory when category, SKU, and price exist', async () => {
    const { client } = createSupabaseStub({
      products: {
        id: 'prod-1',
        name: 'Akhrot Giri',
        category_id: 'cat-1',
        product_type: 'BULK',
        is_active: true,
        description: null,
        created_at: '2026-07-01T09:00:00.000Z',
        updated_at: '2026-07-15T12:00:00.000Z',
      },
      categories: { id: 'cat-1', name: 'Dry Fruits', is_active: true },
      skus: [
        {
          id: 'sku-1',
          product_id: 'prod-1',
          sku_code: 'AKH-LA-10',
          name: 'Light Amber',
          selling_unit: 'KG',
          moq: 10,
          quantity_step: 10,
          is_active: true,
        },
      ],
      sku_prices: [
        {
          id: 'price-1',
          sku_id: 'sku-1',
          trade_price: 920,
          currency: 'INR',
          effective_from: '2026-07-01T09:00:00.000Z',
          effective_to: null,
          recorded_by_profile_id: 'actor-1',
          created_at: '2026-07-01T09:00:00.000Z',
        },
      ],
      inventory_balances: [],
      inventory_movements: [],
      product_images: [],
      profiles: [{ id: 'actor-1', display_name: 'Priya' }],
      operational_locations: [],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.productDetail('prod-1');

    expect(detail?.canPublish).toBe(true);
    expect(detail?.checklist.find((item) => item.key === 'image')?.optional).toBe(true);
    expect(detail?.checklist.find((item) => item.key === 'inventory')?.optional).toBe(
      true,
    );
    expect(detail?.publishStatus).toBe('published');
  });

  it('productList marks unpriced products as Missing Price', async () => {
    const { client } = createSupabaseStub({
      products: [
        {
          id: 'prod-1',
          name: 'New Product',
          category_id: 'cat-1',
          product_type: 'BULK',
          is_active: true,
          updated_at: '2026-07-15T12:00:00.000Z',
        },
      ],
      categories: [{ id: 'cat-1', name: 'Dry Fruits', is_active: true }],
      skus: [
        {
          id: 'sku-1',
          product_id: 'prod-1',
          is_active: true,
        },
      ],
      sku_prices: [],
      inventory_balances: [],
    });

    const api = new LiveAdminApi(client as never);
    const rows = await api.productList();

    expect(rows[0]?.readinessLabel).toBe('Missing Price');
    expect(rows[0]?.publishStatus).toBe('published');
  });
});

describe('LiveAdminApi deliveryDetail stop status mapping', () => {
  it('maps route_stops DB statuses to Admin UI stop statuses (H1 regression)', async () => {
    const routeId = 'a1000000-0000-4000-8000-000000000001';
    const { client } = createSupabaseStub({
      delivery_routes: {
        id: routeId,
        service_area_id: 'area-1',
        assigned_delivery_profile_id: 'drv-1',
        status: 'IN_PROGRESS',
        created_at: '2026-07-15T08:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        deleted_at: null,
      },
      profiles: [{ id: 'drv-1', display_name: 'Amit' }],
      service_areas: [{ id: 'area-1', name: 'South Delhi' }],
      operational_locations: null,
      route_stops: [
        {
          id: 'stop-pending',
          route_id: routeId,
          order_id: 'ord-1',
          sequence: 1,
          status: 'PENDING',
        },
        {
          id: 'stop-progress',
          route_id: routeId,
          order_id: 'ord-2',
          sequence: 2,
          status: 'IN_PROGRESS',
        },
        {
          id: 'stop-done',
          route_id: routeId,
          order_id: 'ord-3',
          sequence: 3,
          status: 'COMPLETED',
        },
        {
          id: 'stop-failed',
          route_id: routeId,
          order_id: 'ord-4',
          sequence: 4,
          status: 'FAILED',
        },
        {
          id: 'stop-skip',
          route_id: routeId,
          order_id: 'ord-5',
          sequence: 5,
          status: 'SKIPPED',
        },
      ],
      orders: [
        { id: 'ord-1', shop_id: 'shop-1', total: 100 },
        { id: 'ord-2', shop_id: 'shop-1', total: 200 },
        { id: 'ord-3', shop_id: 'shop-1', total: 300 },
        { id: 'ord-4', shop_id: 'shop-1', total: 400 },
        { id: 'ord-5', shop_id: 'shop-1', total: 500 },
      ],
      shops: [
        {
          id: 'shop-1',
          trade_name: 'Test Kirana',
          service_area_id: 'area-1',
          deleted_at: null,
        },
      ],
      payments: [],
      order_events: [],
      delivery_attempts: [],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.deliveryDetail(routeId);

    expect(detail).not.toBeNull();
    const byStop = Object.fromEntries(
      (detail?.assignedOrders ?? []).map((row) => [
        row.id,
        { status: row.deliveryStatus, label: row.deliveryStatusLabel },
      ]),
    );

    expect(byStop['stop-pending']).toEqual({
      status: 'pending',
      label: 'Pending',
    });
    expect(byStop['stop-progress']).toEqual({
      status: 'in_progress',
      label: 'In Progress',
    });
    expect(byStop['stop-done']).toEqual({
      status: 'delivered',
      label: 'Delivered',
    });
    expect(byStop['stop-failed']).toEqual({
      status: 'failed',
      label: 'Failed',
    });
    expect(byStop['stop-skip']).toEqual({
      status: 'skipped',
      label: 'Skipped',
    });

    expect(detail?.assignedOrders[0]?.orderId).toBe('ord-1');
    expect(detail?.serviceAreaId).toBe('area-1');
    expect(detail?.assignedDeliveryProfileId).toBe('drv-1');

    // Performance counts must use mapped delivered/failed, not pending fallback.
    expect(detail?.performance.ordersDelivered).toBe(1);
    expect(detail?.performance.failedDeliveries).toBe(1);

    // H4: no invented vehicle_loaded / departed_warehouse stages
    expect(detail?.timeline.map((s) => s.id)).not.toContain('vehicle_loaded');
    expect(detail?.timeline.map((s) => s.id)).not.toContain('departed_warehouse');
    expect(detail?.timeline[0]?.id).toBe('route_created');
    expect(detail?.collections.codExpectedLabel).toBe('₹0');
    expect(detail?.collectionHistory).toEqual([]);
  });

  it('maps COD from payments (not order totals) and builds collection history', async () => {
    const routeId = 'a1000000-0000-4000-8000-000000000002';
    const { client } = createSupabaseStub({
      delivery_routes: {
        id: routeId,
        service_area_id: 'area-1',
        assigned_delivery_profile_id: 'drv-1',
        status: 'IN_PROGRESS',
        created_at: '2026-07-15T08:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        deleted_at: null,
      },
      profiles: [{ id: 'drv-1', display_name: 'Amit' }],
      service_areas: [{ id: 'area-1', name: 'South Delhi' }],
      route_stops: [
        {
          id: 'stop-1',
          route_id: routeId,
          order_id: 'ord-cod',
          sequence: 1,
          status: 'PENDING',
          updated_at: '2026-07-15T09:00:00.000Z',
        },
        {
          id: 'stop-2',
          route_id: routeId,
          order_id: 'ord-online',
          sequence: 2,
          status: 'COMPLETED',
          updated_at: '2026-07-15T09:30:00.000Z',
        },
      ],
      orders: [
        { id: 'ord-cod', shop_id: 'shop-1', total: 9999 },
        { id: 'ord-online', shop_id: 'shop-1', total: 5000 },
      ],
      shops: [
        {
          id: 'shop-1',
          trade_name: 'Test Kirana',
          service_area_id: 'area-1',
          deleted_at: null,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          order_id: 'ord-cod',
          method_intent: 'PAY_ON_DELIVERY',
          collection_method: 'CASH_ON_DELIVERY',
          status: 'PENDING',
          amount: 1200,
          paid_at: null,
        },
        {
          id: 'pay-2',
          order_id: 'ord-online',
          method_intent: 'PAY_ONLINE_NOW',
          collection_method: 'ONLINE_GATEWAY',
          status: 'PAID',
          amount: 5000,
          paid_at: '2026-07-15T08:30:00.000Z',
        },
      ],
      order_events: [
        {
          id: 'ev-1',
          order_id: 'ord-cod',
          to_status: 'OUT_FOR_DELIVERY',
          note: 'Route started — out for delivery',
          created_at: '2026-07-15T08:15:00.000Z',
        },
      ],
      delivery_attempts: [],
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.deliveryDetail(routeId);

    expect(detail?.collections.codExpectedLabel).toBe('₹1,200');
    expect(detail?.collections.codCollectedLabel).toBe('₹0');
    expect(detail?.collections.pendingCollectionLabel).toBe('₹1,200');
    expect(detail?.collectionHistory).toEqual([]);

    const codOrder = detail?.assignedOrders.find((o) => o.orderId === 'ord-cod');
    expect(codOrder?.paymentTypeLabel).toBe('COD');
    expect(codOrder?.codCollectable).toBe(true);
    expect(codOrder?.codSuggestedAmount).toBe(1200);

    const onlineOrder = detail?.assignedOrders.find(
      (o) => o.orderId === 'ord-online',
    );
    expect(onlineOrder?.paymentTypeLabel).toBe('Online (paid)');
    expect(onlineOrder?.codCollectable).toBe(false);

    expect(detail?.timeline.some((s) => s.id === 'route_started')).toBe(true);
    expect(
      detail?.timeline.find((s) => s.id === 'route_started')?.atLabel,
    ).toBeTruthy();
    expect(detail?.timeline.some((s) => s.id === 'stop-stop-2')).toBe(true);
  });
});
