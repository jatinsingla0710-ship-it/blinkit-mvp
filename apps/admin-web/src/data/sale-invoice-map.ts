import type { OrderLineItem, OrderPaymentSummary, PaymentStatusVm } from '@/data/orders-types';
import { formatInr, formatInrPrecise } from '@/data/live/format';
import {
  formatQuantityWithUnit,
  humanizeSellingUnit,
} from '@/data/quantity-display';

/** Raw sale_items row shape used by invoice mapping. */
export type SaleItemRowInput = {
  id: string;
  product_name?: string | null;
  sku_code?: string | null;
  sku_name?: string | null;
  quantity: number;
  unit_price: number;
  discount?: number | null;
  line_total: number;
  /** From order_lines.selling_unit_snapshot when joined via order_line_id. */
  selling_unit?: string | null;
};

/** Raw sales header amounts used when a sale exists. */
export type SaleTotalsInput = {
  subtotal: number;
  discount: number;
  total: number;
};

/** Raw sales_payments row for converted-sale payment display. */
export type SalePaymentInput = {
  status: string;
  amount: number;
  collected_at?: string | null;
};

/**
 * Map immutable sale_items snapshots into invoice / order line view-models.
 */
export function mapSaleItemsToOrderLines(
  items: SaleItemRowInput[],
): OrderLineItem[] {
  return items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unit_price) || 0;
    const discount = Number(item.discount) || 0;
    const lineTotal = Number(item.line_total) || 0;
    const productName =
      (item.product_name ?? '').trim() ||
      (item.sku_name ?? '').trim() ||
      '—';
    return {
      id: item.id,
      productName,
      skuCode: (item.sku_code ?? '').trim() || '—',
      skuName: (item.sku_name ?? '').trim() || '—',
      quantityLabel: formatQuantityWithUnit(
        qty,
        humanizeSellingUnit(item.selling_unit),
      ),
      unitPriceLabel: formatInrPrecise(unit),
      discountLabel: formatInr(discount),
      lineTotalLabel: formatInr(lineTotal),
      quantity: qty,
      unitPrice: unit,
      lineTotal,
    };
  });
}

function salePaymentStatus(status: string | null | undefined): PaymentStatusVm {
  const s = (status ?? '').toUpperCase();
  if (s === 'PAID') return 'PAID';
  if (s === 'REFUNDED') return 'REFUNDED';
  if (s === 'UNPAID') return 'UNPAID';
  if (s === 'PAYMENT_PENDING' || s === 'PENDING') return 'PENDING';
  if (s === 'PARTIAL') return 'PARTIAL';
  return 'PENDING';
}

/**
 * Payment / totals block for a converted sale — prefers sales + sales_payments.
 */
export function mapSaleToPaymentSummary(input: {
  sale: SaleTotalsInput;
  salePayment?: SalePaymentInput | null;
  methodLabel: string;
}): OrderPaymentSummary {
  const subtotal = Number(input.sale.subtotal) || 0;
  const discount = Number(input.sale.discount) || 0;
  const total = Number(input.sale.total) || 0;
  const status = salePaymentStatus(input.salePayment?.status);
  const collected =
    input.salePayment && status === 'PAID'
      ? Number(input.salePayment.amount) || 0
      : status === 'REFUNDED'
        ? 0
        : input.salePayment
          ? Number(input.salePayment.amount) || 0
          : status === 'PAID'
            ? total
            : 0;
  const outstanding = Math.max(total - collected, 0);
  return {
    methodLabel: input.methodLabel,
    status,
    subtotalLabel: formatInr(subtotal),
    discountLabel: formatInr(discount),
    adjustmentsLabel: formatInr(discount > 0 ? -discount : 0),
    totalLabel: formatInr(total),
    collectedLabel: formatInr(collected),
    outstandingLabel: formatInr(outstanding),
    subtotal,
    discount,
    total,
    collected,
    outstanding,
  };
}
