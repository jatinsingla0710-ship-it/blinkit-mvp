import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { DeliveryRouteStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';
import { Badge, Card, EmptyState, PageHeader } from '@groaurum/ui';
import { useDeliveryApi } from '@/data/DeliveryDataProviders';

function routeTone(status: DeliveryRouteStatus): BadgeTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'CANCELLED':
      return 'danger';
    case 'PLANNED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function RoutesPage() {
  const user = useCurrentUser();
  const api = useDeliveryApi();
  const profileId = user?.id ?? '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['delivery', 'routes', profileId],
    queryFn: () => api.listRoutes(profileId),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-delivery-stack">
      <PageHeader title="Routes" subtitle="Assigned delivery routes" />

      {isLoading ? (
        <Card>
          <EmptyState title="Loading routes" detail="Fetching your assignments…" />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-delivery-error">
          {error instanceof Error ? error.message : 'Failed to load routes'}
        </p>
      ) : null}

      {data && data.length === 0 ? (
        <Card>
          <EmptyState
            title="No routes assigned"
            detail="When ops assigns a route, it will appear here."
          />
        </Card>
      ) : null}

      {data && data.length > 0 ? (
        <div className="ga-delivery-list">
          {data.map((route) => (
            <Link
              key={route.id}
              to={`/routes/${route.id}`}
              className="ga-delivery-list-item"
            >
              <div className="ga-delivery-list-item__row">
                <div>
                  <p className="ga-delivery-list-item__title">
                    {route.routeCode}
                  </p>
                  <p className="ga-delivery-list-item__meta">
                    {route.routeDateLabel} · {route.areaLabel}
                  </p>
                </div>
                <Badge tone={routeTone(route.status)}>{route.statusLabel}</Badge>
              </div>
              <p className="ga-delivery-muted">
                {route.completedCount}/{route.stopCount} done ·{' '}
                {route.pendingCount} pending · COD {route.codCollectedLabel} /{' '}
                {route.codExpectedLabel}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
