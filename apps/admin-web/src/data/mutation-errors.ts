import { ZodError } from 'zod';
import { isDataError } from '@groaurum/data';

export function formatMutationError(
  error: unknown,
  fallback = 'Request failed',
): string {
  if (isDataError(error)) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Invalid input';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
