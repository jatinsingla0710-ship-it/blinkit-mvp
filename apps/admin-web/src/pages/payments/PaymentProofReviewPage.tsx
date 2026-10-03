import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  useCustomersSnapshotQuery,
  usePaymentProofScanQuery,
  useUnpaidOrderCandidatesQuery,
} from '@/data/hooks';
import {
  useConfirmPaymentProofScanMutation,
  useDiscardPaymentProofScanMutation,
  useSavePaymentProofScanExtractMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import {
  applyPaymentProofMatches,
  emptyPaymentProofExtract,
  type PaymentProofCollectionMethod,
  type PaymentProofExtractDraft,
} from '@/data/payment-proof-extract';
import { formatInr } from '@/data/live/format';
import { todayExpenseDate } from '@/data/company-expenses';
import { SALES_SECTION_LINKS } from '@/data/section-links';
import './PaymentsPage.css';

const METHOD_OPTIONS: { id: PaymentProofCollectionMethod; label: string }[] = [
  { id: 'UPI_ON_DELIVERY', label: 'UPI' },
  { id: 'CASH_ON_DELIVERY', label: 'Cash' },
  { id: 'CARD_ON_DELIVERY', label: 'Card' },
  { id: 'ONLINE_GATEWAY', label: 'Online gateway' },
  { id: 'OTHER', label: 'Other' },
];

export function PaymentProofReviewPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const scanQuery = usePaymentProofScanQuery(scanId);
  const customersQuery = useCustomersSnapshotQuery();

  const saveMutation = useSavePaymentProofScanExtractMutation();
  const confirmMutation = useConfirmPaymentProofScanMutation();
  const discardMutation = useDiscardPaymentProofScanMutation();

  const [extract, setExtract] = useState<PaymentProofExtractDraft>(
    emptyPaymentProofExtract(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanQuery.data || hydrated) return;
    setExtract(scanQuery.data.extract);
    setHydrated(true);
  }, [scanQuery.data, hydrated]);

  const shopId = extract.matchedCustomerId ?? undefined;
  const unpaidQuery = useUnpaidOrderCandidatesQuery(shopId);

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.rows ?? []).map((r) => ({
        id: r.id,
        shopName: r.shopName,
        ownerName: r.ownerName,
      })),
    [customersQuery.data],
  );

  const unpaidOrders = unpaidQuery.data ?? [];

  const readOnly =
    scanQuery.data?.status === 'CONFIRMED' ||
    scanQuery.data?.status === 'DISCARDED';

  const rematch = () => {
    setExtract((prev) =>
      applyPaymentProofMatches(prev, customerOptions, unpaidOrders),
    );
  };

  const onSave = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({ scanId, extract });
    } catch (err) {
      setError(formatMutationError(err, 'Could not save review'));
    }
  };

  const onConfirm = async () => {
    if (!scanId) return;
    setError(null);
    try {
      if (!extract.matchedOrderId) {
        throw new Error('Choose an unpaid order before marking paid');
      }
      await confirmMutation.mutateAsync({
        scanId,
        extract,
        orderId: extract.matchedOrderId,
        shopId: extract.matchedCustomerId,
      });
      navigate(`/orders/${extract.matchedOrderId}`);
    } catch (err) {
      setError(formatMutationError(err, 'Could not confirm payment proof'));
    }
  };

  const onDiscard = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await discardMutation.mutateAsync(scanId);
      navigate('/payments');
    } catch (err) {
      setError(formatMutationError(err, 'Could not discard scan'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-payments">
        <PageHeader title="Review payment proof" subtitle="Permission required" />
        <p className="ga-payments__error">
          You need payments manage permission to review payment proofs.
        </p>
      </div>
    );
  }

  return (
    <QueryStateGate
      title="Review payment proof"
      state={scanQuery.state}
      emptyTitle="Payment proof not found"
      emptyDetail="This scan may have been discarded or the link is wrong."
    >
      {(scan) => (
        <div className="ga-payments">
          <PageHeader
            title="Review payment proof"
            subtitle={`Extractor: ${scan.extractorLabel} · Status: ${scan.status}`}
            meta={scan.createdAtLabel}
            actions={
              scan.orderId ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/orders/${scan.orderId}`)}
                >
                  Open order
                </Button>
              ) : undefined
            }
          />
          <SectionRelatedLinks label="Sales" links={[...SALES_SECTION_LINKS]} />

          <section className="ga-payments__card ga-payments__scan-layout">
            <div>
              <h2>Photo</h2>
              {scan.imageUrl ? (
                <img
                  className="ga-payments__proof-image"
                  src={scan.imageUrl}
                  alt="Uploaded payment proof"
                />
              ) : (
                <p className="ga-payments__note">No photo attached.</p>
              )}
              <p className="ga-payments__muted">
                Manual review required. Confirm marks the selected order as
                paid — never from the image alone.
              </p>
            </div>

            <div>
              <div className="ga-payments__card-head">
                <h2>Proof fields</h2>
                {!readOnly ? (
                  <Button variant="ghost" onClick={rematch}>
                    Re-match customer / order
                  </Button>
                ) : null}
              </div>

              <div className="ga-payments__form-grid">
                <label>
                  Sender hint
                  <input
                    value={extract.senderHint ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        senderHint: e.target.value,
                      }))
                    }
                    placeholder="Customer name on screenshot"
                  />
                </label>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={extract.amount ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        amount:
                          e.target.value === ''
                            ? null
                            : Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Payment date
                  <input
                    type="date"
                    value={extract.paymentDate ?? todayExpenseDate()}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        paymentDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Reference / UTR
                  <input
                    value={extract.referenceNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        referenceNumber: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Method
                  <select
                    value={extract.collectionMethod ?? 'UPI_ON_DELIVERY'}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        collectionMethod: e.target
                          .value as PaymentProofCollectionMethod,
                      }))
                    }
                  >
                    {METHOD_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Matched customer
                  <select
                    value={extract.matchedCustomerId ?? ''}
                    disabled={readOnly}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const name =
                        customerOptions.find((c) => c.id === id)?.shopName ??
                        null;
                      setExtract((prev) => ({
                        ...prev,
                        matchedCustomerId: id,
                        matchedCustomerName: name,
                        customerMatchConfidence: id ? 'exact' : 'none',
                        matchedOrderId: null,
                        orderMatchConfidence: 'none',
                      }));
                    }}
                  >
                    <option value="">Select customer</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shopName}
                        {extract.matchedCustomerId === c.id &&
                        extract.customerMatchConfidence &&
                        extract.customerMatchConfidence !== 'none'
                          ? ` (${extract.customerMatchConfidence})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unpaid order to mark paid
                  <select
                    value={extract.matchedOrderId ?? ''}
                    disabled={readOnly || !extract.matchedCustomerId}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        matchedOrderId: e.target.value || null,
                        orderMatchConfidence: e.target.value
                          ? 'exact'
                          : 'none',
                      }))
                    }
                  >
                    <option value="">
                      {extract.matchedCustomerId
                        ? unpaidQuery.isPending
                          ? 'Loading orders…'
                          : unpaidOrders.length
                            ? 'Select unpaid order'
                            : 'No unpaid orders'
                        : 'Choose customer first'}
                    </option>
                    {unpaidOrders.map((o) => (
                      <option key={o.orderId} value={o.orderId}>
                        {o.shortLabel} · {formatInr(o.outstanding)} due
                        {extract.matchedOrderId === o.orderId &&
                        extract.orderMatchConfidence &&
                        extract.orderMatchConfidence !== 'none'
                          ? ` (${extract.orderMatchConfidence})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea
                  rows={2}
                  value={extract.notes ?? ''}
                  disabled={readOnly}
                  onChange={(e) =>
                    setExtract((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </label>
              {extract.matchedCustomerId ? (
                <p className="ga-payments__muted">
                  Customer:{' '}
                  <Link to={`/customers/${extract.matchedCustomerId}`}>
                    {extract.matchedCustomerName ?? 'Open'}
                  </Link>
                </p>
              ) : null}
            </div>
          </section>

          {error ? <p className="ga-payments__error">{error}</p> : null}

          {!readOnly ? (
            <div className="ga-payments__actions">
              <Button
                variant="secondary"
                disabled={
                  saveMutation.isPending ||
                  confirmMutation.isPending ||
                  discardMutation.isPending
                }
                onClick={() => void onSave()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save review'}
              </Button>
              <Button
                variant="primary"
                disabled={
                  saveMutation.isPending ||
                  confirmMutation.isPending ||
                  discardMutation.isPending
                }
                onClick={() => void onConfirm()}
              >
                {confirmMutation.isPending
                  ? 'Marking paid…'
                  : 'Confirm → mark order paid'}
              </Button>
              <Button
                variant="ghost"
                disabled={discardMutation.isPending}
                onClick={() => void onDiscard()}
              >
                Discard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/payments')}>
                Back
              </Button>
            </div>
          ) : (
            <div className="ga-payments__actions">
              {scan.orderId ? (
                <Link to={`/orders/${scan.orderId}`}>Open linked order</Link>
              ) : null}
              <Button variant="ghost" onClick={() => navigate('/payments')}>
                Back to collections
              </Button>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
