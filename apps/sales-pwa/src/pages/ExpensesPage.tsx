import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Badge } from '@groaurum/ui';
import { ButtonLink } from '@/components/ButtonLink';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { claimStatusLabel, claimStatusTone, expenseCategoryLabel } from '@/data/claims';
import { errorMessage } from '@/lib/errors';
import { formatDayLabel, formatRupees } from '@/lib/money';

export function ExpensesPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profileId = user?.id ?? '';
  const query = useQuery({
    queryKey: ['sales', 'expenses', profileId],
    queryFn: () => api.listExpenses(),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Expenses" subtitle="Your claims" backTo="/profile" backLabel="Profile" />
      <ButtonLink to="/profile/expenses/new" variant="primary" block>
        Add expense
      </ButtonLink>

      {query.isLoading ? <LoadingState label="Loading expenses…" rows={3} /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load expenses.')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <p className="ga-sales-muted">No expenses yet.</p>
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="ga-sales-list">
          {query.data.map((expense) => (
            <Link key={expense.id} to={`/profile/expenses/${expense.id}`} className="ga-sales-list-item">
              <div className="ga-sales-list-item__row">
                <strong>{expenseCategoryLabel(expense.category)}</strong>
                <Badge tone={claimStatusTone(expense.status)}>{claimStatusLabel(expense.status)}</Badge>
              </div>
              <p className="ga-sales-earnings-amount">{formatRupees(expense.amount)}</p>
              <p className="ga-sales-muted">{formatDayLabel(expense.expenseDate)}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
