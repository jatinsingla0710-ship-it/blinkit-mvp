import type { StockReservationRow } from '@/data/inventory-types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: StockReservationRow[];
};

export function ReservationsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reservations"
        detail="Stock held for open wholesale orders will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Shop</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Reserved</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="ga-table__mono">{row.orderCode}</td>
              <td>
                <span className="ga-table__primary">{row.shopName}</span>
              </td>
              <td>{row.quantityLabel}</td>
              <td>
                <Badge tone="info">{row.statusLabel}</Badge>
              </td>
              <td>{row.reservedAtLabel}</td>
              <td>{row.expiresAtLabel ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
