import {
  paymentCollectedAmount,
  type LedgerOrderInput,
  type LedgerPaymentInput,
} from '@/data/customer-ledger';
import {
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_PAYMENT_METHOD_LABELS,
  type CompanyExpenseCategory,
  type CompanyExpensePaymentMethod,
  type CompanyExpenseRow,
} from '@/data/company-expenses';
import {
  mapPaidPayrollToDayBookEntries,
  type PayrollDayBookInput,
} from '@/data/salesman-payroll';
import {
  SUPPLIER_PAYMENT_METHOD_LABELS,
  mapSupplierPaymentMethod,
  type SupplierPaymentLedgerInput,
} from '@/data/supplier-ledger';
import { formatDate, formatInr } from '@/data/live/format';

export type DayBookEntryType =
  | 'sale'
  | 'collection'
  | 'expense'
  | 'refund'
  | 'payroll'
  | 'supplier_payment';

export type DayBookPaymentMethodFilter =
  | 'all'
  | 'Cash'
  | 'Bank'
  | 'UPI'
  | 'Other'
  | 'Online'
  | 'Pay on delivery'
  | '—';

export type DayBookEntry = {
  id: string;
  atIso: string;
  dateLabel: string;
  type: DayBookEntryType;
  typeLabel: string;
  description: string;
  partyLabel: string | null;
  moneyIn: number;
  moneyOut: number;
  moneyInLabel: string;
  moneyOutLabel: string;
  paymentMethod: string;
  href: string | null;
  sortKey: number;
};

export type DayBookSnapshot = {
  generatedAtLabel: string;
  dateFrom: string;
  dateTo: string;
  entries: DayBookEntry[];
  moneyIn: number;
  moneyInLabel: string;
  moneyOut: number;
  moneyOutLabel: string;
  net: number;
  netLabel: string;
};

export type DayBookOrderInput = LedgerOrderInput & {
  shop_name?: string | null;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function ymdFromIso(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function orderCode(order: DayBookOrderInput): string {
  if (order.order_code) return order.order_code;
  return `GA-${order.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function moneyLabels(inAmount: number, outAmount: number) {
  return {
    moneyInLabel: inAmount > 0 ? formatInr(inAmount) : '—',
    moneyOutLabel: outAmount > 0 ? formatInr(outAmount) : '—',
  };
}

/**
 * Day Book = actual financial events only.
 * - Sale (PAID): money in once — no separate Collection for the same payment
 * - Collection: partial / pending cash+online collected
 * - Expense: company_expenses money out
 * - Refund: REFUNDED payment money out
 * - Supplier payment: cash/bank paid to suppliers (not inventory expense)
 * Does not invent inventory/commission/visit entries.
 */
export function buildDayBookEntries(input: {
  orders: readonly DayBookOrderInput[];
  payments: readonly LedgerPaymentInput[];
  expenses: readonly CompanyExpenseRow[];
  paidPayroll?: readonly PayrollDayBookInput[];
  supplierPayments?: readonly (SupplierPaymentLedgerInput & {
    supplierName?: string | null;
  })[];
}): DayBookEntry[] {
  const paymentByOrder = new Map<string, LedgerPaymentInput>();
  for (const payment of input.payments) {
    paymentByOrder.set(payment.order_id, payment);
  }

  const entries: DayBookEntry[] = [];

  for (const order of input.orders) {
    if (order.status.toUpperCase() === 'CANCELLED') continue;
    const payment = paymentByOrder.get(order.id) ?? null;
    const shop = order.shop_name?.trim() || 'Customer';
    const code = orderCode(order);
    const payStatus = payment?.status.toUpperCase() ?? '';

    if (payStatus === 'REFUNDED' && payment) {
      const out = Math.max(roundMoney(payment.amount), 0);
      if (out > 0) {
        const atIso =
          payment.paid_at || payment.created_at || order.created_at;
        entries.push({
          id: `refund-${payment.id ?? order.id}`,
          atIso,
          dateLabel: formatDate(atIso),
          type: 'refund',
          typeLabel: 'Refund',
          description: `${code} · ${shop}`,
          partyLabel: shop,
          moneyIn: 0,
          moneyOut: out,
          ...moneyLabels(0, out),
          paymentMethod: payment.method_label?.trim() || '—',
          href: `/orders/${order.id}`,
          sortKey: Date.parse(atIso) || 0,
        });
      }
      continue;
    }

    if (payStatus === 'PAID' && payment) {
      const inAmount = roundMoney(order.total);
      const atIso =
        payment.paid_at || payment.created_at || order.created_at;
      entries.push({
        id: `sale-${order.id}`,
        atIso,
        dateLabel: formatDate(atIso),
        type: 'sale',
        typeLabel: 'Sale',
        description: `${code} · ${shop}`,
        partyLabel: shop,
        moneyIn: inAmount,
        moneyOut: 0,
        ...moneyLabels(inAmount, 0),
        paymentMethod: payment.method_label?.trim() || 'Cash',
        href: `/orders/${order.id}`,
        sortKey: Date.parse(atIso) || 0,
      });
      continue;
    }

    const collected = payment ? paymentCollectedAmount(payment) : 0;
    if (collected > 0 && payment) {
      const atIso =
        payment.paid_at || payment.created_at || order.created_at;
      entries.push({
        id: `collection-${payment.id ?? order.id}`,
        atIso,
        dateLabel: formatDate(atIso),
        type: 'collection',
        typeLabel: 'Collection',
        description: `${code} · ${shop}`,
        partyLabel: shop,
        moneyIn: collected,
        moneyOut: 0,
        ...moneyLabels(collected, 0),
        paymentMethod: payment.method_label?.trim() || '—',
        href: `/orders/${order.id}`,
        sortKey: Date.parse(atIso) || 0,
      });
    }
  }

  for (const expense of input.expenses) {
    const atIso = `${expense.expenseDate}T12:00:00+05:30`;
    entries.push({
      id: `expense-${expense.id}`,
      atIso,
      dateLabel: expense.expenseDateLabel,
      type: 'expense',
      typeLabel: 'Expense',
      description: `${expense.categoryLabel} · ${expense.description}`,
      partyLabel: null,
      moneyIn: 0,
      moneyOut: expense.amount,
      ...moneyLabels(0, expense.amount),
      paymentMethod: expense.paymentMethodLabel,
      href: `/expenses/${expense.id}`,
      sortKey: Date.parse(atIso) || 0,
    });
  }

  for (const payroll of mapPaidPayrollToDayBookEntries(
    input.paidPayroll ?? [],
  )) {
    entries.push({
      id: payroll.id,
      atIso: payroll.atIso,
      dateLabel: formatDate(payroll.atIso),
      type: 'payroll',
      typeLabel: payroll.typeLabel,
      description: payroll.description,
      partyLabel: payroll.partyLabel,
      moneyIn: 0,
      moneyOut: payroll.moneyOut,
      ...moneyLabels(0, payroll.moneyOut),
      paymentMethod: payroll.paymentMethod,
      href: payroll.href,
      sortKey: payroll.sortKey,
    });
  }

  for (const payment of input.supplierPayments ?? []) {
    const atIso = `${payment.paymentDate}T12:00:00+05:30`;
    const method = mapSupplierPaymentMethod(payment.paymentMethod);
    const party = payment.supplierName?.trim() || 'Supplier';
    const amount = roundMoney(payment.amount);
    if (amount <= 0) continue;
    entries.push({
      id: `supplier-payment-${payment.id}`,
      atIso,
      dateLabel: formatDate(atIso),
      type: 'supplier_payment',
      typeLabel: 'Supplier payment',
      description: payment.referenceNumber?.trim()
        ? `${party} · ${payment.referenceNumber.trim()}`
        : `Paid ${party}`,
      partyLabel: party,
      moneyIn: 0,
      moneyOut: amount,
      ...moneyLabels(0, amount),
      paymentMethod: SUPPLIER_PAYMENT_METHOD_LABELS[method],
      href: `/suppliers/${payment.supplierId}`,
      sortKey: Date.parse(atIso) || 0,
    });
  }

  return entries.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return b.sortKey - a.sortKey;
    return a.id.localeCompare(b.id);
  });
}

export function filterDayBookEntries(
  entries: readonly DayBookEntry[],
  opts: {
    dateFrom?: string;
    dateTo?: string;
    type?: DayBookEntryType | 'all';
    paymentMethod?: string;
  },
): DayBookEntry[] {
  const type = opts.type ?? 'all';
  const method = (opts.paymentMethod ?? 'all').trim();
  return entries.filter((entry) => {
    const ymd = ymdFromIso(entry.atIso);
    if (opts.dateFrom && ymd && ymd < opts.dateFrom) return false;
    if (opts.dateTo && ymd && ymd > opts.dateTo) return false;
    if (type !== 'all' && entry.type !== type) return false;
    if (method !== 'all' && entry.paymentMethod !== method) return false;
    return true;
  });
}

export function summarizeDayBook(entries: readonly DayBookEntry[]): {
  moneyIn: number;
  moneyOut: number;
  net: number;
} {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const entry of entries) {
    moneyIn += entry.moneyIn;
    moneyOut += entry.moneyOut;
  }
  return {
    moneyIn: roundMoney(moneyIn),
    moneyOut: roundMoney(moneyOut),
    net: roundMoney(moneyIn - moneyOut),
  };
}

export function buildDayBookSnapshot(input: {
  generatedAtIso: string;
  dateFrom: string;
  dateTo: string;
  orders: readonly DayBookOrderInput[];
  payments: readonly LedgerPaymentInput[];
  expenses: readonly CompanyExpenseRow[];
  paidPayroll?: readonly PayrollDayBookInput[];
  supplierPayments?: readonly (SupplierPaymentLedgerInput & {
    supplierName?: string | null;
  })[];
  type?: DayBookEntryType | 'all';
  paymentMethod?: string;
}): DayBookSnapshot {
  const all = buildDayBookEntries({
    orders: input.orders,
    payments: input.payments,
    expenses: input.expenses,
    paidPayroll: input.paidPayroll,
    supplierPayments: input.supplierPayments,
  });
  const entries = filterDayBookEntries(all, {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    type: input.type,
    paymentMethod: input.paymentMethod,
  });
  const totals = summarizeDayBook(entries);
  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    entries,
    moneyIn: totals.moneyIn,
    moneyInLabel: formatInr(totals.moneyIn),
    moneyOut: totals.moneyOut,
    moneyOutLabel: formatInr(totals.moneyOut),
    net: totals.net,
    netLabel: formatInr(totals.net),
  };
}

export function exportDayBookCsv(entries: readonly DayBookEntry[]): string {
  const header = [
    'Date',
    'Type',
    'Description',
    'Party',
    'Money In',
    'Money Out',
    'Payment Method',
  ];
  const lines = entries.map((row) =>
    [
      row.dateLabel,
      row.typeLabel,
      row.description,
      row.partyLabel ?? '',
      row.moneyIn > 0 ? String(row.moneyIn) : '',
      row.moneyOut > 0 ? String(row.moneyOut) : '',
      row.paymentMethod,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function expenseCategoryLabel(
  category: CompanyExpenseCategory,
): string {
  return COMPANY_EXPENSE_CATEGORY_LABELS[category];
}

export function expensePaymentMethodLabel(
  method: CompanyExpensePaymentMethod,
): string {
  return COMPANY_EXPENSE_PAYMENT_METHOD_LABELS[method];
}
