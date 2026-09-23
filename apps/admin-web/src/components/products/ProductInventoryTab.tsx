import type { InventoryMovementRow } from '@/data/product-types';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: InventoryMovementRow[];
};

export function ProductInventoryTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No inventory movements"
        detail="Receipts, sales, and adjustments will list here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Location</th>
            <th>When</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="ga-table__mono">{row.skuCode}</td>
              <td>{row.typeLabel}</td>
              <td>{row.quantityLabel}</td>
              <td>{row.locationLabel}</td>
              <td>{row.atLabel}</td>
              <td>{row.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
