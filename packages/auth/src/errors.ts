import type { AuthError, AuthErrorCode } from './types';

export function createAuthError(
  code: AuthErrorCode,
  message: string,
  cause?: unknown,
): AuthError {
  return { code, message, cause };
}
