import type { OrderActivityRow } from '@/data/orders-types';
import { EmptyState } from '@/components/ui/EmptyState';
import './OrderActivityLog.css';

type Props = {
  rows: OrderActivityRow[];
};

/**
 * Append-only audit history for order operations.
 */
export function OrderActivityLog({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No activity"
        detail="Operational audit events will appear here."
      />
    );
  }

  return (
    <ol className="ga-ord-activity">
      {rows.map((row) => (
        <li key={row.id} className="ga-ord-activity__item">
          <div className="ga-ord-activity__when">{row.atLabel}</div>
          <div className="ga-ord-activity__body">
            <p className="ga-ord-activity__action">{row.actionLabel}</p>
            <p className="ga-ord-activity__detail">{row.detail}</p>
            <p className="ga-ord-activity__actor">{row.actorLabel}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
