import { useEffect, useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import {
  buildGoogleMapsDirectionsUrl,
  formatCoordinates,
  isValidCoordinatePair,
  readCurrentPosition,
} from '@/data/geolocation';
import { formatMutationError } from '@/data/mutation-errors';
import { useUpdateCustomerMutation } from '@/data/mutations';
import './CustomerShopLocationPanel.css';

type Props = {
  customerId: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
};

export function CustomerShopLocationPanel({
  customerId,
  deliveryLat,
  deliveryLng,
}: Props) {
  const updateCustomer = useUpdateCustomerMutation();
  const [draftLat, setDraftLat] = useState<number | null>(deliveryLat ?? null);
  const [draftLng, setDraftLng] = useState<number | null>(deliveryLng ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setDraftLat(deliveryLat ?? null);
    setDraftLng(deliveryLng ?? null);
    setMessage(null);
    setError(null);
  }, [deliveryLat, deliveryLng, customerId]);

  const hasSaved = isValidCoordinatePair(deliveryLat, deliveryLng);
  const hasDraft = isValidCoordinatePair(draftLat, draftLng);
  const dirty =
    hasDraft &&
    (draftLat !== deliveryLat || draftLng !== deliveryLng);
  const pending = updateCustomer.isPending;

  const onUseCurrentLocation = async () => {
    if (locating || pending) return;
    setError(null);
    setMessage(null);
    setLocating(true);
    try {
      const { lat, lng } = await readCurrentPosition();
      setDraftLat(lat);
      setDraftLng(lng);
      setMessage(`Captured ${formatCoordinates(lat, lng)}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not read current location.',
      );
    } finally {
      setLocating(false);
    }
  };

  const onSave = () => {
    if (pending || submittingRef.current || !hasDraft || !dirty) return;
    const lat = draftLat!;
    const lng = draftLng!;
    setError(null);
    setMessage(null);
    submittingRef.current = true;
    updateCustomer.mutate(
      {
        id: customerId,
        input: {
          deliveryLat: lat,
          deliveryLng: lng,
        },
      },
      {
        onSuccess: () => {
          submittingRef.current = false;
          setMessage('Shop location saved.');
        },
        onError: (err) => {
          submittingRef.current = false;
          setError(formatMutationError(err, 'Save failed'));
        },
      },
    );
  };

  return (
    <div className="ga-cust-location">
      <div className="ga-cust-location__head">
        <h3 className="ga-cust-location__title">Shop GPS location</h3>
        <div className="ga-cust-location__actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onUseCurrentLocation()}
            disabled={pending || locating}
          >
            {locating
              ? 'Locating…'
              : hasSaved
                ? 'Update Location'
                : 'Use Current Location'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            disabled={pending || locating || !dirty}
          >
            {pending ? 'Saving…' : 'Save location'}
          </Button>
        </div>
      </div>

      {hasSaved ? (
        <p className="ga-cust-location__saved">
          Saved: {formatCoordinates(deliveryLat!, deliveryLng!)}
        </p>
      ) : (
        <p className="ga-cust-location__empty">No GPS coordinates saved yet.</p>
      )}

      {hasDraft && dirty ? (
        <p className="ga-cust-location__draft">
          Pending: {formatCoordinates(draftLat!, draftLng!)}
        </p>
      ) : null}

      {hasSaved ? (
        <a
          className="ga-cust-location__maps-link"
          href={buildGoogleMapsDirectionsUrl(deliveryLat!, deliveryLng!)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Navigate to Shop
        </a>
      ) : null}

      {message ? <p className="ga-cust-location__ok">{message}</p> : null}
      {error ? <p className="ga-cust-location__error">{error}</p> : null}
    </div>
  );
}
