export interface ListOptions {
  signal?: AbortSignal;
}

export interface SearchOptions extends ListOptions {
  query: string;
}

/**
 * Read repository contract (list / get / search / subscribe).
 * Write methods live on CrudRepository (Sprint 4).
 */
export interface ReadRepository<TList, TDetail, TSearch = string> {
  list(options?: ListOptions): Promise<readonly TList[]>;
  getById(id: string, options?: ListOptions): Promise<TDetail | null>;
  search(query: TSearch, options?: ListOptions): Promise<readonly TList[]>;
  /**
   * Realtime hook point. Sprint 4: interface ready; adapters may still no-op.
   * Live channel wiring is deferred — subscribe must not break reads.
   */
  subscribe(
    listener: (event: {
      type: 'INVALIDATE' | 'INSERT' | 'UPDATE' | 'DELETE';
      entity: string;
      id?: string;
      at: string;
    }) => void,
  ): () => void;
}

export type EntityName =
  | 'products'
  | 'categories'
  | 'skus'
  | 'prices'
  | 'inventory'
  | 'customers'
  | 'orders'
  | 'salesmen'
  | 'delivery'
  | 'service_areas'
  | 'serviceability_rules'
  | 'operational_locations'
  | 'reports'
  | 'settings'
  | 'dashboard';
