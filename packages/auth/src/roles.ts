/**
 * Application roles for GroAurum RBAC.
 * Finer-grained than DB staff_role; map to Supabase claims later.
 */

export const APP_ROLES = [
  'super_admin',
  'operations_manager',
  'warehouse_manager',
  'sales_manager',
  'delivery_manager',
  'salesman',
  'delivery_executive',
  'retail_customer',
  'read_only',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Coarse audience / client surface. */
export const APP_AUDIENCES = [
  'admin_erp',
  'customer_app',
  'sales_pwa',
  'delivery_pwa',
] as const;

export type AppAudience = (typeof APP_AUDIENCES)[number];

export const ADMIN_ROLES: readonly AppRole[] = [
  'super_admin',
  'operations_manager',
  'warehouse_manager',
  'sales_manager',
  'delivery_manager',
  'read_only',
] as const;

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function audienceForRole(role: AppRole): AppAudience {
  switch (role) {
    case 'retail_customer':
      return 'customer_app';
    case 'salesman':
      return 'sales_pwa';
    case 'delivery_executive':
      return 'delivery_pwa';
    default:
      return 'admin_erp';
  }
}

export function isAdminRole(role: AppRole): boolean {
  return ADMIN_ROLES.includes(role);
}
