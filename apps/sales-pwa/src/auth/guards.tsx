import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleGuard, useAuthSession } from '@groaurum/auth/react';
import { Card, EmptyState, PageHeader } from '@groaurum/ui';

function AuthShell({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="ga-sales-auth">
      <PageHeader title={title} subtitle="GroAurum Sales" />
      <Card>
        <EmptyState title={title} detail={detail} />
      </Card>
    </div>
  );
}

function SessionLoading() {
  return (
    <AuthShell
      title="Loading session"
      detail="Restoring your GroAurum Sales session…"
    />
  );
}

function WrongAudience() {
  const { session } = useAuthSession();
  const audience = session?.audience ?? 'unknown';
  return (
    <AuthShell
      title="Wrong application"
      detail={`This account belongs on ${audience.replace(/_/g, ' ')}. Open the correct GroAurum client.`}
    />
  );
}

function AuthError() {
  const { error } = useAuthSession();
  return (
    <AuthShell
      title={error?.code === 'session_expired' ? 'Session expired' : 'Auth error'}
      detail={
        error?.message ??
        'Unexpected authentication error. Retry or check your credentials.'
      }
    />
  );
}

function ForbiddenSalesRole() {
  return (
    <AuthShell
      title="Forbidden"
      detail="This app requires a salesman role."
    />
  );
}

type ProtectedSalesProps = {
  children: ReactNode;
};

/** Requires authenticated sales_pwa session with salesman role. */
export function ProtectedSalesRoute({ children }: ProtectedSalesProps) {
  return (
    <ProtectedRoute
      audience="sales_pwa"
      loadingFallback={<SessionLoading />}
      unauthorizedFallback={<Navigate to="/login" replace />}
      wrongAudienceFallback={<WrongAudience />}
      errorFallback={<AuthError />}
    >
      <RoleGuard roles={['salesman']} fallback={<ForbiddenSalesRole />}>
        {children}
      </RoleGuard>
    </ProtectedRoute>
  );
}
