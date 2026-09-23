import type { CustomerHealth } from '@/data/customers-types';
import { CustomerPaymentStatusBadge } from '@/components/customers/CustomerStatusBadges';
import { Card } from '@/components/ui/Card';
import './CustomerHealthCard.css';

type Props = {
  health: CustomerHealth;
};

export function CustomerHealthCard({ health }: Props) {
  return (
    <Card title="Customer Health">
      <dl className="ga-cust-health">
        <div>
          <dt>Orders this month</dt>
          <dd>{health.ordersThisMonth}</dd>
        </div>
        <div>
          <dt>Average order value (this month)</dt>
          <dd>{health.averageOrderValueLabel}</dd>
        </div>
        <div>
          <dt>Last order date</dt>
          <dd>{health.lastOrderDateLabel}</dd>
        </div>
        <div>
          <dt>Last payment status</dt>
          <dd>
            <CustomerPaymentStatusBadge status={health.lastPaymentStatus} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}
