import { useMemo, useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import { newClientRequestId } from '@/data/counter-sale';
import { formatInr } from '@/data/live/format';
import {
  formatPurchaseReturnError,
  nextReturnClientRequestId,
  planPurchaseReturn,
  returnSubmissionFingerprint,
} from '@/data/purchase-return-form';
import { useCreatePurchaseReturnMutation } from '@/data/mutations';
import type { PurchaseDetail } from '@/data/purchasing';

type Props = {
  purchase: PurchaseDetail;
  onDone: (message: string) => void;
  onError: (message: string) => void;
  /** When true, open the return form immediately (tests / deep links). */
  defaultExpanded?: boolean;
};

export function PurchaseReturnForm({
  purchase,
  onDone,
  onError,
  defaultExpanded = false,
}: Props) {
  const createReturn = useCreatePurchaseReturnMutation();
  const requestIdRef = useRef(newClientRequestId());
  const fingerprintRef = useRef<string | null>(null);
  const lastOutcomeRef = useRef<'none' | 'error' | 'success'>('none');

  const returnableItems = useMemo(
    () => purchase.items.filter((item) => item.remainingReturnable > 0),
    [purchase.items],
  );

  const [showForm, setShowForm] = useState(defaultExpanded);
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const pending = createReturn.isPending;

  const preview = useMemo(
    () =>
      planPurchaseReturn({
        items: purchase.items,
        quantities,
        reason,
        receiptTaxable: purchase.receiptTaxableAmount,
        receiptTax: purchase.receiptTaxAmount,
        priorReturnTaxable: purchase.returnTaxableAmount,
        priorReturnTax: purchase.returnTaxAmount,
      }),
    [purchase, quantities, reason],
  );

  if (!purchase.canReturn || returnableItems.length === 0) return null;

  const onConfirm = async () => {
    onError('');
    if (!preview.ok) {
      onError(preview.error);
      return;
    }
    const fingerprint = returnSubmissionFingerprint({
      purchaseId: purchase.id,
      reason: preview.reason,
      lines: preview.lines,
    });
    const next = nextReturnClientRequestId({
      previousId: requestIdRef.current,
      previousFingerprint: fingerprintRef.current,
      nextFingerprint: fingerprint,
      lastOutcome: lastOutcomeRef.current,
    });
    requestIdRef.current = next.id;
    fingerprintRef.current = next.fingerprint;

    try {
      const result = await createReturn.mutateAsync({
        purchaseId: purchase.id,
        lines: preview.lines,
        reason: preview.reason,
        clientRequestId: next.id,
      });
      lastOutcomeRef.current = 'success';
      onDone(
        result.idempotentReplay
          ? 'Same return request replayed — stock was not doubled.'
          : `Returned ${result.totalQuantity} units · credit ${formatInr(result.totalAmount)}.`,
      );
      setShowForm(false);
      setReason('');
      setQuantities({});
    } catch (err) {
      lastOutcomeRef.current = 'error';
      onError(formatPurchaseReturnError(err));
    }
  };

  return (
    <section className="ga-purchasing__card ga-purchasing__return">
      <div className="ga-purchasing__card-head">
        <h2>Return to supplier</h2>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Hide return form' : 'Return stock…'}
        </Button>
      </div>
      <p className="ga-purchasing__note">
        Return only quantities already received and not previously returned.
        This reduces payable (or creates supplier credit if the bill was paid).
        No cash/bank refund is created here.
      </p>

      {showForm ? (
        <div className="ga-purchasing__ops-form">
          <label className="ga-purchasing__field">
            <span>Return reason (required)</span>
            <textarea
              rows={2}
              value={reason}
              disabled={pending}
              maxLength={500}
              placeholder="e.g. Damaged carton / wrong item"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Returnable</th>
                  <th>Return now</th>
                </tr>
              </thead>
              <tbody>
                {returnableItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.productName}
                      <div className="ga-purchasing__muted">
                        Received {item.receivedQuantityLabel} · already returned{' '}
                        {item.returnedQuantityLabel}
                      </div>
                    </td>
                    <td>{item.remainingReturnableLabel}</td>
                    <td>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={item.remainingReturnable}
                        step="any"
                        value={quantities[item.id] ?? ''}
                        disabled={pending}
                        aria-label={`Return quantity for ${item.productName}`}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
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
                <dt>Taxable credit</dt>
                <dd>{formatInr(preview.taxableAmount)}</dd>
              </div>
              <div>
                <dt>Tax reversal</dt>
                <dd>{formatInr(preview.taxAmount)}</dd>
              </div>
              <div>
                <dt>Total credit</dt>
                <dd>
                  <strong>{formatInr(preview.totalAmount)}</strong>
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
              onClick={() => void onConfirm()}
            >
              {pending ? 'Returning…' : 'Confirm return'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
