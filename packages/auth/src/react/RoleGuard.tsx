import type { ReactNode } from 'react';
import { canAccessModule, userHasAnyRole } from '../helpers';
import type { AdminModule } from '../permissions';
import type { AppRole } from '../roles';
import { useCurrentUser } from './hooks';

type Props = {
  /** Explicit allow-list. */
  roles?: readonly AppRole[];
  /** Or declare an admin module (uses MODULE_ALLOWED_ROLES). */
  module?: AdminModule;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Capability gate inside an authenticated shell.
 * Prefer `module` for admin ERP routes so allow-lists stay centralized.
 */
export function RoleGuard({ roles, module, children, fallback = null }: Props) {
  const user = useCurrentUser();

  if (!user) {
    return <>{fallback}</>;
  }

  const allowed = module
    ? canAccessModule(user, module)
    : roles
      ? userHasAnyRole(user, roles)
      : false;

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
