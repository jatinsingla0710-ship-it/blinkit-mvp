import { useMemo } from 'react';
import {
  canAccessModule,
  userHasAnyRole,
  userHasPermission,
  userHasRole,
} from '../helpers';
import type { AdminModule, Permission } from '../permissions';
import type { AppRole } from '../roles';
import { useCurrentUser } from './hooks';

export function usePermissions() {
  const user = useCurrentUser();

  return useMemo(
    () => ({
      user,
      hasPermission: (permission: Permission) =>
        userHasPermission(user, permission),
      hasRole: (role: AppRole) => userHasRole(user, role),
      hasAnyRole: (roles: readonly AppRole[]) => userHasAnyRole(user, roles),
      canAccessModule: (module: AdminModule) => canAccessModule(user, module),
    }),
    [user],
  );
}
