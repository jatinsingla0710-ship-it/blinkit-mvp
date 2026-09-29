import type { CustomerActivityRow } from '@/data/customers-types';
import { CUSTOMER_ACTIVITY_UNAVAILABLE_DETAIL } from '@/data/customers-helpers';
import { EmptyState } from '@/components/ui/EmptyState';
import './CustomerActivityTab.css';

type Props = {
  rows: CustomerActivityRow[];
  /** Live Admin has no activity feed table — show deferred copy when empty. */
  deferred?: boolean;
};

export function CustomerActivityTab({ rows, deferred = false }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={deferred ? 'Activity not available' : 'No activity'}
        detail={
          deferred
            ? CUSTOMER_ACTIVITY_UNAVAILABLE_DETAIL
            : 'Orders and visits for this shop will appear here.'
        }
      />
    );
  }

  return (
    <ol className="ga-cust-activity">
      {rows.map((row) => (
        <li key={row.id} className="ga-cust-activity__item">
          <div className="ga-cust-activity__when">{row.atLabel}</div>
          <div>
            <p className="ga-cust-activity__action">{row.actionLabel}</p>
            <p className="ga-cust-activity__detail">{row.detail}</p>
            <p className="ga-cust-activity__actor">{row.actorLabel}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
