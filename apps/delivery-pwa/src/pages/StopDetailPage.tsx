import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_FAILURE_REASON_LABELS,
} from '@groaurum/shared-types';
import type { BadgeTone } from '@groaurum/ui';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  PageHeader,
  SelectField,
  TextField,
} from '@groaurum/ui';
import { useDeliveryApi } from '@/data/DeliveryDataProviders';

type DigitalMethod = 'UPI_ON_DELIVERY' | 'OTHER' | 'CARD_ON_DELIVERY';

function stopTone(status: string): BadgeTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'IN_PROGRESS':
      return 'info';
    default:
      return 'neutral';
  }
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function logDeliveryActionError(context: string, err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Unable to complete delivery. Please try again.';

  if (import.meta.env.DEV) {
    const extra =
      typeof err === 'object' && err
        ? {
            message,
            code: 'code' in err ? (err as { code?: string }).code : undefined,
            details:
              'details' in err ? (err as { details?: string }).details : undefined,
            hint: 'hint' in err ? (err as { hint?: string }).hint : undefined,
          }
        : { message };
    console.error(`[Delivery PWA] ${context}`, extra, err);
  }

  return message;
}

export function StopDetailPage() {
  const { routeId = '', stopId = '' } = useParams();
  const api = useDeliveryApi();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [failNotes, setFailNotes] = useState('');
  const [failureReason, setFailureReason] = useState<string>(
    DELIVERY_FAILURE_REASONS[0],
  );
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [digitalMethod, setDigitalMethod] =
    useState<DigitalMethod>('UPI_ON_DELIVERY');
  const [digitalReference, setDigitalReference] = useState('');
  const [digitalNotes, setDigitalNotes] = useState('');

  const stopsQuery = useQuery({
    queryKey: ['delivery', 'route-stops', routeId],
    queryFn: () => api.getRouteStops(routeId),
    enabled: Boolean(routeId),
  });

  const stop = stopsQuery.data?.find((s) => s.id === stopId);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ['delivery', 'route-stops', routeId],
    });
    void queryClient.invalidateQueries({ queryKey: ['delivery', 'routes'] });
    void queryClient.invalidateQueries({ queryKey: ['delivery', 'dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['delivery', 'cod'] });
  }

  const markInProgress = useMutation({
    mutationFn: () => api.markStopInProgress(stopId),
    onSuccess: () => {
      setActionError(null);
      setActionSuccess('Stop marked in progress.');
      invalidate();
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(logDeliveryActionError('markStopInProgress', err));
    },
  });

  const collectCash = useMutation({
    mutationFn: async () => {
      if (!stop) throw new Error('Stop not found');
      const amount = stop.amount;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Invalid amount due');
      }
      return api.recordCashPayment({
        orderId: stop.orderId,
        cashAmount: amount,
      });
    },
    onSuccess: (result) => {
      setActionError(null);
      setShowBankForm(false);
      if (result.canCompleteDelivery) {
        setActionSuccess(
          `✓ ${formatInr(result.cashCollected)} cash collected · held by you`,
        );
      } else {
        setActionSuccess(
          `Cash ${formatInr(result.cashCollected)} recorded. Remaining ${formatInr(result.remaining)}.`,
        );
      }
      invalidate();
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(logDeliveryActionError('recordCashPayment', err));
    },
  });

  const reportDigital = useMutation({
    mutationFn: async () => {
      if (!stop) throw new Error('Stop not found');
      return api.reportDigitalPayment({
        orderId: stop.orderId,
        amount: stop.amount,
        collectionMethod: digitalMethod,
        reference: digitalReference.trim() || null,
        notes: digitalNotes.trim() || null,
      });
    },
    onSuccess: (result) => {
      setActionError(null);
      setShowBankForm(false);
      setActionSuccess(
        `⏳ ${formatInr(result.reportedAmount)} bank/UPI payment reported · awaiting company verification`,
      );
      invalidate();
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(logDeliveryActionError('reportDigitalPayment', err));
    },
  });

  const completeStop = useMutation({
    mutationFn: async () => {
      if (!stop) throw new Error('Stop not found');
      return api.completeStop({
        stopId,
        notes: notes.trim() || null,
        photoCaptured,
        signatureCaptured,
        collectCodAmount: null,
      });
    },
    onSuccess: () => {
      setActionError(null);
      setActionSuccess('✓ Delivery completed.');
      invalidate();
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(logDeliveryActionError('completeStop', err));
    },
  });

  const failStop = useMutation({
    mutationFn: () =>
      api.failStop({
        stopId,
        failureReason,
        notes: failNotes.trim() || null,
        photoCaptured,
      }),
    onSuccess: () => {
      setActionError(null);
      setActionSuccess('Delivery problem reported.');
      invalidate();
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(logDeliveryActionError('failStop', err));
    },
  });

  const paymentView = useMemo(() => {
    if (!stop) return null;
    const amountDue = stop.amount;
    const cash = stop.cashCollectedAmount ?? 0;
    const online = stop.onlineCollectedAmount ?? 0;
    const remaining = Math.max(
      Math.round((amountDue - cash - online) * 100) / 100,
      0,
    );
    const paid =
      stop.codCollected ||
      stop.paymentStatus === 'PAID' ||
      remaining <= 0;
    const awaitingVerification =
      stop.awaitingVerification ||
      (stop.paymentStatus === 'PAYMENT_PENDING' &&
        Boolean(stop.collectionMethod) &&
        stop.collectionMethod !== 'CASH_ON_DELIVERY' &&
        !paid);
    // Show collect actions whenever money is still owed — do NOT require
    // paymentMethodIntent === PAY_ON_DELIVERY (missing payment used to hide buttons).
    const needsCollection = !paid && !awaitingVerification && remaining > 0;
    const canComplete = paid || awaitingVerification;
    return {
      amountDue,
      cash,
      online,
      paid,
      remaining,
      awaitingVerification,
      needsCollection,
      canComplete,
      alreadyPaidDisplay: cash + online,
    };
  }, [stop]);

  if (stopsQuery.isLoading) {
    return (
      <Card>
        <EmptyState title="Loading stop" detail="Fetching delivery details…" />
      </Card>
    );
  }

  if (!stop || !paymentView) {
    return (
      <div className="ga-delivery-stack">
        <PageHeader title="Stop" subtitle="Not found" />
        <p className="ga-delivery-error">
          {stopsQuery.error instanceof Error
            ? stopsQuery.error.message
            : 'Stop not found'}
        </p>
        <Link to={`/routes/${routeId}`}>
          <Button variant="secondary">Back to route</Button>
        </Link>
      </div>
    );
  }

  const isOpen = stop.status === 'PENDING' || stop.status === 'IN_PROGRESS';
  const completeBlockedReason = paymentView.canComplete
    ? null
    : 'Record the customer payment before completing delivery.';

  return (
    <div className="ga-delivery-stack">
      <PageHeader
        title={stop.shopName}
        subtitle={`${stop.orderCode} · stop #${stop.sequence}`}
        meta={<Badge tone={stopTone(stop.status)}>{stop.statusLabel}</Badge>}
      />

      {actionError ? <p className="ga-delivery-error">{actionError}</p> : null}
      {actionSuccess ? (
        <p className="ga-delivery-success">{actionSuccess}</p>
      ) : null}

      <Card title="Delivery stop">
        <FieldGrid columns={2}>
          <Field label="Shop">{stop.shopName}</Field>
          <Field label="Order">{stop.orderCode}</Field>
          <Field label="Contact">{stop.contactName ?? '—'}</Field>
          <Field label="Mobile">{stop.contactMobile ?? '—'}</Field>
          <Field label="Address" wide>
            {stop.addressLine}, {stop.city} {stop.pinCode}
          </Field>
        </FieldGrid>
        <div className="ga-delivery-actions" style={{ marginTop: 'var(--ga-space-3)' }}>
          <a href={stop.navigationUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" type="button">
              Open maps
            </Button>
          </a>
          <Link to={`/routes/${routeId}`}>
            <Button variant="ghost">Back to route</Button>
          </Link>
        </div>
      </Card>

      {isOpen ? (
        <>
          {stop.status === 'PENDING' ? (
            <Card title="Workflow">
              <Button
                variant="primary"
                type="button"
                disabled={markInProgress.isPending}
                onClick={() => markInProgress.mutate()}
              >
                {markInProgress.isPending
                  ? 'Updating…'
                  : 'Mark in progress (Loaded)'}
              </Button>
            </Card>
          ) : null}

          <Card title="Payment">
            <FieldGrid columns={2}>
              <Field label="Order total">
                {formatInr(paymentView.amountDue)}
              </Field>
              <Field label="Already paid">
                {formatInr(paymentView.alreadyPaidDisplay)}
              </Field>
              <Field label="To collect">
                {paymentView.paid || paymentView.awaitingVerification
                  ? '₹0'
                  : formatInr(paymentView.remaining)}
              </Field>
              <Field label="Status">
                {paymentView.paid
                  ? '✓ Payment complete'
                  : paymentView.awaitingVerification
                    ? '⏳ Awaiting company verification'
                    : '⚠ Payment required'}
              </Field>
            </FieldGrid>

            {paymentView.paid ? (
              <div style={{ marginTop: 'var(--ga-space-3)' }}>
                {paymentView.cash > 0 ? (
                  <p className="ga-delivery-muted">
                    ✓ Cash collected · {formatInr(paymentView.cash)} held by you
                  </p>
                ) : (
                  <p className="ga-delivery-muted">
                    ✓ Payment is already received. You can complete delivery.
                  </p>
                )}
              </div>
            ) : null}

            {paymentView.awaitingVerification ? (
              <div style={{ marginTop: 'var(--ga-space-3)' }}>
                <p className="ga-delivery-muted">
                  ⏳ Bank / UPI payment reported
                  {stop.providerReference
                    ? ` · ref ${stop.providerReference}`
                    : ''}
                  . Company still needs to verify — not counted as received yet.
                </p>
              </div>
            ) : null}

            {paymentView.needsCollection ? (
              <div
                className="ga-delivery-form"
                style={{ marginTop: 'var(--ga-space-3)' }}
              >
                <div
                  style={{
                    border: '1px solid var(--ga-color-border, #ddd)',
                    borderRadius: 8,
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                    💵 Cash
                  </p>
                  <p className="ga-delivery-muted" style={{ marginTop: 0 }}>
                    Collect {formatInr(paymentView.remaining)} from customer.
                    Cash stays with you until Admin receives it.
                  </p>
                  <Button
                    variant="primary"
                    type="button"
                    disabled={collectCash.isPending || reportDigital.isPending}
                    onClick={() => {
                      const ok = window.confirm(
                        `Collect ${formatInr(paymentView.amountDue)} cash from the customer?`,
                      );
                      if (!ok) return;
                      collectCash.mutate();
                    }}
                  >
                    {collectCash.isPending
                      ? 'Saving…'
                      : `💵 Collect ${formatInr(paymentView.amountDue)} Cash`}
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid var(--ga-color-border, #ddd)',
                    borderRadius: 8,
                    padding: '0.75rem',
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                    🏦 Bank / Online Payment
                  </p>
                  <p className="ga-delivery-muted" style={{ marginTop: 0 }}>
                    Customer paid by bank transfer / UPI / online. This is
                    reported for company verification — not auto-confirmed.
                  </p>
                  {!showBankForm ? (
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={collectCash.isPending}
                      onClick={() => setShowBankForm(true)}
                    >
                      🏦 Record Bank / UPI Payment
                    </Button>
                  ) : (
                    <div className="ga-delivery-form">
                      <SelectField
                        label="How did the customer pay?"
                        name="digital-method"
                        value={digitalMethod}
                        onChange={(v) => setDigitalMethod(v as DigitalMethod)}
                        grow
                      >
                        <option value="UPI_ON_DELIVERY">📱 UPI</option>
                        <option value="OTHER">🏦 Bank Transfer</option>
                        <option value="CARD_ON_DELIVERY">💳 Online / Card</option>
                      </SelectField>
                      <TextField
                        label="Transaction / reference number"
                        name="digital-ref"
                        value={digitalReference}
                        onChange={(e) => setDigitalReference(e.target.value)}
                        placeholder="UPI ref / UTR (recommended)"
                        grow
                      />
                      <TextField
                        label="Notes (optional)"
                        name="digital-notes"
                        value={digitalNotes}
                        onChange={(e) => setDigitalNotes(e.target.value)}
                        grow
                      />
                      <div className="ga-delivery-actions">
                        <Button
                          variant="primary"
                          type="button"
                          disabled={reportDigital.isPending}
                          onClick={() => reportDigital.mutate()}
                        >
                          {reportDigital.isPending
                            ? 'Saving…'
                            : 'Submit for verification'}
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={reportDigital.isPending}
                          onClick={() => setShowBankForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Complete delivery">
            <div className="ga-delivery-form">
              <TextField
                label="Notes (optional)"
                name="complete-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                grow
              />
              <label className="ga-delivery-check">
                <input
                  type="checkbox"
                  checked={photoCaptured}
                  onChange={(e) => setPhotoCaptured(e.target.checked)}
                />
                Photo captured (placeholder)
              </label>
              <label className="ga-delivery-check">
                <input
                  type="checkbox"
                  checked={signatureCaptured}
                  onChange={(e) => setSignatureCaptured(e.target.checked)}
                />
                Signature captured (placeholder)
              </label>
              {completeBlockedReason ? (
                <p className="ga-delivery-muted">{completeBlockedReason}</p>
              ) : paymentView.awaitingVerification ? (
                <p className="ga-delivery-muted">
                  Payment awaiting company verification. You can complete the
                  physical delivery.
                </p>
              ) : (
                <p className="ga-delivery-muted">
                  Payment complete. You can finish this delivery.
                </p>
              )}
              <Button
                variant="primary"
                type="button"
                disabled={
                  completeStop.isPending || Boolean(completeBlockedReason)
                }
                onClick={() => completeStop.mutate()}
              >
                {completeStop.isPending
                  ? 'Completing…'
                  : '✓ Complete Delivery'}
              </Button>
            </div>
          </Card>

          <Card title="Report Delivery Problem">
            <div className="ga-delivery-form">
              <SelectField
                label="What went wrong?"
                name="failure-reason"
                value={failureReason}
                onChange={setFailureReason}
                grow
              >
                {DELIVERY_FAILURE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {DELIVERY_FAILURE_REASON_LABELS[reason]}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Notes"
                name="fail-notes"
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                grow
              />
              <Button
                variant="secondary"
                type="button"
                disabled={failStop.isPending}
                onClick={() => failStop.mutate()}
              >
                {failStop.isPending ? 'Saving…' : 'Report Delivery Problem'}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            title="Stop closed"
            detail={`This stop is ${stop.statusLabel}. No further actions.`}
          />
        </Card>
      )}
    </div>
  );
}
