import { Link } from 'react-router-dom';
import type { BusinessActivityItem, BusinessActivityKind } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import './RecentBusinessActivity.css';

type Props = {
  items: BusinessActivityItem[];
};

const KIND_LABELS: Record<BusinessActivityKind, string> = {
  order_created: 'Order Created',
  order_cancelled: 'Order Cancelled',
  stock_updated: 'Stock Updated',
  product_added: 'Product Added',
  price_updated: 'Price Updated',
  delivery_completed: 'Delivery Completed',
  customer_registered: 'Customer Added',
  payment_received: 'Payment Received',
  payment_pending: 'Payment Pending',
  salesman_check_in: 'Salesman Check-in',
};

function kindClass(kind: BusinessActivityKind): string {
  return `ga-activity__badge--${kind.replace(/_/g, '-')}`;
}

export function RecentBusinessActivity({ items }: Props) {
  const rows = items.slice(0, 10);

  return (
    <Card title="Recent Business Activity">
      {rows.length === 0 ? (
        <EmptyState
          title="No recent activity"
          detail="Business events will appear here as orders, stock, and customers change."
        />
      ) : (
        <ul className="ga-activity__list">
          {rows.map((item) => (
            <li key={item.id}>
              <Link to={item.href} className="ga-activity__row">
                <span
                  className={['ga-activity__badge', kindClass(item.kind)].join(' ')}
                >
                  {KIND_LABELS[item.kind]}
                </span>
                <div className="ga-activity__body">
                  <p className="ga-activity__title">{item.title}</p>
                  <p className="ga-activity__detail">{item.detail}</p>
                  <p className="ga-activity__meta">
                    {item.actorLabel ? `By ${item.actorLabel}` : 'System'}
                  </p>
                </div>
                <time className="ga-activity__time">{item.timestampLabel}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RecentBusinessActivitySkeleton() {
  return (
    <Card title="Recent Business Activity">
      <ul className="ga-activity__list" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className="ga-activity__row ga-activity__row--skeleton">
              <div className="ga-skeleton ga-skeleton--badge" />
              <div className="ga-activity__body">
                <div className="ga-skeleton ga-skeleton--line ga-skeleton--title" />
                <div className="ga-skeleton ga-skeleton--line ga-skeleton--detail" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
