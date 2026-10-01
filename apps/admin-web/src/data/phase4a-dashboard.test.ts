import { describe, expect, it } from 'vitest';
import { executiveOpsKpisWithoutDuplicateSales } from '@/data/financial-reports';
import { mapOpsDashboardKpisToExecutive } from '@/data/dashboard-ops-kpis';

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
    const quickActions = [
      { id: 'add_product', href: '/products' },
      { id: 'update_price', href: '/pricing' },
      { id: 'add_customer', href: '/customers' },
      { id: 'create_route', href: '/delivery' },
    ];
    expect(quickActions.map((a) => a.href)).toEqual([
      '/products',
      '/pricing',
      '/customers',
      '/delivery',
    ]);
  });
});
