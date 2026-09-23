import { useEffect, useState } from 'react';
import { Modal, SelectField, Button, TextField } from '@groaurum/ui';
import {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_FAILURE_REASON_LABELS,
} from '@groaurum/shared-types';
import { formatMutationError } from '@/data/mutation-errors';
import { useFailDeliveryStopMutation } from '@/data/mutations';
import './AssignDriverModal.css';

type Props = {
  open: boolean;
  stopId: string;
  routeId: string;
  orderCode: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function FailStopModal({
  open,
  stopId,
  routeId,
  orderCode,
  onClose,
  onSuccess,
}: Props) {
  const failStop = useFailDeliveryStopMutation();
  const [reason, setReason] = useState<string>(DELIVERY_FAILURE_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(DELIVERY_FAILURE_REASONS[0]);
    setNotes('');
    setError(null);
  }, [open, stopId]);

  const pending = failStop.isPending;

  const onSubmit = () => {
    if (!reason) {
      setError('Select a failure reason');
      return;
    }
    setError(null);
    failStop.mutate(
      {
        stopId,
        routeId,
        failureReason: reason,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Could not mark failed')),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={`Delivery Problem · ${orderCode}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : 'Report Delivery Problem'}
          </Button>
        </>
      }
    >
      <div className="ga-dl-assign">
        <SelectField
          label="What went wrong?"
          value={reason}
          onChange={setReason}
        >
          {DELIVERY_FAILURE_REASONS.map((r) => (
            <option key={r} value={r}>
              {DELIVERY_FAILURE_REASON_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Notes (optional)"
          name="failureNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error ? <p className="ga-dl-assign__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
