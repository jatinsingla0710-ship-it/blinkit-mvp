import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, Button } from '@groaurum/ui';
import { activeDeliveryStaff } from '@/data/live-entity-helpers';
import { useDeliveryStaffQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useUpdateDeliveryRouteMutation } from '@/data/mutations';
import './AssignDriverModal.css';

type Props = {
  open: boolean;
  routeId: string;
  onClose: () => void;
};

export function AssignDriverModal({ open, routeId, onClose }: Props) {
  const updateRoute = useUpdateDeliveryRouteMutation();
  const { state: staffState } = useDeliveryStaffQuery();
  const [driverId, setDriverId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const drivers = useMemo(
    () => activeDeliveryStaff(staffState.data ?? []),
    [staffState.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDriverId(drivers[0]?.id ?? '');
  }, [open, drivers]);

  const pending = updateRoute.isPending;
  const missingDrivers = drivers.length === 0;

  const onSubmit = () => {
    if (!driverId) {
      setError('Select an active delivery driver');
      return;
    }
    setError(null);
    updateRoute.mutate(
      {
        id: routeId,
        input: { assignedDeliveryProfileId: driverId },
      },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(formatMutationError(err, 'Assign failed')),
      },
    );
  };

  return (
    <Modal
      open={open}
      title="Assign Driver"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || missingDrivers}
          >
            {pending ? 'Assigning…' : 'Assign Driver'}
          </Button>
        </>
      }
    >
      <div className="ga-dl-assign">
        {missingDrivers ? (
          <p className="ga-dl-assign__error">
            No active delivery drivers are available.
          </p>
        ) : (
          <SelectField
            label="Driver"
            value={driverId}
            onChange={setDriverId}
          >
            <option value="">Select driver</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
                {driver.mobileLabel ? ` · ${driver.mobileLabel}` : ''}
              </option>
            ))}
          </SelectField>
        )}
        {error ? <p className="ga-dl-assign__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
