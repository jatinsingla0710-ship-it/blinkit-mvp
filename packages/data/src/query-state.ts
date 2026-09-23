/** Shared read/query infrastructure for GroAurum data access. */

export type QueryStatus = 'loading' | 'empty' | 'error' | 'success';

export type DataErrorCode =
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'offline'
  | 'timeout'
  | 'adapter_unavailable'
  | 'unexpected';

export interface DataError {
  code: DataErrorCode;
  message: string;
  cause?: unknown;
}

export function createDataError(
  code: DataErrorCode,
  message: string,
  cause?: unknown,
): DataError {
  return { code, message, cause };
}

export function isDataError(value: unknown): value is DataError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

export interface QueryState<T> {
  status: QueryStatus;
  data: T | null;
  error: DataError | null;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export function toQueryState<T>(input: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | null | undefined;
  isEmpty?: (data: T) => boolean;
}): QueryState<T> {
  if (input.isPending) {
    return {
      status: 'loading',
      data: null,
      error: null,
      isLoading: true,
      isEmpty: false,
      isError: false,
      isSuccess: false,
    };
  }

  if (input.isError) {
    const error = isDataError(input.error)
      ? input.error
      : createDataError(
          'unexpected',
          input.error instanceof Error
            ? input.error.message
            : 'Unexpected data error',
          input.error,
        );
    return {
      status: 'error',
      data: null,
      error,
      isLoading: false,
      isEmpty: false,
      isError: true,
      isSuccess: false,
    };
  }

  const data = (input.data ?? null) as T | null;
  const empty =
    data === null ||
    (input.isEmpty ? input.isEmpty(data) : Array.isArray(data) && data.length === 0);

  if (empty) {
    return {
      status: 'empty',
      data,
      error: null,
      isLoading: false,
      isEmpty: true,
      isError: false,
      isSuccess: true,
    };
  }

  return {
    status: 'success',
    data,
    error: null,
    isLoading: false,
    isEmpty: false,
    isError: false,
    isSuccess: true,
  };
}
