import { expect } from 'vitest';

type SupabaseMutationResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

/**
 * PostgREST returns HTTP 200 with zero updated rows when RLS denies an UPDATE.
 * Assert the client mutation was blocked without relying on a non-null error.
 */
export async function expectRlsBlocksUpdate(
  run: () => PromiseLike<SupabaseMutationResult>,
): Promise<void> {
  const { data, error } = await run();
  expect(error).toBeNull();
  expect(data ?? []).toEqual([]);
}
