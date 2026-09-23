import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type { SalesVisitStatus } from '@groaurum/api-client';
import type { BadgeTone } from '@groaurum/ui';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  TextField,
} from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';

function visitTone(status: SalesVisitStatus): BadgeTone {
  switch (status) {
    case 'VISITED':
      return 'success';
    case 'MISSED':
      return 'danger';
    case 'PENDING':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function VisitsPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const profileId = user?.id ?? '';
  const [notesByVisit, setNotesByVisit] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: loadError } = useQuery({
    queryKey: ['sales', 'visits', 'today', profileId],
    queryFn: () => api.listTodaysVisits(profileId),
    enabled: Boolean(profileId),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      visitId,
      status,
    }: {
      visitId: string;
      status: SalesVisitStatus;
    }) =>
      api.updateVisitStatus(
        visitId,
        status,
        notesByVisit[visitId]?.trim() || null,
      ),
    onSuccess: () => {
      setError(null);
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
      <PageHeader title="Visits" subtitle="Today’s route" />

      {isLoading ? (
        <Card>
          <EmptyState title="Loading visits" detail="Fetching today’s route…" />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-sales-error">
          {loadError instanceof Error
            ? loadError.message
            : 'Failed to load visits'}
        </p>
      ) : null}

      {error ? <p className="ga-sales-error">{error}</p> : null}

      {data && data.length === 0 ? (
        <Card>
          <EmptyState
            title="No visits today"
            detail="Your route for today is empty."
          />
        </Card>
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
                <Badge tone={visitTone(visit.status)}>{visit.status}</Badge>
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

              <div className="ga-sales-actions">
                <Button
                  variant="primary"
                  disabled={
                    updateMutation.isPending || visit.status === 'VISITED'
                  }
                  onClick={() =>
                    updateMutation.mutate({
                      visitId: visit.id,
                      status: 'VISITED',
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
