import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AdminModule } from '@groaurum/auth';
import { ProtectedRoute, RoleGuard } from '@groaurum/auth/react';
import { AuthFoundationViews } from '@/auth/AuthFoundationViews';

type ProtectedAdminProps = {
  children: ReactNode;
};

function LoginRedirect({ reason }: { reason?: string }) {
  const location = useLocation();
  return (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname, authError: reason }}
    />
  );
}

/** Requires authenticated admin_erp audience; otherwise redirect to /login. */
export function ProtectedAdminRoute({ children }: ProtectedAdminProps) {
  return (
    <ProtectedRoute
      audience="admin_erp"
      loadingFallback={<AuthFoundationViews.SessionLoading />}
      unauthorizedFallback={<LoginRedirect />}
      wrongAudienceFallback={<AuthFoundationViews.WrongAudience />}
      errorFallback={<LoginRedirect reason="Session error — please sign in again." />}
    >
      {children}
    </ProtectedRoute>
  );
}

type ModuleGuardProps = {
  module: AdminModule;
  children: ReactNode;
};

/** Declares allowed roles for an admin module route. */
export function AdminModuleGuard({ module, children }: ModuleGuardProps) {
  return (
    <RoleGuard
      module={module}
      fallback={<AuthFoundationViews.Forbidden module={module} />}
    >
      {children}
    </RoleGuard>
  );
}
