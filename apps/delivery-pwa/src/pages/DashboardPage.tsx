import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Button, Card, EmptyState, PageHeader } from '@groaurum/ui';
import { useDeliveryApi } from '@/data/DeliveryDataProviders';

export function DashboardPage() {
  const user = useCurrentUser();
  const api = useDeliveryApi();
  const profileId = user?.id ?? '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['delivery', 'dashboard', profileId],
    queryFn: () => api.getDashboard(profileId),
    enabled: Boolean(profileId),
  });

  const routesQuery = useQuery({
    queryKey: ['delivery', 'routes', profileId],
    queryFn: () => api.listRoutes(profileId),
    enabled: Boolean(profileId),
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysRoute = routesQuery.data?.find(
    (r) => r.routeDate.slice(0, 10) === today,
  );

  return (
    <div className="ga-delivery-stack">
      <PageHeader
        title="Dashboard"
        subtitle={user?.displayName ? `Hi, ${user.displayName}` : 'Today’s focus'}
      />

      {isLoading ? (
        <Card>
          <EmptyState title="Loading KPIs" detail="Fetching your delivery summary…" />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-delivery-error">
          {error instanceof Error ? error.message : 'Failed to load dashboard'}
        </p>
      ) : null}

      {data ? (
        <div className="ga-delivery-kpi-grid">
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">Today&apos;s routes</p>
            <p className="ga-delivery-kpi__value">{data.todaysRoutes}</p>
          </div>
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">Assigned deliveries</p>
            <p className="ga-delivery-kpi__value">{data.assignedDeliveries}</p>
          </div>
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">COD pending</p>
            <p className="ga-delivery-kpi__value">{data.codPendingLabel}</p>
          </div>
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">Completed</p>
            <p className="ga-delivery-kpi__value">{data.completedDeliveries}</p>
          </div>
          <div className="ga-delivery-kpi" style={{ gridColumn: '1 / -1' }}>
            <p className="ga-delivery-kpi__label">Failed</p>
            <p className="ga-delivery-kpi__value">{data.failedDeliveries}</p>
          </div>
        </div>
      ) : null}

      <Card title="Quick actions">
        <div className="ga-delivery-actions">
          {todaysRoute ? (
            <Link to={`/routes/${todaysRoute.id}`}>
              <Button variant="primary">Today&apos;s route</Button>
            </Link>
          ) : (
            <Link to="/routes">
              <Button variant="primary">View routes</Button>
            </Link>
          )}
          <Link to="/cod">
            <Button variant="secondary">COD collections</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
