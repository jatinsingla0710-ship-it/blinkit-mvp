export type {
  DataAdapterMode,
  AdminEntitySources,
  CreateAdminRepositoriesOptions,
  AdminRepositoriesBundle,
} from './adapters/create-admin-repositories';
export { createAdminRepositories } from './adapters/create-admin-repositories';

export { MemoryCache } from './cache/memory-cache';

export {
  createMockReadRepository,
  createSupabaseReadRepositoryStub,
  type EntitySource,
} from './repositories/create-read-repository';

export type {
  AdminRepositories,
  AdminEntityMap,
  EntityPair,
} from './repositories/admin-repositories';

export {
  createSupabaseDomainRepositories,
  createDomainRealtimeBus,
  type DomainCrudRepositories,
} from './repositories/supabase/create-supabase-domain-repositories';

export {
  createCategoriesRepository,
  createProductsRepository,
  createSkusRepository,
  createPricesRepository,
} from './repositories/supabase/catalogue-repositories';

export {
  createCustomersRepository,
  createInventoryRepository,
  createOrdersRepository,
  createSalesmenRepository,
  createDeliveryRepository,
  createSettingsRepository,
  type SettingRecord,
} from './repositories/supabase/ops-repositories';

export {
  createServiceAreasRepository,
  createServiceabilityRulesRepository,
  createOperationalLocationsRepository,
  mapOperationalLocationRow,
} from './repositories/supabase/territory-repositories';

export { AdminDataService } from './services/admin-data-service';
export { CrudServices, createCrudServices } from './services/crud-services';
export {
  planInventoryAdjustment,
  type InventoryAdjustmentPlan,
} from './services/inventory-adjustment';

/** Implemented mutation hook names (Sprint 4). */
export type MutationHookNames =
  | 'useCreateProductMutation'
  | 'useUpdateProductMutation'
  | 'useSoftDeleteProductMutation'
  | 'useCreateCategoryMutation'
  | 'useUpdateCategoryMutation'
  | 'useCreatePriceMutation'
  | 'useUpdateInventoryMutation'
  | 'useCreateCustomerMutation'
  | 'useUpdateCustomerMutation'
  | 'useCreateOrderMutation'
  | 'useCreateSalesmanMutation'
  | 'useCreateDeliveryRouteMutation'
  | 'useUpsertSettingMutation';
