/** Keys that must never be treated as fresh after localStorage hydrate. */
export const VOLATILE_SALES_QUERY_ROOTS = [
  'orderable-skus',
  'order-preview',
] as const;

export type PersistedQueryEntry = {
  queryKey: unknown[];
  data: unknown;
};

export function isVolatileSalesQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[0] !== 'sales') return false;
  const root = queryKey[1];
  return (
    typeof root === 'string' &&
    (VOLATILE_SALES_QUERY_ROOTS as readonly string[]).includes(root)
  );
}

/** Persist only durable sales queries — never catalogue or live price preview. */
export function shouldPersistSalesQuery(queryKey: readonly unknown[]): boolean {
  return Array.isArray(queryKey) && !isVolatileSalesQueryKey(queryKey);
}

/**
 * When hydrating from localStorage, volatile catalogue data must refetch.
 * Returning updatedAt: 0 marks the entry stale immediately under React Query.
 */
export function hydrateUpdatedAtForQueryKey(
  queryKey: readonly unknown[],
): number | undefined {
  return isVolatileSalesQueryKey(queryKey) ? 0 : undefined;
}
