import { Link } from 'react-router-dom';
import type { OrderAttentionItem } from '@/data/order-attention';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import './OrdersAttentionPanel.css';

type Props = {
  items: OrderAttentionItem[];
};

function actionHref(item: OrderAttentionItem): string {
  const tab =
    item.attentionCategory === 'payment'
      ? 'payment'
      : item.attentionCategory === 'delivery'
        ? 'delivery'
        : item.attentionCategory === 'sale'
          ? 'invoice'
          : 'overview';
  return `/orders/${item.orderId}?tab=${tab}`;
}

export function OrdersAttentionPanel({ items }: Props) {
  if (items.length === 0) {
    return (
      <Card title="Needs Attention">
        <EmptyState
          title="All clear"
          detail="No orders currently need manual action."
        />
      </Card>
    );
  }

  return (
    <Card title="Needs Attention">
      <div className="ga-orders-attention-panel">
        {items.map((item) => (
          <article
            key={item.orderId}
            className={`ga-orders-attention-panel__item ga-orders-attention-panel__item--${item.severity}`}
          >
            <div className="ga-orders-attention-panel__head">
              <div>
                <p className="ga-orders-attention-panel__order">
                  #{item.orderNumber}
                </p>
                <p className="ga-orders-attention-panel__customer">
                  {item.customerName}
                </p>
              </div>
              <span className="ga-orders-attention-panel__stage">
                {item.currentStatus}
              </span>
            </div>

            <div className="ga-orders-attention-panel__reason">
              <span className="ga-orders-attention-panel__warn" aria-hidden>
                !
              </span>
              <div>
                <p className="ga-orders-attention-panel__reason-title">
                  {item.attentionReason}
                </p>
                <p className="ga-orders-attention-panel__reason-detail">
                  {item.attentionDescription}
                </p>
              </div>
            </div>

            <div className="ga-orders-attention-panel__actions">
              <Link
                to={actionHref(item)}
                className="ga-orders-attention-panel__btn ga-orders-attention-panel__btn--primary"
              >
                {item.suggestedAction}
              </Link>
              <Link
                to={`/orders/${item.orderId}`}
                className="ga-orders-attention-panel__btn"
              >
                Open Order
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
