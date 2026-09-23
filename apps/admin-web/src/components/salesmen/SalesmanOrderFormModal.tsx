import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, TextField, Button } from '@groaurum/ui';
import { activeSalesmen } from '@/data/live-entity-helpers';
import {
  useCustomersSnapshotQuery,
  usePricesListQuery,
  useSalesmenSnapshotQuery,
} from '@/data/hooks';
import { useCreateOrderMutation } from '@/data/mutations';
import './SalesmanOrderFormModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
};

export function SalesmanOrderFormModal({ open, onClose, onSuccess }: Props) {
  const createOrder = useCreateOrderMutation();
  const { state: customersState } = useCustomersSnapshotQuery();
  const { state: salesmenState } = useSalesmenSnapshotQuery();
  const { state: pricesState } = usePricesListQuery();
  const [salesmanId, setSalesmanId] = useState('');
  const [shopId, setShopId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const salesmen = useMemo(
    () => activeSalesmen(salesmenState.data?.rows ?? []),
    [salesmenState.data],
  );
  const shops = useMemo(
    () =>
      (customersState.data?.rows ?? []).filter(
        (row) => row.status === 'active' && row.serviceAreaId,
      ),
    [customersState.data],
  );
  const skus = useMemo(
    () =>
      (pricesState.data ?? []).filter(
        (row) => row.status === 'live' && row.currentTradePrice != null,
      ),
    [pricesState.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSalesmanId(salesmen[0]?.id ?? '');
    setShopId(shops[0]?.id ?? '');
    setSkuId(skus[0]?.skuId ?? '');
    setQuantity('1');
  }, [open, salesmen, shops, skus]);

  const selectedShop = shops.find((shop) => shop.id === shopId);
  const selectedSku = skus.find((sku) => sku.skuId === skuId);
  const pending = createOrder.isPending;
  const missingData =
    salesmen.length === 0 || shops.length === 0 || skus.length === 0;

  const onSubmit = () => {
    if (!salesmanId) {
      setError('Select an active salesman');
      return;
    }
    if (!shopId || !selectedShop?.serviceAreaId) {
      setError('Select an active customer shop with a service area');
      return;
    }
    if (!skuId || selectedSku?.currentTradePrice == null) {
      setError('Select a SKU with a live trade price');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }
    setError(null);
    createOrder.mutate(
      {
        shopId,
        serviceAreaId: selectedShop.serviceAreaId,
        source: 'SALESMAN_ASSISTED',
        createdByProfileId: salesmanId,
        lines: [
          {
            skuId,
            quantity: qty,
            agreedUnitPrice: selectedSku.currentTradePrice,
          },
        ],
      },
      {
        onSuccess: (row) => {
          onSuccess?.(row.id);
          onClose();
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Create failed'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title="Create Assisted Order"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || missingData}
          >
            {pending ? 'Creating…' : 'Create Order'}
          </Button>
        </>
      }
    >
      <div className="ga-sm-order-form">
        {missingData ? (
          <p className="ga-sm-order-form__error">
            Active salesmen, customer shops with service areas, and SKUs with
            live prices are required before creating an order.
          </p>
        ) : (
          <p className="ga-sm-order-form__hint">
            Uses trusted place_assisted_order (MOQ, stock check, reservation,
            confirmation challenge). Created orders start as Stock Reserved.
          </p>
        )}
        <SelectField
          label="Salesman"
          value={salesmanId}
          onChange={setSalesmanId}
        >
          <option value="">Select salesman</option>
          {salesmen.map((salesman) => (
            <option key={salesman.id} value={salesman.id}>
              {salesman.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Customer shop" value={shopId} onChange={setShopId}>
          <option value="">Select shop</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.shopName} · {shop.areaLabel}
            </option>
          ))}
        </SelectField>
        <SelectField label="SKU" value={skuId} onChange={setSkuId}>
          <option value="">Select SKU</option>
          {skus.map((sku) => (
            <option key={sku.skuId} value={sku.skuId}>
              {sku.skuCode} · {sku.currentPriceLabel}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="decimal"
          required
        />
        {error ? <p className="ga-sm-order-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
