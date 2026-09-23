import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import type {
  Category,
  DeliveryRoute,
  InventoryBalance,
  Order,
  Product,
  ServiceArea,
  ServiceabilityRule,
  Shop,
  Sku,
  SkuPrice,
  StaffProfile,
} from '@groaurum/shared-types';
import type { OperationalLocation } from '@groaurum/shared-types';
import type { CrudRepository, ReadRepository } from '@groaurum/data';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CustomerCreateInput,
  CustomerUpdateInput,
  DeliveryRouteCreateInput,
  DeliveryRouteUpdateInput,
  InventoryAdjustInput,
  OrderCreateInput,
  PriceCreateInput,
  ProductCreateInput,
  ProductUpdateInput,
  SalesmanCreateInput,
  ServiceAreaCreateInput,
  ServiceAreaUpdateInput,
  ServiceabilityRuleCreateInput,
  ServiceabilityRuleUpdateInput,
  SettingUpsertInput,
  SkuCreateInput,
  SkuUpdateInput,
  WarehouseCreateInput,
  WarehouseUpdateInput,
} from '@groaurum/validation';
import { MemoryCache } from '../../cache/memory-cache';
import {
  createCategoriesRepository,
  createPricesRepository,
  createProductsRepository,
  createSkusRepository,
} from './catalogue-repositories';
import {
  createCustomersRepository,
  createDeliveryRepository,
  createInventoryRepository,
  createOrdersRepository,
  createSalesmenRepository,
  createSettingsRepository,
  type SettingRecord,
} from './ops-repositories';
import {
  createServiceAreasRepository,
  createServiceabilityRulesRepository,
  createOperationalLocationsRepository,
} from './territory-repositories';
import {
  createDataError,
  createNoopRealtimeBus,
  createSupabaseRealtimeBus,
} from '@groaurum/data';

export type DomainCrudRepositories = {
  products: CrudRepository<
    Product,
    Product,
    ProductCreateInput,
    ProductUpdateInput
  >;
  categories: CrudRepository<
    Category,
    Category,
    CategoryCreateInput,
    CategoryUpdateInput
  > & {
    ensureByName(name: string, isActive?: boolean): Promise<Category>;
  };
  skus: CrudRepository<Sku, Sku, SkuCreateInput, SkuUpdateInput>;
  prices: CrudRepository<
    SkuPrice,
    SkuPrice,
    PriceCreateInput,
    Partial<PriceCreateInput>
  >;
  inventory: CrudRepository<
    InventoryBalance,
    InventoryBalance,
    InventoryAdjustInput,
    InventoryAdjustInput
  >;
  customers: CrudRepository<
    Shop,
    Shop,
    CustomerCreateInput,
    CustomerUpdateInput
  >;
  orders: CrudRepository<
    Order,
    Order,
    OrderCreateInput,
    { status?: Order['status'] }
  >;
  salesmen: CrudRepository<
    StaffProfile,
    StaffProfile,
    SalesmanCreateInput,
    Partial<SalesmanCreateInput>
  >;
  delivery: CrudRepository<
    DeliveryRoute,
    DeliveryRoute,
    DeliveryRouteCreateInput,
    DeliveryRouteUpdateInput
  >;
  settings: CrudRepository<
    SettingRecord,
    SettingRecord,
    SettingUpsertInput,
    SettingUpsertInput
  >;
  serviceAreas: CrudRepository<
    ServiceArea,
    ServiceArea,
    ServiceAreaCreateInput,
    ServiceAreaUpdateInput
  >;
  serviceabilityRules: CrudRepository<
    ServiceabilityRule,
    ServiceabilityRule,
    ServiceabilityRuleCreateInput,
    ServiceabilityRuleUpdateInput
  >;
  operationalLocations: CrudRepository<
    OperationalLocation,
    OperationalLocation,
    WarehouseCreateInput,
    WarehouseUpdateInput
  >;
  reports: ReadRepository<SettingRecord, SettingRecord>;
  dashboard: ReadRepository<SettingRecord, SettingRecord>;
};

function createPlaceholderReadRepository(
  entity: 'reports' | 'dashboard',
): ReadRepository<SettingRecord, SettingRecord> {
  const realtime = createNoopRealtimeBus();
  const unavailable = async (): Promise<never> => {
    throw createDataError(
      'adapter_unavailable',
      `${entity} snapshot is served from reports_snapshot / settings after seed; use getSnapshot helpers.`,
    );
  };
  return {
    list: () => unavailable(),
    getById: () => unavailable(),
    search: () => unavailable(),
    subscribe(listener) {
      return realtime.subscribe(entity, (event) => {
        listener({
          type: event.type === 'INVALIDATE' ? 'INVALIDATE' : event.type,
          entity,
          id: event.id,
          at: event.at,
        });
      });
    },
  };
}

/**
 * Real Supabase repositories — replaces Sprint 3 stubs.
 * Sprint 9: attaches a live RealtimeBus for order/inventory/delivery invalidation.
 */
export function createSupabaseDomainRepositories(
  client: GroAurumSupabaseClient,
  cache: MemoryCache = new MemoryCache(),
): DomainCrudRepositories {
  const realtime = createSupabaseRealtimeBus(client as never);

  return {
    categories: createCategoriesRepository(client, cache),
    products: createProductsRepository(client, cache),
    skus: createSkusRepository(client, cache),
    prices: createPricesRepository(client, cache),
    inventory: createInventoryRepository(client, cache, realtime),
    customers: createCustomersRepository(client, cache),
    orders: createOrdersRepository(client, cache, realtime),
    salesmen: createSalesmenRepository(client, cache),
    delivery: createDeliveryRepository(client, cache, realtime),
    settings: createSettingsRepository(client, cache),
    serviceAreas: createServiceAreasRepository(client, cache),
    serviceabilityRules: createServiceabilityRulesRepository(client, cache),
    operationalLocations: createOperationalLocationsRepository(client, cache),
    reports: createPlaceholderReadRepository('reports'),
    dashboard: createPlaceholderReadRepository('dashboard'),
  };
}

/** Sprint 9 helper: live realtime bus for apps to wire into React Query invalidation. */
export function createDomainRealtimeBus(client: GroAurumSupabaseClient) {
  return createSupabaseRealtimeBus(client as never);
}
