import { useState } from 'react';
import { Button, SelectField, TextField } from '@groaurum/ui';
import type {
  DeliveryExceptionActionVm,
  DeliveryExceptionCategoryVm,
  DeliveryExceptionRow,
} from '@/data/delivery-types';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCreateDeliveryExceptionMutation,
  useResolveDeliveryExceptionMutation,
} from '@/data/mutations';
import {
  useDeliveryBoysSnapshotQuery,
  useVehiclesListQuery,
  useDeliveryTimeSlotsQuery,
} from '@/data/hooks';
import {
  DELIVERY_PROBLEM_REASON_CODES,
  DELIVERY_PROBLEM_REASON_LABELS,
} from '@groaurum/shared-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  exceptions: DeliveryExceptionRow[];
  canManage?: boolean;
};

const ACTIONS: DeliveryExceptionActionVm[] = [
  'RESUME',
  'REPLACE_DRIVER',
  'REPLACE_VEHICLE',
  'RESCHEDULE_ROUTE',
  'CANCEL_ATTEMPT',
];

export function DeliveryExceptionsPanel({
  exceptions,
  canManage = false,
}: Props) {
  const createEx = useCreateDeliveryExceptionMutation();
  const resolveEx = useResolveDeliveryExceptionMutation();
  const { state: boysState } = useDeliveryBoysSnapshotQuery();
  const { state: vehiclesState } = useVehiclesListQuery();
  const { state: slotsState } = useDeliveryTimeSlotsQuery();

  const [category, setCategory] =
    useState<DeliveryExceptionCategoryVm>('CUSTOMER');
  const [reasonCode, setReasonCode] = useState<string>(
    DELIVERY_PROBLEM_REASON_CODES[0],
  );
  const [reasonNote, setReasonNote] = useState('');
  const [routeId, setRouteId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [resolveId, setResolveId] = useState<string | null>(null);
  const [action, setAction] = useState<DeliveryExceptionActionVm>('RESUME');
  const [actionNote, setActionNote] = useState('');
  const [replacementBoy, setReplacementBoy] = useState('');
  const [replacementVehicle, setReplacementVehicle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  const onCreate = async () => {
    setCreateError(null);
    if (!reasonCode.trim()) {
      setCreateError('Choose a delivery problem reason');
      return;
    }
    try {
      await createEx.mutateAsync({
        category,
        reasonCode: reasonCode.trim(),
        reasonNote: reasonNote.trim() || undefined,
        routeId: routeId.trim() || null,
      });
      setReasonCode(DELIVERY_PROBLEM_REASON_CODES[0]);
      setReasonNote('');
      setRouteId('');
    } catch (err) {
      setCreateError(formatMutationError(err, 'Could not report delivery problem'));
    }
  };

  const onResolve = async () => {
    if (!resolveId) return;
    setResolveError(null);
    try {
      await resolveEx.mutateAsync({
        exceptionId: resolveId,
        action,
        actionNote: actionNote.trim() || undefined,
        replacementDeliveryProfileId: replacementBoy || null,
        replacementVehicleId: replacementVehicle || null,
        newDeliveryDate: newDate || null,
        newTimeSlotId: newSlot || null,
      });
      setResolveId(null);
      setActionNote('');
    } catch (err) {
      setResolveError(formatMutationError(err, 'Could not resolve'));
    }
  };

  return (
    <div className="ga-dl-exceptions">
      <Card title="Delivery problems needing attention">
        {exceptions.length === 0 ? (
          <EmptyState
            title="No open delivery problems"
            detail="Issues like shop closed, vehicle problems, or customer refusals appear here."
          />
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Reason</th>
                  <th>Route / Order</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {exceptions.map((ex) => (
                  <tr key={ex.id}>
                    <td>{ex.category}</td>
                    <td>
                      {DELIVERY_PROBLEM_REASON_LABELS[
                        ex.reasonCode as keyof typeof DELIVERY_PROBLEM_REASON_LABELS
                      ] ?? ex.reasonCode}
                      {ex.reasonNote ? ` · ${ex.reasonNote}` : ''}
                    </td>
                    <td>
                      {ex.routeLabel ?? '—'}
                      {ex.orderCode ? ` / ${ex.orderCode}` : ''}
                    </td>
                    <td>{ex.createdAtLabel}</td>
                    <td>
                      {canManage ? (
                        <Button
                          variant="secondary"
                          onClick={() => setResolveId(ex.id)}
                        >
                          Resolve
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage ? (
        <Card title="Report Delivery Problem">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
            }}
          >
            <SelectField
              label="Area"
              value={category}
              onChange={(v) =>
                setCategory(v as DeliveryExceptionCategoryVm)
              }
            >
              <option value="CUSTOMER">Customer / shop</option>
              <option value="DRIVER">Delivery boy</option>
              <option value="VEHICLE">Vehicle</option>
              <option value="WAREHOUSE_ORDER">Warehouse / order</option>
              <option value="EXTERNAL">Other external</option>
            </SelectField>
            <SelectField
              label="What went wrong?"
              value={reasonCode}
              onChange={setReasonCode}
            >
              {DELIVERY_PROBLEM_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {DELIVERY_PROBLEM_REASON_LABELS[code]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Extra note (optional)"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
            />
            <TextField
              label="Trip / route id (optional)"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
            />
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="secondary"
              disabled={createEx.isPending}
              onClick={() => void onCreate()}
            >
              Report Delivery Problem
            </Button>
          </div>
          {createError ? (
            <p style={{ color: 'var(--ga-color-danger, #b42318)' }}>
              {createError}
            </p>
          ) : null}
        </Card>
      ) : null}

      {canManage && resolveId ? (
        <Card title="Resolve exception">
          <SelectField
            label="Action"
            value={action}
            onChange={(v) => setAction(v as DeliveryExceptionActionVm)}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </SelectField>
          {action === 'REPLACE_DRIVER' ? (
            <SelectField
              label="Replacement driver"
              value={replacementBoy}
              onChange={setReplacementBoy}
            >
              <option value="">Select…</option>
              {(boysState.data?.rows ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          {action === 'REPLACE_VEHICLE' ? (
            <SelectField
              label="Replacement vehicle"
              value={replacementVehicle}
              onChange={setReplacementVehicle}
            >
              <option value="">Select…</option>
              {(vehiclesState.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </SelectField>
          ) : null}
          {action === 'RESCHEDULE_ROUTE' ? (
            <>
              <TextField
                label="New date"
                type="date"
                value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              />
              <SelectField
                label="New slot"
                value={newSlot}
                onChange={setNewSlot}
              >
                <option value="">Select…</option>
                {(slotsState.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </SelectField>
            </>
          ) : null}
          <TextField
            label="Action note"
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button
              variant="primary"
              disabled={resolveEx.isPending}
              onClick={() => void onResolve()}
            >
              Confirm resolve
            </Button>
            <Button variant="ghost" onClick={() => setResolveId(null)}>
              Cancel
            </Button>
          </div>
          {resolveError ? (
            <p style={{ color: 'var(--ga-color-danger, #b42318)' }}>
              {resolveError}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
