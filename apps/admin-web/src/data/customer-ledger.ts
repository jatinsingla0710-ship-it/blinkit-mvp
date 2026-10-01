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

export type CustomerLedgerEntryType = 'sale' | 'payment';

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
  ledgerHref: string;
  collectHref: string | null;
};

export type ReceivablesSnapshot = {
  generatedAtLabel: string;
  rows: ReceivableRow[];
  totalOutstanding: number;
  totalOutstandingLabel: string;
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
): number {
  const byOrder = indexPaymentsByOrder(payments);
  let total = 0;
  for (const order of orders) {
    total += orderOutstandingResidual(order, byOrder.get(order.id) ?? null);
  }
  return roundMoney(total);
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
): number {
  const eligible = new Set(
    orders.filter((o) => isLedgerEligibleOrder(o.status)).map((o) => o.id),
  );
  return roundMoney(
    payments
      .filter((p) => eligible.has(p.order_id))
      .reduce((sum, p) => sum + paymentCollectedAmount(p), 0),
  );
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
 * Chronological customer ledger from orders + payments (no journal table).
 * Running balance = cumulative sales − cumulative collections.
 */
export function buildCustomerLedger(input: {
  orders: readonly LedgerOrderInput[];
  payments: readonly LedgerPaymentInput[];
}): CustomerLedgerVm {
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

  raw.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.type !== b.type) return a.type === 'sale' ? -1 : 1;
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

  const outstanding = customerOutstandingTotal(input.orders, input.payments);
  const totalSales = customerSalesTotal(input.orders);
  const totalPaid = customerPaidTotal(input.orders, input.payments);
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
    collectHref: firstOpen ? `/orders/${firstOpen.order.id}` : null,
  };
}

export function buildReceivableRow(input: {
  customerId: string;
  shopName: string;
  phoneLabel: string;
  areaLabel: string;
  orders: readonly LedgerOrderInput[];
  payments: readonly LedgerPaymentInput[];
}): ReceivableRow {
  const ledger = buildCustomerLedger({
    orders: input.orders,
    payments: input.payments,
  });
  const lastPayment = [...input.payments]
    .filter((p) => paymentCollectedAmount(p) > 0)
    .sort(
      (a, b) =>
        Date.parse(b.paid_at || b.created_at || '') -
        Date.parse(a.paid_at || a.created_at || ''),
    )[0];

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
    lastPaymentAtLabel: lastPayment
      ? formatDate(lastPayment.paid_at || lastPayment.created_at || null)
      : null,
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
  }[];
}): ReceivablesSnapshot {
  const rows = input.customers
    .map((customer) => buildReceivableRow(customer))
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
  };
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
