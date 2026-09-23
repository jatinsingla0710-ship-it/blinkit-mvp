import {
  AdminDataService,
  createAdminRepositories,
  createCrudServices,
  MemoryCache,
  type AdminRepositories,
  type CrudServices,
  type DataAdapterMode,
  type DomainCrudRepositories,
} from '@groaurum/api';
import { createDataError } from '@groaurum/data';
import type { ProductListRow, ProductDetail, ProductSkuRow } from '@/data/product-types';
import type { CategoryListItem } from './category-model';
import type { SkuPriceListRow, SkuPricingDetail } from '@/data/pricing-types';
import type {
  InventoryListRow,
  InventorySkuDetail,
  InventorySnapshot,
} from '@/data/inventory-types';
import type {
  CustomerListRow,
  CustomerDetail,
  CustomersSnapshot,
} from '@/data/customers-types';
import type { OrderListRow, OrderDetail, OrdersSnapshot } from '@/data/orders-types';
import type {
  SalesmanListRow,
  SalesmanDetail,
  SalesmenSnapshot,
} from '@/data/salesmen-types';
import type {
  DeliveryRouteListRow,
  DeliveryRouteDetail,
  DeliverySnapshot,
} from '@/data/delivery-types';
import type { ReportsSnapshot } from '@/data/reports-types';
import type { SettingsSnapshot } from '@/data/settings-types';
import type { DashboardSnapshot } from '@/data/dashboard-types';
import type { ServiceAreaListItem } from '@/data/service-area-model';
import type { WarehouseListItem } from '@/data/warehouse-model';
import {
  buildAdminMockSources,
  getAdminMockSnapshots,
  type AdminMockSnapshots,
} from '@/data/buildAdminMockSources';
import {
  buildAdminLiveSources,
  getAdminLiveSnapshots,
  LiveAdminApi,
} from '@/data/live';
import { getAdminSupabaseClient } from '@/lib/adminSupabaseClient';
import { resolveOperationalDataAdapter } from '@/lib/operationalEnv';

export type SkuListRow = ProductSkuRow & { productId: string };

export type AdminErpRepositories = AdminRepositories<{
  products: { list: ProductListRow; detail: ProductDetail };
  categories: { list: CategoryListItem; detail: CategoryListItem };
  skus: { list: SkuListRow; detail: SkuListRow };
  prices: { list: SkuPriceListRow; detail: SkuPricingDetail };
  inventory: { list: InventoryListRow; detail: InventorySkuDetail };
  customers: { list: CustomerListRow; detail: CustomerDetail };
  orders: { list: OrderListRow; detail: OrderDetail };
  salesmen: { list: SalesmanListRow; detail: SalesmanDetail };
  delivery: { list: DeliveryRouteListRow; detail: DeliveryRouteDetail };
  reports: { list: ReportsSnapshot; detail: ReportsSnapshot };
  settings: { list: SettingsSnapshot; detail: SettingsSnapshot };
  dashboard: { list: DashboardSnapshot; detail: DashboardSnapshot };
  serviceAreas: { list: ServiceAreaListItem; detail: ServiceAreaListItem };
  warehouses: { list: WarehouseListItem; detail: WarehouseListItem };
}>;

export type AdminDataClient = {
  mode: DataAdapterMode;
  service: AdminDataService<AdminErpRepositories>;
  repositories: AdminErpRepositories;
  domain: DomainCrudRepositories | null;
  crud: CrudServices | null;
  liveApi: LiveAdminApi | null;
  getSnapshot: <K extends keyof AdminMockSnapshots>(
    key: K,
  ) => Promise<AdminMockSnapshots[K]>;
};

let singleton: AdminDataClient | null = null;

function resolveMode(): DataAdapterMode {
  return resolveOperationalDataAdapter();
}

/**
 * Adapter switch: VITE_DATA_ADAPTER=mock|supabase
 * - mock: fixture view-models (offline UI review)
 * - supabase: live view-models + domain CRUD
 */
export function getAdminDataClient(): AdminDataClient {
  if (singleton) return singleton;

  const mode = resolveMode();
  const cache = new MemoryCache();

  if (mode === 'supabase') {
    // Share client with auth provider so JWT is attached to PostgREST.
    const client = getAdminSupabaseClient();
    const liveApi = new LiveAdminApi(client);
    const liveSnapshots = getAdminLiveSnapshots(liveApi);
    const bundle = createAdminRepositories<AdminErpRepositories>({
      mode: 'supabase',
      cache,
      client,
      sources: buildAdminLiveSources(client),
    });
    const crud = bundle.domain
      ? createCrudServices(bundle.domain, cache)
      : null;

    singleton = {
      mode,
      repositories: bundle.repositories,
      domain: bundle.domain,
      crud,
      liveApi,
      service: new AdminDataService(bundle.repositories, cache),
      getSnapshot: (key) => liveSnapshots.getSnapshot(key),
    };
    return singleton;
  }

  const sources = buildAdminMockSources();
  const snapshots = getAdminMockSnapshots();
  const bundle = createAdminRepositories<AdminErpRepositories>({
    mode: 'mock',
    cache,
    sources,
  });

  singleton = {
    mode,
    repositories: bundle.repositories,
    domain: null,
    crud: null,
    liveApi: null,
    service: new AdminDataService(bundle.repositories, cache),
    async getSnapshot(key) {
      return snapshots[key];
    },
  };
  return singleton;
}

export function resetAdminDataClient(): void {
  singleton = null;
}

export function requireCrudServices(): CrudServices {
  const client = getAdminDataClient();
  if (!client.crud) {
    throw createDataError(
      'adapter_unavailable',
      'CRUD requires VITE_DATA_ADAPTER=supabase and a configured Supabase client.',
    );
  }
  return client.crud;
}

export function requireLiveAdminApi(): LiveAdminApi {
  const client = getAdminDataClient();
  if (!client.liveApi) {
    throw createDataError(
      'adapter_unavailable',
      'Live API requires VITE_DATA_ADAPTER=supabase.',
    );
  }
  return client.liveApi;
}

export type {
  InventorySnapshot,
  CustomersSnapshot,
  OrdersSnapshot,
  SalesmenSnapshot,
  DeliverySnapshot,
};
