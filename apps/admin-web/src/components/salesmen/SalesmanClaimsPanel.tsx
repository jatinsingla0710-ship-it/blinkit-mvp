import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, TextField } from '@groaurum/ui';
import type { SalesmanClaimStatus, SalesmanExpense, SalesmanReturnRequest } from '@groaurum/api-client';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import { formatInrPrecise } from '@/data/live/format';
import {
  useReviewReturnRequestMutation,
  useReviewSalesmanExpenseMutation,
} from '@/data/mutations';
import './SalesmanClaimsPanel.css';

type Props = {
  profileId: string;
  canManage: boolean;
};

function statusLabel(status: SalesmanClaimStatus): string {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending';
}

function statusTone(status: SalesmanClaimStatus): 'warning' | 'success' | 'danger' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'warning';
}

function categoryLabel(category: SalesmanExpense['category']): string {
  if (category === 'TRAVEL') return 'Travel';
  if (category === 'FOOD') return 'Food';
  if (category === 'PHONE') return 'Phone';
  return 'Other';
}

export function SalesmanClaimsPanel({ profileId, canManage }: Props) {
  const expenses = useQuery({
    queryKey: ['groaurum', 'salesmen', 'claims', profileId, 'expenses'],
    queryFn: () => requireLiveAdminApi().listSalesmanExpenses(profileId),
    enabled: Boolean(profileId),
  });
  const returns = useQuery({
    queryKey: ['groaurum', 'salesmen', 'claims', profileId, 'returns'],
    queryFn: () => requireLiveAdminApi().listSalesmanReturnRequests(profileId),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sm-claims">
      <section aria-label="Expenses">
        <h3>Expenses</h3>
        <p className="ga-sm-claims__hint">Approving an expense records the decision. It does not pay the salesman.</p>
        {expenses.isPending ? <p className="ga-sm-claims__hint">Loading expenses…</p> : null}
        {expenses.isError ? (
          <p className="ga-sm-claims__error" role="alert">
            {formatMutationError(expenses.error, 'Could not load expenses')}
          </p>
        ) : null}
        {expenses.data && expenses.data.length === 0 ? (
          <p className="ga-sm-claims__hint">No expenses.</p>
        ) : null}
        {expenses.data?.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} canManage={canManage} />
        ))}
      </section>
      <section aria-label="Returns">
        <h3>Returns and damage</h3>
        <p className="ga-sm-claims__hint">
          Approving a request records the decision. Stock, payment, and commission stay unchanged.
        </p>
        {returns.isPending ? <p className="ga-sm-claims__hint">Loading returns…</p> : null}
        {returns.isError ? (
          <p className="ga-sm-claims__error" role="alert">
            {formatMutationError(returns.error, 'Could not load return requests')}
          </p>
        ) : null}
        {returns.data && returns.data.length === 0 ? (
          <p className="ga-sm-claims__hint">No return requests.</p>
        ) : null}
        {returns.data?.map((request) => (
          <ReturnRow key={request.id} request={request} canManage={canManage} />
        ))}
      </section>
    </div>
  );
}

function ExpenseRow({ expense, canManage }: { expense: SalesmanExpense; canManage: boolean }) {
  const review = useReviewSalesmanExpenseMutation();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const decide = (status: 'APPROVED' | 'REJECTED') => {
    setError(null);
    review.mutate(
      { expenseId: expense.id, status, reviewNote: note.trim() || null },
      { onError: (err) => setError(formatMutationError(err, 'Could not review the expense')) },
    );
  };

  return (
    <article className="ga-sm-claims__card">
      <div className="ga-sm-claims__row">
        <strong>{categoryLabel(expense.category)}</strong>
        <Badge tone={statusTone(expense.status)}>{statusLabel(expense.status)}</Badge>
      </div>
      <p>{formatInrPrecise(expense.amount)}</p>
      <p className="ga-sm-claims__hint">{expense.expenseDate}</p>
      {expense.note ? <p>{expense.note}</p> : null}
      {expense.receiptUrl ? <img src={expense.receiptUrl} alt="Receipt" className="ga-sm-claims__photo" /> : null}
      {expense.reviewNote ? <p>Review note: {expense.reviewNote}</p> : null}
      {canManage && expense.status === 'PENDING' ? (
        <>
          <TextField label="Review note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="ga-sm-claims__actions">
            <Button type="button" variant="primary" disabled={review.isPending} onClick={() => decide('APPROVED')}>
              Approve
            </Button>
            <Button type="button" variant="secondary" disabled={review.isPending} onClick={() => decide('REJECTED')}>
              Reject
            </Button>
          </div>
        </>
      ) : null}
      {error ? (
        <p className="ga-sm-claims__error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function ReturnRow({ request, canManage }: { request: SalesmanReturnRequest; canManage: boolean }) {
  const review = useReviewReturnRequestMutation();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const decide = (status: 'APPROVED' | 'REJECTED') => {
    setError(null);
    review.mutate(
      { requestId: request.id, status, reviewNote: note.trim() || null },
      { onError: (err) => setError(formatMutationError(err, 'Could not review the return request')) },
    );
  };

  return (
    <article className="ga-sm-claims__card">
      <div className="ga-sm-claims__row">
        <strong>{request.shopName}</strong>
        <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
      </div>
      <p>
        {request.productName} · {request.skuName}
      </p>
      <p>
        Quantity {request.quantity} · {request.reason}
      </p>
      {request.note ? <p>{request.note}</p> : null}
      {request.photoUrl ? <img src={request.photoUrl} alt="Return photo" className="ga-sm-claims__photo" /> : null}
      {request.reviewNote ? <p>Review note: {request.reviewNote}</p> : null}
      {canManage && request.status === 'PENDING' ? (
        <>
          <TextField label="Review note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="ga-sm-claims__actions">
            <Button type="button" variant="primary" disabled={review.isPending} onClick={() => decide('APPROVED')}>
              Approve
            </Button>
            <Button type="button" variant="secondary" disabled={review.isPending} onClick={() => decide('REJECTED')}>
              Reject
            </Button>
          </div>
        </>
      ) : null}
      {error ? (
        <p className="ga-sm-claims__error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
