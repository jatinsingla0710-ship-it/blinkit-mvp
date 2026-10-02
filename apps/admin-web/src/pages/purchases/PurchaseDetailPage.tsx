import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePurchaseDetailQuery } from '@/data/hooks';
import {
  useCancelPurchaseDraftMutation,
  useReceivePurchaseMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { PURCHASING_SECTION_LINKS } from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import './PurchasingPages.css';

export function PurchaseDetailPage() {
  const { purchaseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, refetch } = usePurchaseDetailQuery(purchaseId);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const receiveMutation = useReceivePurchaseMutation();
  const cancelMutation = useCancelPurchaseDraftMutation();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pending = receiveMutation.isPending || cancelMutation.isPending;

  const onReceive = async () => {
    if (!purchaseId) return;
    setError(null);
    setMessage(null);
    try {
      const result = await receiveMutation.mutateAsync(purchaseId);
      setMessage(
        result.alreadyReceived
          ? 'Purchase was already received. Stock was not added again.'
          : `Received into inventory (${result.movementCount} movement(s), qty ${result.totalQuantity}).`,
      );
      await refetch();
    } catch (err) {
      setError(formatMutationError(err, 'Could not receive purchase'));
    }
  };

  useEffect(() => {
    if (
      searchParams.get('receive') === '1' &&
      canManage &&
      state.data?.canReceive &&
      !receiveMutation.isPending
    ) {
      setSearchParams({}, { replace: true });
      void onReceive();
    }
  }, [searchParams, canManage, state.data?.canReceive]);

  const onCancel = async () => {
    if (!purchaseId) return;
    setError(null);
    setMessage(null);
    try {
      await cancelMutation.mutateAsync(purchaseId);
      await refetch();
    } catch (err) {
      setError(formatMutationError(err, 'Could not cancel purchase'));
    }
  };

  return (
    <QueryStateGate
      title="Purchase"
      state={state}
      emptyTitle="Purchase not found"
      emptyDetail="This purchase may have been removed."
    >
      {(purchase) => (
        <div className="ga-purchasing">
          <PageHeader
            title={purchase.billNumber}
            subtitle={`${purchase.supplierName} · ${purchase.purchaseDateLabel}`}
            meta={purchase.statusLabel}
            actions={
              <div className="ga-purchasing__actions">
                {canManage && purchase.canEdit ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                  >
                    Edit draft
                  </Button>
                ) : null}
                {canManage && purchase.canReceive ? (
                  <Button
                    variant="primary"
                    disabled={pending}
                    onClick={() => void onReceive()}
                  >
                    {pending ? 'Receiving…' : 'Receive into stock'}
                  </Button>
                ) : null}
              </div>
            }
          />

          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          {error ? <p className="ga-purchasing__error">{error}</p> : null}
          {message ? <p className="ga-purchasing__note">{message}</p> : null}

          <section className="ga-purchasing__card">
            <h2>Header</h2>
            <dl className="ga-purchasing__dl">
              <div>
                <dt>Supplier</dt>
                <dd>
                  <Link to={`/suppliers/${purchase.supplierId}`}>
                    {purchase.supplierName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Warehouse</dt>
                <dd>{purchase.warehouseName}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{purchase.purchaseDateLabel}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{purchase.statusLabel}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{purchase.receivedAtLabel ?? '—'}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{purchase.notes ?? '—'}</dd>
              </div>
            </dl>
            {purchase.status === 'RECEIVED' ? (
              <p className="ga-purchasing__note">
                Received purchases are locked. Stock was increased via inventory
                receipt movements. This is not a cash payment and does not appear
                in Day Book.
              </p>
            ) : null}
          </section>

          <section className="ga-purchasing__card">
            <h2>Amounts</h2>
            <div className="ga-purchasing__totals">
              <span>Subtotal: {purchase.subtotalLabel}</span>
              <span>Tax: {purchase.taxAmountLabel}</span>
              <span>Total: {purchase.totalLabel}</span>
            </div>
            <p className="ga-purchasing__note">
              Tax is optional in this phase — full GST engine comes later.
            </p>
          </section>

          <section className="ga-purchasing__card">
            <h2>Items</h2>
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit cost</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>
                        {item.skuCode}
                        <div className="ga-purchasing__note">{item.skuName}</div>
                      </td>
                      <td>{item.quantityLabel}</td>
                      <td>{item.unitCostLabel}</td>
                      <td>{item.lineTotalLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canManage && purchase.status === 'DRAFT' ? (
            <div className="ga-purchasing__actions">
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => void onCancel()}
              >
                Cancel draft
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
