import { useParams } from 'react-router-dom';
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

export function ExpenseDetailPage() {
  const { expenseId = '' } = useParams();
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const query = useQuery({
    queryKey: ['sales', 'expense', user?.id ?? '', expenseId],
    queryFn: () => api.getExpense(expenseId),
    enabled: Boolean(user?.id && expenseId),
  });
  const expense = query.data;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Expense" backTo="/profile/expenses" backLabel="Expenses" />
      {query.isLoading ? <LoadingState label="Loading expense…" variant="detail" /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load this expense.')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isSuccess && !expense ? (
        <>
          <p className="ga-sales-muted">This expense was not found.</p>
          <ButtonLink to="/profile/expenses" variant="secondary" block>
            Back to expenses
          </ButtonLink>
        </>
      ) : null}
      {expense ? (
        <article className="ga-sales-list-item">
          <div className="ga-sales-list-item__row">
            <strong>{expenseCategoryLabel(expense.category)}</strong>
            <Badge tone={claimStatusTone(expense.status)}>{claimStatusLabel(expense.status)}</Badge>
          </div>
          <p className="ga-sales-earnings-hero__value">{formatRupees(expense.amount)}</p>
          <p className="ga-sales-muted">{formatDayLabel(expense.expenseDate)}</p>
          {expense.note ? <p>{expense.note}</p> : null}
          {expense.receiptUrl ? (
            <img src={expense.receiptUrl} alt="Receipt" className="ga-sales-claim-photo" />
          ) : (
            <p className="ga-sales-muted">No receipt photo.</p>
          )}
          {expense.reviewNote ? <p>Review note: {expense.reviewNote}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
