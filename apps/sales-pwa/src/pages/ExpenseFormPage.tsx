import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SelectField, TextField } from '@groaurum/ui';
import type { SalesmanExpenseCategory } from '@groaurum/api-client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { shopPhotoFileError } from '@/data/customer-form';
import {
  EXPENSE_CATEGORIES,
  expenseAmountError,
  expenseDateError,
  kolkataToday,
} from '@/data/claims';
import { enqueueOfflineJob } from '@/data/offline-queue';
import { errorMessage } from '@/lib/errors';

export function ExpenseFormPage() {
  const api = useSalesmanApi();
  const navigate = useNavigate();
  const toast = useToast();
  const [category, setCategory] = useState<SalesmanExpenseCategory>('TRAVEL');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(kolkataToday);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const amountProblem = expenseAmountError(amount);
    const dateProblem = expenseDateError(expenseDate);
    if (amountProblem || dateProblem) {
      setError(amountProblem ?? dateProblem);
      return;
    }
    if (file) {
      const photoProblem = shopPhotoFileError(file);
      if (photoProblem) {
        setError(photoProblem);
        return;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (file) {
        setError('You are offline. A receipt cannot be saved until you are back online.');
        return;
      }
      enqueueOfflineJob({
        id: crypto.randomUUID(),
        kind: 'expense',
        category,
        amount: Number(amount.replace(/,/g, '').trim()),
        expenseDate,
        note: note.trim() || null,
      });
      toast.success('Expense will send when you are back online.');
      navigate('/profile/expenses', { replace: true });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createExpense({
        category,
        amount: Number(amount.replace(/,/g, '').trim()),
        expenseDate,
        note: note.trim() || null,
      });
      if (file) {
        try {
          await api.uploadExpenseReceipt(created.id, {
            bytes: await file.arrayBuffer(),
            contentType: file.type,
          });
        } catch (err) {
          toast.error(errorMessage(err, 'Expense saved, but the receipt did not upload.'));
          navigate(`/profile/expenses/${created.id}`, { replace: true });
          return;
        }
      }
      toast.success('Expense submitted');
      navigate(`/profile/expenses/${created.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not save the expense.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Add expense" backTo="/profile/expenses" backLabel="Expenses" />
      <form className="ga-sales-stack ga-sales-claim-form" onSubmit={(event) => void onSubmit(event)}>
        <SelectField label="Category" value={category} onChange={(value) => setCategory(value as SalesmanExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Amount (₹)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <TextField label="Date" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
        <TextField label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
        <label className="ga-btn ga-btn--secondary ga-sales-file-label">
          {file ? file.name : 'Add receipt photo'}
          <input
            className="ga-sales-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </label>
        {error ? (
          <p className="ga-sales-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" className="ga-sales-btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Submit expense'}
        </Button>
      </form>
    </div>
  );
}
