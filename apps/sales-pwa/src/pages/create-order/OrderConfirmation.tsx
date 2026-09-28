import { formatOrderNumber, type SalesmanOrderDetail } from '@groaurum/api-client';
import { Button, Card } from '@groaurum/ui';
import { ButtonLink } from '@/components/ButtonLink';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import type { PlacedOrderOutcome } from '@/data/order-submit';
import { formatMoney } from '@/lib/money';
import { orderStatusGroup } from '@/lib/order-status';

type Props = {
  outcome: PlacedOrderOutcome;
  shopName: string;
  /** Total the salesman reviewed; the saved order total wins once loaded. */
  reviewedTotal: number;
  /** Saved order read back from the server; undefined while loading, null if unavailable. */
  order: SalesmanOrderDetail | null | undefined;
  onNewOrder: () => void;
};

export function OrderConfirmation({
  outcome,
  shopName,
  reviewedTotal,
  order,
  onNewOrder,
}: Props) {
  const sent = outcome.kind === 'confirmation_sent';
  const orderNumber = order?.orderNumber ?? formatOrderNumber(outcome.orderId);
  const total = order?.total ?? reviewedTotal;
  const pending = order ? orderStatusGroup(order.status) === 'pending' : false;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title={sent ? 'Order placed' : 'Order created — confirmation not sent'}
        subtitle={`Order #${orderNumber}`}
        backTo="/orders"
        backLabel="Orders"
      />

      <Card>
        <div className="ga-sales-stack">
          {sent ? (
            <p className="ga-sales-success" role="status">
              Order #{orderNumber} is saved and the retailer has been sent an approval request.
            </p>
          ) : (
            <div className="ga-sales-warning ga-sales-stack" role="alert">
              <p>
                Order #{orderNumber} was created, but the approval request to the retailer
                could not be sent{outcome.message ? `: ${outcome.message}` : '.'}
              </p>
              <p>
                <strong>Do not place this order again.</strong> Ask your admin to resend the
                approval request for order #{orderNumber}.
              </p>
            </div>
          )}

          <dl className="ga-sales-facts">
            <div>
              <dt>Retailer</dt>
              <dd>{order?.shopName ?? shopName}</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd className="ga-sales-amount ga-sales-amount--lg">{formatMoney(total)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {order ? (
                  <OrderStatusBadge status={order.status} />
                ) : order === null ? (
                  <span className="ga-sales-muted">
                    Couldn’t load the status. Check Order history.
                  </span>
                ) : (
                  <span className="ga-sales-muted" aria-busy="true">
                    Loading status…
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {pending ? (
            <div>
              <p className="ga-sales-location__label">What happens next</p>
              <p className="ga-sales-muted">
                The retailer needs to approve this order. After approval, stock is reserved and
                the order moves to dispatch. You can follow it in Orders → Pending.
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="ga-sales-review-actions">
        <ButtonLink to={`/orders/${outcome.orderId}`} variant="primary" block>
          View order
        </ButtonLink>
        <Button type="button" variant="secondary" className="ga-sales-btn-block" onClick={onNewOrder}>
          Start another order
        </Button>
        <ButtonLink to="/" variant="secondary" block>
          Back to Home
        </ButtonLink>
      </div>
    </div>
  );
}
