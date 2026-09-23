import { describe, expect, it } from 'vitest';
import {
  canAccessModule,
  hasPermission,
  audienceForRole,
  MODULE_ALLOWED_ROLES,
} from './index';

describe('RBAC helpers', () => {
  it('maps roles to product audiences', () => {
    expect(audienceForRole('retail_customer')).toBe('customer_app');
    expect(audienceForRole('salesman')).toBe('sales_pwa');
    expect(audienceForRole('delivery_executive')).toBe('delivery_pwa');
    expect(audienceForRole('super_admin')).toBe('admin_erp');
  });

  it('grants settings only to super admin', () => {
    expect(MODULE_ALLOWED_ROLES.settings).toEqual(['super_admin']);
    expect(
      canAccessModule(
        { roles: ['operations_manager'] },
        'settings',
      ),
    ).toBe(false);
    expect(
      canAccessModule({ roles: ['read_only'] }, 'settings'),
    ).toBe(false);
    expect(
      canAccessModule({ roles: ['super_admin'] }, 'settings'),
    ).toBe(true);
  });

  it('grants settings:manage only to super_admin', () => {
    expect(
      hasPermission({
        roles: ['super_admin'],
        permission: 'settings:manage',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'settings:manage',
      }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['read_only'],
        permission: 'settings:manage',
      }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'settings:view',
      }),
    ).toBe(true);
  });
  it('checks permissions by role', () => {
    expect(
      hasPermission({
        roles: ['read_only'],
        permission: 'orders:manage',
      }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['read_only'],
        permission: 'pricing:manage',
      }),
    ).toBe(false);
    expect(
      hasPermission({
        roles: ['operations_manager'],
        permission: 'orders:manage',
      }),
    ).toBe(true);
    expect(
      hasPermission({
        roles: ['super_admin'],
        permission: 'pricing:manage',
      }),
    ).toBe(true);
  });
});
