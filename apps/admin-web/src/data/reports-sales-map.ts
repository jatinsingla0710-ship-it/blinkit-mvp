import type {
  ChartSeriesPoint,
  ReportTableRow,
  ReportsKpi,
} from '@/data/reports-types';
import { formatInr, formatDate } from '@/data/live/format';

export type SaleReportRow = {
  id: string;
  order_id: string;
  total: number;
  converted_at: string;
  invoice_number?: string;
};

export type SaleItemReportRow = {
  sale_id: string;
  product_name?: string | null;
  sku_code?: string | null;
  sku_name?: string | null;
  quantity: number;
  line_total: number;
};

export type SalePaymentReportRow = {
  sale_id: string;
  status: string;
  amount: number;
};

/**
 * Executive sales KPIs from converted sales (+ optional sales_payments).
 * Does not use open/cancelled order totals.
 */
export function buildSalesReportKpis(input: {
  sales: SaleReportRow[];
  payments?: SalePaymentReportRow[];
}): ReportsKpi[] {
  const sales = input.sales;
  const revenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const count = sales.length;
  const avg = count > 0 ? revenue / count : 0;
  const collected = (input.payments ?? [])
    .filter((p) => (p.status ?? '').toUpperCase() === 'PAID')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return [
    {
      id: 'invoiced_revenue',
      label: 'Invoiced Revenue',
      value: formatInr(revenue),
      hint: 'Sum of converted sales.total',
      tone: revenue > 0 ? 'positive' : 'default',
    },
    {
      id: 'converted_sales',
      label: 'Converted Sales',
      value: `${count}`,
      hint: 'Rows in sales',
    },
    {
      id: 'avg_sale',
      label: 'Avg Sale Value',
      value: formatInr(avg),
      hint: count > 0 ? 'Invoiced revenue ÷ sales' : 'No converted sales yet',
    },
    {
      id: 'collected',
      label: 'Collected on Sales',
      value: formatInr(collected),
      hint: 'Sum of PAID sales_payments.amount',
    },
  ];
}

/** Aggregate sale_items into a top-products table (by line_total desc). */
export function buildTopProductsFromSaleItems(
  items: SaleItemReportRow[],
  limit = 10,
): { columns: string[]; rows: ReportTableRow[] } {
  const byKey = new Map<
    string,
    { name: string; sku: string; qty: number; revenue: number }
  >();
  for (const item of items) {
    const name =
      (item.product_name ?? '').trim() ||
      (item.sku_name ?? '').trim() ||
      '—';
    const sku = (item.sku_code ?? '').trim() || '—';
    const key = `${sku}::${name}`;
    const cur = byKey.get(key) ?? { name, sku, qty: 0, revenue: 0 };
    cur.qty += Number(item.quantity) || 0;
    cur.revenue += Number(item.line_total) || 0;
    byKey.set(key, cur);
  }
  const ranked = [...byKey.values()].sort((a, b) => b.revenue - a.revenue);
  return {
    columns: ['Product', 'SKU', 'Qty', 'Revenue'],
    rows: ranked.slice(0, limit).map((r, i) => ({
      id: `prod-${i}-${r.sku}`,
      cells: [r.name, r.sku, `${r.qty}`, formatInr(r.revenue)],
    })),
  };
}

/** Daily invoiced revenue series from sales.converted_at (newest day last). */
export function buildRevenueByDayFromSales(
  sales: SaleReportRow[],
  dayCount = 7,
): ChartSeriesPoint[] {
  const localDayKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const days: { key: string; label: string; total: number }[] = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      key: localDayKey(d),
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      total: 0,
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const sale of sales) {
    const iso = sale.converted_at;
    if (!iso) continue;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) continue;
    const bucket = byKey.get(localDayKey(parsed));
    if (bucket) bucket.total += Number(sale.total) || 0;
  }
  return days.map((d) => ({
    label: d.label,
    value: d.total,
    displayValue: formatInr(d.total),
  }));
}

/**
 * Salesman leaderboard from sales linked to order created_by profile names.
 */
export function buildSalesmanLeaderboardFromSales(input: {
  sales: SaleReportRow[];
  orderSalesmanByOrderId: Map<string, string>;
  limit?: number;
}): { columns: string[]; rows: ReportTableRow[] } {
  const byName = new Map<string, { count: number; revenue: number }>();
  for (const sale of input.sales) {
    const name =
      input.orderSalesmanByOrderId.get(sale.order_id)?.trim() || '—';
    const cur = byName.get(name) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(sale.total) || 0;
    byName.set(name, cur);
  }
  const ranked = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const limit = input.limit ?? 10;
  return {
    columns: ['Name', 'Sales', 'Revenue'],
    rows: ranked.slice(0, limit).map((r, i) => ({
      id: `sm-${i}-${r.name}`,
      cells: [r.name, `${r.count}`, formatInr(r.revenue)],
    })),
  };
}

/** Human-readable empty copy when a sales-backed report has no rows. */
export function salesReportEmptyDetail(
  kind: 'products' | 'salesmen' | 'revenue',
): string {
  switch (kind) {
    case 'products':
      return 'No sale_items yet. Convert delivered and paid orders to populate this table.';
    case 'salesmen':
      return 'No converted sales yet. Leaderboard uses sales linked to order creators.';
    case 'revenue':
      return 'No converted sales in the last 7 days.';
    default:
      return 'No converted sales data.';
  }
}

export function formatSaleConvertedDay(iso: string): string {
  return formatDate(iso);
}
