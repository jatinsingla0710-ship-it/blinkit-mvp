import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Card, EmptyState, PageHeader } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';

export function PerformancePage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profileId = user?.id ?? '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sales', 'performance', profileId],
    queryFn: () => api.getPerformance(profileId),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sales-stack">
      <PageHeader title="Performance" subtitle="This month" />

      {isLoading ? (
        <Card>
          <EmptyState
            title="Loading performance"
            detail="Calculating your month so far…"
          />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-sales-error">
          {error instanceof Error
            ? error.message
            : 'Failed to load performance'}
        </p>
      ) : null}

      {data ? (
        <div className="ga-sales-kpi-grid">
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Orders</p>
            <p className="ga-sales-kpi__value">{data.ordersThisMonth}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Revenue</p>
            <p className="ga-sales-kpi__value">{data.revenueGeneratedLabel}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">New retailers</p>
            <p className="ga-sales-kpi__value">{data.newRetailers}</p>
          </div>
          <div className="ga-sales-kpi">
            <p className="ga-sales-kpi__label">Activation rate</p>
            <p className="ga-sales-kpi__value">{data.activationRateLabel}</p>
          </div>
          <div className="ga-sales-kpi" style={{ gridColumn: '1 / -1' }}>
            <p className="ga-sales-kpi__label">Repeat customers</p>
            <p className="ga-sales-kpi__value">{data.repeatCustomers}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
