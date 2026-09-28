import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, TextField } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { filterRetailers } from '@/data/customer-search';
import { ButtonLink } from '@/components/ButtonLink';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { PlusIcon } from '@/components/icons';
import { errorMessage } from '@/lib/errors';
import { activationTone } from '@/lib/tones';

export function CustomersPage() {
  const api = useSalesmanApi();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['sales', 'retailers'],
    queryFn: () => api.listRetailers(),
  });
  const visible = useMemo(
    () => (data ? filterRetailers(data, search) : []),
    [data, search],
  );

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="Customers"
        subtitle={
          data
            ? search.trim()
              ? `${visible.length} of ${data.length} assigned retailers`
              : `${data.length} assigned retailers`
            : 'Assigned retailers'
        }
        actions={
          <ButtonLink to="/customers/new" variant="primary">
            <PlusIcon size={20} />
            Add
          </ButtonLink>
        }
      />

      {isLoading ? <LoadingState label="Loading your retailers…" rows={4} /> : null}

      {isError ? (
        <ErrorState
          message={errorMessage(error, 'Could not load your retailers.')}
          onRetry={() => void refetch()}
          retrying={isFetching}
          stale={Boolean(data)}
        />
      ) : null}

      {data && data.length === 0 ? (
        <EmptyStateCard
          title="No retailers yet"
          detail="Add your first retailer to start building your beat and taking orders."
          action={
            <ButtonLink to="/customers/new" variant="primary" block>
              Add customer
            </ButtonLink>
          }
        />
      ) : null}

      {data && data.length > 0 ? (
        <TextField
          label="Search customers"
          name="customerSearch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Shop, contact, mobile, or area"
          grow
        />
      ) : null}

      {data && data.length > 0 && visible.length === 0 ? (
        <EmptyStateCard
          title="No matching retailers"
          detail="Try a shop name, contact name, mobile number, or area. Your assigned list did load."
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="ga-sales-list">
          {visible.map((shop) => (
            <Link
              key={shop.id}
              to={`/customers/${shop.id}`}
              className="ga-sales-list-item"
            >
              <div className="ga-sales-list-item__row">
                <div>
                  <p className="ga-sales-list-item__title">{shop.tradeName}</p>
                  <p className="ga-sales-list-item__meta">
                    {shop.areaLabel} · {shop.city}
                  </p>
                  <p className="ga-sales-list-item__meta">
                    {shop.primaryContactMobile ?? 'No mobile'}
                  </p>
                </div>
                <Badge tone={activationTone(shop.activationStatus)}>
                  {shop.activationLabel}
                </Badge>
              </div>
              <p className="ga-sales-muted">
                Last order: {shop.lastOrderLabel}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
