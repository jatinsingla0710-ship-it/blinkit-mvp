import { useEffect, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import {
  SUPPLIER_PAYMENT_METHOD_LABELS,
  type SupplierPaymentMethod,
} from '@/data/supplier-ledger';
import { todayExpenseDate } from '@/data/company-expenses';
import { formatMutationError } from '@/data/mutation-errors';
import { useRecordSupplierPaymentMutation } from '@/data/mutations';

type PurchaseOption = {
  id: string;
  billNumber: string;
  totalLabel: string;
  status: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  outstandingLabel: string;
  purchases: readonly PurchaseOption[];
};

const METHODS = Object.keys(
  SUPPLIER_PAYMENT_METHOD_LABELS,
) as SupplierPaymentMethod[];

export function SupplierPaymentModal({
  open,
  onClose,
  supplierId,
  supplierName,
  outstandingLabel,
  purchases,
}: Props) {
  const recordPayment = useRecordSupplierPaymentMutation();
  const [paymentDate, setPaymentDate] = useState(todayExpenseDate());
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<SupplierPaymentMethod>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const receivedPurchases = purchases.filter((p) => p.status === 'RECEIVED');

  useEffect(() => {
    if (!open) return;
    setPaymentDate(todayExpenseDate());
    setAmount('');
    setPaymentMethod('CASH');
    setReferenceNumber('');
    setNotes('');
    setPurchaseId('');
    setError(null);
  }, [open]);

  const onSubmit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a payment amount greater than zero');
      return;
    }
    if (!paymentDate) {
      setError('Payment date is required');
      return;
    }
    setError(null);
    try {
      await recordPayment.mutateAsync({
        supplierId,
        paymentDate,
        amount: value,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        purchaseId: purchaseId || null,
      });
      onClose();
    } catch (err) {
      setError(formatMutationError(err, 'Could not record payment'));
    }
  };

  const pending = recordPayment.isPending;

  return (
    <Modal
      open={open}
      title={`Pay ${supplierName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={pending}>
            {pending ? 'Saving…' : 'Record payment'}
          </Button>
        </>
      }
    >
      <div className="ga-sm-order-form">
        <p className="ga-sm-order-form__hint">
          Current amount to pay: <strong>{outstandingLabel}</strong>. This
          records money paid to the supplier — it is not a company expense.
        </p>
        <TextField
          label="Payment date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
        />
        <TextField
          label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          required
        />
        <SelectField
          label="Payment method"
          value={paymentMethod}
          onChange={(value) =>
            setPaymentMethod(value as SupplierPaymentMethod)
          }
        >
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {SUPPLIER_PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Link to bill (optional)"
          value={purchaseId}
          onChange={setPurchaseId}
        >
          <option value="">No specific bill</option>
          {receivedPurchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>
              {purchase.billNumber} · {purchase.totalLabel}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reference"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="UTR / cheque / note"
        />
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error ? <p className="ga-sm-order-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
