import { Link } from 'react-router-dom';
import type { CustomerAttentionItem } from '@/data/customers-types';
import { Card } from '@/components/ui/Card';
import './CustomerAccountNeedsAttention.css';

type Props = {
  items: CustomerAttentionItem[];
};

export function CustomerAccountNeedsAttention({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <Card
      id="attention"
      title="Needs Attention"
      className="ga-cust-account-attention"
    >
      <p className="ga-cust-account-attention__lead">
        {items.length} item{items.length === 1 ? '' : 's'} require action
      </p>
      <ul className="ga-cust-account-attention__list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.reason}</strong>
              <p>{item.description}</p>
            </div>
            <Link to={item.href} className="ga-cust-account-attention__action">
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
