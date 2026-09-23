import { Link } from 'react-router-dom';
import type { CustomerOrderRow } from '@/data/customers-types';
import { CustomerPaymentStatusBadge } from '@/components/customers/CustomerStatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: CustomerOrderRow[];
};

export function CustomerOrdersTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        detail="Wholesale orders for this retailer will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Value</th>
            <th>Fulfillment</th>
            <th>Payment</th>
            <th>Placed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to={`/orders/${row.id}`}
                  className="ga-table__mono"
                  style={{ color: 'var(--ga-primary-dark)', fontWeight: 700 }}
                >
                  {row.orderCode}
                </Link>
              </td>
              <td>{row.valueLabel}</td>
              <td>{row.fulfillmentLabel}</td>
              <td>
                <CustomerPaymentStatusBadge status={row.paymentStatus} />
              </td>
              <td>{row.placedAtLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
