import type { EntitySource } from '@groaurum/api';
import {
  PRODUCT_LIST_FIXTURE,
  PRODUCT_DETAIL_FIXTURES,
} from '@/data/product-fixtures';
import {
  SKU_PRICE_LIST_FIXTURE,
  getSkuPricingDetailFixture,
} from '@/data/pricing-fixtures';
import {
  INVENTORY_SNAPSHOT_FIXTURE,
  getInventorySkuDetailFixture,
} from '@/data/inventory-fixtures';
import { parseInventoryDetailLookupKey } from '@/data/inventory-detail-key';
import {
  CUSTOMERS_SNAPSHOT_FIXTURE,
  getCustomerDetailFixture,
} from '@/data/customers-fixtures';
import {
  ORDERS_SNAPSHOT_FIXTURE,
  getOrderDetailFixture,
} from '@/data/orders-fixtures';
import {
  SALESMEN_SNAPSHOT_FIXTURE,
  getSalesmanDetailFixture,
} from '@/data/salesmen-fixtures';
import {
  DELIVERY_SNAPSHOT_FIXTURE,
  getDeliveryRouteDetailFixture,
} from '@/data/delivery-fixtures';
import { REPORTS_SNAPSHOT_FIXTURE } from '@/data/reports-fixtures';
import { SETTINGS_SNAPSHOT_FIXTURE } from '@/data/settings-fixtures';
import { DASHBOARD_FIXTURE } from '@/data/dashboard-fixtures';
import { SERVICE_AREA_LIST_FIXTURE } from '@/data/service-area-fixtures';
import { WAREHOUSE_LIST_FIXTURE } from '@/data/warehouse-fixtures';
import type { AdminErpRepositories } from '@/data/adminDataClient';
import type { CategoryListItem } from '@/data/category-model';
import type { AdminEntitySources } from '@groaurum/api';
import type { CustomersSnapshot } from '@/data/customers-types';
import type { OrdersSnapshot } from '@/data/orders-types';
import type { InventorySnapshot } from '@/data/inventory-types';
import type { SalesmenSnapshot } from '@/data/salesmen-types';
import type { DeliverySnapshot } from '@/data/delivery-types';
import type { ReportsSnapshot } from '@/data/reports-types';
import type { SettingsSnapshot } from '@/data/settings-types';
import type { DashboardSnapshot } from '@/data/dashboard-types';

function textMatch(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function snapshotSource<T>(snapshot: T, id = 'current'): EntitySource<T, T> {
  return {
    list: () => [snapshot],
    getById: (lookup) =>
      lookup === id || lookup === 'current' ? snapshot : null,
    search: () => [snapshot],
  };
}

export type AdminMockSnapshots = {
  customers: CustomersSnapshot;
  orders: OrdersSnapshot;
  inventory: InventorySnapshot;
  salesmen: SalesmenSnapshot;
  delivery: DeliverySnapshot;
  reports: ReportsSnapshot;
  settings: SettingsSnapshot;
  dashboard: DashboardSnapshot;
};

export function getAdminMockSnapshots(): AdminMockSnapshots {
  return {
    customers: CUSTOMERS_SNAPSHOT_FIXTURE,
    orders: ORDERS_SNAPSHOT_FIXTURE,
    inventory: INVENTORY_SNAPSHOT_FIXTURE,
    salesmen: SALESMEN_SNAPSHOT_FIXTURE,
    delivery: DELIVERY_SNAPSHOT_FIXTURE,
    reports: REPORTS_SNAPSHOT_FIXTURE,
    settings: SETTINGS_SNAPSHOT_FIXTURE,
    dashboard: DASHBOARD_FIXTURE,
  };
}

/**
 * Fixture seed → mock entity sources.
 * Pages must not import fixtures; only this bootstrap may.
 */
export function buildAdminMockSources(): AdminEntitySources<AdminErpRepositories> {
  const categories: CategoryListItem[] = [
    {
      id: 'cat-almonds',
      name: 'Almonds',
      slug: 'almonds',
      productCount: 4,
      activeProductCount: 3,
      lowStockCount: 1,
      outOfStockCount: 0,
      status: 'active',
    },
    {
      id: 'cat-cashews',
      name: 'Cashews',
      slug: 'cashews',
      productCount: 3,
      activeProductCount: 2,
      lowStockCount: 0,
      outOfStockCount: 1,
      status: 'active',
    },
  ];

  const skuRows = Object.values(PRODUCT_DETAIL_FIXTURES).flatMap((product) =>
    product.skus.map((sku) => ({ ...sku, productId: product.id })),
  );

  return {
    products: {
      list: () => PRODUCT_LIST_FIXTURE,
      getById: (id) => PRODUCT_DETAIL_FIXTURES[id] ?? null,
      search: (q) =>
        PRODUCT_LIST_FIXTURE.filter(
          (row) =>
            textMatch(row.name, q) ||
            textMatch(row.categoryName, q) ||
            textMatch(row.id, q),
        ),
    },
    categories: {
      list: () => categories,
      getById: (id) => categories.find((c) => c.id === id) ?? null,
      search: (q) =>
        categories.filter(
          (c) => textMatch(c.name, q) || textMatch(c.slug, q),
        ),
    },
    skus: {
      list: () => skuRows,
      getById: (id) => skuRows.find((s) => s.id === id) ?? null,
      search: (q) =>
        skuRows.filter(
          (s) =>
            textMatch(s.skuCode, q) ||
            textMatch(s.name, q) ||
            textMatch(s.productId, q),
        ),
    },
    prices: {
      list: () => SKU_PRICE_LIST_FIXTURE,
      getById: (id) => getSkuPricingDetailFixture(id),
      search: (q) =>
        SKU_PRICE_LIST_FIXTURE.filter(
          (row) =>
            textMatch(row.skuCode, q) ||
            textMatch(row.productName, q) ||
            textMatch(row.skuName, q),
        ),
    },
    inventory: {
      list: () => INVENTORY_SNAPSHOT_FIXTURE.rows,
      getById: (id) => {
        const { skuId, balanceId } = parseInventoryDetailLookupKey(id);
        return getInventorySkuDetailFixture(skuId, balanceId);
      },
      search: (q) =>
        INVENTORY_SNAPSHOT_FIXTURE.rows.filter(
          (row) =>
            textMatch(row.skuCode, q) ||
            textMatch(row.productName, q) ||
            textMatch(row.skuName, q),
        ),
    },
    customers: {
      list: () => CUSTOMERS_SNAPSHOT_FIXTURE.rows,
      getById: (id) => getCustomerDetailFixture(id),
      search: (q) =>
        CUSTOMERS_SNAPSHOT_FIXTURE.rows.filter(
          (row) =>
            textMatch(row.shopName, q) ||
            textMatch(row.ownerName, q) ||
            textMatch(row.areaLabel, q),
        ),
    },
    orders: {
      list: () => ORDERS_SNAPSHOT_FIXTURE.rows,
      getById: (id) => getOrderDetailFixture(id),
      search: (q) =>
        ORDERS_SNAPSHOT_FIXTURE.rows.filter(
          (row) =>
            textMatch(row.orderCode, q) ||
            textMatch(row.customerName, q),
        ),
    },
    salesmen: {
      list: () => SALESMEN_SNAPSHOT_FIXTURE.rows,
      getById: (id) => getSalesmanDetailFixture(id),
      search: (q) =>
        SALESMEN_SNAPSHOT_FIXTURE.rows.filter(
          (row) =>
            textMatch(row.name, q) || textMatch(row.territory, q),
        ),
    },
    delivery: {
      list: () => DELIVERY_SNAPSHOT_FIXTURE.rows,
      getById: (id) => getDeliveryRouteDetailFixture(id),
      search: (q) =>
        DELIVERY_SNAPSHOT_FIXTURE.rows.filter(
          (row) =>
            textMatch(row.routeCode, q) ||
            textMatch(row.driverName, q) ||
            textMatch(row.deliveryArea, q),
        ),
    },
    reports: snapshotSource(REPORTS_SNAPSHOT_FIXTURE),
    settings: snapshotSource(SETTINGS_SNAPSHOT_FIXTURE),
    dashboard: snapshotSource(DASHBOARD_FIXTURE),
    serviceAreas: {
      list: () => SERVICE_AREA_LIST_FIXTURE,
      getById: (id) =>
        SERVICE_AREA_LIST_FIXTURE.find((row) => row.id === id) ?? null,
      search: (q) =>
        SERVICE_AREA_LIST_FIXTURE.filter(
          (row) =>
            textMatch(row.name, q) ||
            textMatch(row.description, q) ||
            row.pinCodes.some((pin) => textMatch(pin, q)),
        ),
    },
    warehouses: {
      list: () => WAREHOUSE_LIST_FIXTURE,
      getById: (id) =>
        WAREHOUSE_LIST_FIXTURE.find((row) => row.id === id) ?? null,
      search: (q) =>
        WAREHOUSE_LIST_FIXTURE.filter(
          (row) =>
            textMatch(row.name, q) ||
            textMatch(row.city, q) ||
            textMatch(row.state, q) ||
            textMatch(row.pinCode, q) ||
            textMatch(row.addressLine, q),
        ),
    },
  };
}
