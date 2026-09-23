import type { ReactNode } from 'react';
import type { AuthError, AuthErrorCode } from '../types';

const DEFAULT_COPY: Record<AuthErrorCode, { title: string; detail: string }> = {
  unauthorized: {
    title: 'Unauthorized',
    detail: 'Sign in to continue.',
  },
  forbidden: {
    title: 'Forbidden',
    detail: 'You do not have permission to view this area.',
  },
  session_expired: {
    title: 'Session expired',
    detail: 'Your session expired. Sign in again to continue.',
  },
  offline: {
    title: 'Offline',
    detail: 'Network unavailable. Check your connection and retry.',
  },
  unexpected: {
    title: 'Unexpected error',
    detail: 'Something went wrong. Try again or contact support.',
  },
};

type AuthErrorViewProps = {
  code?: AuthErrorCode;
  error?: AuthError | null;
  title?: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
};

/** Presentational auth/error panel — not a routed login screen. */
export function AuthErrorView({
  code = 'unexpected',
  error,
  title,
  detail,
  action,
  className,
}: AuthErrorViewProps) {
  const resolved = error?.code ?? code;
  const copy = DEFAULT_COPY[resolved];
  return (
    <div className={className} role="alert" data-auth-error={resolved}>
      <h1>{title ?? copy.title}</h1>
      <p>{detail ?? error?.message ?? copy.detail}</p>
      {action}
    </div>
  );
}

type LoadingViewProps = {
  label?: string;
  className?: string;
};

export function AuthLoadingView({
  label = 'Loading session…',
  className,
}: LoadingViewProps) {
  return (
    <div className={className} role="status" aria-live="polite" data-auth-loading>
      <p>{label}</p>
    </div>
  );
}

type RouteLoadingViewProps = {
  label?: string;
  className?: string;
};

export function RouteLoadingView({
  label = 'Loading…',
  className,
}: RouteLoadingViewProps) {
  return (
    <div className={className} role="status" aria-live="polite" data-route-loading>
      <p>{label}</p>
    </div>
  );
}
