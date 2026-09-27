import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BadgeTone } from '@groaurum/ui';
import {
  buildCustomerAppWhatsappMessage,
  buildWhatsappShareUrl,
} from '@groaurum/shared-types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
} from '@groaurum/ui';
import type { SalesmanRetailer } from '@groaurum/api-client';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { resolveCustomerAppUrl } from '@/data/customer-app-config';
import { missingServiceAreaMessage } from '@/data/order-submit';
import {
  formatCoordinates,
  isValidCoordinatePair,
  readCurrentPosition,
} from '@/data/geolocation';
import { isSalesDataMockMode } from '@/data/salesmanApi';

function activationTone(
  status: SalesmanRetailer['activationStatus'],
): BadgeTone {
  switch (status) {
    case 'activated':
      return 'success';
    case 'app_link_sent':
      return 'info';
    case 'access_disabled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function CustomerDetailPage() {
  const { shopId = '' } = useParams();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const mockMode = isSalesDataMockMode();
  const customerAppUrl = resolveCustomerAppUrl();
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackingWarning, setTrackingWarning] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sales', 'retailer', shopId],
    queryFn: () => api.getRetailer(shopId),
    enabled: Boolean(shopId),
  });

  useEffect(() => {
    setLocationMessage(null);
    setLocationError(null);
  }, [shopId, data?.deliveryLat, data?.deliveryLng]);

  const recordAppLinkMutation = useMutation({
    mutationFn: () => api.recordAppLinkSent(shopId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailer', shopId] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailers'] });
    },
    onError: (err) => {
      setTrackingWarning(
        `WhatsApp was opened, but the app-link send could not be recorded${
          err instanceof Error && err.message ? `: ${err.message}` : '.'
        }`,
      );
    },
  });

  function onSendAppLink() {
    setActionError(null);
    setTrackingWarning(null);
    if (!data?.primaryContactMobile) {
      setActionError('No mobile number on file for this retailer');
      return;
    }
    if (!customerAppUrl.ok) {
      setActionError(customerAppUrl.message);
      return;
    }
    const message = buildCustomerAppWhatsappMessage({
      customerName: data.primaryContactName ?? data.tradeName,
      appUrl: customerAppUrl.url,
    });
    window.open(
      buildWhatsappShareUrl(data.primaryContactMobile, message),
      '_blank',
      'noopener,noreferrer',
    );
    recordAppLinkMutation.mutate();
  }

  const locationMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) =>
      api.setShopDeliveryLocation(shopId, coords.lat, coords.lng),
    onSuccess: (result) => {
      setLocationError(null);
      setLocationMessage(
        `Location saved: ${formatCoordinates(result.deliveryLat, result.deliveryLng)}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailer', shopId] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailers'] });
    },
    onError: (err) => {
      setLocationError(
        err instanceof Error ? err.message : 'Could not save shop location',
      );
    },
  });

  async function onUseCurrentLocation() {
    if (locating || locationMutation.isPending) return;
    setLocationError(null);
    setLocationMessage(null);
    setLocating(true);
    try {
      const coords = await readCurrentPosition();
      setLocationMessage(
        `Location captured: ${formatCoordinates(coords.lat, coords.lng)}`,
      );
      locationMutation.mutate(coords);
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : 'Could not read current location.',
      );
    } finally {
      setLocating(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <EmptyState title="Loading retailer" detail="Fetching profile…" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <div className="ga-sales-stack">
        <PageHeader title="Retailer" subtitle="Not found" />
        <p className="ga-sales-error">
          {error instanceof Error ? error.message : 'Retailer not found'}
        </p>
        <Link to="/customers">
          <Button variant="secondary">Back to customers</Button>
        </Link>
      </div>
    );
  }

  const hasSavedLocation = isValidCoordinatePair(
    data.deliveryLat,
    data.deliveryLng,
  );

  return (
    <div className="ga-sales-stack">
      <PageHeader
        title={data.tradeName}
        subtitle={data.areaLabel}
        meta={
          <Badge tone={activationTone(data.activationStatus)}>
            {data.activationLabel}
          </Badge>
        }
      />

      <Card title="Profile">
        <FieldGrid columns={2}>
          <Field label="Legal name">{data.legalName ?? '—'}</Field>
          <Field label="Contact">{data.primaryContactName ?? '—'}</Field>
          <Field label="Mobile">{data.primaryContactMobile ?? '—'}</Field>
          <Field label="Last order">{data.lastOrderLabel}</Field>
          <Field label="Address" wide>
            {data.addressLine}, {data.city}, {data.state} {data.pinCode}
          </Field>
        </FieldGrid>
      </Card>

      <Card title="Shop GPS location">
        <p className="ga-sales-muted">
          Shop map pin only — not a visit check-in.
        </p>
        {hasSavedLocation ? (
          <p className="ga-sales-success">
            Saved: {formatCoordinates(data.deliveryLat!, data.deliveryLng!)}
          </p>
        ) : (
          <p className="ga-sales-muted">No GPS coordinates saved yet.</p>
        )}
        <div className="ga-sales-actions" style={{ marginTop: 12 }}>
          <Button
            type="button"
            variant="secondary"
            disabled={locating || locationMutation.isPending}
            onClick={() => void onUseCurrentLocation()}
          >
            {locating || locationMutation.isPending
              ? 'Saving location…'
              : hasSavedLocation
                ? 'Update Location'
                : 'Use Current Location'}
          </Button>
        </div>
        {locationMessage ? (
          <p className="ga-sales-success" style={{ marginTop: 12 }}>
            {locationMessage}
          </p>
        ) : null}
        {locationError ? (
          <p className="ga-sales-error" style={{ marginTop: 12 }}>
            {locationError}
          </p>
        ) : null}
      </Card>

      <Card title="Customer App">
        <p className="ga-sales-muted">
          The customer can log in with their registered mobile number and OTP.
          The app link helps them find the app — it is not required for login.
        </p>
        {!data.serviceAreaId ? (
          <p className="ga-sales-warning" role="status">
            {missingServiceAreaMessage(data)}
          </p>
        ) : null}
        {data.activationStatus !== 'activated' && !customerAppUrl.ok ? (
          <p className="ga-sales-warning" role="status">
            {customerAppUrl.message}
          </p>
        ) : null}
        <div className="ga-sales-actions">
          {data.activationStatus !== 'activated' ? (
            <Button
              variant="secondary"
              disabled={!data.primaryContactMobile || !customerAppUrl.ok}
              onClick={onSendAppLink}
            >
              Send Customer App Link via WhatsApp
            </Button>
          ) : null}
          {data.serviceAreaId ? (
            <Link to={`/orders/new?shopId=${data.id}`}>
              <Button variant="primary">Create order</Button>
            </Link>
          ) : (
            <Button variant="primary" disabled>
              Create order
            </Button>
          )}
        </div>
        {mockMode ? (
          <p className="ga-sales-muted" style={{ marginTop: 12 }}>
            Demo mode — app link tracking may be simulated only.
          </p>
        ) : null}
        {actionError ? <p className="ga-sales-error">{actionError}</p> : null}
        {trackingWarning ? (
          <p className="ga-sales-warning">{trackingWarning}</p>
        ) : null}
      </Card>
    </div>
  );
}
