import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import {
  mapSalesVisitStatus,
  sumOrderRevenueInCalendarMonth,
} from './salesmen-helpers';

function localIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day, 12, 0, 0, 0).toISOString();
}

describe('Salesman H2 reassignShopSalesman', () => {
  it('calls admin_reassign_shop_salesman with shop, salesman, reason', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        shopId: 'shop-1',
        salesmanProfileId: 'sm-2',
        assignmentId: 'asg-1',
        alreadyAssigned: false,
        closedAssignmentCount: 1,
      },
      error: null,
    }));
    const from = vi.fn(() => {
      throw new Error('client CRUD must not be used for reassign');
    });
    const api = new LiveAdminApi({ rpc, from } as never);
    const result = await api.reassignShopSalesman(
      'shop-1',
      'sm-2',
      'Territory change',
    );

    expect(rpc).toHaveBeenCalledWith('admin_reassign_shop_salesman', {
      p_shop_id: 'shop-1',
      p_new_salesman_profile_id: 'sm-2',
      p_reason: 'Territory change',
    });
    expect(result).toEqual({
      shopId: 'shop-1',
      salesmanProfileId: 'sm-2',
      assignmentId: 'asg-1',
      alreadyAssigned: false,
      closedAssignmentCount: 1,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Admin role required' },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(
      api.reassignShopSalesman('shop-1', 'sm-2', null),
    ).rejects.toThrow(/Admin role required/i);
  });
});

describe('Salesman H2 createSalesVisit', () => {
  it('calls admin_create_sales_visit for a PLANNED visit', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        visitId: 'vis-1',
        salesmanProfileId: 'sm-1',
        shopId: 'shop-1',
        plannedAt: '2026-08-22T10:00:00.000Z',
        status: 'PLANNED',
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.createSalesVisit({
      salesmanProfileId: 'sm-1',
      shopId: 'shop-1',
      plannedAt: '2026-08-22T10:00:00.000Z',
      notes: 'Morning call',
    });

    expect(rpc).toHaveBeenCalledWith('admin_create_sales_visit', {
      p_salesman_profile_id: 'sm-1',
      p_shop_id: 'shop-1',
      p_planned_at: '2026-08-22T10:00:00.000Z',
      p_notes: 'Morning call',
    });
    expect(result.visitId).toBe('vis-1');
    expect(result.status).toBe('PLANNED');
  });

  it('maps DB visit statuses for Admin reads', () => {
    expect(mapSalesVisitStatus('PLANNED')).toBe('planned');
    expect(mapSalesVisitStatus('VISITED')).toBe('completed');
    expect(mapSalesVisitStatus('MISSED')).toBe('missed');
  });
});

describe('Salesman H2 month revenue helper', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0, 0);

  it('sums only current calendar-month order totals', () => {
    expect(
      sumOrderRevenueInCalendarMonth(
        [
          { created_at: localIso(2026, 7, 5), total: 100 },
          { created_at: localIso(2026, 7, 20), total: 50.5 },
          { created_at: localIso(2026, 6, 20), total: 999 },
          { created_at: localIso(2026, 8, 1), total: 10 },
        ],
        now,
      ),
    ).toBe(150.5);
  });
});

describe('Salesman H2 create-salesman decision', () => {
  it('rejects create without auth provisioning (no fake profiles)', async () => {
    const {
      CREATE_SALESMAN_BLOCKED_MESSAGE,
      rejectCreateSalesman,
    } = await import('./mutations');
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
