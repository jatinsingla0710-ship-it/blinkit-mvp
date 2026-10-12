/**
 * Phase 3 / 6B.2D — purchase accounting composition.
 * Payable basis follows receipt/return events (or legacy full bill).
 * purchases.total remains the original bill total.
 * Overpayment / return-after-pay surfaces as supplier credit on the bill.
 */

import { formatInr } from '@/data/live/format';
import { computePurchasePayableAmounts } from '@/data/purchase-payable';

export type PurchaseAccountingItemInput = {
  quantity: number;
  unitCost: number;
  lineTotal: number;
};

export type PurchaseAccountingPaymentInput = {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethodLabel: string;
  referenceNumber?: string | null;
};

export type PurchaseAccountingVm = {
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED' | 'PARTIALLY_RECEIVED' | string;
  path: 'none' | 'legacy' | 'receipt_events';
  isInventoryPurchase: true;
  isExpense: false;
  inventoryQuantity: number;
  inventoryQuantityLabel: string;
  inventoryCost: number;
  inventoryCostLabel: string;
  subtotal: number;
  subtotalLabel: string;
  taxAmount: number;
  taxAmountLabel: string;
  /** Original bill total — never shrunk for partial receipts. */
  billTotal: number;
  billTotalLabel: string;
  receiptTotal: number;
  receiptTotalLabel: string;
  returnTotal: number;
  returnTotalLabel: string;
  payableIncrease: number;
  payableIncreaseLabel: string;
  paidAgainstBill: number;
  paidAgainstBillLabel: string;
  /** Signed remaining; negative = supplier credit on this bill. */
  remainingOnBill: number;
  remainingOnBillLabel: string;
  creditOnBill: number;
  creditOnBillLabel: string;
  effects: Array<{
    id: string;
    label: string;
    detail: string;
    tone: 'info' | 'warning' | 'positive';
  }>;
  ownerSummary: string;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function money(value: number): string {
  return formatInr(roundMoney(value));
}

/**
 * Build honest accounting effects for one purchase bill.
 */
export function buildPurchaseAccounting(input: {
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: readonly PurchaseAccountingItemInput[];
  payments?: readonly PurchaseAccountingPaymentInput[];
  receiptTotal?: number | null;
  returnTotal?: number | null;
  hasReceiptEvents?: boolean;
}): PurchaseAccountingVm {
  const status = input.status.toUpperCase();
  const inventoryQuantity = roundMoney(
    input.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  );
  const inventoryCost = roundMoney(
    input.items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0),
  );
  const subtotal = roundMoney(input.subtotal);
  const taxAmount = roundMoney(input.taxAmount);
  const billTotal = roundMoney(input.total);
  const paidAgainstBill = roundMoney(
    (input.payments ?? []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    ),
  );

  const amounts = computePurchasePayableAmounts({
    status,
    billTotal,
    receiptTotal: input.receiptTotal,
    returnTotal: input.returnTotal,
    hasReceiptEvents: input.hasReceiptEvents,
    linkedPayments: paidAgainstBill,
  });

  const payableIncrease = amounts.payableBasis;
  const remainingOnBill = amounts.remaining;
  const creditOnBill = amounts.creditOnBill;

  const effects: PurchaseAccountingVm['effects'] = [];
  if (status === 'DRAFT') {
    effects.push({
      id: 'draft',
      label: 'Draft bill',
      detail: 'No stock or payable change until you receive this purchase.',
      tone: 'info',
    });
  } else if (status === 'CANCELLED') {
    effects.push({
      id: 'cancelled',
      label: 'Cancelled',
      detail: 'Cancelled purchases do not change stock or supplier dues.',
      tone: 'warning',
    });
  } else if (
    status === 'RECEIVED' ||
    status === 'PARTIALLY_RECEIVED'
  ) {
    effects.push({
      id: 'inventory',
      label:
        status === 'PARTIALLY_RECEIVED'
          ? 'Inventory partially received'
          : 'Inventory increased',
      detail: `${inventoryQuantity} pack(s) on bill · stock cost ${money(inventoryCost)}`,
      tone: 'positive',
    });
    if (payableIncrease > 0) {
      effects.push({
        id: 'payable',
        label: 'Supplier payable increased',
        detail:
          amounts.path === 'receipt_events'
            ? `Payable on received value ${money(payableIncrease)} (bill total ${money(billTotal)} unchanged).`
            : `You now owe ${money(payableIncrease)} on this bill (includes tax ${money(taxAmount)}).`,
        tone: 'warning',
      });
    }
    if (amounts.returnTotal > 0) {
      effects.push({
        id: 'returns',
        label: 'Supplier returns recorded',
        detail: `${money(amounts.returnTotal)} returned · reduces payable on this bill.`,
        tone: 'info',
      });
    }
    effects.push({
      id: 'not_expense',
      label: 'Not an expense',
      detail:
        'Inventory purchases are stock you own, not Day Book expenses. Expense happens later when goods are sold (COGS).',
      tone: 'info',
    });
    if (paidAgainstBill > 0) {
      effects.push({
        id: 'payments',
        label: 'Payments recorded',
        detail:
          creditOnBill > 0
            ? `${money(paidAgainstBill)} paid against this bill · supplier credit ${money(creditOnBill)}.`
            : `${money(paidAgainstBill)} paid against this bill · remaining ${money(Math.max(remainingOnBill, 0))}.`,
        tone:
          remainingOnBill > 0
            ? 'warning'
            : creditOnBill > 0
              ? 'info'
              : 'positive',
      });
    } else if (creditOnBill > 0) {
      effects.push({
        id: 'credit',
        label: 'Supplier credit',
        detail: `Returns/payments leave a ${money(creditOnBill)} credit on this bill (no cash refund invented).`,
        tone: 'info',
      });
    }
  }

  let ownerSummary = 'This purchase does not affect accounting.';
  if (status === 'DRAFT') {
    ownerSummary = 'Receive this bill to increase stock and supplier dues.';
  } else if (status === 'CANCELLED') {
    ownerSummary = 'This purchase does not affect accounting.';
  } else if (creditOnBill > 0) {
    ownerSummary = `Supplier credit of ${money(creditOnBill)} on this bill (overpayment or return after payment).`;
  } else if (remainingOnBill > 0) {
    ownerSummary = `You still need to pay ${money(remainingOnBill)} on received value for this bill.`;
  } else if (payableIncrease > 0 && paidAgainstBill > 0) {
    ownerSummary = 'Received value on this bill is fully paid.';
  } else if (payableIncrease > 0) {
    ownerSummary = `Payable of ${money(payableIncrease)} is open until you record a payment.`;
  } else if (status === 'PARTIALLY_RECEIVED' || status === 'RECEIVED') {
    ownerSummary = 'No payable remains on received value for this bill.';
  }

  return {
    status,
    path: amounts.path,
    isInventoryPurchase: true,
    isExpense: false,
    inventoryQuantity,
    inventoryQuantityLabel: String(inventoryQuantity),
    inventoryCost,
    inventoryCostLabel: money(inventoryCost),
    subtotal,
    subtotalLabel: money(subtotal),
    taxAmount,
    taxAmountLabel: money(taxAmount),
    billTotal,
    billTotalLabel: money(billTotal),
    receiptTotal: amounts.receiptTotal,
    receiptTotalLabel: money(amounts.receiptTotal),
    returnTotal: amounts.returnTotal,
    returnTotalLabel: money(amounts.returnTotal),
    payableIncrease,
    payableIncreaseLabel: money(payableIncrease),
    paidAgainstBill,
    paidAgainstBillLabel: money(paidAgainstBill),
    remainingOnBill,
    remainingOnBillLabel: money(remainingOnBill),
    creditOnBill,
    creditOnBillLabel: money(creditOnBill),
    effects,
    ownerSummary,
  };
}
