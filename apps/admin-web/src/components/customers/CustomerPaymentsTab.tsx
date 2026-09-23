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
        title="No payments"
        detail="Collections and online settlements will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="ga-table__mono">{row.orderCode}</td>
              <td>{row.methodLabel}</td>
              <td>{row.amountLabel}</td>
              <td>
                <CustomerPaymentStatusBadge status={row.status} />
              </td>
              <td>{row.atLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
