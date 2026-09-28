import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { errorMessage } from '@/lib/errors';

/** "My Earnings" (Profile → My Earnings). Shows this month's performance. */
export function PerformancePage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profileId = user?.id ?? '';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sales', 'performance', profileId],
    queryFn: () => api.getPerformance(profileId),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="My Earnings"
        subtitle="This month so far"
        backTo="/profile"
        backLabel="Profile"
      />

      {isLoading ? <LoadingState label="Loading your month…" variant="kpis" rows={4} /> : null}

      {isError ? (
        <ErrorState
          message={errorMessage(error, 'Could not load your performance.')}
          onRetry={() => void refetch()}
          retrying={isFetching}
          stale={Boolean(data)}
        />
      ) : null}

      {data ? (
        <>
          <div className="ga-sales-kpi-grid">
            <div className="ga-sales-kpi" style={{ gridColumn: '1 / -1' }}>
              <p className="ga-sales-kpi__label">Revenue generated</p>
              <p className="ga-sales-kpi__value">{data.revenueGeneratedLabel}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">Orders</p>
              <p className="ga-sales-kpi__value">{data.ordersThisMonth}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">New retailers</p>
              <p className="ga-sales-kpi__value">{data.newRetailers}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">Activation rate</p>
              <p className="ga-sales-kpi__value">{data.activationRateLabel}</p>
            </div>
            <div className="ga-sales-kpi">
              <p className="ga-sales-kpi__label">Repeat customers</p>
              <p className="ga-sales-kpi__value">{data.repeatCustomers}</p>
            </div>
          </div>
          <p className="ga-sales-muted">
            Commission and salary details will appear here in a later update.
          </p>
        </>
      ) : null}
    </div>
  );
}
