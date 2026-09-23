import {
  createDataError,
  createNoopRealtimeBus,
  type EntityName,
  type ListOptions,
  type ReadRepository,
  type RealtimeBus,
} from '@groaurum/data';
import { MemoryCache } from '../cache/memory-cache';

export interface EntitySource<TList, TDetail> {
  list(): readonly TList[] | Promise<readonly TList[]>;
  getById(id: string): TDetail | null | Promise<TDetail | null>;
  search(query: string): readonly TList[] | Promise<readonly TList[]>;
}

async function resolve<T>(value: T | Promise<T>): Promise<T> {
  return value;
}

export function createMockReadRepository<TList, TDetail>(
  entity: EntityName,
  source: EntitySource<TList, TDetail>,
  options?: {
    cache?: MemoryCache;
    realtime?: RealtimeBus;
  },
): ReadRepository<TList, TDetail> {
  const cache = options?.cache ?? new MemoryCache();
  const realtime = options?.realtime ?? createNoopRealtimeBus();

  return {
    async list(listOptions?: ListOptions) {
      assertNotAborted(listOptions?.signal);
      const cacheKey = `${entity}:list`;
      const cached = cache.get<readonly TList[]>(cacheKey);
      if (cached) return cached;
      const rows = await resolve(source.list());
      cache.set(cacheKey, rows);
      return rows;
    },

    async getById(id: string, listOptions?: ListOptions) {
      assertNotAborted(listOptions?.signal);
      const cacheKey = `${entity}:detail:${id}`;
      const cached = cache.get<TDetail | null>(cacheKey);
      if (cached !== undefined) return cached;
      const row = await resolve(source.getById(id));
      cache.set(cacheKey, row);
      return row;
    },

    async search(query: string, listOptions?: ListOptions) {
      assertNotAborted(listOptions?.signal);
      const q = query.trim().toLowerCase();
      const cacheKey = `${entity}:search:${q}`;
      const cached = cache.get<readonly TList[]>(cacheKey);
      if (cached) return cached;
      const rows = q
        ? await resolve(source.search(q))
        : await resolve(source.list());
      cache.set(cacheKey, rows);
      return rows;
    },

    subscribe(listener) {
      return realtime.subscribe(entity, (event) => {
        if (event.type === 'INVALIDATE') {
          cache.invalidate(`${entity}:`);
          listener({
            type: 'INVALIDATE',
            entity,
            at: event.at,
          });
        }
      });
    },
  };
}

export function createSupabaseReadRepositoryStub<TList, TDetail>(
  entity: EntityName,
): ReadRepository<TList, TDetail> {
  const unavailable = async (): Promise<never> => {
    throw createDataError(
      'adapter_unavailable',
      `Supabase adapter for "${entity}" is not connected yet. Set DATA_ADAPTER=mock.`,
    );
  };

  return {
    list: () => unavailable(),
    getById: () => unavailable(),
    search: () => unavailable(),
    subscribe() {
      return () => undefined;
    },
  };
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createDataError('timeout', 'Request aborted');
  }
}
