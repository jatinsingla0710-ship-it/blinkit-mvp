import {
  ageingBucketLabel,
  daysBetween,
  receivableAgeingBucket,
  summarizeAgeingOutstanding,
  type AgeingTotals,
  type ReceivableAgeingBucket,
} from '@/data/customer-ageing';
import { formatDate, formatDateTime, formatInr } from '@/data/live/format';

/** Order statuses excluded from receivables / ledger sales. */
const EXCLUDED_ORDER_STATUSES = new Set(['CANCELLED']);

export type LedgerOrderInput = {
  id: string;
  shop_id?: string;
  status: string;
  total: number;
  created_at: string;
  order_code?: string;
};

export type LedgerPaymentInput = {
  id?: string;
  order_id: string;
  status: string;
  amount: number;
  cash_collected_amount?: number | null;
  online_collected_amount?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  method_label?: string | null;
};

/** Active customer opening receivable (positive = customer owes). */
export type LedgerOpeningInput = {
  id: string;
  amount: number;
  asOfDate: string;
  note?: string | null;
};

/** Unallocated customer-level collection (not tied to an order). */
export type LedgerShopCollectionInput = {
  id: string;
  amount: number;
  method?: string | null;
  note?: string | null;
  atIso: string;
};

export type CustomerLedgerExtras = {
  opening?: LedgerOpeningInput | null;
  shopCollections?: readonly LedgerShopCollectionInput[];
};

export type CustomerLedgerEntryType =
  | 'sale'
  | 'payment'
  | 'opening'
  | 'collection';

export type CustomerLedgerEntry = {
  id: string;
  atIso: string;
  atLabel: string;
  type: CustomerLedgerEntryType;
  typeLabel: string;
  reference: string;
  referenceHref: string;
  debit: number;
  credit: number;
  debitLabel: string;
  creditLabel: string;
  balance: number;
  balanceLabel: string;
  /** Deep-link to record/verify collection on the related order. */
  collectHref: string | null;
};

export type CustomerLedgerVm = {
  outstanding: number;
  outstandingLabel: string;
  totalSales: number;
  totalSalesLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  lastTransactionAtLabel: string | null;
  entries: CustomerLedgerEntry[];
  /** First open order with residual — primary collect action. */
  collectHref: string | null;
};

export type ReceivableRow = {
  customerId: string;
  shopName: string;
  phoneLabel: string;
  areaLabel: string;
  totalSales: number;
  totalSalesLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  outstanding: number;
  outstandingLabel: string;
  lastPaymentAtLabel: string | null;
  /** Days since oldest open order; null when paid up. */
  oldestOpenDays: number | null;
  ageingBucket: ReceivableAgeingBucket;
  ageingLabel: string;
  ledgerHref: string;
  collectHref: string | null;
};

export type ReceivablesSnapshot = {
  generatedAtLabel: string;
  rows: ReceivableRow[];
  totalOutstanding: number;
  totalOutstandingLabel: string;
  ageingTotals: AgeingTotals;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function isLedgerEligibleOrder(status: string): boolean {
  return !EXCLUDED_ORDER_STATUSES.has(status.toUpperCase());
}

/**
 * Residual still owed on one order — same rule as OFD unpaid residual:
 * PAID → 0; REFUNDED payment → 0; else max(0, total − cash − online).
 * No payment row → full order total (still eligible).
 */
export function orderOutstandingResidual(
  order: Pick<LedgerOrderInput, 'status' | 'total'>,
  payment?: Pick<
    LedgerPaymentInput,
    'status' | 'cash_collected_amount' | 'online_collected_amount'
  > | null,
): number {
  if (!isLedgerEligibleOrder(order.status)) return 0;
  if (!payment) return Math.max(roundMoney(order.total), 0);

  const payStatus = payment.status.toUpperCase();
  if (payStatus === 'PAID' || payStatus === 'REFUNDED') return 0;

  const cash = Number(payment.cash_collected_amount ?? 0) || 0;
  const online = Number(payment.online_collected_amount ?? 0) || 0;
  return Math.max(roundMoney(order.total - cash - online), 0);
}

/** Amount credited toward the customer for a payment row. */
export function paymentCollectedAmount(
  payment: Pick<
    LedgerPaymentInput,
    'status' | 'amount' | 'cash_collected_amount' | 'online_collected_amount'
  >,
): number {
  const status = payment.status.toUpperCase();
  if (status === 'REFUNDED') return 0;

  const cash = Number(payment.cash_collected_amount ?? 0) || 0;
  const online = Number(payment.online_collected_amount ?? 0) || 0;
  const split = roundMoney(cash + online);
  if (split > 0) return split;

  if (status === 'PAID') return Math.max(roundMoney(payment.amount), 0);
  return 0;
}

export function customerOutstandingTotal(
  orders: readonly LedgerOrderInput[],
  payments: readonly LedgerPaymentInput[],
  extras?: CustomerLedgerExtras | null,
): number {
  const byOrder = indexPaymentsByOrder(payments);
  let orderDue = 0;
  for (const order of orders) {
    orderDue += orderOutstandingResidual(order, byOrder.get(order.id) ?? null);
  }
  const opening = Math.max(0, Number(extras?.opening?.amount) || 0);
  const collections = roundMoney(
    (extras?.shopCollections ?? []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0,
    ),
  );
  return roundMoney(Math.max(0, opening + orderDue - collections));
}

export function customerSalesTotal(
  orders: readonly LedgerOrderInput[],
): number {
  return roundMoney(
    orders
      .filter((o) => isLedgerEligibleOrder(o.status))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
  );
}

export function customerPaidTotal(
  orders: readonly LedgerOrderInput[],
  payments: readonly LedgerPaymentInput[],
  extras?: CustomerLedgerExtras | null,
): number {
  const eligible = new Set(
    orders.filter((o) => isLedgerEligibleOrder(o.status)).map((o) => o.id),
  );
  const orderPaid = payments
    .filter((p) => eligible.has(p.order_id))
    .reduce((sum, p) => sum + paymentCollectedAmount(p), 0);
  const shopPaid = (extras?.shopCollections ?? []).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );
  return roundMoney(orderPaid + shopPaid);
}

function indexPaymentsByOrder(
  payments: readonly LedgerPaymentInput[],
): Map<string, LedgerPaymentInput> {
  const map = new Map<string, LedgerPaymentInput>();
  for (const payment of payments) {
    // One payment per order (UNIQUE order_id). Keep latest if duplicates appear.
    const existing = map.get(payment.order_id);
    if (!existing) {
      map.set(payment.order_id, payment);
      continue;
    }
    const existingAt = Date.parse(
      existing.paid_at || existing.created_at || '',
    );
    const nextAt = Date.parse(payment.paid_at || payment.created_at || '');
    if (
      Number.isNaN(existingAt) ||
      (!Number.isNaN(nextAt) && nextAt >= existingAt)
    ) {
      map.set(payment.order_id, payment);
    }
  }
  return map;
}

function orderCodeOf(order: LedgerOrderInput): string {
  if (order.order_code) return order.order_code;
  const hex = order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `GA-${hex}`;
}

/**
 * Chronological customer ledger from opening + orders + payments + shop collections.
 * Outstanding = opening + order residuals − unallocated shop collections.
 */
export function buildCustomerLedger(input: {
  orders: readonly LedgerOrderInput[];
  payments: readonly LedgerPaymentInput[];
  opening?: LedgerOpeningInput | null;
  shopCollections?: readonly LedgerShopCollectionInput[];
  /** Used for opening/collection deep-links when no order carries shop_id. */
  shopId?: string | null;
}): CustomerLedgerVm {
  const extras: CustomerLedgerExtras = {
    opening: input.opening ?? null,
    shopCollections: input.shopCollections ?? [],
  };
  const byOrder = indexPaymentsByOrder(input.payments);
  const eligibleOrders = input.orders.filter((o) =>
    isLedgerEligibleOrder(o.status),
  );

  type Raw = {
    id: string;
    atIso: string;
    type: CustomerLedgerEntryType;
    typeLabel: string;
    reference: string;
    referenceHref: string;
    debit: number;
    credit: number;
    collectHref: string | null;
    sortKey: number;
  };

  const raw: Raw[] = [];
  const shopId =
    input.shopId ||
    eligibleOrders.find((o) => o.shop_id)?.shop_id ||
    input.orders.find((o) => o.shop_id)?.shop_id ||
    null;

  if (input.opening && input.opening.amount > 0) {
    const atIso = `${input.opening.asOfDate}T00:00:00.000Z`;
    raw.push({
      id: `opening-${input.opening.id}`,
      atIso,
      type: 'opening',
      typeLabel: 'Opening balance',
      reference: input.opening.note?.trim() || 'Opening',
      referenceHref: shopId ? `/customers/${shopId}#ledger` : '#ledger',
      debit: roundMoney(input.opening.amount),
      credit: 0,
      collectHref: shopId ? `/customers/${shopId}#ledger` : null,
      sortKey: Date.parse(atIso) || 0,
    });
  }

  for (const order of eligibleOrders) {
    const code = orderCodeOf(order);
    const atIso = order.created_at;
    raw.push({
      id: `sale-${order.id}`,
      atIso,
      type: 'sale',
      typeLabel: 'Sale',
      reference: code,
      referenceHref: `/orders/${order.id}`,
      debit: roundMoney(order.total),
      credit: 0,
      collectHref:
        orderOutstandingResidual(order, byOrder.get(order.id) ?? null) > 0
          ? `/orders/${order.id}`
          : null,
      sortKey: Date.parse(atIso) || 0,
    });
  }

  for (const payment of input.payments) {
    const order = eligibleOrders.find((o) => o.id === payment.order_id);
    if (!order) continue;
    const credit = paymentCollectedAmount(payment);
    if (credit <= 0) continue;
    const atIso =
      payment.paid_at || payment.created_at || order.created_at;
    const code = orderCodeOf(order);
    const method = payment.method_label?.trim();
    raw.push({
      id: `pay-${payment.id ?? payment.order_id}`,
      atIso,
      type: 'payment',
      typeLabel: method ? `Payment · ${method}` : 'Payment received',
      reference: code,
      referenceHref: `/orders/${order.id}`,
      debit: 0,
      credit,
      collectHref: null,
      sortKey: (Date.parse(atIso) || 0) + 1,
    });
  }

  for (const collection of extras.shopCollections ?? []) {
    if (!(collection.amount > 0)) continue;
    const method = collection.method?.trim();
    raw.push({
      id: `collect-${collection.id}`,
      atIso: collection.atIso,
      type: 'collection',
      typeLabel: method
        ? `Collection · ${method}`
        : 'Collection received',
      reference: collection.note?.trim() || 'Customer collection',
      referenceHref: shopId ? `/customers/${shopId}#ledger` : '#ledger',
      debit: 0,
      credit: roundMoney(collection.amount),
      collectHref: null,
      sortKey: (Date.parse(collection.atIso) || 0) + 1,
    });
  }

  const typeRank = (type: CustomerLedgerEntryType): number => {
    if (type === 'opening') return 0;
    if (type === 'sale') return 1;
    if (type === 'payment') return 2;
    return 3;
  };

  raw.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.type !== b.type) return typeRank(a.type) - typeRank(b.type);
    return a.id.localeCompare(b.id);
  });

  let balance = 0;
  const entries: CustomerLedgerEntry[] = raw.map((row) => {
    balance = roundMoney(balance + row.debit - row.credit);
    return {
      id: row.id,
      atIso: row.atIso,
      atLabel: formatDateTime(row.atIso),
      type: row.type,
      typeLabel: row.typeLabel,
      reference: row.reference,
      referenceHref: row.referenceHref,
      debit: row.debit,
      credit: row.credit,
      debitLabel: row.debit > 0 ? formatInr(row.debit) : '—',
      creditLabel: row.credit > 0 ? formatInr(row.credit) : '—',
      balance,
      balanceLabel: formatInr(balance),
      collectHref: row.collectHref,
    };
  });

  const outstanding = customerOutstandingTotal(
    input.orders,
    input.payments,
    extras,
  );
  const totalSales = customerSalesTotal(input.orders);
  const totalPaid = customerPaidTotal(input.orders, input.payments, extras);
  const last = entries.length ? entries[entries.length - 1]! : null;

  const firstOpen = eligibleOrders
    .map((order) => ({
      order,
      residual: orderOutstandingResidual(order, byOrder.get(order.id) ?? null),
    }))
    .filter((row) => row.residual > 0)
    .sort(
      (a, b) =>
        Date.parse(a.order.created_at) - Date.parse(b.order.created_at),
    )[0];

  return {
    outstanding,
    outstandingLabel: formatInr(outstanding),
    totalSales,
    totalSalesLabel: formatInr(totalSales),
    totalPaid,
    totalPaidLabel: formatInr(totalPaid),
    lastTransactionAtLabel: last ? formatDate(last.atIso) : null,
    entries: [...entries].reverse(),
    collectHref: firstOpen
      ? `/orders/${firstOpen.order.id}`
      : outstanding > 0 && shopId
        ? `/customers/${shopId}#ledger`
        : null,
  };
}

/** Oldest unpaid order / opening age in calendar days (null when nothing due). */
export function oldestOpenReceivableDays(
  orders: readonly LedgerOrderInput[],
  payments: readonly LedgerPaymentInput[],
  asOfIso: string = new Date().toISOString(),
  extras?: CustomerLedgerExtras | null,
): number | null {
  const outstanding = customerOutstandingTotal(orders, payments, extras);
  if (outstanding <= 0) return null;

  const byOrder = indexPaymentsByOrder(payments);
  let oldestIso: string | null = null;
  for (const order of orders) {
    const residual = orderOutstandingResidual(
      order,
      byOrder.get(order.id) ?? null,
    );
    if (residual <= 0) continue;
    if (
      !oldestIso ||
      Date.parse(order.created_at) < Date.parse(oldestIso)
    ) {
      oldestIso = order.created_at;
    }
  }

  const opening = extras?.opening;
  if (opening && opening.amount > 0) {
    const openingIso = `${opening.asOfDate}T00:00:00.000Z`;
    if (!oldestIso || Date.parse(openingIso) < Date.parse(oldestIso)) {
      oldestIso = openingIso;
    }
  }

  if (!oldestIso) return null;
  return daysBetween(oldestIso, asOfIso);
}

export function buildReceivableRow(input: {
  customerId: string;
  shopName: string;
  phoneLabel: string;
  areaLabel: string;
  orders: readonly LedgerOrderInput[];
  payments: readonly LedgerPaymentInput[];
  opening?: LedgerOpeningInput | null;
  shopCollections?: readonly LedgerShopCollectionInput[];
  asOfIso?: string;
}): ReceivableRow {
  const asOfIso = input.asOfIso ?? new Date().toISOString();
  const extras: CustomerLedgerExtras = {
    opening: input.opening ?? null,
    shopCollections: input.shopCollections ?? [],
  };
  const ledger = buildCustomerLedger({
    orders: input.orders,
    payments: input.payments,
    opening: extras.opening,
    shopCollections: extras.shopCollections,
    shopId: input.customerId,
  });
  const lastOrderPayment = [...input.payments]
    .filter((p) => paymentCollectedAmount(p) > 0)
    .map((p) => ({
      at: p.paid_at || p.created_at || '',
    }));
  const lastShopPayment = (extras.shopCollections ?? []).map((c) => ({
    at: c.atIso,
  }));
  const lastPayment = [...lastOrderPayment, ...lastShopPayment].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  )[0];
  const oldestOpenDays = oldestOpenReceivableDays(
    input.orders,
    input.payments,
    asOfIso,
    extras,
  );
  const ageingBucket = receivableAgeingBucket(
    oldestOpenDays,
    ledger.outstanding,
  );

  return {
    customerId: input.customerId,
    shopName: input.shopName,
    phoneLabel: input.phoneLabel,
    areaLabel: input.areaLabel,
    totalSales: ledger.totalSales,
    totalSalesLabel: ledger.totalSalesLabel,
    totalPaid: ledger.totalPaid,
    totalPaidLabel: ledger.totalPaidLabel,
    outstanding: ledger.outstanding,
    outstandingLabel: ledger.outstandingLabel,
    lastPaymentAtLabel: lastPayment?.at ? formatDate(lastPayment.at) : null,
    oldestOpenDays,
    ageingBucket,
    ageingLabel: ageingBucketLabel(ageingBucket),
    ledgerHref: `/customers/${input.customerId}#ledger`,
    collectHref: ledger.collectHref,
  };
}

export function buildReceivablesSnapshot(input: {
  generatedAtIso: string;
  customers: readonly {
    customerId: string;
    shopName: string;
    phoneLabel: string;
    areaLabel: string;
    orders: readonly LedgerOrderInput[];
    payments: readonly LedgerPaymentInput[];
    opening?: LedgerOpeningInput | null;
    shopCollections?: readonly LedgerShopCollectionInput[];
  }[];
}): ReceivablesSnapshot {
  const rows = input.customers
    .map((customer) =>
      buildReceivableRow({ ...customer, asOfIso: input.generatedAtIso }),
    )
    .filter((row) => row.totalSales > 0 || row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.shopName.localeCompare(b.shopName));

  const totalOutstanding = roundMoney(
    rows.reduce((sum, row) => sum + row.outstanding, 0),
  );

  return {
    generatedAtLabel: formatDateTime(input.generatedAtIso),
    rows,
    totalOutstanding,
    totalOutstandingLabel: formatInr(totalOutstanding),
    ageingTotals: summarizeAgeingOutstanding(rows),
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Printable / downloadable customer account statement from the derived ledger. */
export function exportCustomerStatementCsv(input: {
  shopName: string;
  phoneLabel?: string | null;
  generatedAtIso: string;
  ledger: CustomerLedgerVm;
}): string {
  const header = [
    'Date',
    'Type',
    'Reference',
    'Debit',
    'Credit',
    'Balance',
  ];
  // Entries are newest-first in the VM; reverse for chronological statement.
  const chronological = [...input.ledger.entries].reverse();
  const lines = chronological.map((row) =>
    [
      csvEscape(row.atLabel),
      csvEscape(row.typeLabel),
      csvEscape(row.reference),
      String(row.debit),
      String(row.credit),
      String(row.balance),
    ].join(','),
  );
  const meta = [
    `Customer,${csvEscape(input.shopName)}`,
    input.phoneLabel
      ? `Phone,${csvEscape(input.phoneLabel)}`
      : null,
    `Generated,${csvEscape(formatDateTime(input.generatedAtIso))}`,
    `Outstanding,${String(input.ledger.outstanding)}`,
    `Sales,${String(input.ledger.totalSales)}`,
    `Paid,${String(input.ledger.totalPaid)}`,
    '',
  ].filter((line): line is string => line != null);

  return [...meta, header.join(','), ...lines].join('\n');
}

export function filterReceivableRows(
  rows: readonly ReceivableRow[],
  search: string,
  filter: 'all' | 'outstanding' | 'paid',
): ReceivableRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'outstanding' && row.outstanding <= 0) return false;
    if (filter === 'paid' && row.outstanding > 0) return false;
    if (!q) return true;
    return (
      row.shopName.toLowerCase().includes(q) ||
      row.phoneLabel.toLowerCase().includes(q) ||
      row.areaLabel.toLowerCase().includes(q)
    );
  });
}
