/** Throw PostgREST / RPC errors as Error so formatMutationError works. */
export function throwRpcError(
  error: unknown,
  fallback = 'Request failed',
): never {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : fallback;
  throw new Error(message);
}
