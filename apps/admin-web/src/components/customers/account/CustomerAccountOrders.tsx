import { Link } from 'react-router-dom';
import type { CustomerOrderRow } from '@/data/customers-types';
import { CustomerPaymentStatusBadge } from '@/components/customers/CustomerStatusBadges';
import { Card } from '@/components/ui/Card';
import './CustomerAccountSections.css';

type Props = {
  orders: CustomerOrderRow[];
  shopName: string;
};

export function CustomerAccountRecentOrders({ orders, shopName }: Props) {
  const recent = orders.slice(0, 5);

  return (
    <Card title="Recent Orders" className="ga-cust-account-card">
      {recent.length === 0 ? (
        <p className="ga-cust-account-empty">No orders yet for this customer.</p>
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table ga-cust-account-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/orders/${row.id}`} className="ga-table__primary">
                      {row.orderCode}
                    </Link>
                  </td>
                  <td>{row.placedAtLabel}</td>
                  <td>{row.valueLabel}</td>
                  <td>{row.fulfillmentLabel}</td>
                  <td>
                    <CustomerPaymentStatusBadge status={row.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link
        to={`/orders?q=${encodeURIComponent(shopName)}`}
        className="ga-cust-account-link"
      >
        View all orders
      </Link>
    </Card>
  );
}
