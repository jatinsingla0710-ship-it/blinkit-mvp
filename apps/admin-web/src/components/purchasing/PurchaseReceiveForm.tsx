import { useMemo, useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import { newClientRequestId } from '@/data/counter-sale';
import { formatInr } from '@/data/live/format';
import {
  defaultReceiveQuantities,
  formatPurchaseReceiveError,
  nextReceiveClientRequestId,
  planPurchaseReceive,
  receiveSubmissionFingerprint,
} from '@/data/purchase-receive-form';
import {
  useReceivePurchaseLinesMutation,
  useReceivePurchaseMutation,
} from '@/data/mutations';
import type { PurchaseDetail } from '@/data/purchasing';

type Props = {
  purchase: PurchaseDetail;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  /** When true, open the quantity form immediately (tests / deep links). */
  defaultExpanded?: boolean;
};

export function PurchaseReceiveForm({
  purchase,
  onDone,
  onError,
  defaultExpanded = false,
}: Props) {
  const receiveLines = useReceivePurchaseLinesMutation();
  const receiveAll = useReceivePurchaseMutation();
  const requestIdRef = useRef(newClientRequestId());
  const fingerprintRef = useRef<string | null>(null);
  const lastOutcomeRef = useRef<'none' | 'error' | 'success'>('none');

  const receivableItems = useMemo(
    () => purchase.items.filter((item) => item.remainingToReceive > 0),
    [purchase.items],
  );

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    defaultReceiveQuantities(purchase.items),
  );
  const [showForm, setShowForm] = useState(defaultExpanded);

  const pending = receiveLines.isPending || receiveAll.isPending;

  const preview = useMemo(
    () =>
      planPurchaseReceive({
        items: purchase.items,
        quantities,
        billSubtotal: purchase.subtotal,
        billTax: purchase.taxAmount,
        priorReceiptTaxable: purchase.receiptTaxableAmount,
        priorReceiptTax: purchase.receiptTaxAmount,
      }),
    [purchase, quantities],
  );

  const setQty = (itemId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
  };

  const onReceiveRemaining = async () => {
    onError('');
    try {
      const result = await receiveAll.mutateAsync(purchase.id);
      lastOutcomeRef.current = 'success';
      onDone(
        result.alreadyReceived
          ? 'Purchase was already fully received.'
          : `Received remaining stock (${result.totalQuantity} units).`,
      );
      setShowForm(false);
    } catch (err) {
      lastOutcomeRef.current = 'error';
      onError(formatPurchaseReceiveError(err));
    }
  };

  const onConfirmPartial = async () => {
    onError('');
    if (!preview.ok) {
      onError(preview.error);
      return;
    }
    const fingerprint = receiveSubmissionFingerprint({
      purchaseId: purchase.id,
      lines: preview.lines,
    });
    const next = nextReceiveClientRequestId({
      previousId: requestIdRef.current,
      previousFingerprint: fingerprintRef.current,
      nextFingerprint: fingerprint,
      lastOutcome: lastOutcomeRef.current,
    });
    requestIdRef.current = next.id;
    fingerprintRef.current = next.fingerprint;

    try {
      const result = await receiveLines.mutateAsync({
        purchaseId: purchase.id,
        lines: preview.lines,
        clientRequestId: next.id,
      });
      lastOutcomeRef.current = 'success';
      onDone(
        result.idempotentReplay
          ? 'Same receive request replayed — stock was not doubled.'
          : `Received ${result.totalQuantity} units · payable ${formatInr(result.totalAmount)}${
              result.status === 'PARTIALLY_RECEIVED'
                ? ' · still partially received'
                : ' · fully received'
            }.`,
      );
      setShowForm(false);
      setQuantities(defaultReceiveQuantities(purchase.items));
    } catch (err) {
      lastOutcomeRef.current = 'error';
      onError(formatPurchaseReceiveError(err));
    }
  };

  if (!purchase.canReceive || receivableItems.length === 0) return null;

  return (
    <section className="ga-purchasing__card ga-purchasing__receive">
      <div className="ga-purchasing__card-head">
        <h2>Receive stock</h2>
        <div className="ga-purchasing__actions">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void onReceiveRemaining()}
          >
            {pending ? 'Receiving…' : 'Receive all remaining'}
          </Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Hide quantities' : 'Receive partial…'}
          </Button>
        </div>
      </div>
      <p className="ga-purchasing__note">
        Enter how much of each line you are receiving now. Tax is allocated
        pro-rata from the bill; the final receipt takes any rounding remainder.
      </p>

      {showForm ? (
        <div className="ga-purchasing__ops-form">
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Remaining</th>
                  <th>Receive now</th>
                </tr>
              </thead>
              <tbody>
                {receivableItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.productName}
                      <div className="ga-purchasing__muted">
                        Ordered {item.quantityLabel} · received{' '}
                        {item.receivedQuantityLabel}
                      </div>
                    </td>
                    <td>{item.remainingToReceiveLabel}</td>
                    <td>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={item.remainingToReceive}
                        step="any"
                        value={quantities[item.id] ?? ''}
                        disabled={pending}
                        aria-label={`Receive quantity for ${item.productName}`}
                        onChange={(e) => setQty(item.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.ok ? (
            <dl className="ga-purchasing__dl ga-purchasing__preview">
              <div>
                <dt>Receipt taxable</dt>
                <dd>{formatInr(preview.taxableAmount)}</dd>
              </div>
              <div>
                <dt>Allocated tax</dt>
                <dd>{formatInr(preview.taxAmount)}</dd>
              </div>
              <div>
                <dt>Receipt total</dt>
                <dd>
                  <strong>{formatInr(preview.totalAmount)}</strong>
                </dd>
              </div>
              <div>
                <dt>After confirm</dt>
                <dd>
                  {preview.completesBill
                    ? 'Fully received'
                    : 'Still partially received'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="ga-purchasing__muted">{preview.error}</p>
          )}

          <div className="ga-purchasing__actions">
            <Button
              variant="primary"
              disabled={pending || !preview.ok}
              onClick={() => void onConfirmPartial()}
            >
              {pending ? 'Receiving…' : 'Confirm receive'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
