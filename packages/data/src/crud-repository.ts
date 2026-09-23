/**
 * Read + write repository contract for production CRUD.
 * Extends Sprint 3 ReadRepository; mutations are soft-delete aware.
 */
import type { ListOptions, ReadRepository } from './repository';

export interface CrudRepository<
  TList,
  TDetail,
  TCreate = unknown,
  TUpdate = Partial<TCreate>,
> extends ReadRepository<TList, TDetail> {
  create(input: TCreate, options?: ListOptions): Promise<TDetail>;
  update(id: string, input: TUpdate, options?: ListOptions): Promise<TDetail>;
  softDelete(id: string, options?: ListOptions): Promise<void>;
}
