import type { RecentOrderRow } from '@/data/dashboard-types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  orders: RecentOrderRow[];
};

function statusTone(status: RecentOrderRow['status']) {
  switch (status) {
    case 'Delivered':
      return 'success' as const;
    case 'Failed':
      return 'danger' as const;
    case 'Out for Delivery':
      return 'info' as const;
    case 'Packing':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

export function RecentOrders({ orders }: Props) {
  return (
    <Card title="Recent Orders">
      {orders.length === 0 ? (
        <EmptyState
          title="No recent orders"
          detail="Live order feed will appear here once connected."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="ga-table__mono">{order.orderCode}</td>
                  <td>
                    <span className="ga-table__primary">{order.shopName}</span>
                  </td>
                  <td>{order.amountLabel}</td>
                  <td>
                    <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                  </td>
                  <td>{order.placedAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
