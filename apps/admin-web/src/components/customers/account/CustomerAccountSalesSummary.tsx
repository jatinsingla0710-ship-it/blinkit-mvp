import { Link } from 'react-router-dom';
import type { CustomerAccountSummary } from '@/data/customers-types';
import { Card } from '@/components/ui/Card';
import './CustomerAccountSections.css';

type Props = {
  summary: CustomerAccountSummary;
  shopName: string;
};

export function CustomerAccountSalesSummary({ summary, shopName }: Props) {
  return (
    <Card id="sales" title="Sales Summary" className="ga-cust-account-card">
      <dl className="ga-cust-account-sales">
        <div>
          <dt>Lifetime sales</dt>
          <dd>{summary.totalSalesLabel}</dd>
        </div>
        <div>
          <dt>{summary.fyLabel} sales</dt>
          <dd>{summary.fySalesLabel}</dd>
        </div>
        <div>
          <dt>Completed sales</dt>
          <dd>{summary.completedSalesCount}</dd>
        </div>
        <div>
          <dt>Last purchase</dt>
          <dd>{summary.lastPurchaseLabel}</dd>
        </div>
      </dl>
      <Link
        to={`/reports/sales?q=${encodeURIComponent(shopName)}`}
        className="ga-cust-account-link"
      >
        View customer sales
      </Link>
    </Card>
  );
}
