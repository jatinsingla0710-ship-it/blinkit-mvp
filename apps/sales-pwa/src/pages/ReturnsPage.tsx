import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Badge } from '@groaurum/ui';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { claimStatusLabel, claimStatusTone } from '@/data/claims';
import { errorMessage } from '@/lib/errors';

export function ReturnsPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const profileId = user?.id ?? '';
  const query = useQuery({
    queryKey: ['sales', 'returns', profileId],
    queryFn: () => api.listReturnRequests(),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Returns" subtitle="Damage and return requests" backTo="/profile" backLabel="Profile" />
      {query.isLoading ? <LoadingState label="Loading returns…" rows={3} /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load return requests.')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.data && query.data.length === 0 ? (
        <p className="ga-sales-muted">
          No return requests yet. Open an order and choose Return or damage.
        </p>
      ) : null}
      {query.data && query.data.length > 0 ? (
        <div className="ga-sales-list">
          {query.data.map((request) => (
            <Link key={request.id} to={`/profile/returns/${request.id}`} className="ga-sales-list-item">
              <div className="ga-sales-list-item__row">
                <strong>{request.shopName}</strong>
                <Badge tone={claimStatusTone(request.status)}>{claimStatusLabel(request.status)}</Badge>
              </div>
              <p>{request.productName}</p>
              <p className="ga-sales-muted">
                {request.quantity} · {request.reason}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
