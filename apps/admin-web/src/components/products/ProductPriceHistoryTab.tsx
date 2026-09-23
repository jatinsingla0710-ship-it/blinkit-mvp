import type { PriceHistoryRow } from '@/data/product-types';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: PriceHistoryRow[];
};

export function ProductPriceHistoryTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No price history"
        detail="Trade price changes will appear here once pricing is connected."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Trade Price</th>
            <th>Effective From</th>
            <th>Effective To</th>
            <th>Changed By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="ga-table__mono">{row.skuCode}</td>
              <td>{row.tradePriceLabel}</td>
              <td>{row.effectiveFromLabel}</td>
              <td>{row.effectiveToLabel ?? 'Current'}</td>
              <td>{row.changedByLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
