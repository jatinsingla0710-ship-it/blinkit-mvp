import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { CompanyExpenseFormModal } from '@/components/expenses/CompanyExpenseFormModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useCompanyExpenseDetailQuery } from '@/data/hooks';
import { useDeleteCompanyExpenseMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import './ExpenseDetailPage.css';

export function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  const { state } = useCompanyExpenseDetailQuery(expenseId);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const navigate = useNavigate();
  const deleteExpense = useDeleteCompanyExpenseMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!expenseId) return;
    if (!window.confirm('Delete this expense?')) return;
    setError(null);
    try {
      await deleteExpense.mutateAsync(expenseId);
      navigate('/expenses', { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not delete expense'));
    }
  };

  return (
    <QueryStateGate
      title="Expense"
      state={state}
      emptyTitle="Expense not found"
      emptyDetail="Return to Expenses and pick another entry."
    >
      {(expense) => (
        <div className="ga-expense-detail">
          <PageHeader
            title={expense.description}
            subtitle={`${expense.categoryLabel} · ${expense.expenseDateLabel}`}
            meta={
              <Link to="/expenses" className="ga-expense-detail__back">
                ← Expenses
              </Link>
            }
            actions={
              canManage ? (
                <>
                  <Button variant="ghost" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void onDelete()}
                    disabled={deleteExpense.isPending}
                  >
                    Delete
                  </Button>
                </>
              ) : undefined
            }
          />

          <dl className="ga-expense-detail__grid">
            <div>
              <dt>Amount</dt>
              <dd>{expense.amountLabel}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{expense.paymentMethodLabel}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{expense.categoryLabel}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{expense.expenseDateLabel}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{expense.referenceNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>Receipt</dt>
              <dd>{expense.receiptPath ?? '—'}</dd>
            </div>
          </dl>

          {error ? <p className="ga-expense-detail__error">{error}</p> : null}

          {canManage ? (
            <CompanyExpenseFormModal
              open={editOpen}
              expense={expense}
              onClose={() => setEditOpen(false)}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
