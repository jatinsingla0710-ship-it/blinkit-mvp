import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Button, SelectField, TextField } from '@groaurum/ui';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { shopPhotoFileError } from '@/data/customer-form';
import { returnQuantityError, returnReasonError } from '@/data/claims';
import { errorMessage } from '@/lib/errors';

export function ReturnFormPage() {
  const { orderId = '', shopId = '' } = useParams();
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const navigate = useNavigate();
  const toast = useToast();
  const [pickedOrderId, setPickedOrderId] = useState(orderId);
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['sales', 'return-orders', user?.id ?? '', shopId],
    queryFn: async () => {
      const orders = await api.listOrders(user?.id ?? '');
      return shopId ? orders.filter((order) => order.shopId === shopId) : orders;
    },
    enabled: Boolean(user?.id && shopId && !orderId),
  });

  const activeOrderId = orderId || pickedOrderId;
  const orderQuery = useQuery({
    queryKey: ['sales', 'return-order', user?.id ?? '', activeOrderId],
    queryFn: () => api.getOrder(activeOrderId),
    enabled: Boolean(user?.id && activeOrderId),
  });

  const lines = orderQuery.data?.lines ?? [];
  const selected = useMemo(
    () => lines.find((line) => line.skuId === skuId) ?? null,
    [lines, skuId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeOrderId || !selected) {
      setError('Choose an order and a product.');
      return;
    }
    const quantityProblem = returnQuantityError(quantity, selected.quantity);
    const reasonProblem = returnReasonError(reason);
    if (quantityProblem || reasonProblem) {
      setError(quantityProblem ?? reasonProblem);
      return;
    }
    if (file) {
      const photoProblem = shopPhotoFileError(file);
      if (photoProblem) {
        setError(photoProblem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createReturnRequest({
        orderId: activeOrderId,
        skuId: selected.skuId,
        quantity: Number(quantity.replace(/,/g, '').trim()),
        reason: reason.trim(),
        note: note.trim() || null,
      });
      if (file) {
        try {
          await api.uploadReturnPhoto(created.id, {
            bytes: await file.arrayBuffer(),
            contentType: file.type,
          });
        } catch (err) {
          toast.error(errorMessage(err, 'Request saved, but the photo did not upload.'));
          navigate(`/profile/returns/${created.id}`, { replace: true });
          return;
        }
      }
      toast.success('Return request submitted');
      navigate(`/profile/returns/${created.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not submit the return request.'));
    } finally {
      setBusy(false);
    }
  }

  const loading = (shopId && !orderId && ordersQuery.isLoading) || (activeOrderId && orderQuery.isLoading);
  const loadError = ordersQuery.error ?? orderQuery.error;

  return (
    <div className="ga-sales-stack">
      <ScreenHeader
        title="Return or damage"
        backTo={orderId ? `/orders/${orderId}` : shopId ? `/customers/${shopId}` : '/profile/returns'}
        backLabel={orderId ? 'Order' : shopId ? 'Customer' : 'Returns'}
      />
      {loading ? <LoadingState label="Loading order…" rows={3} /> : null}
      {loadError ? (
        <ErrorState
          message={errorMessage(loadError, 'Could not load the order.')}
          onRetry={() => {
            void ordersQuery.refetch();
            void orderQuery.refetch();
          }}
        />
      ) : null}
      {!loading && !loadError && shopId && !orderId && ordersQuery.data?.length === 0 ? (
        <p className="ga-sales-muted">This shop has no orders yet. Place an order before requesting a return.</p>
      ) : null}
      {!loading && !loadError && activeOrderId && orderQuery.isSuccess && !orderQuery.data ? (
        <p className="ga-sales-muted">This order was not found.</p>
      ) : null}
      {!loading && !loadError && orderQuery.data && orderQuery.data.lines.length === 0 ? (
        <p className="ga-sales-muted">This order has no products to return.</p>
      ) : null}

      {!loading && !loadError && (orderQuery.data?.lines.length || (shopId && ordersQuery.data && ordersQuery.data.length > 0)) ? (
        <form className="ga-sales-stack ga-sales-claim-form" onSubmit={(event) => void onSubmit(event)}>
          {shopId && !orderId && ordersQuery.data ? (
            <SelectField
              label="Order"
              value={pickedOrderId}
              onChange={(value) => {
                setPickedOrderId(value);
                setSkuId('');
              }}
            >
              <option value="">Choose an order</option>
              {ordersQuery.data.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} · {order.dateLabel}
                </option>
              ))}
            </SelectField>
          ) : null}
          {orderQuery.data ? (
            <p className="ga-sales-muted">
              {orderQuery.data.shopName} · {orderQuery.data.orderNumber}
            </p>
          ) : null}
          {lines.length > 0 ? (
            <SelectField label="Product" value={skuId} onChange={setSkuId}>
              <option value="">Choose a product</option>
              {lines.map((line) => (
                <option key={line.id} value={line.skuId}>
                  {line.productName} · {line.skuName} ({line.quantity})
                </option>
              ))}
            </SelectField>
          ) : null}
          <TextField
            label="Quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <TextField label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <label className="ga-btn ga-btn--secondary ga-sales-file-label">
            {file ? file.name : 'Add photo'}
            <input
              className="ga-sales-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setFile(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </label>
          {error ? (
            <p className="ga-sales-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" className="ga-sales-btn-block" disabled={busy || !selected}>
            {busy ? 'Saving…' : 'Submit request'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
