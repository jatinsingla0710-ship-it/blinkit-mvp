import {
  ADMIN_MODULES,
  MODULE_ALLOWED_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type AdminModule,
  type Permission,
} from './permissions';
import { APP_ROLES, type AppRole } from './roles';
import {
  isFrontendOnlyAppRole,
  isLiveMappedAppRole,
  staffRolesForAppRole,
  type LiveStaffRole,
} from './staff-role-map';

export type RoleSourceKind = 'live_supabase' | 'frontend_only';

export type RoleMatrixRow = {
  role: AppRole;
  source: RoleSourceKind;
  /** Matching public.staff_role values when source is live_supabase. */
  staffRoles: readonly LiveStaffRole[];
  permissions: readonly Permission[];
  modules: readonly AdminModule[];
};

export type RolePermissionMatrix = {
  /** Honest product copy for the Admin Settings Roles tab. */
  notice: string;
  roles: readonly RoleMatrixRow[];
  permissions: readonly Permission[];
  modules: readonly AdminModule[];
};

const MATRIX_NOTICE =
  'This matrix is the current Admin RBAC source of truth (AppRole + ROLE_PERMISSIONS + MODULE_ALLOWED_ROLES). Live Supabase only stores coarse staff_role values (ADMIN, SALESMAN, DELIVERY, CUSTOMER, READ_ONLY). Manager roles such as operations_manager exist in the frontend model and mock auth only — they cannot be assigned or persisted yet. Role create/edit/delete is not available.';

function modulesForRole(role: AppRole): AdminModule[] {
  return ADMIN_MODULES.filter((module) =>
    MODULE_ALLOWED_ROLES[module].includes(role),
  );
}

export function buildRolePermissionMatrix(): RolePermissionMatrix {
  const roles: RoleMatrixRow[] = APP_ROLES.map((role) => {
    const live = isLiveMappedAppRole(role);
    return {
      role,
      source: live ? 'live_supabase' : 'frontend_only',
      staffRoles: live ? staffRolesForAppRole(role) : [],
      permissions: ROLE_PERMISSIONS[role],
      modules: modulesForRole(role),
    };
  });

  return {
    notice: MATRIX_NOTICE,
    roles,
    permissions: PERMISSIONS,
    modules: ADMIN_MODULES,
  };
}

export function roleHasModuleAccess(
  role: AppRole,
  module: AdminModule,
): boolean {
  return MODULE_ALLOWED_ROLES[module].includes(role);
}

export function assertRoleMatrixCoversAppRoles(
  matrix: RolePermissionMatrix = buildRolePermissionMatrix(),
): void {
  const covered = new Set(matrix.roles.map((row) => row.role));
  for (const role of APP_ROLES) {
    if (!covered.has(role)) {
      throw new Error(`Role matrix missing AppRole: ${role}`);
    }
  }
  for (const row of matrix.roles) {
    if (row.source === 'frontend_only' && !isFrontendOnlyAppRole(row.role)) {
      throw new Error(`Unexpected frontend_only classification: ${row.role}`);
    }
    if (row.source === 'live_supabase' && !isLiveMappedAppRole(row.role)) {
      throw new Error(`Unexpected live_supabase classification: ${row.role}`);
    }
  }
}
