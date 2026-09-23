import type { StockAdjustmentRow } from '@/data/inventory-types';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: StockAdjustmentRow[];
};

export function AdjustmentsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No adjustments"
        detail="Manual corrections and write-offs will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Reason</th>
            <th>Quantity</th>
            <th>Warehouse</th>
            <th>When</th>
            <th>By</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="ga-table__primary">{row.reasonLabel}</span>
              </td>
              <td>{row.quantityLabel}</td>
              <td>{row.warehouseName}</td>
              <td>{row.atLabel}</td>
              <td>{row.recordedByLabel}</td>
              <td>{row.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
