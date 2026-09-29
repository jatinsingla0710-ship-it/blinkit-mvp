import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { errorMessage } from '@/lib/errors';

function errorText(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return '';
}

/** Hosted databases without the Phase 5 columns should not lock the salesman out. */
function profileSetupSchemaMissing(error: unknown): boolean {
  return /preferred_language|profile_setup_completed_at|avatar_path|schema cache|42703/i.test(
    errorText(error),
  );
}

export function SetupGate() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthSession();
  const profileId = user?.id ?? '';
  const profile = useQuery({
    queryKey: ['sales', 'profile', profileId],
    queryFn: () => api.getOwnProfile(),
    enabled: Boolean(profileId),
  });

  if (!profileId || profile.isLoading) {
    return <LoadingState label="Loading your profile…" rows={2} />;
  }

  if (profile.isError && profileSetupSchemaMissing(profile.error)) {
    return <ScreenOutlet />;
  }

  if (profile.isError) {
    return (
      <div className="ga-sales-stack">
        <ErrorState
          message={errorText(profile.error) || errorMessage(profile.error, 'Could not load your profile.')}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void signOut().finally(() => navigate('/login', { replace: true }));
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  const needsSetup = !profile.data?.setupCompletedAt;
  if (needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  if (!needsSetup && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }
  return <ScreenOutlet />;
}

function ScreenOutlet() {
  return (
    <Suspense
      fallback={
        <p className="ga-sales-muted" role="status">
          Loading…
        </p>
      }
    >
      <Outlet />
    </Suspense>
  );
}
