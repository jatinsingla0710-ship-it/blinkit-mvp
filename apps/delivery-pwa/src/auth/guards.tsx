import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleGuard, useAuthSession } from '@groaurum/auth/react';
import { Card, EmptyState, PageHeader } from '@groaurum/ui';

function AuthShell({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="ga-delivery-auth">
      <PageHeader title={title} subtitle="GroAurum Delivery" />
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
      detail="Restoring your GroAurum Delivery session…"
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

function ForbiddenDeliveryRole() {
  return (
    <AuthShell
      title="Forbidden"
      detail="This app requires a delivery executive role."
    />
  );
}

type ProtectedDeliveryProps = {
  children: ReactNode;
};

/** Requires authenticated delivery_pwa session with delivery_executive role. */
export function ProtectedDeliveryRoute({ children }: ProtectedDeliveryProps) {
  return (
    <ProtectedRoute
      audience="delivery_pwa"
      loadingFallback={<SessionLoading />}
      unauthorizedFallback={<Navigate to="/login" replace />}
      wrongAudienceFallback={<WrongAudience />}
      errorFallback={<AuthError />}
    >
      <RoleGuard roles={['delivery_executive']} fallback={<ForbiddenDeliveryRole />}>
        {children}
      </RoleGuard>
    </ProtectedRoute>
  );
}
