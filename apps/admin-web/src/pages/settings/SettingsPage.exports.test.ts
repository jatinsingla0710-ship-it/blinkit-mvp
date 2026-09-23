import { describe, expect, it } from 'vitest';
import {
  buildRolePermissionMatrix,
  FRONTEND_ONLY_APP_ROLES,
  LIVE_MAPPED_APP_ROLES,
} from '@groaurum/auth';
import { COMPANY_SETTING_KEY } from '@groaurum/validation';

/**
 * Regression: Settings white-screen when Vite prebundled @groaurum/auth
 * omitted newer named exports (buildRolePermissionMatrix). RolesPermissionsMatrix
 * is statically imported by SettingsPage, so a missing export crashes the route.
 */
describe('Settings route auth/validation export contract', () => {
  it('exports buildRolePermissionMatrix for the Roles & Permissions matrix', () => {
    expect(typeof buildRolePermissionMatrix).toBe('function');
    const matrix = buildRolePermissionMatrix();
    expect(matrix.roles.length).toBeGreaterThan(0);
    expect(LIVE_MAPPED_APP_ROLES.length).toBeGreaterThan(0);
    expect(FRONTEND_ONLY_APP_ROLES.length).toBeGreaterThan(0);
  });

  it('exports COMPANY_SETTING_KEY for Company Profile saves', () => {
    expect(COMPANY_SETTING_KEY).toBe('company');
  });

  it('loads SettingsPage module without missing-export crashes', async () => {
    const mod = await import('@/pages/settings/SettingsPage');
    expect(typeof mod.SettingsPage).toBe('function');
  });
});
