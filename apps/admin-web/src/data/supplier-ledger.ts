/**
 * Phase 2 / 6B.2D — supplier payables ledger.
 * Payable basis: receipt totals − returns (new path), or legacy bill total.
 * Payments (linked or supplier-level) decrease the running balance.
 * Negative outstanding = supplier credit / advance — never invent a cash refund.
 */

import {
  ageingBucketLabel,
  daysBetween,
  receivableAgeingBucket,
  type ReceivableAgeingBucket,
} from '@/data/customer-ageing';
import { formatDate, formatInr } from '@/data/live/format';
import {
  computePurchasePayableAmounts,
  isPayablePurchaseStatus,
} from '@/data/purchase-payable';

export type SupplierPaymentMethod = 'CASH' | 'BANK' | 'UPI' | 'OTHER';

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<
  SupplierPaymentMethod,
  string
> = {
  CASH: 'Cash',
  BANK: 'Bank',
  UPI: 'UPI',
  OTHER: 'Other',
};

export type SupplierPurchaseLedgerInput = {
  id: string;
  supplierId: string;
  billNumber: string;
  status: string;
  /** Original bill total — never shrunk for partial receipts. */
  total: number;
  purchaseDate: string;
  receivedAt?: string | null;
  firstReceivedAt?: string | null;
  /** Sum of purchase_receipts.total_amount when receipt events exist. */
  receiptTotal?: number | null;
  /** Sum of purchase_returns.total_amount. */
  returnTotal?: number | null;
  hasReceiptEvents?: boolean;
};

export type SupplierPaymentJournalSync = {
  /** synced = journals written/confirmed for payment date; pending = payment saved, books lag */
  status: 'synced' | 'pending';
  posted?: number;
  skipped?: number;
  error?: string;
};

export type SupplierPaymentLedgerInput = {
  id: string;
  supplierId: string;
  purchaseId?: string | null;
  paymentDate: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod | string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  /**
   * Best-effort journal sync after recording the payment.
   * Domain payment always commits; journals use admin_sync (idempotent by source_id).
   */
  journalSync?: SupplierPaymentJournalSync;
};

export type SupplierLedgerEntryType = 'purchase' | 'payment' | 'return';

export type SupplierLedgerEntry = {
  id: string;
  atIso: string;
  atLabel: string;
  type: SupplierLedgerEntryType;
  typeLabel: string;
  reference: string;
  referenceHref: string | null;
  debit: number;
  credit: number;
  debitLabel: string;
  creditLabel: string;
  balance: number;
  balanceLabel: string;
  paymentMethodLabel?: string | null;
};

export type SupplierLedgerVm = {
  payable: number;
  payableLabel: string;
  totalPurchases: number;
  totalPurchasesLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  /** Running balance; negative means supplier credit. */
  outstanding: number;
  outstandingLabel: string;
  /** Explicit credit when outstanding < 0. */
  supplierCredit: number;
  supplierCreditLabel: string;
  lastPaymentAtLabel: string | null;
  entries: SupplierLedgerEntry[];
  payHref: string;
};

export type SupplierPayableRow = {
  supplierId: string;
  supplierName: string;
  contactLabel: string;
  mobileLabel: string | null;
  totalPurchases: number;
  totalPurchasesLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  outstanding: number;
  outstandingLabel: string;
  supplierCredit: number;
  supplierCreditLabel: string;
  lastPaymentAtLabel: string | null;
  /** Days since oldest open bill while still owed; null when paid up / in credit. */
  oldestOpenDays: number | null;
  ageingBucket: ReceivableAgeingBucket;
  ageingLabel: string;
  ledgerHref: string;
  payHref: string;
};

export type SupplierPayablesSnapshot = {
  generatedAtLabel: string;
  rows: SupplierPayableRow[];
  totalOutstanding: number;
  totalOutstandingLabel: string;
  totalSupplierCredit: number;
  totalSupplierCreditLabel: string;
  suppliersWithDues: number;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function moneyLabel(value: number): string {
  return formatInr(roundMoney(value));
}

function atIsoFromDate(date: string, fallbackIso?: string | null): string {
  if (fallbackIso) return fallbackIso;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T12:00:00+05:30`;
  return date;
}

/** @deprecated Prefer isPayablePurchaseStatus + payable basis. */
export function isPayablePurchase(status: string): boolean {
  return isPayablePurchaseStatus(status);
}

/**
 * Proxy age for supplier dues: calendar days since the oldest bill with a
 * positive payable basis while outstanding remains.
 */
export function oldestOpenPayableDays(
  purchases: readonly SupplierPurchaseLedgerInput[],
  outstanding: number,
  asOfIso: string,
): number | null {
  if (outstanding <= 0) return null;
  let oldestIso: string | null = null;
  for (const purchase of purchases) {
    const amounts = computePurchasePayableAmounts({
      status: purchase.status,
      billTotal: purchase.total,
      receiptTotal: purchase.receiptTotal,
      returnTotal: purchase.returnTotal,
      hasReceiptEvents: purchase.hasReceiptEvents,
    });
    if (amounts.payableBasis <= 0) continue;
    const iso = atIsoFromDate(
      purchase.purchaseDate,
      purchase.firstReceivedAt ?? purchase.receivedAt,
    );
    if (!oldestIso || Date.parse(iso) < Date.parse(oldestIso)) {
      oldestIso = iso;
    }
  }
  if (!oldestIso) return null;
  return daysBetween(oldestIso, asOfIso);
}

export function mapSupplierPaymentMethod(
  raw: string | null | undefined,
): SupplierPaymentMethod {
  const key = String(raw ?? 'CASH').toUpperCase();
  if (key === 'BANK' || key === 'UPI' || key === 'OTHER') return key;
  return 'CASH';
}

export function buildSupplierLedger(input: {
  supplierId: string;
  purchases: readonly SupplierPurchaseLedgerInput[];
  payments: readonly SupplierPaymentLedgerInput[];
}): SupplierLedgerVm {
  const events: Array<{
    id: string;
    atIso: string;
    sortKey: number;
    type: SupplierLedgerEntryType;
    reference: string;
    referenceHref: string | null;
    debit: number;
    credit: number;
    paymentMethodLabel?: string | null;
  }> = [];

  for (const purchase of input.purchases) {
    if (purchase.supplierId !== input.supplierId) continue;
    const amounts = computePurchasePayableAmounts({
      status: purchase.status,
      billTotal: purchase.total,
      receiptTotal: purchase.receiptTotal,
      returnTotal: purchase.returnTotal,
      hasReceiptEvents: purchase.hasReceiptEvents,
    });

    if (amounts.path === 'receipt_events') {
      if (amounts.receiptTotal > 0) {
        const atIso = atIsoFromDate(
          purchase.purchaseDate,
          purchase.firstReceivedAt ?? purchase.receivedAt ?? null,
        );
        events.push({
          id: `purchase-${purchase.id}`,
          atIso,
          sortKey: Date.parse(atIso) || 0,
          type: 'purchase',
          reference: purchase.billNumber,
          referenceHref: `/purchases/${purchase.id}`,
          debit: amounts.receiptTotal,
          credit: 0,
        });
      }
      if (amounts.returnTotal > 0) {
        const atIso = atIsoFromDate(
          purchase.purchaseDate,
          purchase.receivedAt ?? purchase.firstReceivedAt ?? null,
        );
        events.push({
          id: `return-${purchase.id}`,
          atIso,
          sortKey: (Date.parse(atIso) || 0) + 1,
          type: 'return',
          reference: `${purchase.billNumber} · return`,
          referenceHref: `/purchases/${purchase.id}`,
          debit: 0,
          credit: amounts.returnTotal,
        });
      }
      continue;
    }

    if (amounts.path === 'legacy' && amounts.payableBasis > 0) {
      const atIso = atIsoFromDate(
        purchase.purchaseDate,
        purchase.receivedAt ?? null,
      );
      events.push({
        id: `purchase-${purchase.id}`,
        atIso,
        sortKey: Date.parse(atIso) || 0,
        type: 'purchase',
        reference: purchase.billNumber,
        referenceHref: `/purchases/${purchase.id}`,
        debit: amounts.payableBasis,
        credit: 0,
      });
    }
  }

  for (const payment of input.payments) {
    if (payment.supplierId !== input.supplierId) continue;
    const atIso = atIsoFromDate(
      payment.paymentDate,
      payment.createdAt ?? null,
    );
    const method = mapSupplierPaymentMethod(payment.paymentMethod);
    events.push({
      id: `payment-${payment.id}`,
      atIso,
      sortKey: Date.parse(atIso) || 0,
      type: 'payment',
      reference:
        payment.referenceNumber?.trim() ||
        (payment.purchaseId ? 'Bill payment' : 'Supplier payment'),
      referenceHref: payment.purchaseId
        ? `/purchases/${payment.purchaseId}`
        : null,
      debit: 0,
      credit: roundMoney(payment.amount),
      paymentMethodLabel: SUPPLIER_PAYMENT_METHOD_LABELS[method],
    });
  }

  events.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.id.localeCompare(b.id);
  });

  let running = 0;
  let totalPurchases = 0;
  let totalPaid = 0;
  let lastPaymentAtLabel: string | null = null;

  const typeLabel = (type: SupplierLedgerEntryType): string => {
    if (type === 'payment') return 'Payment';
    if (type === 'return') return 'Return';
    return 'Purchase';
  };

  const entries: SupplierLedgerEntry[] = events.map((event) => {
    running = roundMoney(running + event.debit - event.credit);
    if (event.type === 'purchase') {
      totalPurchases = roundMoney(totalPurchases + event.debit);
    }
    if (event.type === 'payment') {
      totalPaid = roundMoney(totalPaid + event.credit);
      lastPaymentAtLabel = formatDate(event.atIso);
    }
    return {
      id: event.id,
      atIso: event.atIso,
      atLabel: formatDate(event.atIso),
      type: event.type,
      typeLabel: typeLabel(event.type),
      reference: event.reference,
      referenceHref: event.referenceHref,
      debit: event.debit,
      credit: event.credit,
      debitLabel: event.debit > 0 ? moneyLabel(event.debit) : '—',
      creditLabel: event.credit > 0 ? moneyLabel(event.credit) : '—',
      balance: running,
      balanceLabel: moneyLabel(running),
      paymentMethodLabel: event.paymentMethodLabel ?? null,
    };
  });

  const outstanding = running;
  const supplierCredit = roundMoney(Math.max(0, -outstanding));
  return {
    payable: outstanding,
    payableLabel: moneyLabel(outstanding),
    totalPurchases,
    totalPurchasesLabel: moneyLabel(totalPurchases),
    totalPaid,
    totalPaidLabel: moneyLabel(totalPaid),
    outstanding,
    outstandingLabel: moneyLabel(outstanding),
    supplierCredit,
    supplierCreditLabel: moneyLabel(supplierCredit),
    lastPaymentAtLabel,
    entries: [...entries].reverse(),
    payHref: `/suppliers/${input.supplierId}?pay=1`,
  };
}

export function buildSupplierPayablesSnapshot(input: {
  generatedAtIso: string;
  suppliers: readonly {
    id: string;
    name: string;
    contactPerson?: string | null;
    mobileLabel?: string | null;
  }[];
  purchases: readonly SupplierPurchaseLedgerInput[];
  payments: readonly SupplierPaymentLedgerInput[];
}): SupplierPayablesSnapshot {
  const purchasesBySupplier = new Map<string, SupplierPurchaseLedgerInput[]>();
  for (const purchase of input.purchases) {
    const list = purchasesBySupplier.get(purchase.supplierId) ?? [];
    list.push(purchase);
    purchasesBySupplier.set(purchase.supplierId, list);
  }
  const paymentsBySupplier = new Map<string, SupplierPaymentLedgerInput[]>();
  for (const payment of input.payments) {
    const list = paymentsBySupplier.get(payment.supplierId) ?? [];
    list.push(payment);
    paymentsBySupplier.set(payment.supplierId, list);
  }

  const asOfIso = input.generatedAtIso;
  const rows: SupplierPayableRow[] = [];
  for (const supplier of input.suppliers) {
    const supplierPurchases = purchasesBySupplier.get(supplier.id) ?? [];
    const ledger = buildSupplierLedger({
      supplierId: supplier.id,
      purchases: supplierPurchases,
      payments: paymentsBySupplier.get(supplier.id) ?? [],
    });
    if (
      ledger.totalPurchases === 0 &&
      ledger.totalPaid === 0 &&
      ledger.supplierCredit === 0 &&
      !ledger.entries.some((e) => e.type === 'return')
    ) {
      continue;
    }
    const oldestOpenDays = oldestOpenPayableDays(
      supplierPurchases,
      ledger.outstanding,
      asOfIso,
    );
    const ageingBucket = receivableAgeingBucket(
      oldestOpenDays,
      ledger.outstanding,
    );
    rows.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      contactLabel: supplier.contactPerson?.trim() || '—',
      mobileLabel: supplier.mobileLabel ?? null,
      totalPurchases: ledger.totalPurchases,
      totalPurchasesLabel: ledger.totalPurchasesLabel,
      totalPaid: ledger.totalPaid,
      totalPaidLabel: ledger.totalPaidLabel,
      outstanding: ledger.outstanding,
      outstandingLabel: ledger.outstandingLabel,
      supplierCredit: ledger.supplierCredit,
      supplierCreditLabel: ledger.supplierCreditLabel,
      lastPaymentAtLabel: ledger.lastPaymentAtLabel,
      oldestOpenDays,
      ageingBucket,
      ageingLabel: ageingBucketLabel(ageingBucket),
      ledgerHref: `/suppliers/${supplier.id}`,
      payHref: ledger.payHref,
    });
  }

  rows.sort((a, b) => {
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
    return a.supplierName.localeCompare(b.supplierName);
  });

  const totalOutstanding = roundMoney(
    rows.reduce((sum, row) => sum + Math.max(row.outstanding, 0), 0),
  );
  const totalSupplierCredit = roundMoney(
    rows.reduce((sum, row) => sum + row.supplierCredit, 0),
  );

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    rows,
    totalOutstanding,
    totalOutstandingLabel: moneyLabel(totalOutstanding),
    totalSupplierCredit,
    totalSupplierCreditLabel: moneyLabel(totalSupplierCredit),
    suppliersWithDues: rows.filter((row) => row.outstanding > 0).length,
  };
}

export function filterPayableRows(
  rows: readonly SupplierPayableRow[],
  search: string,
  due: 'all' | 'outstanding' | 'paid',
): SupplierPayableRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (due === 'outstanding' && row.outstanding <= 0) return false;
    if (due === 'paid' && row.outstanding !== 0) return false;
    if (!needle) return true;
    return [row.supplierName, row.contactLabel, row.mobileLabel ?? '']
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}
