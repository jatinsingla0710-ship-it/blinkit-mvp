import type { AppRole } from './roles';

/**
 * Coarse roles stored on profiles.roles (public.staff_role).
 * These are the only roles Supabase auth can emit today.
 */
export const LIVE_STAFF_ROLES = [
  'ADMIN',
  'SALESMAN',
  'DELIVERY',
  'CUSTOMER',
  'READ_ONLY',
] as const;

export type LiveStaffRole = (typeof LIVE_STAFF_ROLES)[number];

/** AppRole produced from a live staff_role via mapStaffRolesToAppRoles. */
export const LIVE_MAPPED_APP_ROLES = [
  'super_admin',
  'salesman',
  'delivery_executive',
  'retail_customer',
  'read_only',
] as const satisfies readonly AppRole[];

export type LiveMappedAppRole = (typeof LIVE_MAPPED_APP_ROLES)[number];

/**
 * AppRoles that exist only in the frontend RBAC model / mock auth.
 * They are not values of public.staff_role and cannot be assigned in live Supabase yet.
 */
export const FRONTEND_ONLY_APP_ROLES = [
  'operations_manager',
  'warehouse_manager',
  'sales_manager',
  'delivery_manager',
] as const satisfies readonly AppRole[];

export type FrontendOnlyAppRole = (typeof FRONTEND_ONLY_APP_ROLES)[number];

export const STAFF_ROLE_TO_APP_ROLE: Record<LiveStaffRole, LiveMappedAppRole> = {
  ADMIN: 'super_admin',
  SALESMAN: 'salesman',
  DELIVERY: 'delivery_executive',
  CUSTOMER: 'retail_customer',
  READ_ONLY: 'read_only',
};

export function isLiveMappedAppRole(role: AppRole): role is LiveMappedAppRole {
  return (LIVE_MAPPED_APP_ROLES as readonly string[]).includes(role);
}

export function isFrontendOnlyAppRole(
  role: AppRole,
): role is FrontendOnlyAppRole {
  return (FRONTEND_ONLY_APP_ROLES as readonly string[]).includes(role);
}

export function staffRolesForAppRole(role: AppRole): readonly LiveStaffRole[] {
  return LIVE_STAFF_ROLES.filter(
    (staff) => STAFF_ROLE_TO_APP_ROLE[staff] === role,
  );
}
