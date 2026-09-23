import type { EntityName } from './repository';

/**
 * Canonical TanStack Query key factory.
 * Invalidation should always go through these keys.
 */
export const queryKeys = {
  root: ['groaurum'] as const,
  entity: (entity: EntityName) => ['groaurum', entity] as const,
  list: (entity: EntityName, scope?: string) =>
    scope
      ? (['groaurum', entity, 'list', scope] as const)
      : (['groaurum', entity, 'list'] as const),
  detail: (entity: EntityName, id: string) =>
    ['groaurum', entity, 'detail', id] as const,
  search: (entity: EntityName, query: string) =>
    ['groaurum', entity, 'search', query] as const,
  snapshot: (entity: EntityName) =>
    ['groaurum', entity, 'snapshot'] as const,
} as const;

/** Helpers for broad invalidation after future mutations. */
export const invalidation = {
  entity: (entity: EntityName) => queryKeys.entity(entity),
  all: () => queryKeys.root,
};
