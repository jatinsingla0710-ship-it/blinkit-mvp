import type { PriceRecordRow } from '@/data/pricing-types';
import { PriceStatusBadge } from '@/components/pricing/PriceStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import './PriceHistoryTimeline.css';

type Props = {
  rows: PriceRecordRow[];
};

/**
 * Append-only price history timeline.
 * Records are displayed newest-first; values are never edited in place.
 */
export function PriceHistoryTimeline({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No price history"
        detail="Append-only trade price records will appear here."
      />
    );
  }

  return (
    <ol className="ga-price-timeline">
      {rows.map((row, index) => (
        <li key={row.id} className="ga-price-timeline__item">
          <div className="ga-price-timeline__rail">
            <span
              className={[
                'ga-price-timeline__dot',
                row.status === 'live' ? 'ga-price-timeline__dot--live' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            {index < rows.length - 1 ? (
              <span className="ga-price-timeline__line" />
            ) : null}
          </div>
          <div className="ga-price-timeline__body">
            <div className="ga-price-timeline__header">
              <p className="ga-price-timeline__price">{row.tradePriceLabel}</p>
              <PriceStatusBadge status={row.status} />
            </div>
            <p className="ga-price-timeline__range">
              {row.effectiveFromLabel}
              {row.effectiveToLabel
                ? ` → ${row.effectiveToLabel}`
                : ' → open'}
            </p>
            <p className="ga-price-timeline__meta">
              Recorded {row.createdAtLabel} · {row.createdByLabel}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
