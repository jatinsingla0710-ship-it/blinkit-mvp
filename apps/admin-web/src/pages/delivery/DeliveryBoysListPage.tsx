import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { DeliveryProvisionModal } from '@/components/delivery/DeliveryProvisionModal';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { mapDeliveryBoyUiStatus } from '@/data/delivery-setup-helpers';
import { useDeliveryBoysSnapshotQuery } from '@/data/hooks';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryListPage.css';

export function DeliveryBoysListPage() {
  const { state } = useDeliveryBoysSnapshotQuery();
  const [provisionOpen, setProvisionOpen] = useState(false);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('delivery:manage');

  return (
    <QueryStateGate title="Delivery boys" state={state}>
      {(snapshot) => (
        <div className="ga-dl-list">
          <PageHeader
            title="Delivery boys"
            subtitle="Add and manage your delivery team"
            meta={
              <span>
                <Link to="/delivery">← Delivery</Link>
                {` · ${snapshot.generatedAtLabel}`}
              </span>
            }
          />
          <KpiCards items={snapshot.kpis} />
          {canManage ? (
            <Card title="Quick actions">
              <Button variant="primary" onClick={() => setProvisionOpen(true)}>
                ➕ Add Delivery Boy
              </Button>
            </Card>
          ) : null}
          <Card title="Team">
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Status</th>
                    <th>Current trip</th>
                    <th>Vehicle</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/delivery/boys/${row.id}`)}
                    >
                      <td>{row.name}</td>
                      <td>{row.mobileLabel}</td>
                      <td>
                        {mapDeliveryBoyUiStatus({
                          employmentStatus: row.employmentStatus,
                          operationalStatus: row.operationalStatus,
                        })}
                      </td>
                      <td>{row.currentRouteLabel ?? '—'}</td>
                      <td>{row.vehicleLabel ?? '—'}</td>
                      <td>{row.serviceAreaLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {canManage ? (
            <DeliveryProvisionModal
              open={provisionOpen}
              onClose={() => setProvisionOpen(false)}
              onSuccess={(id) => navigate(`/delivery/boys/${id}`)}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
