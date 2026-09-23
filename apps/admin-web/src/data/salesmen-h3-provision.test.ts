import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import {
  latestOrderAtByShop,
  latestVisitAtByShop,
  mapVisitStatusToDb,
} from './salesmen-helpers';
import { salesmanProvisionSchema } from '@groaurum/validation';

describe('Salesman H3 provisionSalesman', () => {
  it('invokes provision-salesman edge function with caller body (no service key)', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        profileId: 'sm-1',
        authUserId: 'sm-1',
        email: 's@example.com',
        displayName: 'Sam',
        mobile: '919999999999',
        alreadyProvisioned: false,
        createdAuthUser: true,
        temporaryPasswordSet: true,
      },
      error: null,
    }));
    const api = new LiveAdminApi({
      functions: { invoke },
    } as never);

    const result = await api.provisionSalesman({
      displayName: 'Sam',
      mobile: '9999999999',
      email: 's@example.com',
      temporaryPassword: 'TempPass12',
    });

    expect(invoke).toHaveBeenCalledWith('provision-salesman', {
      body: {
        displayName: 'Sam',
        mobile: '9999999999',
        email: 's@example.com',
        temporaryPassword: 'TempPass12',
        isActive: true,
      },
    });
    expect(result.createdAuthUser).toBe(true);
    expect(result.profileId).toBe('sm-1');
  });

  it('surfaces conflict errors from the edge function response', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        error: 'A profile already exists for this mobile without SALESMAN role',
        code: 'MOBILE_PROFILE_CONFLICT',
      },
      error: null,
    }));
    const api = new LiveAdminApi({ functions: { invoke } } as never);
    await expect(
      api.provisionSalesman({
        displayName: 'Sam',
        mobile: '9999999999',
        email: 's@example.com',
        temporaryPassword: 'TempPass12',
      }),
    ).rejects.toThrow(/without SALESMAN role/i);
  });

  it('validates provision input before network', () => {
    expect(
      salesmanProvisionSchema.safeParse({
        displayName: 'Sam',
        mobile: '9999999999',
        email: 'not-an-email',
        temporaryPassword: 'short',
      }).success,
    ).toBe(false);
    expect(
      salesmanProvisionSchema.safeParse({
        displayName: 'Sam',
        mobile: '9999999999',
        email: 's@example.com',
        temporaryPassword: 'TempPass12',
      }).success,
    ).toBe(true);
  });
});

describe('Salesman H3 updateSalesVisitStatus', () => {
  it('calls admin_update_sales_visit_status with DB enum', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        visitId: 'vis-1',
        status: 'VISITED',
        visitedAt: '2026-08-22T12:00:00.000Z',
        salesmanProfileId: 'sm-1',
        shopId: 'shop-1',
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.updateSalesVisitStatus('vis-1', 'completed');
    expect(rpc).toHaveBeenCalledWith('admin_update_sales_visit_status', {
      p_visit_id: 'vis-1',
      p_status: 'VISITED',
    });
    expect(result.status).toBe('VISITED');
    expect(mapVisitStatusToDb('missed')).toBe('MISSED');
  });

  it('surfaces authorization errors', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Admin role required' },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(
      api.updateSalesVisitStatus('vis-1', 'missed'),
    ).rejects.toThrow(/Admin role required/i);
  });
});

describe('Salesman H3 assigned-customer activity helpers', () => {
  it('picks latest order and visit timestamps per shop', () => {
    const orders = latestOrderAtByShop([
      { shop_id: 'a', created_at: '2026-08-01T00:00:00.000Z' },
      { shop_id: 'a', created_at: '2026-08-10T00:00:00.000Z' },
      { shop_id: 'b', created_at: '2026-07-01T00:00:00.000Z' },
    ]);
    expect(orders.get('a')).toBe('2026-08-10T00:00:00.000Z');
    expect(orders.get('b')).toBe('2026-07-01T00:00:00.000Z');

    const visits = latestVisitAtByShop([
      {
        shop_id: 'a',
        planned_at: '2026-08-01T00:00:00.000Z',
        visited_at: null,
      },
      {
        shop_id: 'a',
        planned_at: '2026-08-05T00:00:00.000Z',
        visited_at: '2026-08-06T00:00:00.000Z',
      },
    ]);
    expect(visits.get('a')).toBe('2026-08-06T00:00:00.000Z');
  });
});

describe('Salesman H3 bare create still blocked', () => {
  it('rejects profile-only create without Auth edge provision', async () => {
    const { rejectCreateSalesman, CREATE_SALESMAN_BLOCKED_MESSAGE } =
      await import('./mutations');
    await expect(
      rejectCreateSalesman({
        authUserId: '00000000-0000-0000-0000-000000000001',
        displayName: 'Fake',
        mobile: '9999999999',
      }),
    ).rejects.toThrow(/Auth provisioning|Provision Salesman/i);
    expect(CREATE_SALESMAN_BLOCKED_MESSAGE).toMatch(/edge function|Provision/i);
  });
});
