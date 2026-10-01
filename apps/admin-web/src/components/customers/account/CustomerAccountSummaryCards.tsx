import { Link } from 'react-router-dom';
import type { CustomerAccountSummary } from '@/data/customers-types';
import './CustomerAccountSummaryCards.css';

type Card = {
  id: string;
  icon: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'positive' | 'info';
};

type Props = {
  summary: CustomerAccountSummary;
  shopName: string;
};

export function CustomerAccountSummaryCards({ summary, shopName }: Props) {
  const cards: Card[] = [
    {
      id: 'orders',
      icon: '📦',
      label: 'Total Orders',
      value: `${summary.totalOrders}`,
      hint: 'All non-cancelled orders',
      href: `/orders?q=${encodeURIComponent(shopName)}`,
    },
    {
      id: 'sales',
      icon: '💰',
      label: 'Total Sales',
      value: summary.totalSalesLabel,
      hint: 'Delivered orders',
      href: `#sales`,
    },
    {
      id: 'current',
      icon: '🛒',
      label: 'Current Orders',
      value: `${summary.currentOrders}`,
      hint: 'In progress',
      href: `#activity`,
    },
    {
      id: 'delivery',
      icon: '🚚',
      label: 'Out for Delivery',
      value: `${summary.outForDelivery}`,
      hint: 'On the road now',
      href: `#activity`,
      tone: summary.outForDelivery > 0 ? 'info' : 'default',
    },
  ];

  if (summary.needsAttention > 0) {
    cards.push({
      id: 'attention',
      icon: '⚠️',
      label: 'Needs Attention',
      value: `${summary.needsAttention}`,
      hint: 'Requires action',
      href: `#attention`,
      tone: 'warning',
    });
  }

  if (summary.outstandingLabel) {
    cards.push({
      id: 'outstanding',
      icon: '💳',
      label: 'Outstanding',
      value: summary.outstandingLabel,
      hint: 'Amount still due',
      href: `#ledger`,
      tone: 'warning',
    });
  }

  return (
    <div className="ga-cust-account-kpis">
      {cards.map((card) => {
        const className = [
          'ga-cust-account-kpi',
          card.tone ? `ga-cust-account-kpi--${card.tone}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        const body = (
          <>
            <span className="ga-cust-account-kpi__icon" aria-hidden>
              {card.icon}
            </span>
            <span className="ga-cust-account-kpi__label">{card.label}</span>
            <span className="ga-cust-account-kpi__value">{card.value}</span>
            {card.hint ? (
              <span className="ga-cust-account-kpi__hint">{card.hint}</span>
            ) : null}
          </>
        );

        return card.href ? (
          card.href.startsWith('/') ? (
            <Link key={card.id} to={card.href} className={`${className} ga-cust-account-kpi--link`}>
              {body}
            </Link>
          ) : (
            <a
              key={card.id}
              href={card.href}
              className={`${className} ga-cust-account-kpi--link`}
            >
              {body}
            </a>
          )
        ) : (
          <div key={card.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
