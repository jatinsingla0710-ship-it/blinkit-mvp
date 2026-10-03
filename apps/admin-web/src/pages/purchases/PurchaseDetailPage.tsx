import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePurchaseDetailQuery } from '@/data/hooks';
import {
  useCancelPurchaseDraftMutation,
  useReceivePurchaseMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { formatInr } from '@/data/live/format';
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
          ? 'Purchase was already received. Stock and payable were not changed again.'
          : `Received into stock (${result.movementCount} movement(s), qty ${result.totalQuantity}). Supplier payable increased — this is not an expense.`,
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
                {canManage &&
                purchase.status === 'RECEIVED' &&
                purchase.accounting.remainingOnBill > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/suppliers/${purchase.supplierId}?pay=1`)
                    }
                  >
                    Record payment
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
            <h2>Accounting impact</h2>
            <p className="ga-purchasing__note">{purchase.accounting.ownerSummary}</p>
            <ul className="ga-purchasing__effects">
              {purchase.accounting.effects.map((effect) => (
                <li
                  key={effect.id}
                  className={`ga-purchasing__effect ga-purchasing__effect--${effect.tone}`}
                >
                  <strong>{effect.label}</strong>
                  <span>{effect.detail}</span>
                </li>
              ))}
            </ul>
            <dl className="ga-purchasing__dl">
              <div>
                <dt>Stock cost</dt>
                <dd>{purchase.accounting.inventoryCostLabel}</dd>
              </div>
              <div>
                <dt>Tax on bill</dt>
                <dd>{purchase.accounting.taxAmountLabel}</dd>
              </div>
              <div>
                <dt>Payable from bill</dt>
                <dd>{purchase.accounting.payableIncreaseLabel}</dd>
              </div>
              <div>
                <dt>Paid on this bill</dt>
                <dd>{purchase.accounting.paidAgainstBillLabel}</dd>
              </div>
              <div>
                <dt>Still to pay</dt>
                <dd>
                  <strong>{purchase.accounting.remainingOnBillLabel}</strong>
                </dd>
              </div>
            </dl>
          </section>

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
          </section>

          <section className="ga-purchasing__card">
            <h2>Amounts</h2>
            <div className="ga-purchasing__totals">
              <span>Subtotal: {purchase.subtotalLabel}</span>
              <span>Tax: {purchase.taxAmountLabel}</span>
              <span>Total: {purchase.totalLabel}</span>
            </div>
            {purchase.taxAmount > 0 ? (
              <div className="ga-purchasing__totals">
                <span>
                  Supply:{' '}
                  {purchase.supplyType === 'INTRA'
                    ? 'Same state'
                    : purchase.supplyType === 'INTER'
                      ? 'Other state'
                      : 'Not set'}
                </span>
                <span>CGST: {formatInr(purchase.cgstAmount)}</span>
                <span>SGST: {formatInr(purchase.sgstAmount)}</span>
                <span>IGST: {formatInr(purchase.igstAmount)}</span>
              </div>
            ) : null}
            <p className="ga-purchasing__note">
              Tax is stored on the bill and included in supplier payable. GST
              summary is available under Reports — this is not a GSTR filing
              export. Do not post inventory purchases as expenses.
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
                        <div className="ga-purchasing__muted">{item.skuName}</div>
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

          <section className="ga-purchasing__card">
            <div className="ga-purchasing__card-head">
              <h2>Payments on this bill</h2>
              {canManage && purchase.status === 'RECEIVED' ? (
                <Link
                  className="ga-btn ga-btn--secondary"
                  to={`/suppliers/${purchase.supplierId}?pay=1`}
                >
                  + Record payment
                </Link>
              ) : null}
            </div>
            {purchase.billPayments.length === 0 ? (
              <EmptyState
                title="No payments linked to this bill"
                detail={
                  purchase.status === 'RECEIVED'
                    ? 'Record a supplier payment and optionally link it to this bill.'
                    : 'Receive the purchase before recording payments against it.'
                }
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.billPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.paymentDateLabel}</td>
                        <td>{payment.amountLabel}</td>
                        <td>{payment.paymentMethodLabel}</td>
                        <td>{payment.referenceNumber ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
