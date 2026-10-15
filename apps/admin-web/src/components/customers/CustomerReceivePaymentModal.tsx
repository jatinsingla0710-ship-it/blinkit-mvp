import { useEffect, useId, useRef, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import { validateCustomerCollectionAmount } from '@/data/customer-account-forms';
import { formatMutationError } from '@/data/mutation-errors';
import { useRecordCustomerCollectionMutation } from '@/data/mutations';
import './CustomerFormModal.css';

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  outstanding: number;
  outstandingLabel: string;
};

export function CustomerReceivePaymentModal({
  open,
  onClose,
  shopId,
  shopName,
  outstanding,
  outstandingLabel,
}: Props) {
  const record = useRecordCustomerCollectionMutation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('UPI');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const requestIdRef = useRef<string>('');
  const successId = useId();

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setMethod('UPI');
    setNote('');
    setError(null);
    setSuccessLabel(null);
    requestIdRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `col-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, [open]);

  const pending = record.isPending;

  const onSubmit = async () => {
    const parsed = validateCustomerCollectionAmount(
      amount,
      outstanding,
      outstandingLabel,
    );
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    try {
      const result = await record.mutateAsync({
        shopId,
        amount: parsed.amount,
        method,
        note: note.trim() || null,
        clientRequestId: requestIdRef.current,
      });
      setSuccessLabel(
        `Payment of ₹${Number(result.amount).toLocaleString('en-IN')} received. Outstanding is now ₹${Number(result.outstanding).toLocaleString('en-IN')}.`,
      );
    } catch (err) {
      setError(formatMutationError(err, 'Could not receive payment'));
    }
  };

  return (
    <Modal
      open={open}
      title="Receive payment"
      onClose={onClose}
      footer={
        successLabel ? (
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
              disabled={pending || outstanding <= 0}
            >
              {pending ? 'Saving…' : 'Receive payment'}
            </Button>
          </>
        )
      }
    >
      <div className="ga-cust-form">
        {successLabel ? (
          <p className="ga-cust-form__success" id={successId} role="status">
            {successLabel}
          </p>
        ) : (
          <>
            <p className="ga-cust-form__hint">
              Receive money from <strong>{shopName}</strong>. Current
              outstanding: <strong>{outstandingLabel}</strong>.
            </p>
            {outstanding <= 0 ? (
              <p className="ga-cust-form__hint" role="status">
                Nothing is outstanding for this customer.
              </p>
            ) : null}
            <TextField
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              disabled={outstanding <= 0}
            />
            <SelectField
              label="Payment method"
              value={method}
              onChange={setMethod}
            >
              {METHODS.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </SelectField>
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
