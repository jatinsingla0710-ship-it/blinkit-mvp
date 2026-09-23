import { useMemo, useState, type FormEvent } from 'react';
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

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CreateOrderPage() {
  const api = useSalesmanApi();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = searchParams.get('shopId') ?? '';

  const [qtyBySku, setQtyBySku] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const retailersQuery = useQuery({
    queryKey: ['sales', 'retailers'],
    queryFn: () => api.listRetailers(),
  });

  const skusQuery = useQuery({
    queryKey: ['sales', 'orderable-skus'],
    queryFn: () => api.listOrderableSkus(),
  });

  const selectedShop = useMemo(
    () => retailersQuery.data?.find((r) => r.id === shopId) ?? null,
    [retailersQuery.data, shopId],
  );

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedShop) {
        throw new Error('Select a retailer first');
      }
      if (!selectedShop.serviceAreaId) {
        throw new Error('Retailer has no service area — cannot place order');
      }

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
        shopId: selectedShop.id,
        serviceAreaId: selectedShop.serviceAreaId,
        lines,
        notes: notes.trim() || undefined,
      });
      const placeholder = await api.sendConfirmationPlaceholder(orderId);
      return { orderId, placeholder };
    },
    onSuccess: ({ orderId, placeholder }) => {
      setPlacedOrderId(orderId);
      setConfirmation(placeholder.message);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Order failed');
      setConfirmation(null);
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    placeMutation.mutate();
  }

  if (placedOrderId && confirmation) {
    return (
      <div className="ga-sales-stack">
        <PageHeader title="Order placed" subtitle={`Order ${placedOrderId}`} />
        <Card>
          <p className="ga-sales-success">{confirmation}</p>
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
          <SelectField
            label="Retailer"
            name="shopId"
            value={shopId}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value) next.set('shopId', value);
              else next.delete('shopId');
              setSearchParams(next, { replace: true });
            }}
            grow
          >
            <option value="">Select retailer</option>
            {(retailersQuery.data ?? []).map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.tradeName}
              </option>
            ))}
          </SelectField>

          {skusQuery.isLoading ? (
            <EmptyState title="Loading SKUs" detail="Fetching catalogue…" />
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

          {error ? <p className="ga-sales-error">{error}</p> : null}

          <Button
            type="submit"
            variant="primary"
            disabled={placeMutation.isPending || !shopId}
          >
            {placeMutation.isPending ? 'Placing…' : 'Place assisted order'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
