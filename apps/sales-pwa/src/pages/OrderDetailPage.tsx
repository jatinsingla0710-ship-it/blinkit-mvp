import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SalesmanOrderLine } from '@groaurum/api-client';
import { Card } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { ButtonLink } from '@/components/ButtonLink';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { orderStatusGroup } from '@/lib/order-status';

function unitLabel(unit: string, qty: number): string {
  const u = unit.trim().toLowerCase();
  const base = u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Unit';
  return qty === 1 ? base : `${base}s`;
}

export function OrderLineRow({ line }: { line: SalesmanOrderLine }) {
  return (
    <li className="ga-sales-line">
      <div className="ga-sales-line__main">
        <p className="ga-sales-line__title">{line.productName}</p>
        <p className="ga-sales-list-item__meta">
          {line.skuName} · {line.skuCode}
        </p>
        <p className="ga-sales-list-item__meta">
          {line.quantity} {unitLabel(line.sellingUnit, line.quantity)} ×{' '}
          {formatMoney(line.unitPrice)}
        </p>
      </div>
      <span className="ga-sales-line__total">{formatMoney(line.lineTotal)}</span>
    </li>
  );
}

const NEXT_STEP: Record<ReturnType<typeof orderStatusGroup>, string> = {
  pending: 'Waiting for the retailer to approve this order. Stock is reserved only after approval.',
  approved: 'Approved by the retailer and moving through dispatch and delivery.',
  delivered: 'This order has been delivered.',
  cancelled: 'This order was cancelled and will not be delivered.',
};

export function OrderDetailPage() {
  const api = useSalesmanApi();
  const { orderId = '' } = useParams();

  const orderQuery = useQuery({
    queryKey: ['sales', 'order', orderId],
    queryFn: () => api.getOrder(orderId),
    enabled: Boolean(orderId),
  });
  const order = orderQuery.data;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title={order ? `Order #${order.orderNumber}` : 'Order'}
        subtitle={order ? order.shopName : undefined}
        backTo="/orders"
        backLabel="Orders"
      />

      {orderQuery.isError ? (
        <ErrorState
          message={`Could not load this order: ${errorMessage(orderQuery.error, 'unknown error')}`}
          onRetry={() => {
            void orderQuery.refetch();
          }}
          retrying={orderQuery.isFetching}
          retryLabel="Retry order"
          stale={Boolean(order)}
        />
      ) : null}

      {orderQuery.isLoading ? <LoadingState label="Loading order…" variant="detail" /> : null}

      {orderQuery.isSuccess && order === null ? (
        <EmptyStateCard
          title="Order not found"
          detail="This order does not exist or is not linked to your retailers."
          action={
            <ButtonLink to="/orders" variant="secondary" block>
              Back to orders
            </ButtonLink>
          }
        />
      ) : null}

      {order ? (
        <>
          <Card>
            <div className="ga-sales-stack">
              <div className="ga-sales-list-item__row">
                <OrderStatusBadge status={order.status} />
                <span className="ga-sales-muted">{order.dateTimeLabel}</span>
              </div>
              <p className="ga-sales-muted">{NEXT_STEP[orderStatusGroup(order.status)]}</p>
            </div>
          </Card>

          <Card title={`Items (${order.lines.length})`}>
            {order.lines.length === 0 ? (
              <p className="ga-sales-muted">This order has no lines.</p>
            ) : (
              <ul className="ga-sales-lines">
                {order.lines.map((line) => (
                  <OrderLineRow key={line.id} line={line} />
                ))}
              </ul>
            )}
            {order.adjustments !== 0 ? (
              <div className="ga-sales-total-row ga-sales-total-row--minor">
                <span>Adjustments</span>
                <span>{formatMoney(order.adjustments)}</span>
              </div>
            ) : null}
            <div className="ga-sales-total-row">
              <span>Order total</span>
              <span className="ga-sales-amount ga-sales-amount--lg">{formatMoney(order.total)}</span>
            </div>
          </Card>

          <ButtonLink to={`/customers/${order.shopId}`} variant="secondary" block>
            View retailer
          </ButtonLink>
        </>
      ) : null}
    </div>
  );
}
