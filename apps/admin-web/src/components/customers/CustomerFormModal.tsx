import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import type { NewCustomerLocationDefaults } from '@/data/business-defaults';
import { validateCustomerCreateForm } from '@/data/customer-create-validation';
import { formatMutationError } from '@/data/mutation-errors';
import {
  formatDuplicateMobileWarning,
  isMobileLookupReady,
} from '@/data/customer-mobile-lookup';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import {
  formatCoordinates,
  readCurrentPosition,
} from '@/data/geolocation';
import {
  lookupPinServiceability,
  pinLookupMessage,
  resolveServiceAreaIdForPin,
  serviceAreaOptionsForPin,
} from '@/data/customer-pin-lookup';
import { activeSalesmen, activeServiceAreas } from '@/data/live-entity-helpers';
import {
  useSalesmenSnapshotQuery,
  useServiceAreasListQuery,
} from '@/data/hooks';
import { useCreateCustomerMutation } from '@/data/mutations';
import './CustomerFormModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
  locationHints?: Partial<NewCustomerLocationDefaults> | null;
};

type FormState = {
  tradeName: string;
  legalName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  serviceAreaId: string;
  assignedSalesmanProfileId: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  gstin: string;
};

const EMPTY: FormState = {
  tradeName: '',
  legalName: '',
  ownerName: '',
  ownerMobile: '',
  ownerEmail: '',
  serviceAreaId: '',
  assignedSalesmanProfileId: '',
  deliveryAddressLine: '',
  deliveryCity: '',
  deliveryState: '',
  deliveryPinCode: '',
  deliveryLat: null,
  deliveryLng: null,
  gstin: '',
};

export function CustomerFormModal({
  open,
  onClose,
  onSuccess,
  locationHints,
}: Props) {
  const createCustomer = useCreateCustomerMutation();
  const { state: areasState } = useServiceAreasListQuery();
  const { state: salesmenState } = useSalesmenSnapshotQuery();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const serviceAreas = useMemo(
    () => activeServiceAreas(areasState.data ?? []),
    [areasState.data],
  );
  const salesmen = useMemo(
    () => activeSalesmen(salesmenState.data?.rows ?? []),
    [salesmenState.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLocationMessage(null);
    setLocating(false);
    setCreatedId(null);
    setMobileWarning(null);
    submittingRef.current = false;
    const hintedArea = serviceAreas.find(
      (area) => area.id === locationHints?.serviceAreaId,
    );
    setForm({
      ...EMPTY,
      deliveryCity: locationHints?.deliveryCity ?? '',
      deliveryState: locationHints?.deliveryState ?? '',
      deliveryPinCode: locationHints?.deliveryPinCode ?? '',
      serviceAreaId: locationHints?.deliveryPinCode
        ? resolveServiceAreaIdForPin(
            locationHints.deliveryPinCode,
            serviceAreas,
            hintedArea?.id ?? '',
          )
        : hintedArea?.id ?? '',
    });
  }, [open, locationHints, serviceAreas]);

  useEffect(() => {
    if (!open || !isMobileLookupReady(form.ownerMobile)) {
      setMobileWarning(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void requireLiveAdminApi()
        .findCustomersByMobile(form.ownerMobile)
        .then((matches) => {
          if (cancelled) return;
          setMobileWarning(
            matches.length > 0 ? formatDuplicateMobileWarning(matches) : null,
          );
        })
        .catch(() => {
          if (!cancelled) setMobileWarning(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, form.ownerMobile]);

  const pending = createCustomer.isPending;
  const missingSalesmen = salesmen.length === 0;
  const missingAreas = serviceAreas.length === 0;
  const hasLocation =
    form.deliveryLat != null && form.deliveryLng != null;
  const pinLookup = lookupPinServiceability(form.deliveryPinCode, serviceAreas);
  const pinMessage = pinLookupMessage(pinLookup);
  const selectableServiceAreas = serviceAreaOptionsForPin(
    form.deliveryPinCode,
    serviceAreas,
  );
  const pinBlocksCreate =
    pinLookup.status === 'invalid' || pinLookup.status === 'not_serviceable';
  const serviceAreaLocked = pinLookup.status === 'matched';

  const onPinChange = (raw: string) => {
    const deliveryPinCode = raw.replace(/\D/g, '').slice(0, 6);
    setForm((current) => ({
      ...current,
      deliveryPinCode,
      serviceAreaId: resolveServiceAreaIdForPin(
        deliveryPinCode,
        serviceAreas,
        current.serviceAreaId,
      ),
    }));
  };

  const onUseCurrentLocation = async () => {
    if (locating || pending) return;
    setLocationMessage(null);
    setLocating(true);
    try {
      const { lat, lng } = await readCurrentPosition();
      setForm((current) => ({
        ...current,
        deliveryLat: lat,
        deliveryLng: lng,
      }));
      setLocationMessage(`Captured ${formatCoordinates(lat, lng)}`);
    } catch (err) {
      setLocationMessage(
        err instanceof Error ? err.message : 'Could not read current location.',
      );
    } finally {
      setLocating(false);
    }
  };

  const onSubmit = () => {
    if (pending || submittingRef.current || createdId) return;
    const validated = validateCustomerCreateForm(form, {
      serviceAreas,
      salesmen,
    });
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    setError(null);
    submittingRef.current = true;
    createCustomer.mutate(validated.payload, {
      onSuccess: (row) => {
        submittingRef.current = false;
        setCreatedId(row.id);
      },
      onError: (err) => {
        submittingRef.current = false;
        setError(formatMutationError(err, 'Create failed'));
      },
    });
  };

  const close = () => {
    if (pending) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      title={createdId ? 'Customer created' : 'Add Customer'}
      onClose={close}
      footer={
        createdId ? (
          <>
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onSuccess?.(createdId);
                onClose();
              }}
            >
              View Customer
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSubmit}
              disabled={
                pending || missingSalesmen || missingAreas || pinBlocksCreate
              }
            >
              {pending ? 'Creating…' : 'Create Customer'}
            </Button>
          </>
        )
      }
    >
      {createdId ? (
        <div className="ga-cust-form__success-block">
          <p className="ga-cust-form__success">
            Customer created successfully. Visits and orders can start now.
          </p>
        </div>
      ) : (
        <div className="ga-cust-form">
          {missingAreas ? (
            <p className="ga-cust-form__error">
              No active service areas are available. Create one before adding
              customers.
            </p>
          ) : null}
          {missingSalesmen ? (
            <p className="ga-cust-form__error">
              No active salesmen are available. Assign a salesman before adding
              customers.
            </p>
          ) : null}
          <TextField
            label="Shop / business name"
            value={form.tradeName}
            onChange={(e) =>
              setForm((f) => ({ ...f, tradeName: e.target.value }))
            }
            required
          />
          <TextField
            label="Legal name"
            value={form.legalName}
            onChange={(e) =>
              setForm((f) => ({ ...f, legalName: e.target.value }))
            }
            hint="Optional"
          />
          <TextField
            label="GSTIN"
            value={form.gstin}
            onChange={(e) =>
              setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))
            }
            hint="Optional · 15 characters"
            className="ga-cust-form__mono"
          />
          <TextField
            label="Owner / contact person"
            value={form.ownerName}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerName: e.target.value }))
            }
            required
          />
          <TextField
            label="Mobile"
            value={form.ownerMobile}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerMobile: e.target.value }))
            }
            inputMode="tel"
            placeholder="10-digit mobile"
            required
          />
          {mobileWarning ? (
            <p className="ga-cust-form__warning" role="status">
              {mobileWarning}
            </p>
          ) : null}
          <TextField
            label="Email"
            value={form.ownerEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerEmail: e.target.value }))
            }
            hint="Optional"
          />
          <TextField
            label="PIN code"
            value={form.deliveryPinCode}
            onChange={(e) => onPinChange(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            hint="Enter a 6-digit PIN to find the serviceable area"
            required
          />
          {pinMessage ? (
            <p
              className={
                pinLookup.status === 'not_serviceable' ||
                pinLookup.status === 'invalid'
                  ? 'ga-cust-form__error'
                  : 'ga-cust-form__hint'
              }
            >
              {pinMessage}
            </p>
          ) : null}
          <SelectField
            label="Service area"
            value={form.serviceAreaId}
            onChange={(serviceAreaId) =>
              setForm((f) => ({ ...f, serviceAreaId }))
            }
            disabled={
              pinLookup.status === 'incomplete' ||
              pinLookup.status === 'invalid' ||
              pinLookup.status === 'not_serviceable' ||
              serviceAreaLocked
            }
          >
            <option value="">
              {pinLookup.status === 'incomplete'
                ? 'Enter PIN code first'
                : pinLookup.status === 'multiple'
                  ? 'Select service area'
                  : 'Select service area'}
            </option>
            {selectableServiceAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="State"
            value={form.deliveryState}
            onChange={(e) =>
              setForm((f) => ({ ...f, deliveryState: e.target.value }))
            }
            hint="Enter manually — state is not derived from PIN in current data"
            required
          />
          <TextField
            label="City"
            value={form.deliveryCity}
            onChange={(e) =>
              setForm((f) => ({ ...f, deliveryCity: e.target.value }))
            }
            required
          />
          <TextField
            label="Delivery address"
            value={form.deliveryAddressLine}
            onChange={(e) =>
              setForm((f) => ({ ...f, deliveryAddressLine: e.target.value }))
            }
            hint="Enter shop address manually"
            required
          />
          <SelectField
            label="Assigned salesman"
            value={form.assignedSalesmanProfileId}
            onChange={(assignedSalesmanProfileId) =>
              setForm((f) => ({ ...f, assignedSalesmanProfileId }))
            }
          >
            <option value="">Select salesman</option>
            {salesmen.map((salesman) => (
              <option key={salesman.id} value={salesman.id}>
                {salesman.name}
              </option>
            ))}
          </SelectField>
          <p className="ga-cust-form__hint">
            The shop is usable as soon as it is saved. No customer login is required.
          </p>
          <div className="ga-cust-form__location">
            <div className="ga-cust-form__location-head">
              <span className="ga-cust-form__location-label">Shop location</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onUseCurrentLocation()}
                disabled={pending || locating}
              >
                {locating ? 'Locating…' : 'Use Current Location'}
              </Button>
            </div>
            {hasLocation ? (
              <p className="ga-cust-form__location-value">
                {formatCoordinates(form.deliveryLat!, form.deliveryLng!)}
              </p>
            ) : (
              <p className="ga-cust-form__location-hint">
                Optional. Capture GPS coordinates for delivery routing.
              </p>
            )}
            {locationMessage ? (
              <p
                className={
                  hasLocation
                    ? 'ga-cust-form__location-ok'
                    : 'ga-cust-form__error'
                }
              >
                {locationMessage}
              </p>
            ) : null}
          </div>
          {error ? <p className="ga-cust-form__error">{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}
