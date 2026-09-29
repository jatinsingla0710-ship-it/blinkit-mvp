import { useMemo, useState } from 'react';
import type { SalesmanAssignedCustomer, SalesmanVisitRow } from '@/data/salesmen-types';
import { SALESMAN_VISITS_EMPTY_DETAIL } from '@/data/salesmen-helpers';
import {
  useCreateSalesVisitMutation,
  useUpdateSalesVisitStatusMutation,
} from '@/data/mutations';
import { VisitStatusBadge } from '@/components/salesmen/SalesmanStatusBadges';
import { EmptyState, Timeline, Button, SelectField } from '@groaurum/ui';
import './SalesmanVisitsTab.css';

type Props = {
  salesmanProfileId: string;
  visits: SalesmanVisitRow[];
  assignedCustomers: SalesmanAssignedCustomer[];
  visitsSource?: 'sales_visits';
  canCreate?: boolean;
  canUpdateStatus?: boolean;
};

export function SalesmanVisitsTab({
  salesmanProfileId,
  visits,
  assignedCustomers,
  visitsSource = 'sales_visits',
  canCreate = false,
  canUpdateStatus = false,
}: Props) {
  const createVisit = useCreateSalesVisitMutation();
  const updateStatus = useUpdateSalesVisitStatusMutation();
  const [shopId, setShopId] = useState('');
  const [plannedLocal, setPlannedLocal] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const shops = useMemo(
    () => assignedCustomers.map((c) => ({ id: c.id, name: c.shopName })),
    [assignedCustomers],
  );

  const onSubmit = () => {
    if (!shopId) {
      setError('Select an assigned shop');
      return;
    }
    setError(null);
    const plannedAt = plannedLocal
      ? new Date(plannedLocal).toISOString()
      : null;
    createVisit.mutate(
      {
        salesmanProfileId,
        shopId,
        plannedAt,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          setShopId('');
          setPlannedLocal('');
          setNotes('');
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Could not create visit'),
      },
    );
  };

  const onMark = (visitId: string, status: 'completed' | 'missed') => {
    setStatusError(null);
    updateStatus.mutate(
      { visitId, status, salesmanProfileId },
      {
        onError: (err) =>
          setStatusError(
            err instanceof Error ? err.message : 'Could not update visit',
          ),
      },
    );
  };

  const createPanel =
    canCreate && shops.length > 0 ? (
      <div className="ga-sm-visits__create">
        {!formOpen ? (
          <Button variant="secondary" onClick={() => setFormOpen(true)}>
            Plan visit
          </Button>
        ) : (
          <div className="ga-sm-visits__form">
            <p className="ga-sm-visits__form-hint">
              Creates a PLANNED row in <code>sales_visits</code> for a shop
              assigned to this salesman. No GPS or route planner.
            </p>
            <SelectField label="Shop" value={shopId} onChange={setShopId}>
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </SelectField>
            <label className="ga-sm-visits__field">
              Planned at (optional)
              <input
                type="datetime-local"
                value={plannedLocal}
                onChange={(e) => setPlannedLocal(e.target.value)}
              />
            </label>
            <label className="ga-sm-visits__field">
              Notes (optional)
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Brief note"
              />
            </label>
            {error ? <p className="ga-sm-visits__error">{error}</p> : null}
            <div className="ga-sm-visits__form-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setError(null);
                }}
                disabled={createVisit.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={onSubmit}
                disabled={createVisit.isPending}
              >
                {createVisit.isPending ? 'Saving…' : 'Create visit'}
              </Button>
            </div>
          </div>
        )}
      </div>
    ) : canCreate && shops.length === 0 ? (
      <p className="ga-sm-visits__source">
        Assign a customer shop before planning a visit.
      </p>
    ) : null;

  if (visits.length === 0) {
    return (
      <div className="ga-sm-visits">
        <p className="ga-sm-visits__source">
          Source: {visitsSource} · Admin can create PLANNED visits and mark
          completed/missed
        </p>
        {createPanel}
        <EmptyState
          title="No visits in sales_visits"
          detail={SALESMAN_VISITS_EMPTY_DETAIL}
        />
      </div>
    );
  }

  const planned = visits.filter((v) => v.status === 'planned').length;
  const completed = visits.filter((v) => v.status === 'completed').length;
  const missed = visits.filter((v) => v.status === 'missed').length;
  const shopClosed = visits.filter((v) => v.status === 'shop_closed').length;

  return (
    <div className="ga-sm-visits">
      <p className="ga-sm-visits__source">
        Source: {visitsSource} · PLANNED → completed/missed via Admin or Sales
        PWA
      </p>
      {createPanel}
      {statusError ? <p className="ga-sm-visits__error">{statusError}</p> : null}
      <div className="ga-sm-visits__summary">
        <span>{planned} planned</span>
        <span>{completed} completed</span>
        <span>{missed} missed</span>
        {shopClosed > 0 ? <span>{shopClosed} shop closed</span> : null}
      </div>
      <Timeline
        items={visits.map((visit) => ({
          id: visit.id,
          title: visit.shopName,
          meta: `${visit.areaLabel} · ${visit.plannedAtLabel}`,
          note: visit.note,
          state: visit.status === 'shop_closed' ? 'skipped' : visit.status,
          trailing: (
            <span className="ga-sm-visits__trailing">
              <VisitStatusBadge status={visit.status} />
              {canUpdateStatus && visit.status === 'planned' ? (
                <span className="ga-sm-visits__status-actions">
                  <Button
                    variant="ghost"
                    disabled={updateStatus.isPending}
                    onClick={() => onMark(visit.id, 'completed')}
                  >
                    Completed
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={updateStatus.isPending}
                    onClick={() => onMark(visit.id, 'missed')}
                  >
                    Missed
                  </Button>
                </span>
              ) : null}
            </span>
          ),
        }))}
      />
    </div>
  );
}
