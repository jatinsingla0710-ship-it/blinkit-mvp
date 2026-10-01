/**
 * Phase 3D — owner financial reporting helpers.
 * Reuses Sales / Collections / Receivables / Expenses / Payroll / Day Book sources.
 * No second ledger; no COGS; P&L is an operating result from recorded cash events.
 */
import { formatInr } from '@/data/live/format';
import type { DayBookEntry } from '@/data/day-book';
import { summarizeDayBook } from '@/data/day-book';
import type { CompanyExpenseRow } from '@/data/company-expenses';
import type { PayrollRow } from '@/data/salesman-payroll';
import type { ReceivableRow } from '@/data/customer-ledger';
import type { KpiCardItem } from '@/components/dashboard/KpiCards';

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type SaleAmountRow = {
  id: string;
  total: number;
  convertedAt: string;
  status?: string;
};

export type ProfitLossInput = {
  /** Converted sales in range (REFUNDED sales excluded by caller). */
  salesTotal: number;
  /** Actual money in from Day Book (sales + collections). */
  collectionsTotal: number;
  /** Refund money out from Day Book. */
  refundsTotal: number;
  /** Company expenses in range. */
  expensesTotal: number;
  /** Paid payroll only. */
  payrollPaidTotal: number;
};

export type ProfitLossVm = {
  salesTotal: number;
  salesTotalLabel: string;
  collectionsTotal: number;
  collectionsTotalLabel: string;
  refundsTotal: number;
  refundsTotalLabel: string;
  expensesTotal: number;
  expensesTotalLabel: string;
  payrollPaidTotal: number;
  payrollPaidTotalLabel: string;
  totalCosts: number;
  totalCostsLabel: string;
  /** Sales − expenses − paid payroll (not full accounting profit). */
  operatingResult: number;
  operatingResultLabel: string;
  /** Collections − refunds − expenses − paid payroll. */
  netCashMovement: number;
  netCashMovementLabel: string;
  disclaimer: string;
};

export function buildProfitLoss(input: ProfitLossInput): ProfitLossVm {
  const salesTotal = roundMoney(input.salesTotal);
  const collectionsTotal = roundMoney(input.collectionsTotal);
  const refundsTotal = roundMoney(input.refundsTotal);
  const expensesTotal = roundMoney(input.expensesTotal);
  const payrollPaidTotal = roundMoney(input.payrollPaidTotal);
  const totalCosts = roundMoney(expensesTotal + payrollPaidTotal);
  const operatingResult = roundMoney(salesTotal - totalCosts);
  const netCashMovement = roundMoney(
    collectionsTotal - refundsTotal - expensesTotal - payrollPaidTotal,
  );
  return {
    salesTotal,
    salesTotalLabel: formatInr(salesTotal),
    collectionsTotal,
    collectionsTotalLabel: formatInr(collectionsTotal),
    refundsTotal,
    refundsTotalLabel: formatInr(refundsTotal),
    expensesTotal,
    expensesTotalLabel: formatInr(expensesTotal),
    payrollPaidTotal,
    payrollPaidTotalLabel: formatInr(payrollPaidTotal),
    totalCosts,
    totalCostsLabel: formatInr(totalCosts),
    operatingResult,
    operatingResultLabel: formatInr(operatingResult),
    netCashMovement,
    netCashMovementLabel: formatInr(netCashMovement),
    disclaimer:
      'Operating result based on recorded expenses and paid payroll. Purchase cost (COGS) is not included.',
  };
}

/** Sum Day Book money by type — collections ≠ sales. */
export function summarizeDayBookByType(entries: readonly DayBookEntry[]): {
  salesIn: number;
  collectionsIn: number;
  refundsOut: number;
  expensesOut: number;
  payrollOut: number;
  moneyIn: number;
  moneyOut: number;
  net: number;
} {
  let salesIn = 0;
  let collectionsIn = 0;
  let refundsOut = 0;
  let expensesOut = 0;
  let payrollOut = 0;
  for (const e of entries) {
    if (e.type === 'sale') salesIn += e.moneyIn;
    else if (e.type === 'collection') collectionsIn += e.moneyIn;
    else if (e.type === 'refund') refundsOut += e.moneyOut;
    else if (e.type === 'expense') expensesOut += e.moneyOut;
    else if (e.type === 'payroll') payrollOut += e.moneyOut;
  }
  const totals = summarizeDayBook(entries);
  return {
    salesIn: roundMoney(salesIn),
    collectionsIn: roundMoney(collectionsIn),
    refundsOut: roundMoney(refundsOut),
    expensesOut: roundMoney(expensesOut),
    payrollOut: roundMoney(payrollOut),
    moneyIn: totals.moneyIn,
    moneyOut: totals.moneyOut,
    net: totals.net,
  };
}

export function sumSalesTotal(rows: readonly SaleAmountRow[]): number {
  return roundMoney(
    rows
      .filter((r) => (r.status ?? '').toUpperCase() !== 'REFUNDED')
      .reduce((s, r) => s + (Number(r.total) || 0), 0),
  );
}

export function averageSaleValue(rows: readonly SaleAmountRow[]): number {
  const active = rows.filter(
    (r) => (r.status ?? '').toUpperCase() !== 'REFUNDED',
  );
  if (active.length === 0) return 0;
  return roundMoney(sumSalesTotal(active) / active.length);
}

export function filterExpensesByDate(
  rows: readonly CompanyExpenseRow[],
  dateFrom: string,
  dateTo: string,
): CompanyExpenseRow[] {
  return rows.filter(
    (r) => r.expenseDate >= dateFrom && r.expenseDate <= dateTo,
  );
}

export function expenseCategoryTotals(
  rows: readonly CompanyExpenseRow[],
): { category: string; categoryLabel: string; total: number; totalLabel: string }[] {
  const map = new Map<string, { label: string; total: number }>();
  for (const r of rows) {
    const cur = map.get(r.category) ?? { label: r.categoryLabel, total: 0 };
    cur.total += r.amount;
    map.set(r.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      categoryLabel: v.label,
      total: roundMoney(v.total),
      totalLabel: formatInr(roundMoney(v.total)),
    }))
    .sort((a, b) => b.total - a.total);
}

export function expenseMethodTotals(
  rows: readonly CompanyExpenseRow[],
): { method: string; methodLabel: string; total: number; totalLabel: string }[] {
  const map = new Map<string, { label: string; total: number }>();
  for (const r of rows) {
    const cur = map.get(r.paymentMethod) ?? {
      label: r.paymentMethodLabel,
      total: 0,
    };
    cur.total += r.amount;
    map.set(r.paymentMethod, cur);
  }
  return [...map.entries()]
    .map(([method, v]) => ({
      method,
      methodLabel: v.label,
      total: roundMoney(v.total),
      totalLabel: formatInr(roundMoney(v.total)),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Only PAID payroll counts as cash out. */
export function filterPaidPayroll(
  rows: readonly PayrollRow[],
  paidFromIso?: string | null,
  paidToIso?: string | null,
): PayrollRow[] {
  return rows.filter((r) => {
    if (r.status !== 'PAID') return false;
    if (!paidFromIso && !paidToIso) return true;
    // paidAtLabel is display-only; callers should filter via API on paid_at.
    return true;
  });
}

export function sumPaidPayroll(rows: readonly PayrollRow[]): number {
  return roundMoney(
    rows
      .filter((r) => r.status === 'PAID')
      .reduce((s, r) => s + r.totalAmount, 0),
  );
}

export type OwnerFinancialKpisInput = {
  todaySales: number;
  monthSales: number;
  collectionsToday: number;
  outstanding: number;
  expensesMonth: number;
  payrollPaidMonth: number;
  netCashToday: number;
  activeCustomers: number;
};

export function buildOwnerFinancialKpis(
  input: OwnerFinancialKpisInput,
): KpiCardItem[] {
  return [
    {
      id: 'today_sales',
      label: "Today's Sales",
      value: formatInr(input.todaySales),
      hint: 'Converted invoices today',
      tone: 'positive',
      href: '/reports/sales',
    },
    {
      id: 'month_sales',
      label: 'Sales this month',
      value: formatInr(input.monthSales),
      hint: 'Converted invoices',
      tone: 'positive',
      href: '/reports/sales',
    },
    {
      id: 'collections_today',
      label: 'Collections Today',
      value: formatInr(input.collectionsToday),
      hint: 'Money received',
      href: '/reports/collections',
    },
    {
      id: 'outstanding',
      label: 'Outstanding',
      value: formatInr(input.outstanding),
      hint: 'Customer balances due',
      tone: input.outstanding > 0 ? 'warning' : 'default',
      href: '/receivables',
    },
    {
      id: 'expenses_month',
      label: 'Company Expenses',
      value: formatInr(input.expensesMonth),
      hint: 'This month',
      href: '/reports/expenses',
    },
    {
      id: 'payroll_paid',
      label: 'Payroll Paid',
      value: formatInr(input.payrollPaidMonth),
      hint: 'This month',
      href: '/reports/payroll',
    },
    {
      id: 'net_cash',
      label: 'Net Cash Today',
      value: formatInr(input.netCashToday),
      hint: 'Money in − money out',
      tone: input.netCashToday >= 0 ? 'positive' : 'danger',
      href: '/day-book',
    },
    {
      id: 'active_customers',
      label: 'Active Customers',
      value: `${input.activeCustomers}`,
      href: '/customers',
    },
  ];
}

export function exportReceivablesCsv(rows: readonly ReceivableRow[]): string {
  const header = ['Customer', 'Sales', 'Paid', 'Outstanding', 'Last Payment'];
  const lines = rows.map((r) =>
    [
      csvEscape(r.shopName),
      String(r.totalSales),
      String(r.totalPaid),
      String(r.outstanding),
      csvEscape(r.lastPaymentAtLabel ?? ''),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function exportExpensesCsv(rows: readonly CompanyExpenseRow[]): string {
  const header = [
    'Date',
    'Category',
    'Description',
    'Amount',
    'Payment Method',
  ];
  const lines = rows.map((r) =>
    [
      r.expenseDate,
      csvEscape(r.categoryLabel),
      csvEscape(r.description),
      String(r.amount),
      csvEscape(r.paymentMethodLabel),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function exportPayrollCsv(rows: readonly PayrollRow[]): string {
  const header = [
    'Month',
    'Salesman',
    'Salary',
    'Commission',
    'Adjustments',
    'Total',
    'Status',
  ];
  const lines = rows.map((r) =>
    [
      csvEscape(r.payrollMonthLabel),
      csvEscape(r.salesmanName),
      String(r.baseSalary),
      String(r.earnedCommission),
      String(r.adjustments),
      String(r.totalAmount),
      csvEscape(r.statusLabel),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function exportProductSalesCsv(
  rows: readonly {
    product: string;
    sku: string;
    quantity: number;
    salesValue: number;
  }[],
): string {
  const header = ['Product', 'SKU', 'Quantity Sold', 'Sales Value'];
  const lines = rows.map((r) =>
    [
      csvEscape(r.product),
      csvEscape(r.sku),
      String(r.quantity),
      String(r.salesValue),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function exportCollectionsCsv(
  rows: readonly {
    date: string;
    customer: string;
    amount: number;
    method: string;
    reference: string;
  }[],
): string {
  const header = ['Date', 'Customer', 'Amount', 'Method', 'Reference'];
  const lines = rows.map((r) =>
    [
      csvEscape(r.date),
      csvEscape(r.customer),
      String(r.amount),
      csvEscape(r.method),
      csvEscape(r.reference),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function exportSalesmanPerformanceCsv(
  rows: readonly {
    salesman: string;
    orderCount: number;
    revenue: number;
  }[],
): string {
  const header = ['Salesman', 'Orders', 'Revenue'];
  const lines = rows.map((r) =>
    [
      csvEscape(r.salesman),
      String(r.orderCount),
      String(r.revenue),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Filtered Outstanding report KPIs — must match the visible table. */
export function summarizeReceivableRows(rows: readonly ReceivableRow[]): {
  customerCount: number;
  totalSales: number;
  totalSalesLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  totalOutstanding: number;
  totalOutstandingLabel: string;
} {
  let totalSales = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  for (const row of rows) {
    totalSales += row.totalSales;
    totalPaid += row.totalPaid;
    totalOutstanding += row.outstanding;
  }
  return {
    customerCount: rows.length,
    totalSales: roundMoney(totalSales),
    totalSalesLabel: formatInr(roundMoney(totalSales)),
    totalPaid: roundMoney(totalPaid),
    totalPaidLabel: formatInr(roundMoney(totalPaid)),
    totalOutstanding: roundMoney(totalOutstanding),
    totalOutstandingLabel: formatInr(roundMoney(totalOutstanding)),
  };
}

/** Filtered Payroll report KPIs — must match the visible table. */
export function summarizePayrollRows(rows: readonly PayrollRow[]): {
  salesmanCount: number;
  totalPayroll: number;
  totalPayrollLabel: string;
  paidTotal: number;
  paidTotalLabel: string;
  pendingTotal: number;
  pendingTotalLabel: string;
} {
  let totalPayroll = 0;
  let paidTotal = 0;
  let pendingTotal = 0;
  for (const row of rows) {
    totalPayroll += row.totalAmount;
    if (row.status === 'PAID') paidTotal += row.totalAmount;
    else pendingTotal += row.totalAmount;
  }
  return {
    salesmanCount: rows.length,
    totalPayroll: roundMoney(totalPayroll),
    totalPayrollLabel: formatInr(roundMoney(totalPayroll)),
    paidTotal: roundMoney(paidTotal),
    paidTotalLabel: formatInr(roundMoney(paidTotal)),
    pendingTotal: roundMoney(pendingTotal),
    pendingTotalLabel: formatInr(roundMoney(pendingTotal)),
  };
}

/**
 * Executive ops cards for the owner dashboard — omit Monthly Revenue when
 * Money strip already shows "Sales this month" from the owner financial overview.
 * Does not change admin_ops_dashboard_kpis semantics.
 */
export function executiveOpsKpisWithoutDuplicateSales<T extends { id: string }>(
  kpis: readonly T[],
): T[] {
  return kpis.filter((k) => k.id !== 'monthly_revenue');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Aggregate product sales from sale line items (already filtered to active sales). */
export function aggregateProductSales(
  items: readonly {
    product_name?: string | null;
    sku_name?: string | null;
    sku_code?: string | null;
    quantity: number;
    line_total: number;
  }[],
): { product: string; sku: string; quantity: number; salesValue: number }[] {
  const map = new Map<
    string,
    { product: string; sku: string; quantity: number; salesValue: number }
  >();
  for (const item of items) {
    const product =
      (item.product_name ?? '').trim() ||
      (item.sku_name ?? '').trim() ||
      '—';
    const sku = (item.sku_code ?? '').trim() || '—';
    const key = `${sku}::${product}`;
    const cur = map.get(key) ?? {
      product,
      sku,
      quantity: 0,
      salesValue: 0,
    };
    cur.quantity += Number(item.quantity) || 0;
    cur.salesValue += Number(item.line_total) || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      quantity: roundMoney(r.quantity),
      salesValue: roundMoney(r.salesValue),
    }))
    .sort((a, b) => b.salesValue - a.salesValue);
}

export const REPORT_HUB_LINKS = [
  {
    to: '/reports/profit-loss',
    title: 'Profit & Loss',
    description: 'Sales vs recorded expenses and paid payroll',
  },
  {
    to: '/reports/sales',
    title: 'Sales Report',
    description: 'Converted invoices and averages',
  },
  {
    to: '/reports/collections',
    title: 'Collections Report',
    description: 'Money received by method',
  },
  {
    to: '/reports/outstanding',
    title: 'Customer Outstanding',
    description: 'Who still owes money',
  },
  {
    to: '/reports/expenses',
    title: 'Expense Report',
    description: 'Company expenses by category',
  },
  {
    to: '/reports/payroll',
    title: 'Payroll Report',
    description: 'Monthly salary and commission paid',
  },
  {
    to: '/reports/products',
    title: 'Product Sales',
    description: 'Quantity and value by product',
  },
  {
    to: '/reports/salesmen',
    title: 'Salesman Performance',
    description: 'Sales, targets, and commission earned',
  },
] as const;
