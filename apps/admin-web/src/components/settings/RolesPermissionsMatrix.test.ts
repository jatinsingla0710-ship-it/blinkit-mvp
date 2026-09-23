import { describe, expect, it } from 'vitest';
import { buildRolePermissionMatrix } from '@groaurum/auth';

describe('Admin Roles & Permissions Phase 1 matrix', () => {
  it('exposes live vs frontend-only rows for the Settings UI', () => {
    const matrix = buildRolePermissionMatrix();
    const live = matrix.roles.filter((row) => row.source === 'live_supabase');
    const frontend = matrix.roles.filter(
      (row) => row.source === 'frontend_only',
    );

    expect(live.map((row) => row.role)).toEqual([
      'super_admin',
      'salesman',
      'delivery_executive',
      'retail_customer',
      'read_only',
    ]);
    expect(frontend.map((row) => row.role)).toEqual([
      'operations_manager',
      'warehouse_manager',
      'sales_manager',
      'delivery_manager',
    ]);
  });
});
