import { Link } from 'react-router-dom';
import type { CustomerPaymentRow } from '@/data/customers-types';
import { CustomerPaymentStatusBadge } from '@/components/customers/CustomerStatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: CustomerPaymentRow[];
};

export function CustomerPaymentsTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No payments recorded yet."
        detail="Receive payment or collect against a sale to see history here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.atLabel}</td>
              <td>{row.amountLabel}</td>
              <td>{row.methodLabel}</td>
              <td>
                {row.source === 'collection' ? (
                  <span>
                    Receive payment
                    {row.note ? ` · ${row.note}` : ''}
                  </span>
                ) : row.orderId ? (
                  <Link className="ga-table__mono" to={`/orders/${row.orderId}`}>
                    {row.orderCode}
                  </Link>
                ) : (
                  <span className="ga-table__mono">{row.orderCode}</span>
                )}
              </td>
              <td>
                <CustomerPaymentStatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
