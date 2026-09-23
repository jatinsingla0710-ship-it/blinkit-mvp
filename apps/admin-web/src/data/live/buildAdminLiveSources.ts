import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import type { AdminEntitySources } from '@groaurum/api';
import type { AdminErpRepositories } from '@/data/adminDataClient';
import { parseInventoryDetailLookupKey } from '@/data/inventory-detail-key';
import { textMatch } from './format';
import { LiveAdminApi } from './LiveAdminApi';

import type { CustomersSnapshot } from '@/data/customers-types';
import type { OrdersSnapshot } from '@/data/orders-types';
import type { InventorySnapshot } from '@/data/inventory-types';
import type { SalesmenSnapshot } from '@/data/salesmen-types';
import type { DeliverySnapshot } from '@/data/delivery-types';
import type { ReportsSnapshot } from '@/data/reports-types';
import type { SettingsSnapshot } from '@/data/settings-types';
import type { DashboardSnapshot } from '@/data/dashboard-types';

export type AdminLiveSnapshots = {
  customers: CustomersSnapshot;
  orders: OrdersSnapshot;
  inventory: InventorySnapshot;
  salesmen: SalesmenSnapshot;
  delivery: DeliverySnapshot;
  reports: ReportsSnapshot;
  settings: SettingsSnapshot;
  dashboard: DashboardSnapshot;
};

export function getAdminLiveSnapshots(api: LiveAdminApi): {
  getSnapshot: <K extends keyof AdminLiveSnapshots>(key: K) => Promise<AdminLiveSnapshots[K]>;
} {
  return {
    async getSnapshot<K extends keyof AdminLiveSnapshots>(key: K): Promise<AdminLiveSnapshots[K]> {
      switch (key) {
        case 'customers':
          return api.customersSnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'orders':
          return api.ordersSnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'inventory':
          return api.inventorySnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'salesmen':
          return api.salesmenSnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'delivery':
          return api.deliverySnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'reports':
          return api.reportsSnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'settings':
          return api.settingsSnapshot() as Promise<AdminLiveSnapshots[K]>;
        case 'dashboard':
          return api.dashboardSnapshot() as Promise<AdminLiveSnapshots[K]>;
        default:
          throw new Error(`Unknown snapshot key: ${String(key)}`);
      }
    },
  };
}

export function buildAdminLiveSources(
  client: GroAurumSupabaseClient,
): AdminEntitySources<AdminErpRepositories> {
  const api = new LiveAdminApi(client);

  return {
    products: {
      list: () => api.productList(),
      getById: (id) => api.productDetail(id),
      search: async (q) => {
        const rows = await api.productList();
        return rows.filter(
          (r) =>
            textMatch(r.name, q) ||
            textMatch(r.categoryName, q) ||
            textMatch(r.id, q),
        );
      },
    },
    categories: {
      list: () => api.categoryList(),
      getById: (id) => api.categoryDetail(id),
      search: async (q) => {
        const rows = await api.categoryList();
        return rows.filter(
          (c) => textMatch(c.name, q) || textMatch(c.slug, q),
        );
      },
    },
    skus: {
      list: () => api.skuList(),
      getById: async (id) => {
        const rows = await api.skuList();
        return rows.find((s) => s.id === id) ?? null;
      },
      search: async (q) => {
        const rows = await api.skuList();
        return rows.filter(
          (s) =>
            textMatch(s.skuCode, q) ||
            textMatch(s.name, q) ||
            textMatch(s.productId, q),
        );
      },
    },
    prices: {
      list: () => api.priceList(),
      getById: (id) => api.priceDetail(id),
      search: async (q) => {
        const rows = await api.priceList();
        return rows.filter(
          (r) =>
            textMatch(r.skuCode, q) ||
            textMatch(r.productName, q) ||
            textMatch(r.skuName, q),
        );
      },
    },
    inventory: {
      list: async () => {
        const snap = await api.inventorySnapshot();
        return snap.rows;
      },
      getById: (id) => {
        const { skuId, balanceId } = parseInventoryDetailLookupKey(id);
        return api.inventoryDetail(skuId, balanceId);
      },
      search: async (q) => {
        const snap = await api.inventorySnapshot();
        return snap.rows.filter(
          (r) =>
            textMatch(r.skuCode, q) ||
            textMatch(r.productName, q) ||
            textMatch(r.skuName, q),
        );
      },
    },
    customers: {
      list: async () => {
        const snap = await api.customersSnapshot();
        return snap.rows;
      },
      getById: (id) => api.customerDetail(id),
      search: async (q) => {
        const snap = await api.customersSnapshot();
        return snap.rows.filter(
          (r) =>
            textMatch(r.shopName, q) ||
            textMatch(r.ownerName, q) ||
            textMatch(r.areaLabel, q),
        );
      },
    },
    orders: {
      list: async () => {
        const snap = await api.ordersSnapshot();
        return snap.rows;
      },
      getById: (id) => api.orderDetail(id),
      search: async (q) => {
        const snap = await api.ordersSnapshot();
        return snap.rows.filter(
          (r) =>
            textMatch(r.orderCode, q) ||
            textMatch(r.customerName, q),
        );
      },
    },
    salesmen: {
      list: async () => {
        const snap = await api.salesmenSnapshot();
        return snap.rows;
      },
      getById: (id) => api.salesmanDetail(id),
      search: async (q) => {
        const snap = await api.salesmenSnapshot();
        return snap.rows.filter(
          (r) => textMatch(r.name, q) || textMatch(r.territory, q),
        );
      },
    },
    delivery: {
      list: async () => {
        const snap = await api.deliverySnapshot();
        return snap.rows;
      },
      getById: (id) => api.deliveryDetail(id),
      search: async (q) => {
        const snap = await api.deliverySnapshot();
        return snap.rows.filter(
          (r) =>
            textMatch(r.routeCode, q) ||
            textMatch(r.driverName, q) ||
            textMatch(r.deliveryArea, q),
        );
      },
    },
    reports: {
      list: async () => [await api.reportsSnapshot()],
      getById: async (_id) => api.reportsSnapshot(),
      search: async () => [await api.reportsSnapshot()],
    },
    settings: {
      list: async () => [await api.settingsSnapshot()],
      getById: async (_id) => api.settingsSnapshot(),
      search: async () => [await api.settingsSnapshot()],
    },
    dashboard: {
      list: async () => [await api.dashboardSnapshot()],
      getById: async (_id) => api.dashboardSnapshot(),
      search: async () => [await api.dashboardSnapshot()],
    },
    serviceAreas: {
      list: () => api.serviceAreaList(),
      getById: (id) => api.serviceAreaDetail(id),
      search: async (q) => {
        const rows = await api.serviceAreaList();
        return rows.filter(
          (row) =>
            textMatch(row.name, q) ||
            textMatch(row.description, q) ||
            row.pinCodes.some((pin: string) => textMatch(pin, q)),
        );
      },
    },
    warehouses: {
      list: () => api.warehouseList(),
      getById: (id) => api.warehouseDetail(id),
      search: async (q) => {
        const rows = await api.warehouseList();
        return rows.filter(
          (row) =>
            textMatch(row.name, q) ||
            textMatch(row.city, q) ||
            textMatch(row.state, q) ||
            textMatch(row.pinCode, q) ||
            textMatch(row.addressLine, q),
        );
      },
    },
  };
}
