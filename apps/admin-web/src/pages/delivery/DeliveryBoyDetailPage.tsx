import { useEffect, useMemo, useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import { usePermissions } from '@groaurum/auth/react';

import { Button, SelectField, TextField } from '@groaurum/ui';

import { Card } from '@/components/ui/Card';

import { PageHeader } from '@/components/ui/PageHeader';

import { QueryStateGate } from '@/data/QueryStateGate';

import {

  useDeliveryBoyDetailQuery,

  useServiceAreasListQuery,

  useVehiclesListQuery,

} from '@/data/hooks';

import { activeServiceAreas } from '@/data/live-entity-helpers';

import { mapDeliveryBoyUiStatus } from '@/data/delivery-setup-helpers';

import { formatMutationError } from '@/data/mutation-errors';

import {

  useUpsertDeliveryEmploymentMutation,

  useUpsertVehicleMutation,

} from '@/data/mutations';

import type {

  DeliveryEmploymentStatusVm,

  DeliveryOperationalStatusVm,

} from '@/data/delivery-types';

import './DeliveryListPage.css';



export function DeliveryBoyDetailPage() {

  const { boyId } = useParams<{ boyId: string }>();

  const { state } = useDeliveryBoyDetailQuery(boyId);

  const { state: vehiclesState } = useVehiclesListQuery();

  const upsert = useUpsertDeliveryEmploymentMutation();

  const upsertVehicle = useUpsertVehicleMutation();

  const { state: areasState } = useServiceAreasListQuery();

  const { hasPermission } = usePermissions();

  const canManage = hasPermission('delivery:manage');



  const [joiningDate, setJoiningDate] = useState('');

  const [employmentStatus, setEmploymentStatus] =

    useState<DeliveryEmploymentStatusVm>('ACTIVE');

  const [operationalStatus, setOperationalStatus] =

    useState<DeliveryOperationalStatusVm>('AVAILABLE');

  const [address, setAddress] = useState('');

  const [areaId, setAreaId] = useState('');

  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [vehicleError, setVehicleError] = useState<string | null>(null);

  const [ok, setOk] = useState<string | null>(null);

  const [vehicleOk, setVehicleOk] = useState<string | null>(null);



  const areas = useMemo(

    () => activeServiceAreas(areasState.data ?? []),

    [areasState.data],

  );



  const vehicles = vehiclesState.data ?? [];



  const assignableVehicles = useMemo(

    () =>

      vehicles.filter(

        (v) =>

          v.isActive &&

          (v.status === 'available' ||

            v.status === 'assigned' ||

            v.assignedDriverId === boyId),

      ),

    [vehicles, boyId],

  );



  useEffect(() => {

    if (!state.data) return;

    setJoiningDate(state.data.joiningDate ?? '');

    setEmploymentStatus(state.data.employmentStatus);

    setOperationalStatus(state.data.operationalStatus);

    setAddress(state.data.address ?? '');

    setAreaId(state.data.primaryServiceAreaId ?? '');

    setSelectedVehicleId(state.data.vehicleId ?? '');

  }, [state.data]);



  const onSave = async () => {

    if (!boyId) return;

    setError(null);

    setOk(null);

    try {

      await upsert.mutateAsync({

        profileId: boyId,

        joiningDate: joiningDate || undefined,

        employmentStatus,

        operationalStatus,

        address: address.trim() || undefined,

        contactEmail: state.data?.email || undefined,

        primaryServiceAreaId: areaId || null,

      });

      setOk('Employment saved.');

    } catch (err) {

      setError(formatMutationError(err, 'Could not save'));

    }

  };



  const onAssignVehicle = async () => {

    if (!boyId || !selectedVehicleId) return;

    setVehicleError(null);

    setVehicleOk(null);

    const next = vehicles.find((v) => v.id === selectedVehicleId);

    if (!next) return;

    try {

      const current = state.data?.vehicleId

        ? vehicles.find((v) => v.id === state.data?.vehicleId)

        : null;

      if (current && current.id !== next.id) {

        await upsertVehicle.mutateAsync({

          vehicleId: current.id,

          vehicleNumber: current.vehicleNumber,

          vehicleType: current.vehicleType,

          capacityLabel:

            current.capacityLabel === '—' ? undefined : current.capacityLabel,

          isActive: current.isActive,

          status: 'AVAILABLE',

          assignedDeliveryProfileId: null,

          notes: current.notes ?? undefined,

        });

      }

      await upsertVehicle.mutateAsync({

        vehicleId: next.id,

        vehicleNumber: next.vehicleNumber,

        vehicleType: next.vehicleType,

        capacityLabel:

          next.capacityLabel === '—' ? undefined : next.capacityLabel,

        isActive: next.isActive,

        status: 'ASSIGNED',

        assignedDeliveryProfileId: boyId,

        notes: next.notes ?? undefined,

      });

      setVehicleOk(`Operating: ${next.vehicleNumber} – ${next.vehicleType}`);

    } catch (err) {

      setVehicleError(formatMutationError(err, 'Could not assign vehicle'));

    }

  };



  const onUnassignVehicle = async () => {

    const current = state.data?.vehicleId

      ? vehicles.find((v) => v.id === state.data?.vehicleId)

      : null;

    if (!current) return;

    setVehicleError(null);

    setVehicleOk(null);

    try {

      await upsertVehicle.mutateAsync({

        vehicleId: current.id,

        vehicleNumber: current.vehicleNumber,

        vehicleType: current.vehicleType,

        capacityLabel:

          current.capacityLabel === '—' ? undefined : current.capacityLabel,

        isActive: current.isActive,

        status: 'AVAILABLE',

        assignedDeliveryProfileId: null,

        notes: current.notes ?? undefined,

      });

      setSelectedVehicleId('');

      setVehicleOk('Vehicle unassigned. History is preserved in fleet records.');

    } catch (err) {

      setVehicleError(formatMutationError(err, 'Could not unassign vehicle'));

    }

  };



  return (

    <QueryStateGate

      title="Delivery boy"

      state={state}

      emptyTitle="Not found"

      emptyDetail="Return to delivery boys list."

    >

      {(boy) => {

        const uiStatus = mapDeliveryBoyUiStatus({

          employmentStatus: boy.employmentStatus,

          operationalStatus: boy.operationalStatus,

        });

        return (

          <div className="ga-dl-list">

            <PageHeader

              title={boy.name}

              subtitle={`${boy.mobile || '—'} · ${boy.email || '—'}`}

              meta={boy.updatedAtLabel}

            />

            <Link to="/delivery/boys">← Delivery boys</Link>



            <Card title="Current assignment">

              <p>

                <strong>Status:</strong> {uiStatus}

              </p>

              <p>

                <strong>Trip:</strong> {boy.currentRouteLabel ?? '—'}

                {boy.currentRouteId ? (

                  <>

                    {' '}

                    · <Link to={`/delivery/${boy.currentRouteId}`}>Open trip</Link>

                  </>

                ) : null}

              </p>

              <p>

                <strong>Operating:</strong>{' '}

                {boy.vehicleLabel

                  ? `${boy.vehicleLabel}`

                  : 'No company vehicle assigned'}

              </p>

              <p>

                <strong>Location:</strong> {boy.serviceAreaLabel}

              </p>

            </Card>



            {canManage ? (

              <Card title="Vehicle assignment">

                <p style={{ marginTop: 0, fontSize: '0.875rem' }}>

                  Assign a company vehicle for today. Drivers can also use their

                  own vehicle when creating a delivery trip.

                </p>

                <SelectField

                  label="Company vehicle"

                  value={selectedVehicleId}

                  onChange={setSelectedVehicleId}

                >

                  <option value="">Select vehicle…</option>

                  {assignableVehicles.map((v) => (

                    <option key={v.id} value={v.id}>

                      {v.vehicleNumber} – {v.vehicleType}

                      {v.assignedDriverId && v.assignedDriverId !== boyId

                        ? ' (assigned elsewhere)'

                        : ''}

                    </option>

                  ))}

                </SelectField>

                <div

                  style={{

                    display: 'flex',

                    gap: '0.5rem',

                    marginTop: '0.75rem',

                    flexWrap: 'wrap',

                  }}

                >

                  <Button

                    variant="primary"

                    disabled={!selectedVehicleId || upsertVehicle.isPending}

                    onClick={() => void onAssignVehicle()}

                  >

                    Change Vehicle

                  </Button>

                  {boy.vehicleId ? (

                    <Button

                      variant="secondary"

                      disabled={upsertVehicle.isPending}

                      onClick={() => void onUnassignVehicle()}

                    >

                      Unassign Vehicle

                    </Button>

                  ) : null}

                </div>

                {vehicleError ? (

                  <p style={{ color: 'var(--ga-color-danger)' }}>{vehicleError}</p>

                ) : null}

                {vehicleOk ? (

                  <p style={{ color: 'var(--ga-color-success)' }}>{vehicleOk}</p>

                ) : null}

              </Card>

            ) : null}



            {canManage ? (

              <Card title="Employment">

                <div

                  style={{

                    display: 'grid',

                    gridTemplateColumns: '1fr 1fr',

                    gap: '0.75rem',

                  }}

                >

                  <TextField

                    label="Joining date"

                    type="date"

                    value={joiningDate}

                    onChange={(e) => setJoiningDate(e.target.value)}

                  />

                  <SelectField

                    label="Active / Inactive"

                    value={employmentStatus}

                    onChange={(v) =>

                      setEmploymentStatus(v as DeliveryEmploymentStatusVm)

                    }

                  >

                    <option value="ACTIVE">Active</option>

                    <option value="INACTIVE">Inactive</option>

                  </SelectField>

                  <SelectField

                    label="Availability"

                    value={operationalStatus}

                    onChange={(v) =>

                      setOperationalStatus(v as DeliveryOperationalStatusVm)

                    }

                  >

                    <option value="AVAILABLE">Available</option>

                    <option value="ON_ROUTE">On Delivery</option>

                    <option value="OFF_DUTY">Off duty</option>

                    <option value="UNAVAILABLE">Unavailable</option>

                  </SelectField>

                  <SelectField

                    label="Warehouse / service area"

                    value={areaId}

                    onChange={setAreaId}

                  >

                    <option value="">None</option>

                    {areas.map((a) => (

                      <option key={a.id} value={a.id}>

                        {a.name}

                      </option>

                    ))}

                  </SelectField>

                </div>

                <TextField

                  label="Address"

                  value={address}

                  onChange={(e) => setAddress(e.target.value)}

                />

                <div style={{ marginTop: '0.75rem' }}>

                  <Button

                    variant="primary"

                    disabled={upsert.isPending}

                    onClick={() => void onSave()}

                  >

                    {upsert.isPending ? 'Saving…' : 'Save employment'}

                  </Button>

                </div>

                {error ? (

                  <p style={{ color: 'var(--ga-color-danger)' }}>{error}</p>

                ) : null}

                {ok ? (

                  <p style={{ color: 'var(--ga-color-success)' }}>{ok}</p>

                ) : null}

              </Card>

            ) : null}

          </div>

        );

      }}

    </QueryStateGate>

  );

}

