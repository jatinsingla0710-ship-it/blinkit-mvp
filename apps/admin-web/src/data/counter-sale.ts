/**
 * Admin counter-sale (New Sale) — client helpers only.
 * Server remains authoritative via admin_complete_counter_sale.
 */

export type CounterPaymentMethod = 'CASH' | 'UPI' | 'BANK' | 'CREDIT';

export type CounterSaleCustomer =
  | { kind: 'walkIn' }
  | { kind: 'existing'; shopId: string; displayName: string; phoneLabel?: string }
  | {
      kind: 'quickCreate';
      tradeName: string;
      mobile: string;
      serviceAreaId?: string;
    };

export type CounterCartCatalogueLine = {
  key: string;
  kind: 'CATALOGUE';
  skuId: string;
  name: string;
  sellingUnitLabel: string;
  quantity: number;
  quantityStep: number;
  moq: number;
  /** Resolved catalogue selling price shown in UI. */
  listUnitPrice: number;
  /** Approved unit price sent to RPC (override or list). */
  unitPrice: number;
  priceOverridden: boolean;
  lineDiscount: number;
  availableQuantity?: number;
};

export type CounterCartCustomLine = {
  key: string;
  kind: 'CUSTOM';
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
};

export type CounterCartLine = CounterCartCatalogueLine | CounterCartCustomLine;

export type CounterSaleResult = {
  orderId: string;
  saleId: string;
  paymentId: string;
  invoiceNumber: string;
  shopId: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  itemCount: number;
  idempotentReplay: boolean;
};

export type CounterSaleCompleteInput = {
  customer: CounterSaleCustomer;
  lines: CounterCartLine[];
  billDiscount: number;
  paymentMethod: CounterPaymentMethod;
  amountPaid: number;
  notes?: string;
  clientRequestId: string;
};

/** Preview totals for UI only — server recomputes on submit. */
export function previewCounterSaleTotals(input: {
  lines: readonly CounterCartLine[];
  billDiscount: number;
}): { subtotal: number; discount: number; total: number } {
  const subtotal = round2(
    input.lines.reduce((sum, line) => sum + lineTotal(line), 0),
  );
  const discount = round2(Math.max(0, input.billDiscount));
  const capped = Math.min(discount, subtotal);
  return {
    subtotal,
    discount: capped,
    total: round2(subtotal - capped),
  };
}

export function lineTotal(line: CounterCartLine): number {
  return round2(line.quantity * line.unitPrice - (line.lineDiscount || 0));
}

export function amountDuePreview(total: number, amountPaid: number): number {
  return round2(Math.max(0, total - Math.max(0, amountPaid)));
}

export function validateCounterSaleDraft(input: {
  customer: CounterSaleCustomer | null;
  lines: readonly CounterCartLine[];
  billDiscount: number;
  paymentMethod: CounterPaymentMethod;
  amountPaid: number;
}): string | null {
  if (!input.customer) {
    return 'Select a customer or Walk-in Customer.';
  }
  if (input.customer.kind === 'quickCreate') {
    if (!input.customer.tradeName.trim()) {
      return 'Enter the customer name.';
    }
    if (!input.customer.mobile.trim()) {
      return 'Enter the customer mobile number.';
    }
  }
  if (input.lines.length === 0) {
    return 'Add at least one item to the sale.';
  }
  for (const line of input.lines) {
    if (!(line.quantity > 0)) {
      return `Quantity must be greater than zero for ${line.name}.`;
    }
    if (line.unitPrice < 0) {
      return `Price cannot be negative for ${line.name}.`;
    }
    if (line.lineDiscount < 0) {
      return `Discount cannot be negative for ${line.name}.`;
    }
    if (lineTotal(line) < 0) {
      return `Line total cannot be negative for ${line.name}.`;
    }
    if (line.kind === 'CUSTOM' && !line.unit.trim()) {
      return `Enter a unit for ${line.name}.`;
    }
  }
  const { subtotal, discount, total } = previewCounterSaleTotals({
    lines: input.lines,
    billDiscount: input.billDiscount,
  });
  if (input.billDiscount < 0) {
    return 'Discount cannot be negative.';
  }
  if (discount > subtotal) {
    return 'Discount cannot be greater than the subtotal.';
  }
  if (input.paymentMethod === 'CREDIT') {
    if (input.amountPaid !== 0) {
      return 'Credit sales must have amount paid as ₹0.';
    }
    return null;
  }
  if (input.amountPaid < 0) {
    return 'Amount paid cannot be negative.';
  }
  if (input.amountPaid > total) {
    return 'Amount paid cannot be greater than the sale total.';
  }
  return null;
}

export function buildCounterSaleRpcArgs(input: CounterSaleCompleteInput): {
  p_shop: Record<string, unknown>;
  p_lines: Array<Record<string, unknown>>;
  p_payment: { amountPaid: number; method: string };
  p_bill_discount: number;
  p_notes: string | null;
  p_client_request_id: string;
} {
  const shop =
    input.customer.kind === 'walkIn'
      ? { walkIn: true }
      : input.customer.kind === 'existing'
        ? { shopId: input.customer.shopId }
        : {
            quickCreate: {
              tradeName: input.customer.tradeName.trim(),
              mobile: input.customer.mobile.trim(),
              ...(input.customer.serviceAreaId
                ? { serviceAreaId: input.customer.serviceAreaId }
                : {}),
            },
          };

  const lines = input.lines.map((line) => {
    if (line.kind === 'CATALOGUE') {
      const payload: Record<string, unknown> = {
        kind: 'CATALOGUE',
        skuId: line.skuId,
        quantity: line.quantity,
      };
      if (line.priceOverridden || line.unitPrice !== line.listUnitPrice) {
        payload.unitPrice = line.unitPrice;
      }
      if (line.lineDiscount > 0) {
        payload.discount = line.lineDiscount;
      }
      return payload;
    }
    return {
      kind: 'CUSTOM',
      name: line.name.trim(),
      unit: line.unit.trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      ...(line.lineDiscount > 0 ? { discount: line.lineDiscount } : {}),
    };
  });

  const method =
    input.paymentMethod === 'CREDIT' ? 'CASH' : input.paymentMethod;
  const amountPaid =
    input.paymentMethod === 'CREDIT' ? 0 : round2(input.amountPaid);

  return {
    p_shop: shop,
    p_lines: lines,
    p_payment: { amountPaid, method },
    p_bill_discount: round2(Math.max(0, input.billDiscount)),
    p_notes: input.notes?.trim() || null,
    p_client_request_id: input.clientRequestId,
  };
}

export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Map RPC / network errors to shop-owner language. Cart must stay intact. */
export function formatCounterSaleError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';

  const msg = raw.trim();
  if (!msg) {
    return 'Sale could not be completed. Nothing was charged or deducted.';
  }

  const lower = msg.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('timeout')
  ) {
    return 'Sale could not be completed. Your cart is still here. Please try again.';
  }

  const stockMatch = msg.match(
    /Insufficient stock for (.+?) \(available ([^)]+)\)/i,
  );
  if (stockMatch) {
    return `Not enough stock for ${stockMatch[1]}. Available: ${stockMatch[2]}.`;
  }

  if (lower.includes('no inventory for sku')) {
    return 'Not enough stock for one of the items. Check inventory and try again.';
  }

  if (
    lower.includes('amountpaid') &&
    (lower.includes('exceeds') || lower.includes('greater'))
  ) {
    return 'Amount paid cannot be greater than the sale total.';
  }

  if (lower.includes('bill discount cannot exceed')) {
    return 'Discount cannot be greater than the subtotal.';
  }

  if (lower.includes('at least one sale line')) {
    return 'Add at least one item to the sale.';
  }

  if (lower.includes('shop not found') || lower.includes('inactive')) {
    return 'That customer is not available. Choose another customer or Walk-in.';
  }

  if (lower.includes('quickcreate.tradename')) {
    return 'Enter the customer name.';
  }

  if (lower.includes('quickcreate.mobile')) {
    return 'Enter the customer mobile number.';
  }

  if (lower.includes('not authenticated') || lower.includes('admin role')) {
    return 'Your session expired. Sign in again, then complete the sale.';
  }

  // Keep short server messages that are already readable; hide SQL noise.
  if (
    msg.length < 160 &&
    !lower.includes('plpgsql') &&
    !lower.includes('sqlstate') &&
    !lower.includes('violates')
  ) {
    return msg;
  }

  return 'Sale could not be completed. Nothing was charged or deducted.';
}

export function customerDisplayName(customer: CounterSaleCustomer): string {
  if (customer.kind === 'walkIn') return 'Walk-in Customer';
  if (customer.kind === 'existing') return customer.displayName;
  return customer.tradeName;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function nextQuantity(
  current: number,
  step: number,
  direction: 1 | -1,
  moq: number,
): number {
  const s = step > 0 ? step : 1;
  const min = moq > 0 ? moq : s;
  if (direction === 1) {
    if (current < min) return min;
    return roundQty(current + s, s);
  }
  const next = roundQty(current - s, s);
  return next < min ? 0 : next;
}

function roundQty(n: number, step: number): number {
  const decimals = String(step).includes('.')
    ? String(step).split('.')[1]!.length
    : 0;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
