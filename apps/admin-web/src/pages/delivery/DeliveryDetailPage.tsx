import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { AssignDriverModal } from '@/components/delivery/AssignDriverModal';
import { AssignOrdersModal } from '@/components/delivery/AssignOrdersModal';
import { CollectCodModal } from '@/components/delivery/CollectCodModal';
import { DeliveryCollectionsTab } from '@/components/delivery/DeliveryCollectionsTab';
import { DeliveryOrdersTab } from '@/components/delivery/DeliveryOrdersTab';
import { DeliveryOverviewTab } from '@/components/delivery/DeliveryOverviewTab';
import { DeliveryPerformanceTab } from '@/components/delivery/DeliveryPerformanceTab';
import {
  DeliveryQuickActions,
  type DeliveryQuickActionId,
} from '@/components/delivery/DeliveryQuickActions';
import { FailStopModal } from '@/components/delivery/FailStopModal';
import { RouteStatusBadge } from '@/components/delivery/DeliveryStatusBadges';
import { DeliveryTimelineTab } from '@/components/delivery/DeliveryTimelineTab';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import type { DeliveryAssignedOrder } from '@/data/delivery-types';
import { useDeliveryDetailQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCompleteDeliveryRouteMutation,
  useCompleteDeliveryStopMutation,
  useMarkStopInProgressMutation,
  useStartDeliveryRouteMutation,
} from '@/data/mutations';
import './DeliveryDetailPage.css';

type DeliveryTab =
  | 'overview'
  | 'orders'
  | 'timeline'
  | 'collections'
  | 'performance';

const TABS: TabItem<DeliveryTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Assigned Orders' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'collections', label: 'Collections' },
  { id: 'performance', label: 'Performance' },
];

/**
 * Delivery route detail — start/in-progress/COD/stop actions, close.
 */
export function DeliveryDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const [tab, setTab] = useState<DeliveryTab>('overview');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [assignDriverOpen, setAssignDriverOpen] = useState(false);
  const [assignOrdersOpen, setAssignOrdersOpen] = useState(false);
  const [failStop, setFailStop] = useState<{
    stopId: string;
    orderCode: string;
  } | null>(null);
  const [codModal, setCodModal] = useState<{
    mode: 'collect' | 'deliver';
    row: DeliveryAssignedOrder;
  } | null>(null);

  const { state } = useDeliveryDetailQuery(routeId);
  const completeRoute = useCompleteDeliveryRouteMutation();
  const startRoute = useStartDeliveryRouteMutation();
  const completeStop = useCompleteDeliveryStopMutation();
  const markInProgress = useMarkStopInProgressMutation();
  const { hasPermission } = usePermissions();
  const canManageDelivery = hasPermission('delivery:manage');

  const onAction = (id: DeliveryQuickActionId) => {
    if (!canManageDelivery || !routeId) return;
    if (id === 'assign_driver') {
      setAssignDriverOpen(true);
      return;
    }
    if (id === 'assign_orders') {
      setAssignOrdersOpen(true);
      setTab('orders');
      return;
    }
    if (id === 'start_route') {
      setActionError(null);
      setActionOk(null);
      startRoute.mutate(routeId, {
        onSuccess: () => {
          setActionOk('Route started — open stops marked out for delivery.');
          setTab('orders');
        },
        onError: (err) => {
          setActionError(formatMutationError(err, 'Could not start route'));
        },
      });
      return;
    }
    if (id === 'close_route') {
      setActionError(null);
      setActionOk(null);
      completeRoute.mutate(routeId, {
        onSuccess: (summary) => {
          setActionOk(
            `Route closed · ${summary.completedDeliveries} delivered · ${summary.failedDeliveries} failed · COD pending ${summary.codPending}`,
          );
          setTab('timeline');
        },
        onError: (err) => {
          setActionError(formatMutationError(err, 'Could not close route'));
        },
      });
    }
  };

  return (
    <QueryStateGate
      title="Route"
      state={state}
      emptyTitle="Route not found"
      emptyDetail="Return to Delivery and select a route."
    >
      {(route) => (
        <div className="ga-dl-detail">
          <PageHeader
            title={route.routeCode}
            subtitle={`${route.driverName} · ${route.deliveryArea}`}
            meta={
              <span className="ga-dl-detail__meta">
                <RouteStatusBadge status={route.status} />
                <span>Updated {route.updatedAtLabel}</span>
              </span>
            }
          />

          <div className="ga-dl-detail__toolbar">
            <Link to="/delivery" className="ga-dl-detail__back">
              ← Delivery
            </Link>
            <DeliveryQuickActions
              canManage={canManageDelivery}
              surface="detail"
              allowStartRoute={
                canManageDelivery && route.status === 'planned'
              }
              allowCloseRoute={
                canManageDelivery && route.status !== 'completed'
              }
              startPending={startRoute.isPending}
              closePending={completeRoute.isPending}
              onAction={onAction}
            />
          </div>

          {actionError ? (
            <p className="ga-dl-detail__error" role="alert">
              {actionError}
            </p>
          ) : null}
          {actionOk && !actionError ? (
            <p className="ga-dl-detail__ok">{actionOk}</p>
          ) : null}

          <Card className="ga-dl-detail__main">
            <Tabs items={TABS} active={tab} onChange={setTab} />
            <div className="ga-dl-detail__panel">
              {tab === 'overview' ? <DeliveryOverviewTab route={route} /> : null}
              {tab === 'orders' ? (
                <DeliveryOrdersTab
                  rows={route.assignedOrders}
                  canManage={canManageDelivery && route.status !== 'completed'}
                  actionPending={
                    completeStop.isPending || markInProgress.isPending
                  }
                  onMarkInProgress={(stopId) => {
                    if (!routeId) return;
                    setActionError(null);
                    setActionOk(null);
                    markInProgress.mutate(
                      { stopId, routeId },
                      {
                        onSuccess: () =>
                          setActionOk('Stop marked in progress.'),
                        onError: (err) =>
                          setActionError(
                            formatMutationError(
                              err,
                              'Could not mark in progress',
                            ),
                          ),
                      },
                    );
                  }}
                  onCollectCod={(row) => {
                    setCodModal({ mode: 'collect', row });
                  }}
                  onMarkDelivered={(row) => {
                    if (!routeId) return;
                    if (row.codCollectable) {
                      setCodModal({ mode: 'deliver', row });
                      return;
                    }
                    setActionError(null);
                    setActionOk(null);
                    completeStop.mutate(
                      { stopId: row.id, routeId },
                      {
                        onSuccess: () =>
                          setActionOk('Stop marked delivered.'),
                        onError: (err) =>
                          setActionError(
                            formatMutationError(
                              err,
                              'Could not mark delivered',
                            ),
                          ),
                      },
                    );
                  }}
                  onMarkFailed={(stopId, orderCode) => {
                    setFailStop({ stopId, orderCode });
                  }}
                />
              ) : null}
              {tab === 'timeline' ? (
                <DeliveryTimelineTab stages={route.timeline} />
              ) : null}
              {tab === 'collections' ? (
                <DeliveryCollectionsTab
                  summary={route.collections}
                  history={route.collectionHistory}
                />
              ) : null}
              {tab === 'performance' ? (
                <DeliveryPerformanceTab performance={route.performance} />
              ) : null}
            </div>
          </Card>

          {canManageDelivery && routeId ? (
            <>
              <AssignDriverModal
                open={assignDriverOpen}
                routeId={routeId}
                onClose={() => setAssignDriverOpen(false)}
              />
              <AssignOrdersModal
                open={assignOrdersOpen}
                routeId={routeId}
                hasDriver={Boolean(route.assignedDeliveryProfileId)}
                onClose={() => setAssignOrdersOpen(false)}
                onSuccess={() => {
                  setActionOk('Order assigned to this route.');
                  setTab('orders');
                }}
              />
              {failStop ? (
                <FailStopModal
                  open
                  stopId={failStop.stopId}
                  routeId={routeId}
                  orderCode={failStop.orderCode}
                  onClose={() => setFailStop(null)}
                  onSuccess={() => setActionOk('Stop marked failed.')}
                />
              ) : null}
              {codModal ? (
                <CollectCodModal
                  open
                  mode={codModal.mode}
                  routeId={routeId}
                  stopId={codModal.row.id}
                  orderId={codModal.row.orderId}
                  orderCode={codModal.row.orderCode}
                  suggestedAmount={codModal.row.codSuggestedAmount}
                  onClose={() => setCodModal(null)}
                  onSuccess={(message) => {
                    setActionError(null);
                    setActionOk(message);
                    setTab('collections');
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
