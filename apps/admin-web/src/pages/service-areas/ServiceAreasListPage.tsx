import { useState } from 'react';
import { usePermissions } from '@groaurum/auth/react';
import { ActionBar } from '@groaurum/ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { ServiceAreaFormModal } from '@/components/service-areas/ServiceAreaFormModal';
import { ServiceAreaPinsModal } from '@/components/service-areas/ServiceAreaPinsModal';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useServiceAreasListQuery } from '@/data/hooks';
import { useUpdateServiceAreaMutation } from '@/data/mutations';
import type { ServiceAreaListItem } from '@/data/service-area-model';
import { SETTINGS_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './ServiceAreasListPage.css';

/**
 * Service Areas — coverage territories (under Settings).
 */
export function ServiceAreasListPage() {
  const { hasAnyRole } = usePermissions();
  const canWrite = hasAnyRole(['super_admin', 'operations_manager']);
  const { state } = useServiceAreasListQuery();
  const updateArea = useUpdateServiceAreaMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selected, setSelected] = useState<ServiceAreaListItem | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreate = () => {
    setFormMode('create');
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (row: ServiceAreaListItem) => {
    setFormMode('edit');
    setSelected(row);
    setFormOpen(true);
  };

  const openPins = (row: ServiceAreaListItem) => {
    setSelected(row);
    setPinsOpen(true);
  };

  const toggleActive = (row: ServiceAreaListItem) => {
    setActionError(null);
    updateArea.mutate(
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
    <QueryStateGate title="Service Areas" state={state}>
      {(rows) => (
        <div className="ga-sa-list">
          <PageHeader
            title="Service Areas"
            subtitle="Where your team sells and delivers"
            meta={`${rows.length} areas`}
          />

          <SectionRelatedLinks
            label="Settings"
            links={[...SETTINGS_SECTION_LINKS]}
          />

          {canWrite ? (
            <Card title="Actions">
              <ActionBar>
                <Button variant="primary" onClick={openCreate}>
                  Create Service Area
                </Button>
              </ActionBar>
            </Card>
          ) : null}

          {actionError ? (
            <p className="ga-sa-list__error">{actionError}</p>
          ) : null}

          <Card title="Service Areas">
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>PIN count</th>
                    <th>PIN codes</th>
                    {canWrite ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="ga-table__primary">{row.name}</span>
                      </td>
                      <td>{row.description || '—'}</td>
                      <td>
                        <Badge
                          tone={
                            row.status === 'active' ? 'success' : 'neutral'
                          }
                        >
                          {row.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>{row.pinCount}</td>
                      <td className="ga-sa-list__pins">
                        {row.pinCodes.length > 0
                          ? row.pinCodes.join(', ')
                          : '—'}
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
                              disabled={updateArea.isPending}
                            >
                              {row.status === 'active'
                                ? 'Deactivate'
                                : 'Activate'}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => openPins(row)}
                            >
                              Manage PINs
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

          <ServiceAreaFormModal
            open={formOpen}
            mode={formMode}
            area={selected}
            onClose={() => setFormOpen(false)}
          />
          <ServiceAreaPinsModal
            open={pinsOpen}
            area={selected}
            onClose={() => setPinsOpen(false)}
          />
        </div>
      )}
    </QueryStateGate>
  );
}
