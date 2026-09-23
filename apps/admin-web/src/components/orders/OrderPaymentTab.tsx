import { useState } from 'react';
import type { OrderPaymentSummary } from '@/data/orders-types';
import { PaymentStatusBadge } from '@/components/orders/OrderStatusBadges';
import {
  useMarkOrderPaymentReceivedMutation,
  useRefundConvertedSaleMutation,
} from '@/data/mutations';
import { Button } from '@groaurum/ui';
import './OrderPaymentTab.css';

type Props = {
  orderId: string;
  payment: OrderPaymentSummary;
  canReceivePayment?: boolean;
  /** Full-order return/refund (Sales H3) — no partial lines. */
  canRefund?: boolean;
};

export function OrderPaymentTab({
  orderId,
  payment,
  canReceivePayment = false,
  canRefund = false,
}: Props) {
  const markPaid = useMarkOrderPaymentReceivedMutation();
  const refundSale = useRefundConvertedSaleMutation();
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refundResultNote, setRefundResultNote] = useState<string | null>(null);

  const showReceive = canReceivePayment && payment.status !== 'PAID';
  const showRefund =
    canRefund && payment.status === 'PAID' && !refundResultNote;

  return (
    <div className="ga-ord-payment">
      <div className="ga-ord-payment__row">
        <span>Method</span>
        <strong>{payment.methodLabel}</strong>
      </div>
      <div className="ga-ord-payment__row">
        <span>Status</span>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <div className="ga-ord-payment__row">
        <span>Subtotal</span>
        <strong>{payment.subtotalLabel}</strong>
      </div>
      <div className="ga-ord-payment__row">
        <span>Discount</span>
        <strong>{payment.discountLabel ?? '₹0'}</strong>
      </div>
      <div className="ga-ord-payment__row ga-ord-payment__row--total">
        <span>Grand Total</span>
        <strong>{payment.totalLabel}</strong>
      </div>
      <div className="ga-ord-payment__row">
        <span>Collected</span>
        <strong>{payment.collectedLabel}</strong>
      </div>
      <div className="ga-ord-payment__row">
        <span>Outstanding</span>
        <strong>{payment.outstandingLabel}</strong>
      </div>

      {showReceive ? (
        <div className="ga-ord-payment__action">
          <p className="ga-ord-payment__action-hint">
            Mark payment received for Cash, UPI, Bank Transfer, or Credit. This
            unlocks Convert To Sale.
          </p>
          <Button
            variant="primary"
            disabled={markPaid.isPending}
            onClick={() => markPaid.mutate({ orderId })}
          >
            {markPaid.isPending ? 'Saving…' : 'Receive Payment'}
          </Button>
          {markPaid.isError ? (
            <p className="ga-ord-payment__error">
              {(markPaid.error as Error)?.message ?? 'Could not mark payment'}
            </p>
          ) : null}
        </div>
      ) : null}

      {payment.status === 'PAID' && !showRefund ? (
        <p className="ga-ord-payment__paid-note">
          Payment received. Convert To Sale is available in the action panel.
        </p>
      ) : null}

      {payment.status === 'REFUNDED' ? (
        <p className="ga-ord-payment__paid-note">
          Full return/refund recorded. Order stays Delivered historically. This
          is a database refund marker — not an automatic Razorpay refund.
        </p>
      ) : null}

      {showRefund ? (
        <div className="ga-ord-payment__action ga-ord-payment__refund">
          <p className="ga-ord-payment__action-hint">
            Full-order return &amp; refund only (no partial lines / RMA). Marks
            payment and sale as REFUNDED. Optional restock uses sale_items qty
            and the order&apos;s stock reservation location.
          </p>
          {!confirmOpen ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
            >
              Record full return &amp; refund
            </Button>
          ) : (
            <div className="ga-ord-payment__refund-form">
              <label className="ga-ord-payment__reason">
                Reason (required)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Customer returned goods · supervisor approved"
                />
              </label>
              <label className="ga-ord-payment__restock">
                <input
                  type="checkbox"
                  checked={restock}
                  onChange={(e) => setRestock(e.target.checked)}
                />
                Restock sale_items to inventory (RETURN movements)
              </label>
              <div className="ga-ord-payment__refund-actions">
                <Button
                  variant="secondary"
                  disabled={refundSale.isPending}
                  onClick={() => {
                    setConfirmOpen(false);
                    setReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    refundSale.isPending || reason.trim().length === 0
                  }
                  onClick={() =>
                    refundSale.mutate(
                      {
                        orderId,
                        reason: reason.trim(),
                        restock,
                      },
                      {
                        onSuccess: (result) => {
                          setConfirmOpen(false);
                          setRefundResultNote(
                            `Refund recorded${
                              result.alreadyRefunded
                                ? ' (already refunded)'
                                : ''
                            }. Restocked items: ${result.restockedItemCount}.`,
                          );
                        },
                      },
                    )
                  }
                >
                  {refundSale.isPending
                    ? 'Recording…'
                    : 'Confirm full refund'}
                </Button>
              </div>
            </div>
          )}
          {refundSale.isError ? (
            <p className="ga-ord-payment__error">
              {(refundSale.error as Error)?.message ??
                'Could not record return/refund'}
            </p>
          ) : null}
          {refundResultNote ? (
            <p className="ga-ord-payment__paid-note">{refundResultNote}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
