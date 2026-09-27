import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeOrderQuantity } from '@groaurum/shared-types';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SelectField,
  TextField,
} from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import {
  confirmPlacedOrder,
  evaluateOrderSubmitGate,
  type PlacedOrderOutcome,
} from '@/data/order-submit';

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function PlacedOrderResult({
  outcome,
  shopId,
}: {
  outcome: PlacedOrderOutcome;
  shopId: string;
}) {
  const confirmed = outcome.kind === 'confirmation_sent';
  return (
    <div className="ga-sales-stack">
      <PageHeader
        title={confirmed ? 'Order placed' : 'Order created — confirmation not sent'}
        subtitle={`Order ${outcome.orderId}`}
      />
      <Card>
        {confirmed ? (
          <p className="ga-sales-success">{outcome.message}</p>
        ) : (
          <div className="ga-sales-stack" role="alert">
            <p className="ga-sales-warning">
              The order was saved, but the customer confirmation could not be
              sent: {outcome.message}
            </p>
            <p className="ga-sales-muted">
              Do not place this order again. Ask your admin to resend the
              customer confirmation for order {outcome.orderId}.
            </p>
          </div>
        )}
        <div className="ga-sales-actions" style={{ marginTop: 12 }}>
          <Link to="/">
            <Button variant="primary">Back to dashboard</Button>
          </Link>
          {shopId ? (
            <Link to={`/customers/${shopId}`}>
              <Button variant="secondary">View retailer</Button>
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function CreateOrderPage() {
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = searchParams.get('shopId') ?? '';

  const [qtyBySku, setQtyBySku] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PlacedOrderOutcome | null>(null);

  const retailersQuery = useQuery({
    queryKey: ['sales', 'retailers'],
    queryFn: () => api.listRetailers(),
  });

  const skusQuery = useQuery({
    queryKey: ['sales', 'orderable-skus'],
    queryFn: () => api.listOrderableSkus(),
  });

  const gate = evaluateOrderSubmitGate({
    shopId,
    retailers: retailersQuery.data,
    retailersLoading: retailersQuery.isLoading,
    retailersError: retailersQuery.isError,
    catalogueReady: Boolean(skusQuery.data && skusQuery.data.length > 0),
  });

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!gate.canSubmit) {
        throw new Error(gate.reason);
      }
      const { shop, serviceAreaId } = gate;

      const skus = skusQuery.data ?? [];
      const lines: {
        skuId: string;
        quantity: number;
        agreedUnitPrice: number;
      }[] = [];

      for (const row of skus) {
        const raw = qtyBySku[row.sku.id]?.trim();
        if (!raw) continue;
        const qty = Number(raw);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for ${row.sku.name}`);
        }
        const normalized = normalizeOrderQuantity(row.sku, qty);
        if (normalized !== qty) {
          throw new Error(
            `${row.sku.name}: quantity must be ≥ MOQ ${row.sku.moq} in steps of ${row.sku.quantityStep} (try ${normalized})`,
          );
        }
        if (qty > row.availableQuantity) {
          throw new Error(
            `${row.sku.name}: only ${row.availableQuantity} available`,
          );
        }
        lines.push({
          skuId: row.sku.id,
          quantity: qty,
          agreedUnitPrice: row.unitPrice,
        });
      }

      if (lines.length === 0) {
        throw new Error('Add at least one SKU quantity');
      }

      const orderId = await api.placeAssistedOrder({
        shopId: shop.id,
        serviceAreaId,
        lines,
        notes: notes.trim() || undefined,
      });

      return confirmPlacedOrder(orderId, (id) =>
        api.sendConfirmationPlaceholder(id),
      );
    },
    onSuccess: (result) => {
      setOutcome(result);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
    },
    onError: (err) => {
      setError(errorMessage(err, 'Order failed'));
      setOutcome(null);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!gate.canSubmit || placeMutation.isPending) return;
    placeMutation.mutate();
  }

  if (outcome) {
    return <PlacedOrderResult outcome={outcome} shopId={shopId} />;
  }

  const blockedReason =
    !gate.canSubmit && !retailersQuery.isError ? gate.reason : null;

  return (
    <div className="ga-sales-stack">
      <PageHeader
        title="Create order"
        subtitle="Assisted order with MOQ / step validation"
        meta={
          <Link to={shopId ? `/customers/${shopId}` : '/customers'}>
            <Button variant="ghost">Cancel</Button>
          </Link>
        }
      />

      <Card>
        <form className="ga-sales-form" onSubmit={onSubmit}>
          {retailersQuery.isError ? (
            <div className="ga-sales-stack" role="alert">
              <p className="ga-sales-error">
                Could not load your retailers:{' '}
                {errorMessage(retailersQuery.error, 'unknown error')}
              </p>
              <div className="ga-sales-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={retailersQuery.isFetching}
                  onClick={() => {
                    void retailersQuery.refetch();
                  }}
                >
                  {retailersQuery.isFetching ? 'Retrying…' : 'Retry retailers'}
                </Button>
              </div>
            </div>
          ) : null}

          <SelectField
            label="Retailer"
            name="shopId"
            value={shopId}
            disabled={!retailersQuery.data}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value) next.set('shopId', value);
              else next.delete('shopId');
              setSearchParams(next, { replace: true });
            }}
            grow
          >
            <option value="">
              {retailersQuery.isLoading ? 'Loading retailers…' : 'Select retailer'}
            </option>
            {(retailersQuery.data ?? []).map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.tradeName}
              </option>
            ))}
          </SelectField>

          {skusQuery.isLoading ? (
            <EmptyState title="Loading SKUs" detail="Fetching catalogue…" />
          ) : null}

          {skusQuery.isError ? (
            <div className="ga-sales-stack" role="alert">
              <p className="ga-sales-error">
                Could not load products:{' '}
                {errorMessage(skusQuery.error, 'unknown error')}
              </p>
              <div className="ga-sales-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={skusQuery.isFetching}
                  onClick={() => {
                    void skusQuery.refetch();
                  }}
                >
                  {skusQuery.isFetching ? 'Retrying…' : 'Retry products'}
                </Button>
              </div>
            </div>
          ) : null}

          {skusQuery.data && skusQuery.data.length === 0 ? (
            <EmptyState
              title="No orderable SKUs"
              detail="No priced active SKUs are available."
            />
          ) : null}

          {skusQuery.data && skusQuery.data.length > 0 ? (
            <div>
              {skusQuery.data.map((row) => (
                <div key={row.sku.id} className="ga-sales-sku-row">
                  <div>
                    <p className="ga-sales-list-item__title">{row.sku.name}</p>
                    <p className="ga-sales-list-item__meta">
                      {formatInr(row.unitPrice)} · MOQ {row.sku.moq} · step{' '}
                      {row.sku.quantityStep} · stock {row.availableQuantity}
                    </p>
                  </div>
                  <div className="ga-sales-sku-row__qty">
                    <TextField
                      label="Qty"
                      name={`qty-${row.sku.id}`}
                      type="number"
                      min={0}
                      step={row.sku.quantityStep}
                      value={qtyBySku[row.sku.id] ?? ''}
                      onChange={(e) =>
                        setQtyBySku((prev) => ({
                          ...prev,
                          [row.sku.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <TextField
            label="Notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            grow
          />

          {blockedReason ? (
            <p className="ga-sales-warning" role="status">
              {blockedReason}
            </p>
          ) : null}

          {error ? (
            <p className="ga-sales-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            disabled={placeMutation.isPending || !gate.canSubmit}
          >
            {placeMutation.isPending ? 'Placing…' : 'Place assisted order'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
