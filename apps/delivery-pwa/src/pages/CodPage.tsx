import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Card, EmptyState, PageHeader } from '@groaurum/ui';
import { useDeliveryApi } from '@/data/DeliveryDataProviders';

export function CodPage() {
  const user = useCurrentUser();
  const api = useDeliveryApi();
  const profileId = user?.id ?? '';

  const dashboardQuery = useQuery({
    queryKey: ['delivery', 'dashboard', profileId],
    queryFn: () => api.getDashboard(profileId),
    enabled: Boolean(profileId),
  });

  const historyQuery = useQuery({
    queryKey: ['delivery', 'cod', profileId],
    queryFn: () => api.listCodHistory(profileId),
    enabled: Boolean(profileId),
  });

  const routesQuery = useQuery({
    queryKey: ['delivery', 'routes', profileId],
    queryFn: () => api.listRoutes(profileId),
    enabled: Boolean(profileId),
  });

  const expectedSummary =
    routesQuery.data && routesQuery.data.length > 0
      ? routesQuery.data
          .map((r) => `${r.routeCode} ${r.codExpectedLabel}`)
          .join(' · ')
      : '₹0';

  const collectedSummary =
    routesQuery.data && routesQuery.data.length > 0
      ? routesQuery.data
          .map((r) => `${r.routeCode} ${r.codCollectedLabel}`)
          .join(' · ')
      : '₹0';

  return (
    <div className="ga-delivery-stack">
      <PageHeader title="COD" subtitle="Collections & pending cash" />

      {dashboardQuery.isLoading ? (
        <Card>
          <EmptyState title="Loading COD" detail="Fetching collection summary…" />
        </Card>
      ) : null}

      {dashboardQuery.isError ? (
        <p className="ga-delivery-error">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : 'Failed to load COD summary'}
        </p>
      ) : null}

      {dashboardQuery.data ? (
        <div className="ga-delivery-kpi-grid">
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">COD pending</p>
            <p className="ga-delivery-kpi__value">
              {dashboardQuery.data.codPendingLabel}
            </p>
          </div>
          <div className="ga-delivery-kpi">
            <p className="ga-delivery-kpi__label">Assigned routes</p>
            <p className="ga-delivery-kpi__value">
              {routesQuery.data?.length ?? 0}
            </p>
          </div>
          <div className="ga-delivery-kpi" style={{ gridColumn: '1 / -1' }}>
            <p className="ga-delivery-kpi__label">Expected by route</p>
            <p
              className="ga-delivery-kpi__value"
              style={{ fontSize: 'var(--ga-text-lg)' }}
            >
              {expectedSummary}
            </p>
          </div>
          <div className="ga-delivery-kpi" style={{ gridColumn: '1 / -1' }}>
            <p className="ga-delivery-kpi__label">Collected by route</p>
            <p
              className="ga-delivery-kpi__value"
              style={{ fontSize: 'var(--ga-text-lg)' }}
            >
              {collectedSummary}
            </p>
          </div>
        </div>
      ) : null}

      <Card title="Collection history">
        {historyQuery.isLoading ? (
          <EmptyState title="Loading history" detail="Fetching payments…" />
        ) : null}

        {historyQuery.isError ? (
          <p className="ga-delivery-error">
            {historyQuery.error instanceof Error
              ? historyQuery.error.message
              : 'Failed to load history'}
          </p>
        ) : null}

        {historyQuery.data && historyQuery.data.length === 0 ? (
          <EmptyState
            title="No collections yet"
            detail="COD payments you collect will show up here."
          />
        ) : null}

        {historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="ga-delivery-list">
            {historyQuery.data.map((row) => (
              <div key={row.id} className="ga-delivery-list-item">
                <div className="ga-delivery-list-item__row">
                  <div>
                    <p className="ga-delivery-list-item__title">{row.shopName}</p>
                    <p className="ga-delivery-list-item__meta">
                      {row.orderCode} · {row.methodLabel}
                    </p>
                  </div>
                  <p className="ga-delivery-list-item__title">{row.amountLabel}</p>
                </div>
                <p className="ga-delivery-muted">
                  {row.statusLabel} · {row.atLabel}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
