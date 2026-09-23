import {
  MODULE_ALLOWED_ROLES,
  ROLE_PERMISSIONS,
  type AdminModule,
  type Permission,
} from './permissions';
import { audienceForRole, type AppAudience, type AppRole } from './roles';
import type { AuthSession, AuthUser, PermissionCheckInput } from './types';

export function userHasRole(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  role: AppRole,
): boolean {
  return Boolean(user?.roles.includes(role));
}

export function userHasAnyRole(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  roles: readonly AppRole[],
): boolean {
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}

export function roleHasPermission(
  role: AppRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasPermission({
  roles,
  permission,
}: PermissionCheckInput): boolean {
  return roles.some((role) => roleHasPermission(role, permission));
}

export function userHasPermission(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return hasPermission({ roles: user.roles, permission });
}

export function canAccessModule(
  user: Pick<AuthUser, 'roles'> | null | undefined,
  module: AdminModule,
): boolean {
  if (!user) return false;
  const allowed = MODULE_ALLOWED_ROLES[module];
  return userHasAnyRole(user, allowed);
}

export function resolveNavigationAudience(
  user: Pick<AuthUser, 'primaryRole'> | null | undefined,
): AppAudience | null {
  if (!user) return null;
  return audienceForRole(user.primaryRole);
}

/** Destination app for a signed-in user (navigation guard helper). */
export function resolveAppDestination(
  session: AuthSession | null,
): AppAudience | null {
  if (!session) return null;
  return session.audience;
}

export function isSessionExpired(
  session: AuthSession | null,
  now: Date = new Date(),
): boolean {
  if (!session?.expiresAt) return false;
  return new Date(session.expiresAt).getTime() <= now.getTime();
}
