import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, TextField, Button } from '@groaurum/ui';
import { activeServiceAreas } from '@/data/live-entity-helpers';
import { useServiceAreasListQuery } from '@/data/hooks';
import { useCreateDeliveryRouteMutation } from '@/data/mutations';
import './DeliveryRouteFormModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (routeId: string) => void;
};

export function DeliveryRouteFormModal({ open, onClose, onSuccess }: Props) {
  const createRoute = useCreateDeliveryRouteMutation();
  const { state: areasState } = useServiceAreasListQuery();
  const [serviceAreaId, setServiceAreaId] = useState('');
  const [routeDate, setRouteDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const serviceAreas = useMemo(
    () => activeServiceAreas(areasState.data ?? []),
    [areasState.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setServiceAreaId(serviceAreas[0]?.id ?? '');
    setRouteDate(new Date().toISOString().slice(0, 10));
  }, [open, serviceAreas]);

  const pending = createRoute.isPending;
  const missingAreas = serviceAreas.length === 0;

  const onSubmit = () => {
    if (!serviceAreaId) {
      setError('Select an active service area');
      return;
    }
    if (!routeDate) {
      setError('Route date is required');
      return;
    }
    setError(null);
    createRoute.mutate(
      {
        serviceAreaId,
        routeDate,
        status: 'DRAFT',
      },
      {
        onSuccess: (row) => {
          onSuccess?.(row.id);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Create failed'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title="New empty trip shell"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || missingAreas}
          >
            {pending ? 'Creating…' : 'Create empty shell'}
          </Button>
        </>
      }
    >
      <div className="ga-dl-route-form">
        <p className="ga-dl-route-form__hint">
          Creates an empty draft trip for a date and area. Prefer{' '}
          <strong>Create Delivery Trip</strong> when you already know the
          delivery boy and orders.
        </p>
        {missingAreas ? (
          <p className="ga-dl-route-form__error">
            No active service areas are available. Create one before planning
            trips.
          </p>
        ) : null}
        <SelectField
          label="Service area"
          value={serviceAreaId}
          onChange={setServiceAreaId}
        >
          <option value="">Select service area</option>
          {serviceAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Route date"
          type="date"
          value={routeDate}
          onChange={(e) => setRouteDate(e.target.value)}
          required
        />
        {error ? <p className="ga-dl-route-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
