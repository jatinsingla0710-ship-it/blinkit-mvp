import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesmanOrderSummary } from '@groaurum/api-client';
import { Tabs } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { ButtonLink } from '@/components/ButtonLink';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { ChevronRightIcon, PlusIcon } from '@/components/icons';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import {
  ORDER_STATUS_GROUPS,
  groupOrdersByStatus,
  isOrderStatusGroup,
  type OrderStatusGroup,
} from '@/lib/order-status';

const EMPTY_COPY: Record<OrderStatusGroup, { title: string; detail: string }> = {
  pending: {
    title: 'No orders waiting for approval',
    detail: 'Orders you place stay here until the retailer approves them.',
  },
  approved: {
    title: 'No approved orders in progress',
    detail: 'Orders move here once the retailer approves them, until delivery.',
  },
  delivered: {
    title: 'No delivered orders yet',
    detail: 'Delivered orders from your recent history appear here.',
  },
  cancelled: {
    title: 'No cancelled orders',
    detail: 'Cancelled orders from your recent history appear here.',
  },
};

export function OrderRow({ order }: { order: SalesmanOrderSummary }) {
  return (
    <Link to={`/orders/${order.id}`} className="ga-sales-list-item ga-sales-order-row">
      <div className="ga-sales-list-item__row">
        <div>
          <p className="ga-sales-list-item__title">{order.shopName}</p>
          <p className="ga-sales-list-item__meta">
            #{order.orderNumber} · {order.dateTimeLabel}
          </p>
        </div>
        <ChevronRightIcon size={20} />
      </div>
      <div className="ga-sales-list-item__row ga-sales-order-row__foot">
        <OrderStatusBadge status={order.status} />
        <span className="ga-sales-amount">{formatMoney(order.total)}</span>
      </div>
    </Link>
  );
}

/** Orders tab: recent assisted orders placed by this salesman, grouped by status. */
export function OrdersPage() {
  const api = useSalesmanApi();
  const user = useCurrentUser();
  const profileId = user?.id ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: OrderStatusGroup = isOrderStatusGroup(tabParam) ? tabParam : 'pending';

  const ordersQuery = useQuery({
    queryKey: ['sales', 'orders', profileId],
    queryFn: () => api.listOrders(profileId),
    enabled: Boolean(profileId),
  });

  const grouped = ordersQuery.data ? groupOrdersByStatus(ordersQuery.data) : null;
  const visible = grouped ? grouped[tab] : [];

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Orders" subtitle="Your recent assisted orders" />

      <ButtonLink to="/orders/new" variant="primary" block>
        <PlusIcon size={22} />
        New order
      </ButtonLink>

      <div className="ga-sales-tabs">
        <Tabs
          items={ORDER_STATUS_GROUPS.map((g) => ({
            id: g.id,
            label: grouped ? `${g.label} (${grouped[g.id].length})` : g.label,
          }))}
          active={tab}
          onChange={(next) => {
            const params = new URLSearchParams(searchParams);
            params.set('tab', next);
            setSearchParams(params, { replace: true });
          }}
        />
      </div>

      {ordersQuery.isError ? (
        <ErrorState
          message={`Could not load your orders: ${errorMessage(ordersQuery.error, 'unknown error')}`}
          onRetry={() => {
            void ordersQuery.refetch();
          }}
          retrying={ordersQuery.isFetching}
          retryLabel="Retry orders"
          stale={Boolean(ordersQuery.data)}
        />
      ) : null}

      {ordersQuery.isLoading || (!profileId && !ordersQuery.data) ? (
        <LoadingState label="Loading orders…" rows={4} />
      ) : null}

      {grouped && visible.length === 0 ? (
        <EmptyStateCard
          title={EMPTY_COPY[tab].title}
          detail={EMPTY_COPY[tab].detail}
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="ga-sales-list" role="list" aria-label={`${tab} orders`}>
          {visible.map((order) => (
            <div role="listitem" key={order.id}>
              <OrderRow order={order} />
            </div>
          ))}
        </div>
      ) : null}

      {grouped && ordersQuery.data && ordersQuery.data.length >= 50 ? (
        <p className="ga-sales-muted">Showing your 50 most recent orders.</p>
      ) : null}
    </div>
  );
}
