import {
  createDataError,
  createNoopRealtimeBus,
  type CrudRepository,
  type EntityName,
  type ListOptions,
  type RealtimeBus,
} from '@groaurum/data';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import { MemoryCache } from '../../cache/memory-cache';

type PostgrestErrorLike = { message: string; code?: string };

function mapError(entity: EntityName, error: PostgrestErrorLike): never {
  if (error.code === 'PGRST116') {
    throw createDataError('not_found', `${entity} not found`, error);
  }
  if (error.message.toLowerCase().includes('jwt') || error.code === '42501') {
    throw createDataError('unauthorized', error.message, error);
  }
  if (error.code === '23505') {
    const msg = error.message.toLowerCase();
    if (msg.includes('products_category_name_unique')) {
      throw createDataError(
        'unexpected',
        'A product with this name already exists in the selected category',
        error,
      );
    }
    if (msg.includes('categories_name_unique')) {
      throw createDataError(
        'unexpected',
        'A category with this name already exists',
        error,
      );
    }
  }
  throw createDataError('unexpected', error.message, error);
}

export type SupabaseCrudTableConfig<TRow, TList, TDetail, TCreate, TUpdate> = {
  client: GroAurumSupabaseClient;
  entity: EntityName;
  /** Physical table name in public schema. */
  table: string;
  cache?: MemoryCache;
  realtime?: RealtimeBus;
  mapList: (row: TRow) => TList;
  mapDetail: (row: TRow) => TDetail;
  toInsert: (input: TCreate) => Record<string, unknown>;
  toUpdate: (input: TUpdate) => Record<string, unknown>;
  /** Columns used for ilike search (OR). */
  searchColumns: readonly string[];
  idColumn?: string;
  softDelete?: boolean;
  /** When true, softDelete also sets is_active=false (catalogue/shops). */
  deactivateOnSoftDelete?: boolean;
};

/**
 * Generic Supabase table repository implementing CrudRepository.
 * subscribe() uses RealtimeBus (noop by default — live channels later).
 */
export function createSupabaseCrudRepository<
  TRow extends { id: string },
  TList,
  TDetail,
  TCreate,
  TUpdate,
>(
  config: SupabaseCrudTableConfig<TRow, TList, TDetail, TCreate, TUpdate>,
): CrudRepository<TList, TDetail, TCreate, TUpdate> {
  const cache = config.cache ?? new MemoryCache();
  const realtime = config.realtime ?? createNoopRealtimeBus();
  const idColumn = config.idColumn ?? 'id';
  const softDelete = config.softDelete !== false;
  const deactivateOnSoftDelete = config.deactivateOnSoftDelete !== false;

  const clearCache = () => cache.invalidate(`${config.entity}:`);

  const fromTable = () => config.client.from(config.table as 'categories');

  const asRows = (value: unknown): TRow[] => (value as unknown as TRow[]) ?? [];
  const asRow = (value: unknown): TRow => value as unknown as TRow;

  return {
    async list(options?: ListOptions) {
      assertNotAborted(options?.signal);
      const cacheKey = `${config.entity}:list`;
      const cached = cache.get<readonly TList[]>(cacheKey);
      if (cached) return cached;

      let query = fromTable().select('*');
      if (softDelete) {
        query = query.is('deleted_at', null);
      }
      query = query.order(idColumn, { ascending: true });

      const { data, error } = await query;
      if (error) mapError(config.entity, error);
      const rows = asRows(data).map(config.mapList);
      cache.set(cacheKey, rows);
      return rows;
    },

    async getById(id: string, options?: ListOptions) {
      assertNotAborted(options?.signal);
      const cacheKey = `${config.entity}:detail:${id}`;
      const cached = cache.get<TDetail | null>(cacheKey);
      if (cached !== undefined) return cached;

      let query = fromTable().select('*').eq(idColumn, id);
      if (softDelete) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query.maybeSingle();
      if (error) mapError(config.entity, error);
      const detail = data ? config.mapDetail(asRow(data)) : null;
      cache.set(cacheKey, detail);
      return detail;
    },

    async search(queryText: string, options?: ListOptions) {
      assertNotAborted(options?.signal);
      const q = queryText.trim();
      const cacheKey = `${config.entity}:search:${q.toLowerCase()}`;
      const cached = cache.get<readonly TList[]>(cacheKey);
      if (cached) return cached;

      if (!q) {
        return this.list(options);
      }

      const orFilter = config.searchColumns
        .map((col) => `${col}.ilike.%${q}%`)
        .join(',');

      let query = fromTable().select('*').or(orFilter);
      if (softDelete) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query;
      if (error) mapError(config.entity, error);
      const rows = asRows(data).map(config.mapList);
      cache.set(cacheKey, rows);
      return rows;
    },

    async create(input: TCreate, options?: ListOptions) {
      assertNotAborted(options?.signal);
      const { data, error } = await fromTable()
        .insert(config.toInsert(input) as never)
        .select('*')
        .single();
      if (error) mapError(config.entity, error);
      clearCache();
      const row = asRow(data);
      realtime.publish?.({
        type: 'INSERT',
        entity: config.entity,
        id: row.id,
        at: new Date().toISOString(),
      });
      return config.mapDetail(row);
    },

    async update(id: string, input: TUpdate, options?: ListOptions) {
      assertNotAborted(options?.signal);
      const { data, error } = await fromTable()
        .update(config.toUpdate(input) as never)
        .eq(idColumn, id)
        .select('*')
        .single();
      if (error) mapError(config.entity, error);
      clearCache();
      realtime.publish?.({
        type: 'UPDATE',
        entity: config.entity,
        id,
        at: new Date().toISOString(),
      });
      return config.mapDetail(asRow(data));
    },

    async softDelete(id: string, options?: ListOptions) {
      assertNotAborted(options?.signal);
      if (!softDelete) {
        throw createDataError(
          'unexpected',
          `softDelete is not supported for ${config.entity}`,
        );
      }
      const payload: Record<string, unknown> = {
        deleted_at: new Date().toISOString(),
      };
      if (deactivateOnSoftDelete) {
        payload.is_active = false;
      }
      const { error } = await fromTable()
        .update(payload as never)
        .eq(idColumn, id);
      if (error) mapError(config.entity, error);
      clearCache();
      realtime.publish?.({
        type: 'DELETE',
        entity: config.entity,
        id,
        at: new Date().toISOString(),
      });
    },

    subscribe(listener) {
      return realtime.subscribe(config.entity, (event) => {
        if (
          event.type === 'INVALIDATE' ||
          event.type === 'INSERT' ||
          event.type === 'UPDATE' ||
          event.type === 'DELETE'
        ) {
          clearCache();
          listener({
            type: event.type,
            entity: config.entity,
            id: event.id,
            at: event.at,
          });
        }
      });
    },
  };
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createDataError('timeout', 'Request aborted');
  }
}
