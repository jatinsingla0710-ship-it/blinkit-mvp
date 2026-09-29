import type { ChangeEvent } from 'react';
import type { SalesmanVisit } from '@groaurum/api-client';
import { Badge, Button, TextField } from '@groaurum/ui';
import { mapsDirectionsUrl, telHref } from '@/data/contact-links';
import { isValidCoordinatePair } from '@/data/geolocation';
import { formatDistanceMetres, visitIsComplete } from '@/data/visit-check-in';
import { visitStatusLabel, visitTone } from '@/lib/tones';

type Outcome = 'VISITED' | 'SHOP_CLOSED';

type Props = {
  visit: SalesmanVisit;
  notes: string;
  outcome: Outcome | null;
  photoName: string | null;
  busy: boolean;
  error: string | null;
  onNotes: (value: string) => void;
  onOutcome: (outcome: Outcome) => void;
  onPhoto: (file: File) => void;
  onCheckIn: () => void;
  onComplete: () => void;
};

export function VisitRouteCard({
  visit,
  notes,
  outcome,
  photoName,
  busy,
  error,
  onNotes,
  onOutcome,
  onPhoto,
  onCheckIn,
  onComplete,
}: Props) {
  const done = visitIsComplete(visit.status);
  const hasShopGps = isValidCoordinatePair(visit.deliveryLat, visit.deliveryLng);
  const checkedIn = Boolean(visit.checkInAt);
  const distanceLabel = formatDistanceMetres(visit.checkInDistanceMetres);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPhoto(file);
  }

  return (
    <div className="ga-sales-list-item">
      <div className="ga-sales-list-item__row">
        <div>
          <p className="ga-sales-list-item__title">{visit.shopName}</p>
          <p className="ga-sales-list-item__meta">{visit.plannedAtLabel}</p>
          {visit.contactMobile ? (
            <p className="ga-sales-list-item__meta">
              {visit.contactName ? `${visit.contactName} · ` : ''}
              <a href={telHref(visit.contactMobile)}>{visit.contactMobile}</a>
            </p>
          ) : null}
        </div>
        <Badge tone={visitTone(visit.status)}>{visitStatusLabel(visit.status)}</Badge>
      </div>

      {hasShopGps ? (
        <a
          className="ga-btn ga-btn--secondary"
          href={mapsDirectionsUrl(visit.deliveryLat!, visit.deliveryLng!)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Maps
        </a>
      ) : (
        <>
          <p className="ga-sales-muted">Shop location is not saved</p>
          <Button type="button" variant="secondary" disabled>
            Open in Maps
          </Button>
        </>
      )}

      {checkedIn && distanceLabel ? <p className="ga-sales-success">{distanceLabel}</p> : null}
      {checkedIn && !distanceLabel ? (
        <p className="ga-sales-warning">
          GPS verification is unavailable because this shop location is not saved.
        </p>
      ) : null}

      {!done && !checkedIn ? (
        <Button type="button" variant="primary" disabled={busy} onClick={onCheckIn}>
          {busy ? 'Checking in…' : 'Check In'}
        </Button>
      ) : null}

      {!done && checkedIn ? (
        <>
          <div className="ga-sales-day-actions">
            <Button
              type="button"
              variant={outcome === 'VISITED' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => onOutcome('VISITED')}
            >
              Visited
            </Button>
            <Button
              type="button"
              variant={outcome === 'SHOP_CLOSED' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => onOutcome('SHOP_CLOSED')}
            >
              Shop Closed
            </Button>
          </div>
          <TextField
            label="Add note"
            name={`notes-${visit.id}`}
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            grow
          />
          <label className="ga-btn ga-btn--secondary ga-sales-file-label">
            {photoName ? 'Replace photo' : 'Add photo'}
            <input
              className="ga-sales-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={onFile}
            />
          </label>
          {photoName ? <p className="ga-sales-muted">{photoName}</p> : null}
          <Button type="button" variant="primary" disabled={busy || !outcome} onClick={onComplete}>
            {busy ? 'Completing…' : 'Complete Visit'}
          </Button>
        </>
      ) : null}

      {error ? (
        <p className="ga-sales-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
