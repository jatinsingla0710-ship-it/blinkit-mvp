import { useEffect, useState } from 'react';
import { Modal, TextField, Button } from '@groaurum/ui';
import type { CustomerOpeningBalanceVm } from '@/data/customers-types';
import { todayExpenseDate } from '@/data/company-expenses';
import { validateOpeningBalanceForm } from '@/data/customer-account-forms';
import { formatMutationError } from '@/data/mutation-errors';
import { useSetShopOpeningBalanceMutation } from '@/data/mutations';
import './CustomerFormModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  existing: CustomerOpeningBalanceVm | null;
};

export function CustomerOpeningBalanceModal({
  open,
  onClose,
  shopId,
  shopName,
  existing,
}: Props) {
  const setOpening = useSetShopOpeningBalanceMutation();
  const [amount, setAmount] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayExpenseDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(existing ? String(existing.amount) : '');
    setAsOfDate(existing?.asOfDate ?? todayExpenseDate());
    setNote(existing?.note ?? '');
    setError(null);
    setSuccess(false);
  }, [open, existing]);

  const pending = setOpening.isPending;

  const onSubmit = async () => {
    const parsed = validateOpeningBalanceForm(amount, asOfDate);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    try {
      await setOpening.mutateAsync({
        shopId,
        asOfDate,
        amount: parsed.amount,
        note: note.trim() || null,
      });
      setSuccess(true);
    } catch (err) {
      setError(formatMutationError(err, 'Could not save opening balance'));
    }
  };

  return (
    <Modal
      open={open}
      title={existing ? 'Edit opening balance' : 'Set opening balance'}
      onClose={onClose}
      footer={
        success ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void onSubmit()}
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save opening balance'}
            </Button>
          </>
        )
      }
    >
      <div className="ga-cust-form">
        {success ? (
          <p className="ga-cust-form__success" role="status">
            Opening balance saved for {shopName}.
          </p>
        ) : (
          <>
            <p className="ga-cust-form__hint">
              This is the amount the customer already owed before using
              RichlyBook. It becomes part of their outstanding balance.
            </p>
            {existing ? (
              <p className="ga-cust-form__hint" role="status">
                Current opening: <strong>{existing.amountLabel}</strong> as of{' '}
                {existing.asOfDateLabel}. Saving replaces it safely.
              </p>
            ) : null}
            <TextField
              label="Customer owes you"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
            <TextField
              label="As of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              required
            />
            <TextField
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error ? (
              <p className="ga-cust-form__error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
