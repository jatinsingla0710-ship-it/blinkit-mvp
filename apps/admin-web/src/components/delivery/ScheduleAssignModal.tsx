import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, Button, TextField } from '@groaurum/ui';
import type { ReadyQueueOrder } from '@/data/delivery-types';
import { formatMutationError } from '@/data/mutation-errors';
import { useScheduleAndAssignDeliveryMutation } from '@/data/mutations';
import {
  useDeliveryBoysSnapshotQuery,
  useDeliveryTimeSlotsQuery,
  useVehiclesListQuery,
} from '@/data/hooks';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import {
  friendlyTimeSlotLabel,
  OWN_VEHICLE_VALUE,
  resolveVehicleIdForRpc,
} from '@/data/delivery-setup-helpers';
import '../salesmen/SalesmanProvisionModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  orders: ReadyQueueOrder[];
  preselectedOrderIds?: string[];
  onSuccess?: (routeId?: string) => void;
};

export function ScheduleAssignModal({
  open,
  onClose,
  orders,
  preselectedOrderIds,
  onSuccess,
}: Props) {
  const schedule = useScheduleAndAssignDeliveryMutation();
  const { state: boysState } = useDeliveryBoysSnapshotQuery();
  const { state: vehiclesState } = useVehiclesListQuery();
  const { state: slotsState } = useDeliveryTimeSlotsQuery();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [timeSlotId, setTimeSlotId] = useState('');
  const [boyId, setBoyId] = useState('');
  const [vehicleId, setVehicleId] = useState(OWN_VEHICLE_VALUE);
  const [routeMode, setRouteMode] = useState<'reuse' | 'create'>('create');
  const [existingRouteId, setExistingRouteId] = useState<string | null>(null);
  const [recommendNote, setRecommendNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boys = boysState.data?.rows ?? [];
  const vehicles = (vehiclesState.data ?? []).filter(
    (v) =>
      v.isActive &&
      (v.status === 'available' ||
        v.status === 'assigned' ||
        v.assignedDriverId === boyId),
  );
  const slots = slotsState.data ?? [];

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.includes(o.id)),
    [orders, selectedIds],
  );
  const serviceAreaId = selectedOrders[0]?.serviceAreaId ?? '';

  useEffect(() => {
    if (!open) return;
    setSelectedIds(preselectedOrderIds?.length ? [...preselectedOrderIds] : []);
    setDeliveryDate(new Date().toISOString().slice(0, 10));
    setTimeSlotId(slots[0]?.id ?? '');
    setBoyId('');
    setVehicleId(OWN_VEHICLE_VALUE);
    setRouteMode('create');
    setExistingRouteId(null);
    setRecommendNote(null);
    setError(null);
  }, [open, preselectedOrderIds, slots]);

  const toggleOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedIds(orders.map((o) => o.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const allSelected =
    orders.length > 0 && selectedIds.length === orders.length;

  const applyRecommend = async () => {
    setError(null);
    setRecommendNote(null);
    if (!serviceAreaId || !deliveryDate) {
      setError('Select orders (same area) and a date first');
      return;
    }
    try {
      const rec = await requireLiveAdminApi().recommendDeliveryAssignment(
        serviceAreaId,
        deliveryDate,
      );
      if (!rec.deliveryProfileId) {
        setRecommendNote('No available delivery boy for this area/date.');
        return;
      }
      setBoyId(rec.deliveryProfileId);
      if (rec.vehicleId) setVehicleId(rec.vehicleId);
      if (rec.existingRouteId) {
        setExistingRouteId(rec.existingRouteId);
        setRouteMode('reuse');
        setRecommendNote(
          `Recommend ${rec.displayName ?? 'driver'} · add to existing trip (${rec.stopCount} stops).`,
        );
      } else {
        setExistingRouteId(null);
        setRouteMode('create');
        setRecommendNote(
          `Recommend ${rec.displayName ?? 'driver'} · create new delivery trip.`,
        );
      }
    } catch (err) {
      setError(formatMutationError(err, 'Could not recommend'));
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!selectedIds.length) {
      setError('Select at least one order');
      return;
    }
    if (!boyId || !deliveryDate) {
      setError('Delivery boy and date are required');
      return;
    }
    const areas = new Set(selectedOrders.map((o) => o.serviceAreaId));
    if (areas.size > 1) {
      setError('All selected orders must share the same service area');
      return;
    }
    try {
      const result = await schedule.mutateAsync({
        orderIds: selectedIds,
        deliveryProfileId: boyId,
        vehicleId: resolveVehicleIdForRpc(vehicleId),
        deliveryDate,
        timeSlotId: timeSlotId || null,
        routeId: routeMode === 'reuse' ? existingRouteId : null,
        serviceAreaId: serviceAreaId || null,
      });
      onSuccess?.(
        result['routeId'] ? String(result['routeId']) : undefined,
      );
      onClose();
    } catch (err) {
      setError(formatMutationError(err, 'Could not schedule and assign'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Delivery Trip"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={schedule.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSubmit()}
            disabled={schedule.isPending}
          >
            {schedule.isPending ? 'Creating…' : 'Create Delivery Trip'}
          </Button>
        </>
      }
    >
      <div className="ga-sm-provision">
        <p className="ga-sm-provision__hint">
          Step 1 — Delivery boy · Step 2 — Vehicle (optional) · Step 3 — Orders
          · Step 4 — Schedule. A delivery trip assigns orders to one driver.
        </p>

        <div className="ga-sm-provision__row">
          <SelectField label="Delivery boy" value={boyId} onChange={setBoyId}>
            <option value="">Select…</option>
            {boys
              .filter((b) => b.employmentStatus === 'ACTIVE')
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.operationalStatus}
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
        </div>

        <div className="ga-table-wrap">
          <div className="ga-sm-provision__row">
            <Button
              variant="ghost"
              type="button"
              onClick={allSelected ? clearSelection : selectAll}
            >
              {allSelected ? 'Clear selection' : 'Select all'}
            </Button>
            <span className="ga-sm-provision__hint">
              {selectedIds.length} of {orders.length} selected
            </span>
          </div>
          <table className="ga-table">
            <thead>
              <tr>
                <th />
                <th>Order</th>
                <th>Customer</th>
                <th>Area</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleOrder(o.id)}
                    />
                  </td>
                  <td className="ga-table__mono">{o.orderCode}</td>
                  <td>{o.customerName}</td>
                  <td>{o.serviceAreaLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ga-sm-provision__row">
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

        <SelectField
          label="Trip mode"
          value={routeMode}
          onChange={(v) => setRouteMode(v as 'reuse' | 'create')}
        >
          <option value="create">Create new delivery trip</option>
          <option value="reuse" disabled={!existingRouteId}>
            {existingRouteId
              ? `Add to existing trip (${existingRouteId.slice(0, 8)})`
              : "Add to driver's existing trip (use Recommend)"}
          </option>
        </SelectField>

        <Button variant="secondary" onClick={() => void applyRecommend()}>
          Recommend assignment
        </Button>
        {recommendNote ? (
          <p className="ga-sm-provision__hint">{recommendNote}</p>
        ) : null}
        {error ? <p className="ga-sm-provision__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
