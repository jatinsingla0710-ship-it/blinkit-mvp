import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, SelectField, TextField } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { ButtonLink } from '@/components/ButtonLink';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { newCustomerError, shopPhotoFileError } from '@/data/customer-form';
import { errorMessage } from '@/lib/errors';
import {
  formatCoordinates,
  isValidCoordinatePair,
  readCurrentPosition,
} from '@/data/geolocation';
import { isSalesDataMockMode } from '@/data/salesmanApi';

export function CustomerCreatedConfirmation({
  shopId,
  tradeName,
  photoWarning,
}: {
  shopId: string;
  tradeName: string;
  photoWarning: string | null;
}) {
  return (
    <Card title="Retailer added">
      <p className="ga-sales-muted">
        {tradeName} is on your list. Open the shop or start an order now.
      </p>
      {photoWarning ? (
        <p className="ga-sales-warning" role="status">
          {photoWarning}
        </p>
      ) : null}
      <div className="ga-sales-actions">
        <ButtonLink to={`/customers/${shopId}`} variant="secondary">
          Open customer
        </ButtonLink>
        <ButtonLink to={`/orders/new?shopId=${shopId}`} variant="primary">
          Create order
        </ButtonLink>
      </div>
    </Card>
  );
}

export function CreateCustomerPage() {
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mockMode = isSalesDataMockMode();

  const areasQuery = useQuery({
    queryKey: ['sales', 'service-areas'],
    queryFn: () => api.listServiceAreas(),
  });
  const areas = areasQuery.data ?? [];

  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobile, setMobile] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [serviceAreaId, setServiceAreaId] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    shopId: string;
    tradeName: string;
    photoWarning: string | null;
  } | null>(null);

  const hasLocation = isValidCoordinatePair(deliveryLat, deliveryLng);

  const createMutation = useMutation({
    mutationFn: async () =>
      api.createRetailer({
        tradeName: tradeName.trim(),
        legalName: legalName.trim() || null,
        primaryContactName: contactName.trim(),
        primaryContactMobile: mobile.trim(),
        deliveryAddressLine: addressLine.trim(),
        deliveryCity: city.trim(),
        deliveryState: state.trim(),
        deliveryPinCode: pinCode.trim(),
        serviceAreaId: serviceAreaId || null,
        deliveryLat: hasLocation ? deliveryLat : null,
        deliveryLng: hasLocation ? deliveryLng : null,
      }),
    onSuccess: async (shopId) => {
      const name = tradeName.trim();
      let photoWarning: string | null = null;
      if (photoFile) {
        try {
          const bytes = await photoFile.arrayBuffer();
          await api.uploadShopPhoto(shopId, {
            bytes,
            contentType: photoFile.type,
          });
        } catch (err) {
          photoWarning =
            err instanceof Error
              ? `The retailer was saved, but the photo could not be uploaded. ${err.message}`
              : 'The retailer was saved, but the photo could not be uploaded. Add it from the customer page.';
        }
      }
      toast.success(`${name} added`);
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailers'] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
      setCreated({ shopId, tradeName: name, photoWarning });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not create retailer');
    },
  });

  async function onUseCurrentLocation() {
    if (locating || createMutation.isPending) return;
    setLocationError(null);
    setLocationMessage(null);
    setLocating(true);
    try {
      const { lat, lng } = await readCurrentPosition();
      setDeliveryLat(lat);
      setDeliveryLng(lng);
      setLocationMessage(`Location captured: ${formatCoordinates(lat, lng)}`);
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : 'Could not read current location.',
      );
    } finally {
      setLocating(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = newCustomerError({
      tradeName,
      contactName,
      mobile,
      serviceAreaId,
      addressLine,
      city,
      state,
      pinCode,
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (photoFile) {
      const photoProblem = shopPhotoFileError(photoFile);
      if (photoProblem) {
        setError(photoProblem);
        return;
      }
    }
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="New retailer"
        subtitle={
          mockMode
            ? 'Demo create — not saved to Supabase'
            : 'Orders work immediately; send the Customer App link when ready.'
        }
        backTo="/customers"
        backLabel="Customers"
      />

      {created ? (
        <CustomerCreatedConfirmation
          shopId={created.shopId}
          tradeName={created.tradeName}
          photoWarning={created.photoWarning}
        />
      ) : null}

      {created ? null : (
      <Card>
        <form className="ga-sales-form" onSubmit={onSubmit}>
          <TextField
            label="Trade name"
            name="tradeName"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            required
            grow
          />
          <TextField
            label="Legal name"
            name="legalName"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            grow
          />
          <TextField
            label="Primary contact"
            name="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            grow
          />
          <TextField
            label="Mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            grow
          />
          <TextField
            label="Address"
            name="addressLine"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            required
            grow
          />
          <TextField
            label="City"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            grow
          />
          <TextField
            label="State"
            name="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            required
            grow
          />
          <TextField
            label="PIN code"
            name="pinCode"
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
            required
            grow
          />
          {areasQuery.isError ? (
            <ErrorState
              message={errorMessage(
                areasQuery.error,
                'Could not load service areas.',
              )}
              onRetry={() => void areasQuery.refetch()}
              retrying={areasQuery.isFetching}
              retryLabel="Retry areas"
            />
          ) : null}
          <SelectField
            label="Service area"
            name="serviceAreaId"
            value={serviceAreaId}
            onChange={setServiceAreaId}
            disabled={areasQuery.isLoading}
            grow
          >
            <option value="">
              {areasQuery.isLoading ? 'Loading areas…' : 'Select a service area'}
            </option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>

          <div className="ga-sales-location">
            <p className="ga-sales-location__label">Shop photo</p>
            <p className="ga-sales-muted">Optional. JPEG, PNG, or WebP, up to 5 MB.</p>
            <label className="ga-btn ga-btn--secondary ga-sales-file-label">
              {photoFile ? 'Replace photo' : 'Add photo'}
              <input
                className="ga-sales-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={createMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = '';
                  if (!file) return;
                  const photoProblem = shopPhotoFileError(file);
                  if (photoProblem) {
                    setError(photoProblem);
                    return;
                  }
                  setError(null);
                  setPhotoFile(file);
                }}
              />
            </label>
            {photoFile ? (
              <p className="ga-sales-muted">{photoFile.name}</p>
            ) : (
              <p className="ga-sales-muted">No photo selected.</p>
            )}
          </div>

          <div className="ga-sales-location">
            <p className="ga-sales-location__label">Shop GPS location</p>
            <p className="ga-sales-muted">
              Optional. Saves the shop&apos;s map pin (not a visit check-in).
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={locating || createMutation.isPending}
              onClick={() => void onUseCurrentLocation()}
            >
              {locating
                ? 'Locating…'
                : hasLocation
                  ? 'Update Location'
                  : 'Use Current Location'}
            </Button>
            {hasLocation ? (
              <p className="ga-sales-success">
                Location captured: {formatCoordinates(deliveryLat!, deliveryLng!)}
              </p>
            ) : (
              <p className="ga-sales-muted">No GPS coordinates captured yet.</p>
            )}
            {locationMessage && !hasLocation ? (
              <p className="ga-sales-success">{locationMessage}</p>
            ) : null}
            {locationError ? (
              <p className="ga-sales-error">{locationError}</p>
            ) : null}
          </div>

          <p className="ga-sales-muted">
            After saving you can create orders immediately. Send the Customer
            App link from the retailer page when the customer is ready to use
            the app.
          </p>

          {error ? (
            <p className="ga-sales-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="ga-sales-btn-block"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving…' : 'Create retailer'}
          </Button>
        </form>
      </Card>
      )}
    </div>
  );
}
