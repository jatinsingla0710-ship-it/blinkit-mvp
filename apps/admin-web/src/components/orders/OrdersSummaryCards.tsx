import { Link } from 'react-router-dom';
import type { OrdersDashboardKpi } from '@/data/orders-types';
import './OrdersSummaryCards.css';

type Props = {
  items: OrdersDashboardKpi[];
};

export function OrdersSummaryCards({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="ga-ord-summary ga-ord-summary--empty">
        <p>No summary metrics available.</p>
      </div>
    );
  }

  return (
    <div className="ga-ord-summary">
      {items.map((kpi) => {
        const className = [
          'ga-ord-summary__card',
          kpi.tone ? `ga-ord-summary__card--${kpi.tone}` : '',
          kpi.id === 'needs_attention' && Number(kpi.value) > 0
            ? 'ga-ord-summary__card--attention'
            : '',
        ]
          .filter(Boolean)
          .join(' ');

        const body = (
          <>
            <p className="ga-ord-summary__label">{kpi.label}</p>
            <p className="ga-ord-summary__value">{kpi.value}</p>
            {kpi.subtitle ? (
              <p className="ga-ord-summary__subtitle">{kpi.subtitle}</p>
            ) : null}
            {kpi.bullets && kpi.bullets.length > 0 ? (
              <ul className="ga-ord-summary__bullets">
                {kpi.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {kpi.hint ? (
              <p className="ga-ord-summary__hint">{kpi.hint}</p>
            ) : null}
          </>
        );

        if (kpi.href) {
          return (
            <Link key={kpi.id} to={kpi.href} className={className}>
              {body}
            </Link>
          );
        }

        return (
          <article key={kpi.id} className={className}>
            {body}
          </article>
        );
      })}
    </div>
  );
}
