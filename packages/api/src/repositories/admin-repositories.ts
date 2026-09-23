import type { ReadRepository } from '@groaurum/data';

/**
 * Admin ERP repository surface.
 * Detail/list types are parameterized by the host app (admin-web view models).
 */
export interface AdminRepositories<TMap extends AdminEntityMap = AdminEntityMap> {
  products: ReadRepository<TMap['products']['list'], TMap['products']['detail']>;
  categories: ReadRepository<
    TMap['categories']['list'],
    TMap['categories']['detail']
  >;
  skus: ReadRepository<TMap['skus']['list'], TMap['skus']['detail']>;
  prices: ReadRepository<TMap['prices']['list'], TMap['prices']['detail']>;
  inventory: ReadRepository<
    TMap['inventory']['list'],
    TMap['inventory']['detail']
  >;
  customers: ReadRepository<
    TMap['customers']['list'],
    TMap['customers']['detail']
  >;
  orders: ReadRepository<TMap['orders']['list'], TMap['orders']['detail']>;
  salesmen: ReadRepository<TMap['salesmen']['list'], TMap['salesmen']['detail']>;
  delivery: ReadRepository<TMap['delivery']['list'], TMap['delivery']['detail']>;
  reports: ReadRepository<TMap['reports']['list'], TMap['reports']['detail']>;
  settings: ReadRepository<TMap['settings']['list'], TMap['settings']['detail']>;
  dashboard: ReadRepository<
    TMap['dashboard']['list'],
    TMap['dashboard']['detail']
  >;
  serviceAreas: ReadRepository<
    TMap['serviceAreas']['list'],
    TMap['serviceAreas']['detail']
  >;
  warehouses: ReadRepository<
    TMap['warehouses']['list'],
    TMap['warehouses']['detail']
  >;
}

export type EntityPair<TList, TDetail> = {
  list: TList;
  detail: TDetail;
};

/** Default opaque map — host apps specialize with concrete view models. */
export type AdminEntityMap = {
  products: EntityPair<unknown, unknown>;
  categories: EntityPair<unknown, unknown>;
  skus: EntityPair<unknown, unknown>;
  prices: EntityPair<unknown, unknown>;
  inventory: EntityPair<unknown, unknown>;
  customers: EntityPair<unknown, unknown>;
  orders: EntityPair<unknown, unknown>;
  salesmen: EntityPair<unknown, unknown>;
  delivery: EntityPair<unknown, unknown>;
  reports: EntityPair<unknown, unknown>;
  settings: EntityPair<unknown, unknown>;
  dashboard: EntityPair<unknown, unknown>;
  serviceAreas: EntityPair<unknown, unknown>;
  warehouses: EntityPair<unknown, unknown>;
};
