import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { VehicleFormModal } from '@/components/delivery/VehicleFormModal';
import type { VehicleListRow } from '@/data/delivery-types';
import { mapVehicleUiStatus } from '@/data/delivery-setup-helpers';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useVehiclesListQuery } from '@/data/hooks';
import { useUpsertVehicleMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryListPage.css';

export function VehiclesListPage() {
  const { state } = useVehiclesListQuery();
  const upsert = useUpsertVehicleMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('delivery:manage');

  const setMaintenance = async (v: VehicleListRow) => {
    setError(null);
    try {
      await upsert.mutateAsync({
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        vehicleType: v.vehicleType,
        capacityLabel: v.capacityLabel === '—' ? undefined : v.capacityLabel,
        isActive: v.isActive,
        status: 'MAINTENANCE',
        assignedDeliveryProfileId: v.assignedDriverId,
        notes: v.notes ?? undefined,
      });
    } catch (err) {
      setError(formatMutationError(err, 'Could not update vehicle'));
    }
  };

  const activate = async (v: VehicleListRow) => {
    setError(null);
    try {
      await upsert.mutateAsync({
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        vehicleType: v.vehicleType,
        capacityLabel: v.capacityLabel === '—' ? undefined : v.capacityLabel,
        isActive: true,
        status: 'AVAILABLE',
        assignedDeliveryProfileId: v.assignedDriverId,
        notes: v.notes ?? undefined,
      });
    } catch (err) {
      setError(formatMutationError(err, 'Could not activate vehicle'));
    }
  };

  return (
    <QueryStateGate title="Vehicles" state={state}>
      {(rows) => (
        <div className="ga-dl-list">
          <PageHeader
            title="Vehicles"
            subtitle="Company fleet · assign to delivery boys"
            meta={<Link to="/delivery">← Delivery</Link>}
          />
          {canManage ? (
            <Card title="Quick actions">
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                ➕ Add Vehicle
              </Button>
            </Card>
          ) : null}
          {error ? (
            <p style={{ color: 'var(--ga-color-danger)' }}>{error}</p>
          ) : null}
          <Card title="Fleet">
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Assigned driver</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td className="ga-table__mono">{v.vehicleNumber}</td>
                      <td>{v.vehicleType}</td>
                      <td>{mapVehicleUiStatus(v.status, v.isActive)}</td>
                      <td>{v.assignedDriverName ?? '—'}</td>
                      <td>
                        {canManage ? (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditing(v);
                                setModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => void setMaintenance(v)}
                            >
                              Maintenance
                            </Button>
                            {!v.isActive || v.status === 'maintenance' ? (
                              <Button
                                variant="ghost"
                                onClick={() => void activate(v)}
                              >
                                Activate
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {canManage ? (
            <VehicleFormModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              vehicle={editing}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
