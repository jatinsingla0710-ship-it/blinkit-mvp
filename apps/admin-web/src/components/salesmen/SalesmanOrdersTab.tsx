import { Link } from 'react-router-dom';
import type { SalesmanOrderRow } from '@/data/salesmen-types';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: SalesmanOrderRow[];
};

export function SalesmanOrdersTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No orders"
        detail="Orders tagged to this salesman will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to="/orders"
                  className="ga-table__mono"
                  style={{ color: 'var(--ga-primary-dark)', fontWeight: 700 }}
                >
                  {row.orderCode}
                </Link>
              </td>
              <td>{row.customerName}</td>
              <td>{row.amountLabel}</td>
              <td>{row.statusLabel}</td>
              <td>{row.dateLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
