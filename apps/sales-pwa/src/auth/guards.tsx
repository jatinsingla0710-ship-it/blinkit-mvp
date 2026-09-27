import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ProtectedRoute, RoleGuard, useAuthSession } from '@groaurum/auth/react';
import { Button, Card, EmptyState, PageHeader } from '@groaurum/ui';

function AuthShell({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ga-sales-auth">
      <PageHeader title={title} subtitle="GroAurum Sales" />
      <Card>
        <EmptyState title={title} detail={detail} />
        {actions ? <div className="ga-sales-actions">{actions}</div> : null}
      </Card>
    </div>
  );
}

/** Way out of a blocked session: always ends on /login, even if sign-out fails. */
function SignOutActions({ onRetry }: { onRetry?: () => void }) {
  const { signOut } = useAuthSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Local session is cleared by the provider; still leave the blocked screen.
    } finally {
      setSigningOut(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <Button
        variant="primary"
        type="button"
        disabled={signingOut}
        onClick={() => {
          void onSignOut();
        }}
      >
        {signingOut ? 'Signing out…' : 'Sign out and go to login'}
      </Button>
      {onRetry ? (
        <Button variant="secondary" type="button" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </>
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

export function WrongAudience() {
  const { session } = useAuthSession();
  const audience = session?.audience ?? 'unknown';
  return (
    <AuthShell
      title="Wrong application"
      detail={`This account belongs on ${audience.replace(/_/g, ' ')}. Open the correct GroAurum client, or sign in with a salesman account.`}
      actions={<SignOutActions />}
    />
  );
}

export function AuthError() {
  const { error } = useAuthSession();
  return (
    <AuthShell
      title={error?.code === 'session_expired' ? 'Session expired' : 'Auth error'}
      detail={
        error?.message ??
        'Unexpected authentication error. Retry or check your credentials.'
      }
      actions={<SignOutActions onRetry={() => window.location.reload()} />}
    />
  );
}

export function ForbiddenSalesRole() {
  return (
    <AuthShell
      title="Forbidden"
      detail="This app requires a salesman role. Sign in with a salesman account."
      actions={<SignOutActions />}
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
