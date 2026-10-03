import { Link } from 'react-router-dom';
import type { AttentionAlert } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import './AttentionRequired.css';

type Props = {
  alerts: AttentionAlert[];
};

/** Short “why it matters” copy for existing attention ids — presentation only. */
const ATTENTION_WHY: Record<string, string> = {
  low_stock: 'Stock may run out — check inventory before orders stall.',
  stale_pending: 'Orders waiting too long — process or follow up.',
  failed_delivery: 'Delivery failed — investigate and reattempt.',
  delivered_unpaid: 'Goods delivered but payment still open.',
  payment_amount_mismatch: 'Collected amount does not match the order total.',
  pending_payments: 'Customer payments still pending collection.',
  customer_money_due: 'Customer balances are open — follow up on collection.',
  supplier_money_to_pay: 'Supplier balances are open — record payments due.',
  draft_purchases: 'Supplier bills are drafted but stock has not been received.',
};

function severityClass(severity: AttentionAlert['severity']): string {
  return `ga-attention__item--${severity}`;
}

export function AttentionRequired({ alerts }: Props) {
  return (
    <Card title="Needs attention">
      {alerts.length === 0 ? (
        <div className="ga-attention__ok">
          <span className="ga-attention__ok-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="ga-attention__ok-title">Everything looks good</p>
            <p className="ga-attention__ok-detail">
              No urgent items need your attention right now.
            </p>
          </div>
        </div>
      ) : (
        <ul className="ga-attention__list">
          {alerts.map((alert) => {
            const why = ATTENTION_WHY[alert.id];
            return (
              <li key={alert.id}>
                <Link
                  to={alert.href}
                  className={['ga-attention__item', severityClass(alert.severity)].join(
                    ' ',
                  )}
                >
                  <span className="ga-attention__count">{alert.count}</span>
                  <span className="ga-attention__body">
                    <span className="ga-attention__title">{alert.title}</span>
                    {why ? (
                      <span className="ga-attention__why">{why}</span>
                    ) : null}
                  </span>
                  <span className="ga-attention__chevron" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function AttentionRequiredSkeleton() {
  return (
    <Card title="Needs attention">
      <ul className="ga-attention__list" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i}>
            <div className="ga-attention__item ga-attention__item--skeleton">
              <div className="ga-skeleton ga-skeleton--line ga-skeleton--count-sm" />
              <div className="ga-skeleton ga-skeleton--line ga-skeleton--title" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
