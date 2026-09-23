import type { EntityName, ReadRepository } from '@groaurum/data';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import { MemoryCache } from '../cache/memory-cache';
import {
  createMockReadRepository,
  type EntitySource,
} from '../repositories/create-read-repository';
import type { AdminRepositories } from '../repositories/admin-repositories';
import {
  createSupabaseDomainRepositories,
  type DomainCrudRepositories,
} from '../repositories/supabase/create-supabase-domain-repositories';

export type DataAdapterMode = 'mock' | 'supabase';

export type AdminEntitySources<TRepos extends AdminRepositories> = {
  [K in keyof TRepos]: TRepos[K] extends ReadRepository<infer TList, infer TDetail>
    ? EntitySource<TList, TDetail>
    : never;
};

export type CreateAdminRepositoriesOptions<TRepos extends AdminRepositories> = {
  mode: DataAdapterMode;
  /**
   * View-model seed sources for admin pages.
   * Recommended even in supabase mode so UI keeps working without redesign
   * while domain CRUD hits the real database.
   */
  sources?: AdminEntitySources<TRepos>;
  cache?: MemoryCache;
  /** Required when mode === 'supabase'. */
  client?: GroAurumSupabaseClient;
};

export type AdminRepositoriesBundle<TRepos extends AdminRepositories> = {
  /** View-model repositories used by admin pages. */
  repositories: TRepos;
  /** Domain CRUD repositories (Supabase). Null in pure mock mode. */
  domain: DomainCrudRepositories | null;
};

function buildViewRepositories<TRepos extends AdminRepositories>(
  sources: AdminEntitySources<TRepos>,
  cache: MemoryCache,
): TRepos {
  const build = <TList, TDetail>(
    entity: EntityName,
    source: EntitySource<TList, TDetail>,
  ): ReadRepository<TList, TDetail> =>
    createMockReadRepository(entity, source, { cache });

  return {
    products: build('products', sources.products),
    categories: build('categories', sources.categories),
    skus: build('skus', sources.skus),
    prices: build('prices', sources.prices),
    inventory: build('inventory', sources.inventory),
    customers: build('customers', sources.customers),
    orders: build('orders', sources.orders),
    salesmen: build('salesmen', sources.salesmen),
    delivery: build('delivery', sources.delivery),
    reports: build('reports', sources.reports),
    settings: build('settings', sources.settings),
    dashboard: build('dashboard', sources.dashboard),
    serviceAreas: build('service_areas', sources.serviceAreas),
    warehouses: build('operational_locations', sources.warehouses),
  } as TRepos;
}

/**
 * Single adapter switch.
 * - mock: view-model repos from sources; domain=null
 * - supabase: real DomainCrudRepositories (+ optional view sources for UI)
 */
export function createAdminRepositories<TRepos extends AdminRepositories>(
  options: CreateAdminRepositoriesOptions<TRepos>,
): AdminRepositoriesBundle<TRepos> {
  const cache = options.cache ?? new MemoryCache();

  if (options.mode === 'supabase') {
    if (!options.client) {
      throw new Error('Supabase adapter requires a GroAurumSupabaseClient.');
    }
    const domain = createSupabaseDomainRepositories(options.client, cache);
    if (!options.sources) {
      // Domain repos satisfy CrudRepository; cast for host view-model typing.
      return {
        repositories: domain as unknown as TRepos,
        domain,
      };
    }
    return {
      repositories: buildViewRepositories(options.sources, cache),
      domain,
    };
  }

  if (!options.sources) {
    throw new Error('Mock adapter requires entity sources (seed data).');
  }

  return {
    repositories: buildViewRepositories(options.sources, cache),
    domain: null,
  };
}
