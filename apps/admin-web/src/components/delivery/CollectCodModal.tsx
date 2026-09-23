import { useEffect, useState } from 'react';
import { Modal, SelectField, Button, TextField } from '@groaurum/ui';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCollectDeliveryCodMutation,
  useCompleteDeliveryStopMutation,
} from '@/data/mutations';
import './AssignDriverModal.css';

const COLLECTION_METHODS = [
  'CASH_ON_DELIVERY',
  'UPI_ON_DELIVERY',
  'CARD_ON_DELIVERY',
  'OTHER',
] as const;

type Props = {
  open: boolean;
  mode: 'collect' | 'deliver';
  routeId: string;
  stopId: string;
  orderId: string;
  orderCode: string;
  suggestedAmount: number | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

function methodLabel(method: string): string {
  return method
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Collect COD (and optionally mark delivered with the same amount).
 */
export function CollectCodModal({
  open,
  mode,
  routeId,
  stopId,
  orderId,
  orderCode,
  suggestedAmount,
  onClose,
  onSuccess,
}: Props) {
  const collectCod = useCollectDeliveryCodMutation();
  const completeStop = useCompleteDeliveryStopMutation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(COLLECTION_METHODS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(
      suggestedAmount != null && Number.isFinite(suggestedAmount)
        ? String(suggestedAmount)
        : '',
    );
    setMethod(COLLECTION_METHODS[0]);
    setError(null);
  }, [open, orderId, suggestedAmount]);

  const pending = collectCod.isPending || completeStop.isPending;

  const onSubmit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid collected amount');
      return;
    }
    setError(null);

    if (mode === 'deliver') {
      completeStop.mutate(
        {
          stopId,
          routeId,
          collectCodAmount: parsed,
        },
        {
          onSuccess: () => {
            onSuccess?.('COD collected and stop marked delivered.');
            onClose();
          },
          onError: (err) =>
            setError(
              formatMutationError(err, 'Could not collect COD / mark delivered'),
            ),
        },
      );
      return;
    }

    collectCod.mutate(
      {
        orderId,
        routeId,
        collectedAmount: parsed,
        collectionMethod: method,
      },
      {
        onSuccess: () => {
          onSuccess?.('COD collected.');
          onClose();
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Could not collect COD')),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={
        mode === 'deliver'
          ? `Collect COD & Deliver · ${orderCode}`
          : `Collect COD · ${orderCode}`
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending
              ? 'Saving…'
              : mode === 'deliver'
                ? 'Collect & Mark Delivered'
                : 'Collect COD'}
          </Button>
        </>
      }
    >
      <div className="ga-dl-assign">
        <TextField
          label="Collected amount (INR)"
          name="codAmount"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {mode === 'collect' ? (
          <SelectField
            label="Collection method"
            value={method}
            onChange={setMethod}
          >
            {COLLECTION_METHODS.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className="ga-dl-assign__hint">
            Uses cash on delivery when completing the stop (RPC default).
          </p>
        )}
        {error ? <p className="ga-dl-assign__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
