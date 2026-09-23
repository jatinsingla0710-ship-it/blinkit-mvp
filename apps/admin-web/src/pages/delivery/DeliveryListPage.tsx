import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import {
  EMPTY_DELIVERY_BROWSE,
  browseDeliveryRoutes,
} from '@/data/browse-helpers';
import type { DeliveryBrowseState } from '@/data/delivery-types';
import { DeliveryBrowseBar } from '@/components/delivery/DeliveryBrowseBar';
import { DeliveryQuickActions } from '@/components/delivery/DeliveryQuickActions';
import { DeliveryRoutesTable } from '@/components/delivery/DeliveryRoutesTable';
import { DeliveryRouteFormModal } from '@/components/delivery/DeliveryRouteFormModal';
import { ScheduleAssignModal } from '@/components/delivery/ScheduleAssignModal';
import { DeliveryExceptionsPanel } from '@/components/delivery/DeliveryExceptionsPanel';
import { DeliveryProvisionModal } from '@/components/delivery/DeliveryProvisionModal';
import { VehicleFormModal } from '@/components/delivery/VehicleFormModal';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  mapDeliveryBoyUiStatus,
  mapVehicleUiStatus,
} from '@/data/delivery-setup-helpers';
import {
  useCodCustodySummariesQuery,
  useDeliveryBoysSnapshotQuery,
  useDeliveryExceptionsQuery,
  useDeliverySnapshotQuery,
  useReadyForDeliveryOrdersQuery,
  useVehiclesListQuery,
} from '@/data/hooks';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryListPage.css';

/**
 * Delivery ops hub — today KPIs, exceptions, ready queue, routes.
 */
export function DeliveryListPage() {
  const { state } = useDeliverySnapshotQuery();
  const ready = useReadyForDeliveryOrdersQuery();
  const boysSnap = useDeliveryBoysSnapshotQuery();
  const vehiclesList = useVehiclesListQuery();
  const exceptions = useDeliveryExceptionsQuery(true);
  const custody = useCodCustodySummariesQuery();

  const [browse, setBrowse] = useState<DeliveryBrowseState>(EMPTY_DELIVERY_BROWSE);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManageDelivery = hasPermission('delivery:manage');

  const result = useMemo(() => {
    if (!state.data) {
      return { rows: [], pageCount: 1, total: 0 };
    }
    return browseDeliveryRoutes(state.data.rows, browse);
  }, [state.data, browse]);

  const resourceCards = useMemo(() => {
    const readyCount = ready.data?.length ?? 0;
    const activeTrips = (state.data?.rows ?? []).filter(
      (r) =>
        r.status === 'running' ||
        r.status === 'planned' ||
        r.status === 'loading',
    ).length;
    const availableBoys = (boysSnap.state.data?.rows ?? []).filter(
      (b) =>
        mapDeliveryBoyUiStatus({
          employmentStatus: b.employmentStatus,
          operationalStatus: b.operationalStatus,
        }) === 'Available',
    ).length;
    const availableVehicles = (vehiclesList.state.data ?? []).filter(
      (v) => mapVehicleUiStatus(v.status, v.isActive) === 'Available',
    ).length;
    return [
      {
        id: 'ready',
        label: '📦 Ready for Delivery',
        value: `${readyCount}`,
        tone: readyCount ? ('warning' as const) : ('default' as const),
      },
      {
        id: 'trips',
        label: '🚚 Active Delivery Trips',
        value: `${activeTrips}`,
        tone: activeTrips ? ('warning' as const) : ('default' as const),
      },
      {
        id: 'boys',
        label: '👤 Available Delivery Boys',
        value: `${availableBoys}`,
        tone: availableBoys ? ('positive' as const) : ('danger' as const),
      },
      {
        id: 'vehicles',
        label: '🚐 Available Vehicles',
        value: `${availableVehicles}`,
        tone: 'default' as const,
      },
    ];
  }, [ready.data, state.data, boysSnap.state.data, vehiclesList.state.data]);

  return (
    <QueryStateGate title="Delivery" state={state}>
      {(snapshot) => (
        <div className="ga-dl-list">
          <PageHeader
            title="Delivery"
            subtitle="Add delivery boys · assign trips · track deliveries"
            meta={`${snapshot.generatedAtLabel}${canManageDelivery ? '' : ' · read-only'}`}
          />

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/delivery/boys">Delivery boys</Link>
            <Link to="/delivery/vehicles">Vehicles</Link>
          </div>

          <KpiCards items={resourceCards} />

          {canManageDelivery ? (
            <Card title="Quick actions">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <Button
                  variant="primary"
                  onClick={() => setProvisionOpen(true)}
                >
                  ➕ Add Delivery Boy
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setVehicleModalOpen(true)}
                >
                  ➕ Add Vehicle
                </Button>
                <DeliveryQuickActions
                  canManage
                  surface="list"
                  onAction={(id) => {
                    if (id === 'create_route') setCreateRouteOpen(true);
                    if (id === 'schedule_assign') setScheduleOpen(true);
                  }}
                />
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                A delivery trip assigns orders to a delivery boy for delivery.
              </p>
            </Card>
          ) : null}

          <DeliveryExceptionsPanel
            exceptions={exceptions.data ?? []}
            canManage={canManageDelivery}
          />

          <Card title="📦 Ready for delivery">
            {(ready.data ?? []).length === 0 ? (
              <p>No packed orders waiting for a delivery trip.</p>
            ) : (
              <>
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Area</th>
                        <th>Amount</th>
                        <th>Packed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ready.data ?? []).map((o) => (
                        <tr key={o.id}>
                          <td className="ga-table__mono">
                            <Link to={`/orders/${o.id}`}>{o.orderCode}</Link>
                          </td>
                          <td>{o.customerName}</td>
                          <td>{o.serviceAreaLabel}</td>
                          <td>{o.amountLabel}</td>
                          <td>{o.packedAtLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canManageDelivery ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <Button
                      variant="primary"
                      onClick={() => setScheduleOpen(true)}
                    >
                      🚚 Create Delivery Trip
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Card>

          {canManageDelivery ? (
            <Card title="COD custody (with delivery boys)">
              <p style={{ marginTop: 0 }}>
                Cash with drivers is never auto-settled. Receive by selecting
                collections in Payments — not by typing an amount.
              </p>
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>With driver</th>
                      <th>Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(custody.data ?? []).filter((c) => c.withDriverAmount > 0)
                      .length === 0 ? (
                      <tr>
                        <td colSpan={3}>No cash currently with delivery boys.</td>
                      </tr>
                    ) : (
                      (custody.data ?? [])
                        .filter((c) => c.withDriverAmount > 0)
                        .map((c) => (
                          <tr key={c.deliveryProfileId}>
                            <td>{c.driverName}</td>
                            <td>{c.withDriverLabel}</td>
                            <td>{c.orderCount}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <Link to="/payments?tab=settlements&focus=with_driver">
                  Open Settlements · Receive selected cash
                </Link>
              </div>
            </Card>
          ) : null}

          <DeliveryBrowseBar state={browse} onChange={setBrowse} />

          <DeliveryRoutesTable
            rows={result.rows}
            page={Math.min(browse.page, result.pageCount)}
            pageCount={result.pageCount}
            total={result.total}
            onPageChange={(page) => setBrowse((s) => ({ ...s, page }))}
          />

          {canManageDelivery ? (
            <>
              <DeliveryRouteFormModal
                open={createRouteOpen}
                onClose={() => setCreateRouteOpen(false)}
                onSuccess={(routeId) => navigate(`/delivery/${routeId}`)}
              />
              <ScheduleAssignModal
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                orders={ready.data ?? []}
                onSuccess={(routeId) => {
                  if (routeId) navigate(`/delivery/${routeId}`);
                }}
              />
              <DeliveryProvisionModal
                open={provisionOpen}
                onClose={() => setProvisionOpen(false)}
                onSuccess={(id) => navigate(`/delivery/boys/${id}`)}
              />
              <VehicleFormModal
                open={vehicleModalOpen}
                onClose={() => setVehicleModalOpen(false)}
              />
            </>
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
