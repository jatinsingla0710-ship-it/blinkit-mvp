import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  PageHeader,
  SelectField,
  TextField,
} from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import {
  formatCoordinates,
  isValidCoordinatePair,
  readCurrentPosition,
} from '@/data/geolocation';
import { isSalesDataMockMode } from '@/data/salesmanApi';

export function CreateCustomerPage() {
  const api = useSalesmanApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mockMode = isSalesDataMockMode();

  const { data: areas = [] } = useQuery({
    queryKey: ['sales', 'service-areas'],
    queryFn: () => api.listServiceAreas(),
  });

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
  const [error, setError] = useState<string | null>(null);

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
    onSuccess: (shopId) => {
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailers'] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
      navigate(`/customers/${shopId}`, { replace: true });
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
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="ga-sales-stack">
      <PageHeader
        title="New retailer"
        subtitle={
          mockMode
            ? 'Demo create — not saved to Supabase'
            : 'Create retailer profile. Orders work immediately; send the Customer App link when ready.'
        }
        meta={
          <Link to="/customers">
            <Button variant="ghost">Cancel</Button>
          </Link>
        }
      />

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
          <SelectField
            label="Service area"
            name="serviceAreaId"
            value={serviceAreaId}
            onChange={setServiceAreaId}
            grow
          >
            <option value="">Select area (optional)</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>

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
            Customer created successfully message: you can create orders
            immediately. Send the Customer App link from the retailer page when
            the customer is ready to use the app.
          </p>

          {error ? <p className="ga-sales-error">{error}</p> : null}

          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Saving…' : 'Create retailer'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
