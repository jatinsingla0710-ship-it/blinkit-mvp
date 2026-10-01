import { Link } from 'react-router-dom';
import type { CustomerAccountSummary } from '@/data/customers-types';
import './CustomerAccountSummaryCards.css';

type Props = {
  summary: CustomerAccountSummary;
  shopName: string;
  /** From existing customer ledger — do not invent a second balance. */
  totalSalesLabel: string;
  totalPaidLabel: string;
  outstandingLabel: string;
  outstanding: number;
};

type CardTone = 'default' | 'warning' | 'positive' | 'info';

/**
 * Owner-facing money snapshot for a customer.
 * Sales / Paid / Outstanding come from the Phase 3A ledger.
 */
export function CustomerAccountSummaryCards({
  summary,
  shopName,
  totalSalesLabel,
  totalPaidLabel,
  outstandingLabel,
  outstanding,
}: Props) {
  const moneyCards: {
    id: string;
    label: string;
    value: string;
    hint: string;
    href: string;
    tone: CardTone;
  }[] = [
    {
      id: 'sales',
      label: 'Total sales',
      value: totalSalesLabel,
      hint: 'From delivered orders',
      href: '#ledger',
      tone: 'default',
    },
    {
      id: 'paid',
      label: 'Paid',
      value: totalPaidLabel,
      hint: 'Collections recorded',
      href: '#payments',
      tone: 'positive',
    },
    {
      id: 'outstanding',
      label: 'Outstanding',
      value: outstandingLabel,
      hint: outstanding > 0 ? 'Still due from this customer' : 'Nothing due',
      href: '#ledger',
      tone: outstanding > 0 ? 'warning' : 'default',
    },
  ];

  const opsCards: {
    id: string;
    label: string;
    value: string;
    hint: string;
    href: string;
    tone: CardTone;
  }[] = [
    {
      id: 'current',
      label: 'Open orders',
      value: `${summary.currentOrders}`,
      hint: 'In progress',
      href: '#orders',
      tone: 'default',
    },
  ];

  if (summary.outForDelivery > 0) {
    opsCards.push({
      id: 'delivery',
      label: 'Out for delivery',
      value: `${summary.outForDelivery}`,
      hint: 'On the road now',
      href: '#orders',
      tone: 'info',
    });
  }

  if (summary.needsAttention > 0) {
    opsCards.push({
      id: 'attention',
      label: 'Needs attention',
      value: `${summary.needsAttention}`,
      hint: 'Requires action',
      href: '#attention',
      tone: 'warning',
    });
  }

  return (
    <div className="ga-cust-account-kpis" aria-label="Customer account summary">
      <div className="ga-cust-account-kpis__money">
        {moneyCards.map((card) => (
          <SummaryCard key={card.id} {...card} />
        ))}
      </div>
      {opsCards.length > 0 ? (
        <div className="ga-cust-account-kpis__ops">
          {opsCards.map((card) => (
            <SummaryCard key={card.id} {...card} />
          ))}
          <Link
            to={`/orders?q=${encodeURIComponent(shopName)}`}
            className="ga-cust-account-kpis__orders-link"
          >
            View orders →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard(card: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'positive' | 'info';
}) {
  const className = [
    'ga-cust-account-kpi',
    card.tone ? `ga-cust-account-kpi--${card.tone}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span className="ga-cust-account-kpi__label">{card.label}</span>
      <span className="ga-cust-account-kpi__value">{card.value}</span>
      {card.hint ? (
        <span className="ga-cust-account-kpi__hint">{card.hint}</span>
      ) : null}
    </>
  );

  if (card.href) {
    if (card.href.startsWith('#')) {
      return (
        <a href={card.href} className={className}>
          {body}
        </a>
      );
    }
    return (
      <Link to={card.href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
