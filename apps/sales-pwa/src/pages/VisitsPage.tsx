import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesmanVisit } from '@groaurum/api-client';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { shopPhotoFileError } from '@/data/customer-form';
import { GeoReadError, readCurrentPosition } from '@/data/geolocation';
import { resolveVisitNotesForUpdate } from '@/data/visit-notes';
import {
  createActionLock,
  sortVisitsByPlannedTime,
  visitCheckInFailureMessage,
} from '@/data/visit-check-in';
import { VisitRouteCard } from '@/components/visit/VisitRouteCard';
import { Button } from '@groaurum/ui';
import { ButtonLink } from '@/components/ButtonLink';
import { VoiceNoteButton } from '@/components/VoiceNoteButton';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { orderByNearest } from '@/data/route-order';
import { useT } from '@/i18n/language';
import { errorMessage } from '@/lib/errors';

export function VisitsPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const profileId = user?.id ?? '';
  const lock = useRef(createActionLock()).current;
  const [notesByVisit, setNotesByVisit] = useState<Record<string, string>>({});
  const [outcomeByVisit, setOutcomeByVisit] = useState<
    Record<string, 'VISITED' | 'SHOP_CLOSED' | null>
  >({});
  const [photoByVisit, setPhotoByVisit] = useState<Record<string, File | null>>({});
  const [cardError, setCardError] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nearest, setNearest] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const t = useT();

  const {
    data,
    isLoading,
    isError,
    error: loadError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['sales', 'visits', 'today', profileId],
    queryFn: () => api.listTodaysVisits(profileId),
    enabled: Boolean(profileId),
  });

  const visits = useMemo(() => {
    const timed = sortVisitsByPlannedTime(data ?? []);
    if (!nearest) return timed;
    return orderByNearest(
      timed.map((visit) => ({
        ...visit,
        lat: visit.deliveryLat ?? null,
        lng: visit.deliveryLng ?? null,
      })),
      origin,
    );
  }, [data, nearest, origin]);

  function setVisitError(visitId: string, message: string | null) {
    setCardError((prev) => ({ ...prev, [visitId]: message }));
  }

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['sales', 'visits', 'today', profileId],
    });
    await queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
    await queryClient.invalidateQueries({ queryKey: ['sales', 'shop-visits'] });
  }

  async function onCheckIn(visit: SalesmanVisit) {
    if (busyId || !lock.tryAcquire()) return;
    setBusyId(visit.id);
    setVisitError(visit.id, null);
    try {
      const coords = await readCurrentPosition();
      const result = await api.checkInVisit(visit.id, coords.lat, coords.lng);
      if (result.gpsVerification === 'unavailable') {
        toast.success('Checked in. Shop location is not saved, so distance was not calculated.');
      } else {
        toast.success('Checked in');
      }
      await refresh();
    } catch (err) {
      const message = err instanceof GeoReadError
        ? visitCheckInFailureMessage(err)
        : errorMessage(err, 'Could not check in.');
      setVisitError(visit.id, message);
      toast.error(message);
    } finally {
      lock.release();
      setBusyId(null);
    }
  }

  async function onComplete(visit: SalesmanVisit) {
    const outcome = outcomeByVisit[visit.id];
    if (!outcome || busyId || !lock.tryAcquire()) return;
    setBusyId(visit.id);
    setVisitError(visit.id, null);
    try {
      const coords = await readCurrentPosition();
      const file = photoByVisit[visit.id];
      let photoPath: string | null = null;
      if (file) {
        const problem = shopPhotoFileError(file);
        if (problem) throw new Error(problem);
        const bytes = await file.arrayBuffer();
        const uploaded = await api.uploadVisitPhoto(visit.shopId, visit.id, {
          bytes,
          contentType: file.type,
        });
        photoPath = uploaded.path;
      }
      const edited = notesByVisit[visit.id];
      await api.completeVisit({
        visitId: visit.id,
        status: outcome,
        lat: coords.lat,
        lng: coords.lng,
        notes:
          edited === undefined
            ? undefined
            : resolveVisitNotesForUpdate(edited, visit.notes),
        photoPath,
      });
      toast.success(outcome === 'SHOP_CLOSED' ? 'Marked shop closed' : 'Visit completed');
      await refresh();
    } catch (err) {
      const message = err instanceof GeoReadError
        ? visitCheckInFailureMessage(err)
        : errorMessage(err, 'Could not complete this visit.');
      setVisitError(visit.id, message);
      toast.error(message);
    } finally {
      lock.release();
      setBusyId(null);
    }
  }

  const visitedCount = visits.filter((visit) => visit.status === 'VISITED').length;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="Today’s Route"
        subtitle={
          data && data.length > 0
            ? `${visitedCount} of ${data.length} visited`
            : 'Visits planned for today'
        }
        backTo="/"
        backLabel="Home"
      />

      {isLoading ? <LoadingState label="Loading today’s route…" rows={3} /> : null}

      {isError ? (
        <ErrorState
          message={errorMessage(loadError, 'Could not load today’s visits.')}
          onRetry={() => void refetch()}
          retrying={isFetching}
          stale={Boolean(data)}
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyStateCard
          title="No visits planned today"
          detail="Your admin plans your route. You can still open a customer and place an order."
          action={
            <ButtonLink to="/customers" variant="secondary" block>
              Go to customers
            </ButtonLink>
          }
        />
      ) : null}

      {visits.length > 1 ? (
        <Button
          type="button"
          variant="secondary"
          className="ga-sales-btn-block"
          onClick={() => {
            if (nearest) {
              setNearest(false);
              return;
            }
            void readCurrentPosition()
              .then((coords) => {
                setOrigin({ lat: coords.lat, lng: coords.lng });
                setNearest(true);
                setRouteNote(null);
              })
              .catch(() => setRouteNote(t('route.needsLocation')));
          }}
        >
          {nearest ? t('visits.byTime') : t('visits.nearest')}
        </Button>
      ) : null}
      {routeNote ? <p className="ga-sales-muted">{routeNote}</p> : null}

      {visits.length > 0 ? (
        <div className="ga-sales-list">
          {visits.map((visit) => (
            <div key={visit.id} className="ga-sales-stack">
            <VisitRouteCard
              key={visit.id}
              visit={visit}
              notes={notesByVisit[visit.id] ?? visit.notes ?? ''}
              outcome={outcomeByVisit[visit.id] ?? null}
              photoName={photoByVisit[visit.id]?.name ?? null}
              busy={busyId === visit.id}
              error={cardError[visit.id] ?? null}
              onNotes={(value) =>
                setNotesByVisit((prev) => ({ ...prev, [visit.id]: value }))
              }
              onOutcome={(outcome) =>
                setOutcomeByVisit((prev) => ({ ...prev, [visit.id]: outcome }))
              }
              onPhoto={(file) => {
                const problem = shopPhotoFileError(file);
                if (problem) {
                  setVisitError(visit.id, problem);
                  return;
                }
                setVisitError(visit.id, null);
                setPhotoByVisit((prev) => ({ ...prev, [visit.id]: file }));
              }}
              onCheckIn={() => void onCheckIn(visit)}
              onComplete={() => void onComplete(visit)}
            />
            <VoiceNoteButton shopId={visit.shopId} visitId={visit.id} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
