/**
 * Sales dashboard + register — live Supabase queries.
 */
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import { mapSalesDashboardMetrics } from '../sales-dashboard-map';
import type { SalesDashboardMetricsVm } from '../sales-dashboard-map';
import type { SaleRegisterRow } from '../sales-types';
import type { PaymentStatusVm } from '../orders-types';
import { formatInr, formatDateTime, shortCode } from './format';
import { throwRpcError } from '../rpc-error';

type Row = Record<string, unknown>;
type Sb = GroAurumSupabaseClient;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function paymentStatusFromDb(status: string | null): PaymentStatusVm {
  switch (status) {
    case 'PAID':
      return 'PAID';
    case 'PAYMENT_PENDING':
      return 'PENDING';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'UNPAID':
    case 'FAILED':
      return 'UNPAID';
    default:
      return 'PAID';
  }
}

function paymentMethodLabel(
  collectionMethod: string | null,
  methodIntent: string | null,
): string {
  const raw = (collectionMethod ?? methodIntent ?? '').replace(/_/g, ' ');
  if (!raw) return '—';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchSalesDashboardMetrics(
  sb: Sb,
): Promise<SalesDashboardMetricsVm> {
  const { data, error } = await sb.rpc('admin_sales_dashboard_metrics', {
    p_as_of_date: null,
    p_fy_start_month: 4,
  });
  if (error) throwRpcError(error, 'Could not load sales dashboard metrics');
  if (data == null || typeof data !== 'object') {
    throw new Error('admin_sales_dashboard_metrics returned empty payload');
  }
  return mapSalesDashboardMetrics(data as Record<string, unknown>);
}

export async function listSalesRegister(
  sb: Sb,
  opts?: {
    fromIso?: string | null;
    toIso?: string | null;
    search?: string;
    limit?: number;
  },
): Promise<SaleRegisterRow[]> {
  let q = sb
    .from('sales')
    .select('id, order_id, invoice_number, converted_at, total, status')
    .neq('status', 'REFUNDED')
    .order('converted_at', { ascending: false })
    .limit(opts?.limit ?? 500);

  if (opts?.fromIso) q = q.gte('converted_at', opts.fromIso);
  if (opts?.toIso) q = q.lte('converted_at', opts.toIso);

  const { data: sales, error } = await q;
  if (error) throwRpcError(error, 'Could not load sales register');
  if (!sales?.length) return [];

  const saleRows = sales as Row[];
  const orderIds = [...new Set(saleRows.map((s) => str(s['order_id'])).filter(Boolean))];

  const orderMap = new Map<string, Row>();
  const shopIds = new Set<string>();
  if (orderIds.length > 0) {
    const { data: orders, error: ordersErr } = await sb
      .from('orders')
      .select('id, shop_id')
      .in('id', orderIds);
    if (ordersErr) throw ordersErr;
    for (const o of (orders ?? []) as Row[]) {
      orderMap.set(str(o['id']), o);
      const sid = str(o['shop_id']);
      if (sid) shopIds.add(sid);
    }
  }

  const shopMap = new Map<string, string>();
  if (shopIds.size > 0) {
    const { data: shops, error: shopsErr } = await sb
      .from('shops')
      .select('id, trade_name')
      .in('id', [...shopIds]);
    if (shopsErr) throw shopsErr;
    for (const s of (shops ?? []) as Row[]) {
      shopMap.set(str(s['id']), str(s['trade_name']));
    }
  }

  const paymentMap = new Map<string, Row>();
  if (orderIds.length > 0) {
    const { data: payments, error: payErr } = await sb
      .from('payments')
      .select('order_id, status, collection_method, method_intent')
      .in('order_id', orderIds);
    if (payErr) throw payErr;
    for (const p of (payments ?? []) as Row[]) {
      paymentMap.set(str(p['order_id']), p);
    }
  }

  const searchQ = (opts?.search ?? '').trim().toLowerCase();
  const rows: SaleRegisterRow[] = [];

  for (const s of saleRows) {
    const saleId = str(s['id']);
    const orderId = str(s['order_id']);
    const order = orderMap.get(orderId);
    const shopId = order ? str(order['shop_id']) : '';
    const customerName = shopMap.get(shopId) || '—';
    const invoiceNumber = str(s['invoice_number']) || shortCode(orderId, 'GA');
    const orderCode = shortCode(orderId, 'GA');
    const payment = paymentMap.get(orderId);
    const paymentStatus = paymentStatusFromDb(str(payment?.['status'] ?? 'PAID'));
    const saleStatus = str(s['status']) || 'COMPLETED';

    if (searchQ) {
      const hay = [invoiceNumber, orderCode, customerName, saleStatus]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(searchQ)) continue;
    }

    const convertedAt = str(s['converted_at']);
    const amount = num(s['total']);
    rows.push({
      saleId,
      orderId,
      invoiceNumber,
      orderCode,
      customerName,
      saleDateLabel: formatDateTime(convertedAt),
      saleDateIso: convertedAt,
      amount,
      amountLabel: formatInr(amount),
      paymentStatus,
      paymentMethodLabel: paymentMethodLabel(
        payment ? str(payment['collection_method']) || null : null,
        payment ? str(payment['method_intent']) || null : null,
      ),
      saleStatus,
      saleStatusLabel: saleStatus.replace(/_/g, ' '),
    });
  }

  return rows;
}

/** Resolve sale UUID → order id; pass-through if already an order id. */
export async function resolveSaleToOrderId(
  sb: Sb,
  saleOrOrderId: string,
): Promise<string> {
  const { data: bySale, error: saleErr } = await sb
    .from('sales')
    .select('order_id')
    .eq('id', saleOrOrderId)
    .maybeSingle();
  if (saleErr) throw saleErr;
  if (bySale?.order_id) return str(bySale.order_id);
  return saleOrOrderId;
}

export function exportSalesRegisterCsv(rows: SaleRegisterRow[]): string {
  const header = [
    'Invoice Number',
    'Sale Date',
    'Customer',
    'Order Number',
    'Total Amount',
    'Payment Status',
    'Payment Method',
    'Sales Status',
  ];
  const lines = rows.map((r) =>
    [
      r.invoiceNumber,
      r.saleDateLabel,
      r.customerName,
      r.orderCode,
      r.amount,
      r.paymentStatus,
      r.paymentMethodLabel,
      r.saleStatus,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
