import { Link } from 'react-router-dom';
import { Modal, Button } from '@groaurum/ui';
import type { SalesmanWorkingTodayRow } from '@/data/dashboard-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSalesmenWorkingTodayQuery } from '@/data/hooks';
import { formatDateTime } from '@/data/live/format';
import '@groaurum/ui/styles/data-table.css';
import './SalesmenWorkingTodayModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

function stateLabel(state: string): string {
  return state.replace(/_/g, ' ');
}

function lastVisitLabel(row: SalesmanWorkingTodayRow): string {
  if (!row.lastVisit) return '—';
  const when = row.lastVisit.visitedAt
    ? formatDateTime(row.lastVisit.visitedAt)
    : '';
  return [row.lastVisit.shopName, when].filter(Boolean).join(' · ') || '—';
}

export function SalesmenWorkingTodayModal({ open, onClose }: Props) {
  const query = useSalesmenWorkingTodayQuery(open);

  return (
    <Modal
      open={open}
      title="Salesmen Working Today"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="ga-salesmen-working-modal">
        {query.isPending ? (
          <p className="ga-salesmen-working-modal__note">Loading…</p>
        ) : query.isError ? (
          <p className="ga-salesmen-working-modal__error">
            {query.error instanceof Error
              ? query.error.message
              : 'Could not load working salesmen'}
          </p>
        ) : (query.data?.salesmen.length ?? 0) === 0 ? (
          <EmptyState
            title="No salesmen working today"
            detail="Attendance start or visit activity will appear here."
          />
        ) : (
          <>
            <p className="ga-salesmen-working-modal__note">
              As of {query.data?.asOfDate || 'today'} ·{' '}
              {query.data?.salesmen.length} working
            </p>
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Area</th>
                    <th>Visits</th>
                    <th>Orders</th>
                    <th>Last visit</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.salesmen ?? []).map((row) => (
                    <tr key={row.profileId}>
                      <td>
                        <Link to={`/salesmen/${row.profileId}`} onClick={onClose}>
                          {row.displayName}
                        </Link>
                      </td>
                      <td>{stateLabel(row.operationalState)}</td>
                      <td>{row.serviceAreaName || '—'}</td>
                      <td>{row.visitsToday}</td>
                      <td>{row.ordersToday}</td>
                      <td>{lastVisitLabel(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
