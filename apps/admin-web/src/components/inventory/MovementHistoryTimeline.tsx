import type { StockMovementRow } from '@/data/inventory-types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import './MovementHistoryTimeline.css';

type Props = {
  rows: StockMovementRow[];
};

function movementTone(type: StockMovementRow['type']) {
  switch (type) {
    case 'supplier_receipt':
      return 'success' as const;
    case 'customer_order':
      return 'info' as const;
    case 'damage':
      return 'danger' as const;
    case 'manual_adjustment':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

/**
 * Append-only stock movement ledger timeline.
 */
export function MovementHistoryTimeline({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No movements"
        detail="Supplier receipts, orders, damage, and adjustments will list here."
      />
    );
  }

  return (
    <ol className="ga-inv-timeline">
      {rows.map((row, index) => (
        <li key={row.id} className="ga-inv-timeline__item">
          <div className="ga-inv-timeline__rail">
            <span className="ga-inv-timeline__dot" />
            {index < rows.length - 1 ? (
              <span className="ga-inv-timeline__line" />
            ) : null}
          </div>
          <div className="ga-inv-timeline__body">
            <div className="ga-inv-timeline__header">
              <p className="ga-inv-timeline__qty">{row.quantityLabel}</p>
              <Badge tone={movementTone(row.type)}>{row.typeLabel}</Badge>
            </div>
            <p className="ga-inv-timeline__meta">
              {row.warehouseName}
              {row.referenceLabel ? ` · ${row.referenceLabel}` : ''}
              {row.unitCostLabel ? ` · unit cost ${row.unitCostLabel}` : ''}
            </p>
            <p className="ga-inv-timeline__when">
              {row.atLabel} · {row.recordedByLabel}
            </p>
            {row.note ? (
              <p className="ga-inv-timeline__note">{row.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
