import type { AdminRepositories } from '../repositories/admin-repositories';
import { invalidation, type EntityName } from '@groaurum/data';
import type { MemoryCache } from '../cache/memory-cache';

/**
 * Service layer — orchestrates repositories and cache invalidation policy.
 * No mutations in Sprint 3; methods are read facades + invalidation hooks.
 */
export class AdminDataService<TRepos extends AdminRepositories = AdminRepositories> {
  constructor(
    readonly repositories: TRepos,
    private readonly cache?: MemoryCache,
  ) {}

  repo<K extends keyof TRepos>(name: K): TRepos[K] {
    return this.repositories[name];
  }

  /**
   * Prepared for future CRUD — call after mutations to drop adapter cache
   * and return TanStack query key prefixes for invalidation.
   */
  invalidate(entity: EntityName) {
    this.cache?.invalidate(`${entity}:`);
    return invalidation.entity(entity);
  }

  invalidateAll() {
    this.cache?.invalidate();
    return invalidation.all();
  }
}
