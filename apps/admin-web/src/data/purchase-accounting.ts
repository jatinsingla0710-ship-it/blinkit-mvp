/**
 * Phase 3 — purchase accounting composition.
 * Received inventory purchases increase stock and supplier payable.
 * They are NOT company expenses. Payments settle the payable later.
 */

import { formatInr } from '@/data/live/format';

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
  status: 'DRAFT' | 'RECEIVED' | 'CANCELLED' | string;
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
  payableIncrease: number;
  payableIncreaseLabel: string;
  paidAgainstBill: number;
  paidAgainstBillLabel: string;
  remainingOnBill: number;
  remainingOnBillLabel: string;
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
 * Payable uses bill total (subtotal + tax). Inventory cost uses item line totals
 * (tax is kept on the payable side until a GST engine exists).
 */
export function buildPurchaseAccounting(input: {
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: readonly PurchaseAccountingItemInput[];
  payments?: readonly PurchaseAccountingPaymentInput[];
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
  const payableIncrease =
    status === 'RECEIVED' ? roundMoney(input.total) : 0;
  const paidAgainstBill = roundMoney(
    (input.payments ?? []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    ),
  );
  const remainingOnBill =
    status === 'RECEIVED'
      ? roundMoney(Math.max(payableIncrease - paidAgainstBill, 0))
      : 0;

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
  } else if (status === 'RECEIVED') {
    effects.push({
      id: 'inventory',
      label: 'Inventory increased',
      detail: `${inventoryQuantity} pack(s) received · stock cost ${money(inventoryCost)}`,
      tone: 'positive',
    });
    effects.push({
      id: 'payable',
      label: 'Supplier payable increased',
      detail: `You now owe ${money(payableIncrease)} on this bill (includes tax ${money(taxAmount)}).`,
      tone: 'warning',
    });
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
        detail: `${money(paidAgainstBill)} paid against this bill · remaining ${money(remainingOnBill)}.`,
        tone: remainingOnBill > 0 ? 'warning' : 'positive',
      });
    }
  }

  const ownerSummary =
    status === 'RECEIVED'
      ? remainingOnBill > 0
        ? `Stock received. You still need to pay ${money(remainingOnBill)} on this bill.`
        : paidAgainstBill > 0
          ? 'Stock received and this bill is fully paid.'
          : `Stock received. Payable of ${money(payableIncrease)} is open until you record a payment.`
      : status === 'DRAFT'
        ? 'Receive this bill to increase stock and supplier dues.'
        : 'This purchase does not affect accounting.';

  return {
    status,
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
    payableIncrease,
    payableIncreaseLabel: money(payableIncrease),
    paidAgainstBill,
    paidAgainstBillLabel: money(paidAgainstBill),
    remainingOnBill,
    remainingOnBillLabel: money(remainingOnBill),
    effects,
    ownerSummary,
  };
}
