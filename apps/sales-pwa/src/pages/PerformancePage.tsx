import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesmanEarnings } from '@groaurum/api-client';
import { ErrorState } from '@/components/ErrorState';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { errorMessage } from '@/lib/errors';
import { formatDayLabel, formatMonthLabel, formatRupees } from '@/lib/money';

/** Profile → My Earnings. Commission amounts come from the ledger only. */
export function PerformancePage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profileId = user?.id ?? '';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sales', 'earnings', profileId],
    queryFn: () => api.getEarnings(),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="My Earnings"
        subtitle={data ? formatMonthLabel(data.month) : 'This month'}
        backTo="/profile"
        backLabel="Profile"
      />

      {isLoading ? <LoadingState label="Loading your earnings…" variant="kpis" rows={3} /> : null}

      {isError ? (
        <ErrorState
          message={errorMessage(error, 'Could not load your earnings.')}
          onRetry={() => void refetch()}
          retrying={isFetching}
          stale={Boolean(data)}
        />
      ) : null}

      {data ? <EarningsBody earnings={data} /> : null}
    </div>
  );
}

function EarningsBody({ earnings }: { earnings: SalesmanEarnings }) {
  return (
    <>
      <section className="ga-sales-earnings-hero" aria-label="Earned commission">
        <p className="ga-sales-kpi__label">Earned commission</p>
        <p className="ga-sales-earnings-hero__value">{formatRupees(earnings.earnedCommission)}</p>
        <p className="ga-sales-muted">Only commission already earned. Nothing is estimated.</p>
      </section>

      {earnings.salaryApplies ? (
        <section className="ga-sales-stack" aria-label="Salary">
          <h2 className="ga-sales-section-title">Salary</h2>
          {earnings.salary ? (
            <>
              <div className="ga-sales-kpi">
                <p className="ga-sales-kpi__label">Monthly salary</p>
                <p className="ga-sales-kpi__value">{formatRupees(earnings.salary.monthlySalary)}</p>
              </div>
              {earnings.salary.dailyAllowance > 0 || earnings.salary.otherAllowance > 0 ? (
                <p className="ga-sales-muted">
                  Daily allowance {formatRupees(earnings.salary.dailyAllowance)} per day.
                  Other allowance {formatRupees(earnings.salary.otherAllowance)}.
                  These are not added into the total below.
                </p>
              ) : null}
            </>
          ) : (
            <p className="ga-sales-muted">Salary has not been set.</p>
          )}
        </section>
      ) : null}

      {earnings.totalIncludesSalary ? (
        <section className="ga-sales-kpi" aria-label="Total this month">
          <p className="ga-sales-kpi__label">Salary + earned commission</p>
          <p className="ga-sales-kpi__value">{formatRupees(earnings.totalEarnings)}</p>
          <p className="ga-sales-muted">
            Monthly salary plus commission already earned. Leave adjustments are not included.
          </p>
        </section>
      ) : null}

      <section className="ga-sales-stack" aria-label="Not earned yet">
        <h2 className="ga-sales-section-title">Not earned yet</h2>
        <p className="ga-sales-muted">
          Commission is not earned until the order is delivered, paid, and converted.
        </p>
        {earnings.awaitingOrderCount === 0 ? (
          <p className="ga-sales-muted">No orders are waiting.</p>
        ) : (
          <>
            <p className="ga-sales-earnings-awaiting">
              {earnings.awaitingOrderCount}{' '}
              {earnings.awaitingOrderCount === 1 ? 'order' : 'orders'} ·{' '}
              {formatRupees(earnings.awaitingOrderValue)} order value
            </p>
            <div className="ga-sales-list">
              {earnings.awaitingOrders.map((order) => (
                <article key={order.orderId} className="ga-sales-list-item">
                  <div className="ga-sales-list-item__row">
                    <strong>{order.shopName}</strong>
                    <OrderStatusBadge status={order.orderStatus} />
                  </div>
                  <p className="ga-sales-muted">
                    Order {order.orderNumber} · {formatDayLabel(order.createdAt)}
                  </p>
                  <p className="ga-sales-earnings-amount">
                    Order value {formatRupees(order.orderTotal)}
                  </p>
                  <p className="ga-sales-earnings-pending">Commission not earned</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="ga-sales-stack" aria-label="Commission by order">
        <h2 className="ga-sales-section-title">Earned by order</h2>
        {earnings.entries.length === 0 ? (
          <p className="ga-sales-muted">No commission earned this month.</p>
        ) : (
          <div className="ga-sales-list">
            {earnings.entries.map((entry) => (
              <article key={entry.orderId} className="ga-sales-list-item">
                <div className="ga-sales-list-item__row">
                  <strong>{entry.shopName}</strong>
                  <OrderStatusBadge status={entry.orderStatus} />
                </div>
                <p className="ga-sales-muted">
                  Order {entry.orderNumber} · {formatDayLabel(entry.earnedAt)}
                </p>
                <p className="ga-sales-earnings-amount">{formatRupees(entry.commissionAmount)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="ga-sales-muted">Payslip history is not available.</p>
    </>
  );
}
