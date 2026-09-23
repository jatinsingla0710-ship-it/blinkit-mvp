import { useEffect, useMemo, useState } from 'react';

import { Modal, TextField, SelectField, Button } from '@groaurum/ui';

import type { VehicleListRow } from '@/data/delivery-types';

import { formatMutationError } from '@/data/mutation-errors';

import { useUpsertVehicleMutation } from '@/data/mutations';

import { useDeliveryBoysSnapshotQuery } from '@/data/hooks';

import '../salesmen/SalesmanProvisionModal.css';



const VEHICLE_TYPES = [

  { value: 'BIKE', label: 'Bike' },

  { value: 'AUTO', label: 'Auto' },

  { value: 'VAN', label: 'Van' },

  { value: 'TRUCK', label: 'Truck' },

  { value: 'OTHER', label: 'Other' },

] as const;



type Props = {

  open: boolean;

  onClose: () => void;

  vehicle?: VehicleListRow | null;

  onSuccess?: () => void;

};



type FormState = {

  vehicleNumber: string;

  vehicleType: string;

  capacityLabel: string;

  isActive: boolean;

  status: 'AVAILABLE' | 'ASSIGNED' | 'ON_ROUTE' | 'MAINTENANCE' | 'UNAVAILABLE';

  assignedDeliveryProfileId: string;

  notes: string;

};



function fromVehicle(v: VehicleListRow | null | undefined): FormState {

  const statusMap: Record<string, FormState['status']> = {

    available: 'AVAILABLE',

    assigned: 'ASSIGNED',

    on_route: 'ON_ROUTE',

    maintenance: 'MAINTENANCE',

    unavailable: 'UNAVAILABLE',

    idle: 'AVAILABLE',

    loading: 'ASSIGNED',

    running: 'ON_ROUTE',

  };

  const typeUpper = (v?.vehicleType ?? 'VAN').toUpperCase();

  const knownType = VEHICLE_TYPES.some((t) => t.value === typeUpper)

    ? typeUpper

    : 'OTHER';

  return {

    vehicleNumber: v?.vehicleNumber ?? '',

    vehicleType: knownType,

    capacityLabel: v?.capacityLabel === '—' ? '' : (v?.capacityLabel ?? ''),

    isActive: v?.isActive ?? true,

    status: v ? (statusMap[v.status] ?? 'AVAILABLE') : 'AVAILABLE',

    assignedDeliveryProfileId: v?.assignedDriverId ?? '',

    notes: v?.notes ?? '',

  };

}



export function VehicleFormModal({ open, onClose, vehicle, onSuccess }: Props) {

  const upsert = useUpsertVehicleMutation();

  const { state: boysState } = useDeliveryBoysSnapshotQuery();

  const [form, setForm] = useState<FormState>(fromVehicle(vehicle));

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    if (!open) return;

    setForm(fromVehicle(vehicle));

    setError(null);

  }, [open, vehicle]);



  const boys = useMemo(() => boysState.data?.rows ?? [], [boysState.data]);



  const onSubmit = async () => {

    setError(null);

    if (!form.vehicleNumber.trim()) {

      setError('Vehicle number is required');

      return;

    }

    try {

      await upsert.mutateAsync({

        vehicleId: vehicle?.id ?? null,

        vehicleNumber: form.vehicleNumber.trim(),

        vehicleType: form.vehicleType.trim() || 'VAN',

        capacityLabel: form.capacityLabel.trim() || undefined,

        isActive: form.isActive,

        status: form.status,

        assignedDeliveryProfileId: form.assignedDeliveryProfileId || null,

        notes: form.notes.trim() || undefined,

      });

      onSuccess?.();

      onClose();

    } catch (err) {

      setError(formatMutationError(err, 'Could not save vehicle'));

    }

  };



  return (

    <Modal

      open={open}

      onClose={onClose}

      title={vehicle ? 'Edit vehicle' : '➕ Add Vehicle'}

      footer={

        <>

          <Button variant="ghost" onClick={onClose} disabled={upsert.isPending}>

            Cancel

          </Button>

          <Button

            variant="primary"

            onClick={() => void onSubmit()}

            disabled={upsert.isPending}

          >

            {upsert.isPending ? 'Saving…' : 'Save'}

          </Button>

        </>

      }

    >

      <div className="ga-sm-provision">

        <div className="ga-sm-provision__row">

          <TextField

            label="Vehicle number"

            value={form.vehicleNumber}

            onChange={(e) =>

              setForm((f) => ({ ...f, vehicleNumber: e.target.value }))

            }

          />

          <SelectField

            label="Vehicle type"

            value={form.vehicleType}

            onChange={(vehicleType) => setForm((f) => ({ ...f, vehicleType }))}

          >

            {VEHICLE_TYPES.map((t) => (

              <option key={t.value} value={t.value}>

                {t.label}

              </option>

            ))}

          </SelectField>

        </div>

        <div className="ga-sm-provision__row">

          <SelectField

            label="Status"

            value={form.status}

            onChange={(status) =>

              setForm((f) => ({ ...f, status: status as FormState['status'] }))

            }

          >

            <option value="AVAILABLE">Available</option>

            <option value="ASSIGNED">In Use</option>

            <option value="ON_ROUTE">In Use (on trip)</option>

            <option value="MAINTENANCE">Maintenance</option>

            <option value="UNAVAILABLE">Inactive</option>

          </SelectField>

          <SelectField

            label="Active"

            value={form.isActive ? 'yes' : 'no'}

            onChange={(v) => setForm((f) => ({ ...f, isActive: v === 'yes' }))}

          >

            <option value="yes">Active</option>

            <option value="no">Inactive</option>

          </SelectField>

        </div>

        <SelectField

          label="Assigned driver (optional)"

          value={form.assignedDeliveryProfileId}

          onChange={(assignedDeliveryProfileId) =>

            setForm((f) => ({ ...f, assignedDeliveryProfileId }))

          }

        >

          <option value="">None</option>

          {boys.map((b) => (

            <option key={b.id} value={b.id}>

              {b.name}

            </option>

          ))}

        </SelectField>

        <TextField

          label="Capacity note (optional)"

          value={form.capacityLabel}

          onChange={(e) =>

            setForm((f) => ({ ...f, capacityLabel: e.target.value }))

          }

        />

        <TextField

          label="Notes (optional)"

          value={form.notes}

          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}

        />

        {error ? <p className="ga-sm-provision__error">{error}</p> : null}

      </div>

    </Modal>

  );

}

