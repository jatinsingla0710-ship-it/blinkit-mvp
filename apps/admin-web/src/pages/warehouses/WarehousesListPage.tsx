import { useState } from 'react';
import { usePermissions } from '@groaurum/auth/react';
import { ActionBar } from '@groaurum/ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { WarehouseFormModal } from '@/components/warehouses/WarehouseFormModal';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useWarehousesListQuery } from '@/data/hooks';
import { useUpdateWarehouseMutation } from '@/data/mutations';
import type { WarehouseListItem } from '@/data/warehouse-model';
import { INVENTORY_SECTION_LINKS, SETTINGS_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './WarehousesListPage.css';

/**
 * Warehouses — storage locations (Settings / Inventory).
 */
export function WarehousesListPage() {
  const { hasAnyRole } = usePermissions();
  const canWrite = hasAnyRole([
    'super_admin',
    'operations_manager',
    'warehouse_manager',
  ]);
  const { state } = useWarehousesListQuery();
  const updateWarehouse = useUpdateWarehouseMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selected, setSelected] = useState<WarehouseListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreate = () => {
    setFormMode('create');
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (row: WarehouseListItem) => {
    setFormMode('edit');
    setSelected(row);
    setFormOpen(true);
  };

  const toggleActive = (row: WarehouseListItem) => {
    setActionError(null);
    updateWarehouse.mutate(
      {
        id: row.id,
        input: { isActive: row.status !== 'active' },
      },
      {
        onError: (err) =>
          setActionError(
            err instanceof Error ? err.message : 'Status update failed',
          ),
      },
    );
  };

  return (
    <QueryStateGate title="Warehouses" state={state}>
      {(rows) => (
        <div className="ga-wh-list">
          <PageHeader
            title="Warehouses"
            subtitle="Storage locations used for stock and dispatch"
            meta={`${rows.length} locations`}
          />

          <SectionRelatedLinks
            label="Related"
            links={[
              ...INVENTORY_SECTION_LINKS.filter((l) => l.to !== '/warehouses'),
              SETTINGS_SECTION_LINKS[0],
            ]}
          />

          {canWrite ? (
            <Card title="Actions">
              <ActionBar>
                <Button variant="primary" onClick={openCreate}>
                  Create Warehouse
                </Button>
              </ActionBar>
            </Card>
          ) : null}

          {actionError ? (
            <p className="ga-wh-list__error">{actionError}</p>
          ) : null}

          <Card title="Warehouses">
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>City</th>
                    <th>State</th>
                    <th>PIN</th>
                    <th>Address</th>
                    <th>Status</th>
                    {canWrite ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="ga-table__primary">{row.name}</span>
                      </td>
                      <td>{row.city}</td>
                      <td>{row.state}</td>
                      <td className="ga-table__mono">{row.pinCode}</td>
                      <td>{row.addressLine}</td>
                      <td>
                        <Badge
                          tone={
                            row.status === 'active' ? 'success' : 'neutral'
                          }
                        >
                          {row.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      {canWrite ? (
                        <td>
                          <ActionBar>
                            <Button
                              variant="secondary"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => toggleActive(row)}
                              disabled={updateWarehouse.isPending}
                            >
                              {row.status === 'active'
                                ? 'Deactivate'
                                : 'Activate'}
                            </Button>
                          </ActionBar>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <WarehouseFormModal
            open={formOpen}
            mode={formMode}
            warehouse={selected}
            onClose={() => setFormOpen(false)}
          />
        </div>
      )}
    </QueryStateGate>
  );
}
