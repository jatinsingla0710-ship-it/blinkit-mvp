import { useEffect, useState } from 'react';
import type { OrderDetail } from '@/data/orders-types';
import {
  useScheduleAndAssignDeliveryMutation,
} from '@/data/mutations';
import { Button, SelectField, TextField } from '@groaurum/ui';
import {
  friendlyTimeSlotLabel,
  OWN_VEHICLE_VALUE,
  resolveVehicleIdForRpc,
} from '@/data/delivery-setup-helpers';
import {
  useDeliveryBoysSnapshotQuery,
  useDeliveryTimeSlotsQuery,
  useVehiclesListQuery,
} from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import './OrderDeliveryAssign.css';

type Props = {
  order: OrderDetail;
  /** When false, assignment form is hidden (orders:manage). */
  canManage?: boolean;
};

/**
 * Simple assign-delivery flow for a packed order — one trip via H5 RPC.
 */
export function OrderDeliveryAssign({
  order,
  canManage = false,
}: Props) {
  const schedule = useScheduleAndAssignDeliveryMutation();
  const { state: boysState } = useDeliveryBoysSnapshotQuery();
  const { state: slotsState } = useDeliveryTimeSlotsQuery();
  const { state: vehiclesState } = useVehiclesListQuery();

  const [boyId, setBoyId] = useState(order.delivery.deliveryPersonId ?? '');
  const [vehicleId, setVehicleId] = useState(
    order.delivery.vehicleId ?? OWN_VEHICLE_VALUE,
  );
  const [deliveryDate, setDeliveryDate] = useState(
    order.delivery.scheduledDate ?? new Date().toISOString().slice(0, 10),
  );
  const [timeSlotId, setTimeSlotId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const boys = (boysState.data?.rows ?? []).filter(
    (b) => b.employmentStatus === 'ACTIVE',
  );
  const slots = slotsState.data ?? [];
  const vehicles = (vehiclesState.data ?? []).filter((v) => v.isActive);

  useEffect(() => {
    if (slots[0] && !timeSlotId) setTimeSlotId(slots[0].id);
  }, [slots, timeSlotId]);

  const canSave = Boolean(boyId && deliveryDate) && !schedule.isPending;

  const onAssign = async () => {
    setError(null);
    setOk(null);
    if (!boyId) return;
    try {
      await schedule.mutateAsync({
        orderIds: [order.id],
        deliveryProfileId: boyId,
        vehicleId: resolveVehicleIdForRpc(vehicleId),
        deliveryDate,
        timeSlotId: timeSlotId || null,
        serviceAreaId: order.delivery.serviceAreaId ?? null,
      });
      setOk('Delivery trip created and order assigned.');
    } catch (err) {
      setError(formatMutationError(err, 'Could not assign delivery'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-ord-assign">
        <div className="ga-ord-assign__header">
          <h3 className="ga-ord-assign__title">Assign Delivery</h3>
          <p className="ga-ord-assign__sub">
            You do not have permission to assign delivery staff.
          </p>
        </div>
      </div>
    );
  }

  if (boys.length === 0) {
    return (
      <div className="ga-ord-assign">
        <div className="ga-ord-assign__header">
          <h3 className="ga-ord-assign__title">Assign Delivery</h3>
          <p className="ga-ord-assign__sub">
            No active delivery boys yet. Add a delivery boy under Delivery →
            Delivery Boys, then return here to assign this order.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ga-ord-assign">
      <div className="ga-ord-assign__header">
        <h3 className="ga-ord-assign__title">Assign Delivery</h3>
        <p className="ga-ord-assign__sub">
          Choose a delivery boy and vehicle (optional). This creates or reuses
          a delivery trip for today.
        </p>
      </div>

      {order.delivery.deliveryPersonName ? (
        <p className="ga-ord-assign__current">
          Currently assigned:{' '}
          <strong>{order.delivery.deliveryPersonName}</strong>
          {order.delivery.vehicleLabel
            ? ` · ${order.delivery.vehicleLabel}`
            : ''}
        </p>
      ) : null}

      <div className="ga-ord-assign__form" style={{ flexDirection: 'column' }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <SelectField label="Delivery boy" value={boyId} onChange={setBoyId}>
            <option value="">Select…</option>
            {boys.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Vehicle"
            value={vehicleId}
            onChange={setVehicleId}
          >
            <option value={OWN_VEHICLE_VALUE}>
              Driver&apos;s own vehicle
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleNumber} · {v.statusLabel}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Delivery date"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          <SelectField
            label="Time window"
            value={timeSlotId}
            onChange={setTimeSlotId}
          >
            <option value="">Next available</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {friendlyTimeSlotLabel(s.label)}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={() => void onAssign()}
        >
          {schedule.isPending ? 'Assigning…' : 'Create Delivery Trip'}
        </Button>
      </div>

      {error ? <p className="ga-ord-assign__error">{error}</p> : null}
      {ok ? <p className="ga-ord-assign__ok">{ok}</p> : null}
    </div>
  );
}
