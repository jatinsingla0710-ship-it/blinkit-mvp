import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesVisitStatus } from '@groaurum/api-client';
import { Badge, Button, TextField } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { resolveVisitNotesForUpdate } from '@/data/visit-notes';
import { ButtonLink } from '@/components/ButtonLink';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { errorMessage } from '@/lib/errors';
import { visitStatusLabel, visitTone } from '@/lib/tones';

export function VisitsPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const profileId = user?.id ?? '';
  const [notesByVisit, setNotesByVisit] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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

  const updateMutation = useMutation({
    mutationFn: ({
      visitId,
      status,
      storedNotes,
    }: {
      visitId: string;
      status: SalesVisitStatus;
      storedNotes: string | null;
    }) =>
      api.updateVisitStatus(
        visitId,
        status,
        resolveVisitNotesForUpdate(notesByVisit[visitId], storedNotes),
      ),
    onSuccess: (_result, { status }) => {
      setError(null);
      toast.success(status === 'VISITED' ? 'Visit marked visited' : 'Visit marked missed');
      void queryClient.invalidateQueries({
        queryKey: ['sales', 'visits', 'today', profileId],
      });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not update visit');
    },
  });

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="Today’s Route"
        subtitle={
          data && data.length > 0
            ? `${data.filter((v) => v.status === 'VISITED').length} of ${data.length} visited`
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

      {error ? (
        <p className="ga-sales-error" role="alert">
          {error}
        </p>
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

      {data && data.length > 0 ? (
        <div className="ga-sales-list">
          {data.map((visit) => (
            <div key={visit.id} className="ga-sales-list-item">
              <div className="ga-sales-list-item__row">
                <div>
                  <p className="ga-sales-list-item__title">{visit.shopName}</p>
                  <p className="ga-sales-list-item__meta">
                    {visit.areaLabel} · {visit.plannedAtLabel}
                  </p>
                </div>
                <Badge tone={visitTone(visit.status)}>
                  {visitStatusLabel(visit.status)}
                </Badge>
              </div>

              <TextField
                label="Notes"
                name={`notes-${visit.id}`}
                value={notesByVisit[visit.id] ?? visit.notes ?? ''}
                onChange={(e) =>
                  setNotesByVisit((prev) => ({
                    ...prev,
                    [visit.id]: e.target.value,
                  }))
                }
                grow
              />

              <div className="ga-sales-day-actions">
                <Button
                  variant="primary"
                  disabled={
                    updateMutation.isPending || visit.status === 'VISITED'
                  }
                  onClick={() =>
                    updateMutation.mutate({
                      visitId: visit.id,
                      status: 'VISITED',
                      storedNotes: visit.notes,
                    })
                  }
                >
                  Mark visited
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    updateMutation.isPending || visit.status === 'MISSED'
                  }
                  onClick={() =>
                    updateMutation.mutate({
                      visitId: visit.id,
                      status: 'MISSED',
                      storedNotes: visit.notes,
                    })
                  }
                >
                  Mark missed
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
