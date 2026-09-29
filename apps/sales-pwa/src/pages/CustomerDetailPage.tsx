import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SalesmanOrderSummary, SalesmanVisit } from '@groaurum/api-client';
import { Badge, Button, Card, Field, FieldGrid } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { ButtonLink } from '@/components/ButtonLink';
import { VoiceNoteButton } from '@/components/VoiceNoteButton';
import { ShopPhotoCard } from '@/components/customer/ShopPhotoCard';
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { mapsDirectionsUrl, shopWhatsappHref, telHref } from '@/data/contact-links';
import { shopPhotoFileError } from '@/data/customer-form';
import { errorMessage } from '@/lib/errors';
import { visitStatusLabel, visitTone } from '@/lib/tones';
import { missingServiceAreaMessage } from '@/data/order-submit';
import {
  formatCoordinates,
  isValidCoordinatePair,
  readCurrentPosition,
} from '@/data/geolocation';
export function CustomerDetailPage() {
  const { shopId = '' } = useParams();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sales', 'retailer', shopId],
    queryFn: () => api.getRetailer(shopId),
    enabled: Boolean(shopId),
  });

  const shopReady = Boolean(shopId) && Boolean(data);
  const ordersQuery = useQuery({
    queryKey: ['sales', 'shop-orders', shopId],
    queryFn: () => api.listShopOrders(shopId),
    enabled: shopReady,
  });
  const visitsQuery = useQuery({
    queryKey: ['sales', 'shop-visits', shopId],
    queryFn: () => api.listShopVisits(shopId),
    enabled: shopReady,
  });
  const photoQuery = useQuery({
    queryKey: ['sales', 'shop-photo', shopId],
    queryFn: () => api.getShopPhotoUrl(shopId),
    enabled: shopReady,
  });

  useEffect(() => {
    setLocationMessage(null);
    setLocationError(null);
    setPhotoError(null);
  }, [shopId, data?.deliveryLat, data?.deliveryLng]);

  const locationMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) =>
      api.setShopDeliveryLocation(shopId, coords.lat, coords.lng),
    onSuccess: () => {
      setLocationError(null);
      setLocationMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailer', shopId] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'retailers'] });
    },
    onError: (err) => {
      setLocationError(
        err instanceof Error ? err.message : 'Could not save shop location',
      );
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const problem = shopPhotoFileError(file);
      if (problem) throw new Error(problem);
      const bytes = await file.arrayBuffer();
      return api.uploadShopPhoto(shopId, { bytes, contentType: file.type });
    },
    onSuccess: () => {
      setPhotoError(null);
      toast.success('Shop photo saved');
      void queryClient.invalidateQueries({ queryKey: ['sales', 'shop-photo', shopId] });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Could not upload the photo';
      setPhotoError(message);
      toast.error(message);
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
      <div className="ga-sales-stack">
        <ScreenHeader title="Customer" backTo="/customers" backLabel="Customers" />
        <LoadingState label="Loading customer…" variant="detail" rows={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ga-sales-stack">
        <ScreenHeader title="Customer" backTo="/customers" backLabel="Customers" />
        {isError ? (
          <ErrorState
            message={errorMessage(error, 'Could not load this customer.')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : (
          <EmptyStateCard
            title="Customer not found"
            detail="This customer is not in your assigned list. It may have been reassigned by your admin."
            action={
              <ButtonLink to="/customers" variant="secondary" block>
                Back to customers
              </ButtonLink>
            }
          />
        )}
      </div>
    );
  }

  const hasSavedLocation = isValidCoordinatePair(data.deliveryLat, data.deliveryLng);
  const mobile = data.primaryContactMobile;
  const canOrder = Boolean(data.serviceAreaId);

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title={data.tradeName}
        subtitle={data.areaLabel}
        backTo="/customers"
        backLabel="Customers"
      />

      {isError ? (
        <ErrorState
          message={errorMessage(error, 'Could not refresh this customer.')}
          onRetry={() => void refetch()}
          retrying={isFetching}
          stale
        />
      ) : null}

      <Card title="Profile">
        <FieldGrid columns={2}>
          <Field label="Contact">{data.primaryContactName ?? '—'}</Field>
          <Field label="Mobile">{mobile ?? '—'}</Field>
          <Field label="Last order">{data.lastOrderLabel}</Field>
          <Field label="Address" wide>
            {data.addressLine}, {data.city}, {data.state} {data.pinCode}
          </Field>
          {data.legalName ? (
            <Field label="Legal name" wide>
              {data.legalName}
            </Field>
          ) : null}
        </FieldGrid>
      </Card>

      <div className="ga-sales-quick-actions">
        {mobile ? (
          <a className="ga-btn ga-btn--secondary" href={telHref(mobile)}>
            Call
          </a>
        ) : (
          <Button type="button" variant="secondary" disabled>
            Call
          </Button>
        )}
        {mobile ? (
          <a
            className="ga-btn ga-btn--secondary"
            href={shopWhatsappHref(mobile, data.primaryContactName ?? data.tradeName)}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        ) : (
          <Button type="button" variant="secondary" disabled>
            WhatsApp
          </Button>
        )}
        {hasSavedLocation ? (
          <a
            className="ga-btn ga-btn--secondary"
            href={mapsDirectionsUrl(data.deliveryLat!, data.deliveryLng!)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Directions
          </a>
        ) : (
          <Button type="button" variant="secondary" disabled>
            Directions
          </Button>
        )}
        {canOrder ? (
          <ButtonLink to={`/orders/new?shopId=${data.id}`} variant="primary">
            New order
          </ButtonLink>
        ) : (
          <Button type="button" variant="primary" disabled>
            New order
          </Button>
        )}
      </div>
      <ButtonLink to={`/customers/${data.id}/return`} variant="secondary" block>
        Return or damage
      </ButtonLink>
      <VoiceNoteButton shopId={data.id} />

      <Card title="Shop photo">
        {photoQuery.isLoading ? <LoadingState label="Loading photo…" rows={1} /> : null}
        {photoQuery.isError ? (
          <ErrorState
            message={errorMessage(photoQuery.error, 'Could not load the shop photo.')}
            onRetry={() => void photoQuery.refetch()}
            retrying={photoQuery.isFetching}
            retryLabel="Retry photo"
            stale={photoQuery.data != null}
          />
        ) : null}
        {photoQuery.isSuccess || typeof photoQuery.data === 'string' ? (
          <ShopPhotoCard
            url={photoQuery.data ?? null}
            uploading={photoMutation.isPending}
            error={photoError}
            onFile={(file) => {
              setPhotoError(null);
              photoMutation.mutate(file);
            }}
          />
        ) : null}
      </Card>

      <Card title="Shop GPS location">
        <p className="ga-sales-muted">
          Shop map pin only — not a visit check-in.
        </p>
        {hasSavedLocation ? (
          <p className="ga-sales-success">
            Location saved: {formatCoordinates(data.deliveryLat!, data.deliveryLng!)}
          </p>
        ) : (
          <p className="ga-sales-muted">Location not saved</p>
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
        {locationMessage && !hasSavedLocation ? (
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

      <Card title="Orders">
        {ordersQuery.isLoading ? <LoadingState label="Loading orders…" rows={2} /> : null}
        {ordersQuery.isError ? (
          <ErrorState
            message={errorMessage(ordersQuery.error, 'Could not load orders for this shop.')}
            onRetry={() => void ordersQuery.refetch()}
            retrying={ordersQuery.isFetching}
            retryLabel="Retry orders"
            stale={Boolean(ordersQuery.data)}
          />
        ) : null}
        {ordersQuery.isSuccess && ordersQuery.data.length === 0 ? (
          <EmptyStateCard
            title="No orders yet"
            detail="Create the first order for this shop. Pricing still comes from the server."
            action={
              canOrder ? (
                <ButtonLink to={`/orders/new?shopId=${data.id}`} variant="primary" block>
                  Create first order
                </ButtonLink>
              ) : (
                <p className="ga-sales-warning">{missingServiceAreaMessage(data)}</p>
              )
            }
          />
        ) : null}
        {ordersQuery.data && ordersQuery.data.length > 0 ? (
          <div className="ga-sales-list">
            {ordersQuery.data.map((order) => (
              <OrderHistoryRow key={order.id} order={order} />
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Visits">
        {visitsQuery.isLoading ? <LoadingState label="Loading visits…" rows={2} /> : null}
        {visitsQuery.isError ? (
          <ErrorState
            message={errorMessage(visitsQuery.error, 'Could not load visits for this shop.')}
            onRetry={() => void visitsQuery.refetch()}
            retrying={visitsQuery.isFetching}
            retryLabel="Retry visits"
            stale={Boolean(visitsQuery.data)}
          />
        ) : null}
        {visitsQuery.isSuccess && visitsQuery.data.length === 0 ? (
          <EmptyStateCard
            title="No visits yet"
            detail="Visits you record for this shop will show up here."
          />
        ) : null}
        {visitsQuery.data && visitsQuery.data.length > 0 ? (
          <div className="ga-sales-list">
            {visitsQuery.data.map((visit) => (
              <VisitHistoryRow key={visit.id} visit={visit} />
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function OrderHistoryRow({ order }: { order: SalesmanOrderSummary }) {
  return (
    <Link to={`/orders/${order.id}`} className="ga-sales-list-item">
      <div className="ga-sales-list-item__row">
        <div>
          <p className="ga-sales-list-item__title">{order.orderNumber}</p>
          <p className="ga-sales-list-item__meta">{order.dateTimeLabel}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="ga-sales-muted">{order.totalLabel}</p>
    </Link>
  );
}

function VisitHistoryRow({ visit }: { visit: SalesmanVisit }) {
  return (
    <div className="ga-sales-list-item">
      <div className="ga-sales-list-item__row">
        <div>
          <p className="ga-sales-list-item__title">{visit.plannedAtLabel}</p>
          {visit.visitedAtLabel ? (
            <p className="ga-sales-list-item__meta">Visited {visit.visitedAtLabel}</p>
          ) : null}
        </div>
        <Badge tone={visitTone(visit.status)}>{visitStatusLabel(visit.status)}</Badge>
      </div>
      {visit.notes ? <p className="ga-sales-muted">{visit.notes}</p> : null}
    </div>
  );
}
