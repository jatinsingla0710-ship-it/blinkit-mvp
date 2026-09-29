import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Badge } from '@groaurum/ui';
import { ButtonLink } from '@/components/ButtonLink';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { claimStatusLabel, claimStatusTone } from '@/data/claims';
import { errorMessage } from '@/lib/errors';

export function ReturnDetailPage() {
  const { requestId = '' } = useParams();
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const query = useQuery({
    queryKey: ['sales', 'return', user?.id ?? '', requestId],
    queryFn: () => api.getReturnRequest(requestId),
    enabled: Boolean(user?.id && requestId),
  });
  const request = query.data;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title="Return request" backTo="/profile/returns" backLabel="Returns" />
      {query.isLoading ? <LoadingState label="Loading return…" variant="detail" /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load this return request.')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isSuccess && !request ? (
        <>
          <p className="ga-sales-muted">This request was not found.</p>
          <ButtonLink to="/profile/returns" variant="secondary" block>
            Back to returns
          </ButtonLink>
        </>
      ) : null}
      {request ? (
        <article className="ga-sales-list-item">
          <div className="ga-sales-list-item__row">
            <strong>{request.shopName}</strong>
            <Badge tone={claimStatusTone(request.status)}>{claimStatusLabel(request.status)}</Badge>
          </div>
          <p>{request.productName}</p>
          <p className="ga-sales-muted">
            {request.skuName} · {request.skuCode}
          </p>
          <p>Quantity {request.quantity}</p>
          <p>Reason: {request.reason}</p>
          {request.note ? <p>{request.note}</p> : null}
          {request.photoUrl ? (
            <img src={request.photoUrl} alt="Return photo" className="ga-sales-claim-photo" />
          ) : (
            <p className="ga-sales-muted">No photo.</p>
          )}
          {request.reviewNote ? <p>Review note: {request.reviewNote}</p> : null}
          <p className="ga-sales-muted">
            Approval records the request only. Stock, payment, and commission stay unchanged.
          </p>
        </article>
      ) : null}
    </div>
  );
}
