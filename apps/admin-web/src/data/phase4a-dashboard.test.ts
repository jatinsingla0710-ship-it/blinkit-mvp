import { describe, expect, it } from 'vitest';
import { executiveOpsKpisWithoutDuplicateSales } from '@/data/financial-reports';
import { mapOpsDashboardKpisToExecutive } from '@/data/dashboard-ops-kpis';
import { DASHBOARD_FIXTURE } from '@/data/dashboard-fixtures';

/**
 * Phase 4A — dashboard presentation honesty (composition helpers).
 */
describe('Phase 4A dashboard composition', () => {
  it('keeps ops COD cards while removing duplicate monthly sales KPI', () => {
    const all = mapOpsDashboardKpisToExecutive({
      monthlyRevenue: 125000,
      pendingOrders: 7,
      inTransitOrders: 4,
      workloadDelivered: 40,
      workloadTotal: 70,
      workloadRemaining: 30,
      managerCollectionsPending: 65000,
      pendingToReceiveTotal: 300000,
      pendingToReceiveOrders: 12,
      driverCollectionsPending: 8000,
      driverCollectionsCash: 8000,
      driverCollectionsOnline: 0,
    });
    const owner = executiveOpsKpisWithoutDuplicateSales(all);
    expect(owner.map((c) => c.id)).not.toContain('monthly_revenue');
    expect(owner.map((c) => c.id)).toEqual([
      'pending_orders',
      'manager_collections_pending',
      'in_transit',
      'pending_to_receive',
      'driver_collections_pending',
    ]);
    expect(owner.find((c) => c.id === 'manager_collections_pending')?.label).toMatch(
      /managers/i,
    );
  });

  it('documents owner dashboard quick action routes', () => {
    expect(DASHBOARD_FIXTURE.quickActions.map((action) => action.id)).toEqual([
      'new_sale',
      'new_purchase',
      'record_expense',
      'collect_payment',
    ]);
    expect(DASHBOARD_FIXTURE.quickActions.map((action) => action.href)).toEqual([
      undefined,
      '/purchases/new',
      '/expenses?create=1',
      '/payments?tab=all&focus=ofd_unpaid',
    ]);
  });
});
