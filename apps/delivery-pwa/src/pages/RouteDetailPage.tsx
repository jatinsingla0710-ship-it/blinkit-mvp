import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type {
  DeliveryStopStatus,
  RouteCompletionSummary,
} from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
} from '@groaurum/ui';
import { useDeliveryApi } from '@/data/DeliveryDataProviders';

function stopTone(status: DeliveryStopStatus): BadgeTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'IN_PROGRESS':
      return 'info';
    case 'SKIPPED':
      return 'warning';
    default:
      return 'neutral';
  }
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RouteDetailPage() {
  const { routeId = '' } = useParams();
  const user = useCurrentUser();
  const api = useDeliveryApi();
  const queryClient = useQueryClient();
  const profileId = user?.id ?? '';
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RouteCompletionSummary | null>(null);

  const routesQuery = useQuery({
    queryKey: ['delivery', 'routes', profileId],
    queryFn: () => api.listRoutes(profileId),
    enabled: Boolean(profileId),
  });

  const stopsQuery = useQuery({
    queryKey: ['delivery', 'route-stops', routeId],
    queryFn: () => api.getRouteStops(routeId),
    enabled: Boolean(routeId),
  });

  const route = routesQuery.data?.find((r) => r.id === routeId);
  const stops = stopsQuery.data ?? [];
  const totalStops = stops.length;
  const deliveredCount = stops.filter((s) => s.status === 'COMPLETED').length;
  const remainingCount = stops.filter(
    (s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS',
  ).length;
  const currentStop =
    stops.find((s) => s.status === 'IN_PROGRESS') ??
    stops.find((s) => s.status === 'PENDING');
  const allDone =
    stops.length > 0 &&
    stops.every((s) => s.status === 'COMPLETED' || s.status === 'FAILED' || s.status === 'SKIPPED');
  const canStart =
    route &&
    (route.status === 'PLANNED' || route.status === 'DRAFT');
  const canComplete =
    route &&
    route.status === 'IN_PROGRESS' &&
    allDone;

  function invalidateRouteQueries() {
    void queryClient.invalidateQueries({
      queryKey: ['delivery', 'route-stops', routeId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['delivery', 'routes', profileId],
    });
    void queryClient.invalidateQueries({ queryKey: ['delivery', 'dashboard'] });
  }

  const startMutation = useMutation({
    mutationFn: () => api.startRoute(routeId),
    onSuccess: () => {
      setActionError(null);
      setSummary(null);
      invalidateRouteQueries();
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Could not start route');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.completeRoute(routeId),
    onSuccess: (result) => {
      setActionError(null);
      setSummary(result);
      invalidateRouteQueries();
    },
    onError: (err) => {
      setActionError(
        err instanceof Error ? err.message : 'Could not complete route',
      );
    },
  });

  if (routesQuery.isLoading || stopsQuery.isLoading) {
    return (
      <Card>
        <EmptyState title="Loading route" detail="Fetching stops…" />
      </Card>
    );
  }

  if (!route) {
    return (
      <div className="ga-delivery-stack">
        <PageHeader title="Route" subtitle="Not found" />
        <p className="ga-delivery-error">
          {routesQuery.error instanceof Error
            ? routesQuery.error.message
            : 'Route not found'}
        </p>
        <Link to="/routes">
          <Button variant="secondary">Back to routes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="ga-delivery-stack">
      <PageHeader
        title={route.routeCode}
        subtitle={`${route.routeDateLabel} · ${route.areaLabel}`}
        meta={<Badge tone="info">{route.statusLabel}</Badge>}
      />

      {totalStops > 0 ? (
        <Card title="Progress">
          <FieldGrid columns={2}>
            <Field label="Total">{totalStops}</Field>
            <Field label="Delivered">{deliveredCount}</Field>
            <Field label="Current">
              {currentStop
                ? `#${currentStop.sequence} · ${currentStop.shopName}`
                : '—'}
            </Field>
            <Field label="Remaining">{remainingCount}</Field>
          </FieldGrid>
        </Card>
      ) : null}

      {actionError ? <p className="ga-delivery-error">{actionError}</p> : null}

      <Card title="Route actions">
        <div className="ga-delivery-actions">
          {canStart ? (
            <Button
              variant="primary"
              type="button"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {startMutation.isPending ? 'Starting…' : 'Start route'}
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              variant="primary"
              type="button"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              {completeMutation.isPending ? 'Closing…' : 'Complete route'}
            </Button>
          ) : null}
          <Link to="/routes">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
        {!allDone && route.status === 'IN_PROGRESS' ? (
          <p className="ga-delivery-muted" style={{ marginTop: 'var(--ga-space-2)' }}>
            Finish every stop before completing the route.
          </p>
        ) : null}
      </Card>

      {summary || route.status === 'COMPLETED' ? (
        <Card title="Route summary">
          <FieldGrid columns={2}>
            <Field label="Completed">
              {summary?.completedDeliveries ?? route.completedCount}
            </Field>
            <Field label="Failed">
              {summary?.failedDeliveries ?? route.failedCount}
            </Field>
            <Field label="COD expected">
              {summary
                ? formatInr(summary.codExpected)
                : route.codExpectedLabel}
            </Field>
            <Field label="COD collected">
              {summary
                ? formatInr(summary.codCollected)
                : route.codCollectedLabel}
            </Field>
            {summary ? (
              <Field label="COD pending" wide>
                {formatInr(summary.codPending)}
              </Field>
            ) : null}
          </FieldGrid>
        </Card>
      ) : null}

      {stopsQuery.isError ? (
        <p className="ga-delivery-error">
          {stopsQuery.error instanceof Error
            ? stopsQuery.error.message
            : 'Failed to load stops'}
        </p>
      ) : null}

      {stops.length === 0 ? (
        <Card>
          <EmptyState title="No stops" detail="This route has no deliveries yet." />
        </Card>
      ) : (
        <div className="ga-delivery-list">
          {stops.map((stop) => (
            <Link
              key={stop.id}
              to={`/routes/${routeId}/stops/${stop.id}`}
              className="ga-delivery-list-item"
            >
              <div className="ga-delivery-list-item__row">
                <div>
                  <p className="ga-delivery-list-item__title">
                    #{stop.sequence} · {stop.shopName}
                  </p>
                  <p className="ga-delivery-list-item__meta">
                    {stop.orderCode} · {stop.amountLabel}
                  </p>
                </div>
                <Badge tone={stopTone(stop.status)}>{stop.statusLabel}</Badge>
              </div>
              <p className="ga-delivery-muted">
                {stop.addressLine}, {stop.city} {stop.pinCode}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
