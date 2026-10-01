import { useEffect, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_PAYMENT_METHODS,
  COMPANY_EXPENSE_PAYMENT_METHOD_LABELS,
  todayExpenseDate,
  validateCompanyExpenseInput,
  type CompanyExpenseCategory,
  type CompanyExpenseInput,
  type CompanyExpensePaymentMethod,
  type CompanyExpenseRow,
} from '@/data/company-expenses';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCreateCompanyExpenseMutation,
  useUpdateCompanyExpenseMutation,
} from '@/data/mutations';

type Props = {
  open: boolean;
  onClose: () => void;
  expense?: CompanyExpenseRow | null;
};

type FormState = {
  expenseDate: string;
  category: CompanyExpenseCategory;
  amount: string;
  description: string;
  paymentMethod: CompanyExpensePaymentMethod;
  referenceNumber: string;
};

function toForm(expense?: CompanyExpenseRow | null): FormState {
  if (!expense) {
    return {
      expenseDate: todayExpenseDate(),
      category: 'OTHER',
      amount: '',
      description: '',
      paymentMethod: 'CASH',
      referenceNumber: '',
    };
  }
  return {
    expenseDate: expense.expenseDate,
    category: expense.category,
    amount: String(expense.amount),
    description: expense.description,
    paymentMethod: expense.paymentMethod,
    referenceNumber: expense.referenceNumber ?? '',
  };
}

export function CompanyExpenseFormModal({ open, onClose, expense }: Props) {
  const createExpense = useCreateCompanyExpenseMutation();
  const updateExpense = useUpdateCompanyExpenseMutation();
  const [form, setForm] = useState<FormState>(() => toForm(expense));
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(expense);

  useEffect(() => {
    if (open) {
      setForm(toForm(expense));
      setError(null);
    }
  }, [open, expense]);

  const set =
    (key: keyof FormState) =>
    (value: string) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async () => {
    const input: CompanyExpenseInput = {
      expenseDate: form.expenseDate,
      category: form.category,
      amount: Number(form.amount),
      description: form.description,
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber.trim() || null,
    };
    const problem = validateCompanyExpenseInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      if (editing && expense) {
        await updateExpense.mutateAsync({ id: expense.id, input });
      } else {
        await createExpense.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(formatMutationError(err, 'Could not save expense'));
    }
  };

  const busy = createExpense.isPending || updateExpense.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={busy}>
            {busy ? 'Saving…' : 'Save expense'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <TextField
          label="Date"
          type="date"
          value={form.expenseDate}
          onChange={(e) => set('expenseDate')(e.target.value)}
        />
        <SelectField
          label="Category"
          value={form.category}
          onChange={(value) => set('category')(value as CompanyExpenseCategory)}
        >
          {COMPANY_EXPENSE_CATEGORIES.map((id) => (
            <option key={id} value={id}>
              {COMPANY_EXPENSE_CATEGORY_LABELS[id]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.amount}
          onChange={(e) => set('amount')(e.target.value)}
        />
        <SelectField
          label="Payment method"
          value={form.paymentMethod}
          onChange={(value) =>
            set('paymentMethod')(value as CompanyExpensePaymentMethod)
          }
        >
          {COMPANY_EXPENSE_PAYMENT_METHODS.map((id) => (
            <option key={id} value={id}>
              {COMPANY_EXPENSE_PAYMENT_METHOD_LABELS[id]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Description"
          value={form.description}
          onChange={(e) => set('description')(e.target.value)}
          placeholder="What was this for?"
        />
        <TextField
          label="Reference (optional)"
          value={form.referenceNumber}
          onChange={(e) => set('referenceNumber')(e.target.value)}
          placeholder="UPI ref / cheque no."
        />
        {error ? (
          <p style={{ margin: 0, color: 'var(--ga-color-danger, #b42318)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
