import { describe, expect, it } from 'vitest';
import {
  APP_ROLES,
  FRONTEND_ONLY_APP_ROLES,
  LIVE_MAPPED_APP_ROLES,
  LIVE_STAFF_ROLES,
  MODULE_ALLOWED_ROLES,
  ROLE_PERMISSIONS,
  STAFF_ROLE_TO_APP_ROLE,
  assertRoleMatrixCoversAppRoles,
  buildRolePermissionMatrix,
  canAccessModule,
  hasPermission,
  roleHasModuleAccess,
} from './index';

describe('role permission matrix', () => {
  it('covers every AppRole exactly once', () => {
    const matrix = buildRolePermissionMatrix();
    expect(matrix.roles).toHaveLength(APP_ROLES.length);
    expect(() => assertRoleMatrixCoversAppRoles(matrix)).not.toThrow();
  });

  it('marks live Supabase roles and frontend-only manager roles distinctly', () => {
    const matrix = buildRolePermissionMatrix();
    const byRole = Object.fromEntries(
      matrix.roles.map((row) => [row.role, row]),
    );

    expect(byRole.super_admin.source).toBe('live_supabase');
    expect(byRole.super_admin.staffRoles).toEqual(['ADMIN']);
    expect(byRole.read_only.staffRoles).toEqual(['READ_ONLY']);
    expect(byRole.operations_manager.source).toBe('frontend_only');
    expect(byRole.warehouse_manager.staffRoles).toEqual([]);
    expect(byRole.sales_manager.source).toBe('frontend_only');
    expect(byRole.delivery_manager.source).toBe('frontend_only');
  });

  it('maps every live staff_role to a live AppRole', () => {
    const mapped = LIVE_STAFF_ROLES.map((role) => STAFF_ROLE_TO_APP_ROLE[role]);
    expect(new Set(mapped)).toEqual(new Set(LIVE_MAPPED_APP_ROLES));
    expect(FRONTEND_ONLY_APP_ROLES).toEqual([
      'operations_manager',
      'warehouse_manager',
      'sales_manager',
      'delivery_manager',
    ]);
  });

  it('uses ROLE_PERMISSIONS and MODULE_ALLOWED_ROLES as the matrix source of truth', () => {
    const matrix = buildRolePermissionMatrix();
    for (const row of matrix.roles) {
      expect(row.permissions).toEqual(ROLE_PERMISSIONS[row.role]);
      for (const module of row.modules) {
        expect(roleHasModuleAccess(row.role, module)).toBe(true);
        expect(MODULE_ALLOWED_ROLES[module]).toContain(row.role);
      }
    }
  });

  it('includes an honest notice that roles cannot be edited yet', () => {
    expect(buildRolePermissionMatrix().notice).toMatch(/cannot be assigned/i);
    expect(buildRolePermissionMatrix().notice).toMatch(/not available/i);
  });
});

describe('mutation gate permissions', () => {
  const managePermissions = [
    'products:manage',
    'orders:manage',
    'inventory:manage',
    'delivery:manage',
    'payments:manage',
    'customers:manage',
    'pricing:manage',
    'settings:manage',
  ] as const;

  it('denies all key Admin mutation permissions to read_only', () => {
    for (const permission of managePermissions) {
      expect(
        hasPermission({ roles: ['read_only'], permission }),
      ).toBe(false);
    }
  });

  it('grants key Admin mutation permissions to super_admin', () => {
    for (const permission of managePermissions) {
      expect(
        hasPermission({ roles: ['super_admin'], permission }),
      ).toBe(true);
    }
  });

  it('keeps settings module super_admin-only while ops has settings:view only', () => {
    expect(canAccessModule({ roles: ['operations_manager'] }, 'settings')).toBe(
      false,
    );
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'settings:view',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'settings:manage',
      }),
    ).toBe(false);
  });

  it('allows warehouse_manager inventory:manage but not products:manage', () => {
    expect(
      hasPermission({
        roles: ['warehouse_manager'],
        permission: 'inventory:manage',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['warehouse_manager'],
        permission: 'products:manage',
      }),
    ).toBe(false);
  });

  it('grants payments:view broadly and payments:manage only to ops settlement roles', () => {
    expect(
      hasPermission({ roles: ['read_only'], permission: 'payments:view' }),
    ).toBe(true);
    expect(
      hasPermission({ roles: ['read_only'], permission: 'payments:manage' }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['sales_manager'],
        permission: 'payments:view',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['sales_manager'],
        permission: 'payments:manage',
      }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['delivery_manager'],
        permission: 'payments:manage',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'payments:manage',
      }),
    ).toBe(true);
    expect(canAccessModule({ roles: ['read_only'] }, 'payments')).toBe(true);
  });
});
