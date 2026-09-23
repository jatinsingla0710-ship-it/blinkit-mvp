import type { ReactNode } from 'react';
import type { AppAudience } from '../roles';
import { resolveAppDestination } from '../helpers';
import { useAuthSession } from './hooks';

type Props = {
  /** Audience this application shell serves. */
  audience: AppAudience;
  children: ReactNode;
  /** Shown while session bootstraps. */
  loadingFallback?: ReactNode;
  /** Shown when there is no session. */
  unauthorizedFallback?: ReactNode;
  /**
   * Shown when the user is authenticated for a different product surface
   * (e.g. retail customer hitting Admin ERP).
   */
  wrongAudienceFallback?: ReactNode;
  /** Shown for session_expired / unexpected auth errors. */
  errorFallback?: ReactNode;
};

/**
 * Route-level gate: requires an authenticated session for this audience.
 * No login UI in Sprint 2 — consumers supply fallbacks.
 */
export function ProtectedRoute({
  audience,
  children,
  loadingFallback = null,
  unauthorizedFallback = null,
  wrongAudienceFallback = null,
  errorFallback = null,
}: Props) {
  const { status, session, error, isSessionLoading } = useAuthSession();

  if (isSessionLoading || status === 'loading') {
    return <>{loadingFallback}</>;
  }

  if (status === 'error') {
    if (error?.code === 'session_expired') {
      return <>{errorFallback ?? unauthorizedFallback}</>;
    }
    return <>{errorFallback ?? unauthorizedFallback}</>;
  }

  if (!session || status === 'unauthenticated') {
    return <>{unauthorizedFallback}</>;
  }

  const destination = resolveAppDestination(session);
  if (destination && destination !== audience) {
    return <>{wrongAudienceFallback ?? unauthorizedFallback}</>;
  }

  return <>{children}</>;
}
