import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BadgeTone } from '@groaurum/ui';
import { Badge, Button, Card, EmptyState, PageHeader } from '@groaurum/ui';
import type { SalesmanRetailer } from '@groaurum/api-client';
import { useSalesmanApi } from '@/data/SalesDataProviders';

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

export function CustomersPage() {
  const api = useSalesmanApi();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sales', 'retailers'],
    queryFn: () => api.listRetailers(),
  });

  return (
    <div className="ga-sales-stack">
      <PageHeader
        title="Customers"
        subtitle="Assigned retailers"
        meta={
          <Link to="/customers/new">
            <Button variant="primary">Create retailer</Button>
          </Link>
        }
      />

      {isLoading ? (
        <Card>
          <EmptyState title="Loading retailers" detail="Fetching your beat…" />
        </Card>
      ) : null}

      {isError ? (
        <p className="ga-sales-error">
          {error instanceof Error ? error.message : 'Failed to load retailers'}
        </p>
      ) : null}

      {data && data.length === 0 ? (
        <Card>
          <EmptyState
            title="No retailers yet"
            detail="Create a retailer to start building your beat."
          />
        </Card>
      ) : null}

      {data && data.length > 0 ? (
        <div className="ga-sales-list">
          {data.map((shop) => (
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
