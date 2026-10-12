import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PurchaseReceiveForm } from '@/components/purchasing/PurchaseReceiveForm';
import { PurchaseReturnForm } from '@/components/purchasing/PurchaseReturnForm';
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
import { isPayablePurchaseStatus } from '@/data/purchase-payable';
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

  const onReceiveAll = async () => {
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
      void onReceiveAll();
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
      {(purchase) => {
        const showPayment =
          canManage &&
          isPayablePurchaseStatus(purchase.status) &&
          (purchase.accounting.remainingOnBill > 0 ||
            purchase.accounting.creditOnBill > 0);

        return (
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
                      onClick={() => void onReceiveAll()}
                    >
                      {pending ? 'Receiving…' : 'Receive all remaining'}
                    </Button>
                  ) : null}
                  {showPayment && purchase.accounting.remainingOnBill > 0 ? (
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
              <h2>Payable on this bill</h2>
              <p className="ga-purchasing__note">
                {purchase.accounting.ownerSummary}
              </p>
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
                  <dt>Original bill total</dt>
                  <dd>{purchase.accounting.billTotalLabel}</dd>
                </div>
                <div>
                  <dt>Received value</dt>
                  <dd>{purchase.accounting.receiptTotalLabel}</dd>
                </div>
                <div>
                  <dt>Returned value</dt>
                  <dd>{purchase.accounting.returnTotalLabel}</dd>
                </div>
                <div>
                  <dt>Payable (net received)</dt>
                  <dd>{purchase.accounting.payableIncreaseLabel}</dd>
                </div>
                <div>
                  <dt>Paid on this bill</dt>
                  <dd>{purchase.accounting.paidAgainstBillLabel}</dd>
                </div>
                {purchase.accounting.creditOnBill > 0 ? (
                  <div>
                    <dt>Supplier credit</dt>
                    <dd>
                      <strong className="ga-purchasing__credit">
                        {purchase.accounting.creditOnBillLabel}
                      </strong>
                      <div className="ga-purchasing__muted">
                        Excess over payable — not a cash refund.
                      </div>
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt>Still to pay</dt>
                    <dd>
                      <strong>
                        {formatInr(
                          Math.max(0, purchase.accounting.remainingOnBill),
                        )}
                      </strong>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {canManage ? (
              <PurchaseReceiveForm
                purchase={purchase}
                onDone={async (msg) => {
                  setError(null);
                  setMessage(msg);
                  await refetch();
                }}
                onError={(msg) => {
                  setMessage(null);
                  setError(msg || null);
                }}
              />
            ) : null}

            {canManage ? (
              <PurchaseReturnForm
                purchase={purchase}
                onDone={async (msg) => {
                  setError(null);
                  setMessage(msg);
                  await refetch();
                }}
                onError={(msg) => {
                  setMessage(null);
                  setError(msg || null);
                }}
              />
            ) : null}

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
                  <dt>First received</dt>
                  <dd>{purchase.firstReceivedAtLabel ?? '—'}</dd>
                </div>
                <div>
                  <dt>Fully received</dt>
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
                Bill total stays the original invoice amount. Payable follows
                received value minus returns and payments.
              </p>
            </section>

            <section className="ga-purchasing__card">
              <h2>Items</h2>
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Returned</th>
                      <th>To receive</th>
                      <th>Returnable</th>
                      <th>Unit cost</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.productName}
                          <div className="ga-purchasing__muted">
                            {item.skuCode} · {item.skuName}
                          </div>
                        </td>
                        <td>{item.quantityLabel}</td>
                        <td>{item.receivedQuantityLabel}</td>
                        <td>{item.returnedQuantityLabel}</td>
                        <td>{item.remainingToReceiveLabel}</td>
                        <td>{item.remainingReturnableLabel}</td>
                        <td>{item.unitCostLabel}</td>
                        <td>{item.lineTotalLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="ga-purchasing__card">
              <h2>Receipt history</h2>
              {purchase.receiptHistory.length === 0 ? (
                <EmptyState
                  title="No receipts yet"
                  detail="Receive stock to create receipt events and increase payable."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>By</th>
                        <th>Lines</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.receiptHistory.map((receipt) => (
                        <tr key={receipt.id}>
                          <td>{receipt.receivedAtLabel}</td>
                          <td>{receipt.actorLabel}</td>
                          <td>
                            {receipt.lines.map((line) => (
                              <div key={`${receipt.id}-${line.purchaseItemId}`}>
                                {line.quantityLabel} × {line.productName}
                              </div>
                            ))}
                          </td>
                          <td>
                            {receipt.totalAmountLabel}
                            <div className="ga-purchasing__muted">
                              Taxable {receipt.taxableAmountLabel} · tax{' '}
                              {receipt.taxAmountLabel}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="ga-purchasing__card">
              <h2>Return history</h2>
              {purchase.returnHistory.length === 0 ? (
                <EmptyState
                  title="No supplier returns"
                  detail="Returns reduce payable (or create supplier credit) without changing the original bill total."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>By</th>
                        <th>Reason</th>
                        <th>Lines</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.returnHistory.map((ret) => (
                        <tr key={ret.id}>
                          <td>{ret.returnedAtLabel}</td>
                          <td>{ret.actorLabel}</td>
                          <td>{ret.reason}</td>
                          <td>
                            {ret.lines.map((line) => (
                              <div key={`${ret.id}-${line.purchaseItemId}`}>
                                {line.quantityLabel} × {line.productName}
                              </div>
                            ))}
                          </td>
                          <td>{ret.totalAmountLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="ga-purchasing__card">
              <div className="ga-purchasing__card-head">
                <h2>Payments on this bill</h2>
                {canManage && isPayablePurchaseStatus(purchase.status) ? (
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
                    isPayablePurchaseStatus(purchase.status)
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
        );
      }}
    </QueryStateGate>
  );
}
