import type {
  AssistedOrderLineInput,
  OrderPreviewLineInput,
  SalesmanOrderPreview,
  SalesmanRetailer,
} from '@groaurum/api-client';
import { errorMessage } from '@/lib/errors';
import { diffPreviews, hasPreviewChanges, previewMatchesCart } from '@/data/order-preview';

export type OrderSubmitGate =
  | { canSubmit: true; shop: SalesmanRetailer; serviceAreaId: string }
  | { canSubmit: false; reason: string };

/**
 * Place Order is only offered for a retailer that has actually loaded from
 * the assigned list and has a service area. A `?shopId=` alone is not enough.
 */
export function evaluateOrderSubmitGate(input: {
  shopId: string;
  retailers: SalesmanRetailer[] | undefined;
  retailersLoading: boolean;
  retailersError: boolean;
  catalogueReady: boolean;
}): OrderSubmitGate {
  if (input.retailersError) {
    return { canSubmit: false, reason: 'Customers could not be loaded.' };
  }
  if (input.retailersLoading || input.retailers === undefined) {
    return { canSubmit: false, reason: 'Loading customers…' };
  }
  if (!input.shopId) {
    return { canSubmit: false, reason: 'Select a customer to continue.' };
  }
  const shop = input.retailers.find((r) => r.id === input.shopId);
  if (!shop) {
    return {
      canSubmit: false,
      reason:
        'This customer is not in your assigned list. Pick a customer from the list.',
    };
  }
  if (!shop.serviceAreaId) {
    return { canSubmit: false, reason: missingServiceAreaMessage(shop) };
  }
  if (!input.catalogueReady) {
    return { canSubmit: false, reason: 'Products are not available yet.' };
  }
  return { canSubmit: true, shop, serviceAreaId: shop.serviceAreaId };
}

export function missingServiceAreaMessage(shop: { tradeName: string }): string {
  return `${shop.tradeName} has no service area, so an order cannot be placed yet. Ask your admin to set the service area for this shop.`;
}

export type ConfirmationResult = {
  ok: boolean;
  message: string;
};

export type PlacedOrderOutcome =
  | { kind: 'confirmation_sent'; orderId: string; message: string }
  | { kind: 'confirmation_failed'; orderId: string; message: string };

/**
 * The order already exists once place_assisted_order returns, so a failed
 * confirmation must not look like success, and must not invite a re-submit.
 */
export function interpretPlacedOrder(
  orderId: string,
  confirmation: ConfirmationResult,
): PlacedOrderOutcome {
  if (confirmation.ok) {
    return { kind: 'confirmation_sent', orderId, message: confirmation.message };
  }
  return {
    kind: 'confirmation_failed',
    orderId,
    message: confirmation.message || 'Customer confirmation could not be sent.',
  };
}

/**
 * Synchronous guard against double taps: React state updates are async, so a
 * second tap can arrive before `disabled` renders. place_assisted_order has no
 * idempotency key, so a duplicate call would create a duplicate order.
 */
export function createSubmitLock() {
  let held = false;
  return {
    tryAcquire(): boolean {
      if (held) return false;
      held = true;
      return true;
    },
    release(): void {
      held = false;
    },
    get held(): boolean {
      return held;
    },
  };
}

export class SubmitTimeoutError extends Error {
  constructor() {
    super('The server did not answer in time.');
    this.name = 'SubmitTimeoutError';
  }
}

/** The underlying request is not cancelled: a timeout means "outcome unknown". */
export function withSubmitTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new SubmitTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

export type SubmitFailure =
  /** Server answered and rejected the order: nothing was created. */
  | { kind: 'rejected'; message: string }
  /** No reliable answer: the order may or may not exist. Never auto-retry. */
  | { kind: 'uncertain'; message: string };

const UNCERTAIN_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|timed? ?out|timeout|aborted|connection|ECONNRESET|socket/i;

export function classifySubmitError(err: unknown): SubmitFailure {
  if (err instanceof SubmitTimeoutError) {
    return { kind: 'uncertain', message: err.message };
  }
  const e = (err ?? {}) as { name?: string; message?: string; code?: string; status?: number };
  const message = typeof e.message === 'string' ? e.message : '';
  const status = typeof e.status === 'number' ? e.status : undefined;
  if (
    e.name === 'AbortError' ||
    e.name === 'TypeError' ||
    status === 0 ||
    status === 408 ||
    (status !== undefined && status >= 500) ||
    UNCERTAIN_PATTERN.test(message)
  ) {
    return { kind: 'uncertain', message: message || 'Network problem.' };
  }
  return { kind: 'rejected', message: message || 'The order was not accepted.' };
}

/** Plain-language text for place_assisted_order rejections (nothing was created). */
export function friendlyOrderError(message: string): string {
  if (/Insufficient stock|No inventory/i.test(message)) {
    return 'Not enough stock for one of the items. Edit the items and try again.';
  }
  if (/below MOQ|steps of/i.test(message)) {
    return `A quantity is not allowed (${message}). Edit the items and try again.`;
  }
  if (/order_lines_line_total_matches/i.test(message)) {
    return 'One quantity cannot be priced per pack exactly. Try a different quantity, for example full bags only.';
  }
  if (/not assigned to this salesman/i.test(message)) {
    return 'This customer is no longer assigned to you.';
  }
  if (/Service area does not match|service area/i.test(message)) {
    return 'The customer’s service area changed. Reload the customer and try again.';
  }
  if (/not orderable/i.test(message)) {
    return 'One of the products is no longer available. Edit the items and try again.';
  }
  return message;
}

/** A thrown confirmation step is still a saved order, never a failed placement. */
export async function confirmPlacedOrder(
  orderId: string,
  sendConfirmation: (orderId: string) => Promise<ConfirmationResult>,
): Promise<PlacedOrderOutcome> {
  let confirmation: ConfirmationResult;
  try {
    confirmation = await sendConfirmation(orderId);
  } catch (err) {
    confirmation = {
      ok: false,
      message: err instanceof Error ? err.message : '',
    };
  }
  return interpretPlacedOrder(orderId, confirmation);
}

export type SubmitOrderApi = {
  previewOrderLines: (lines: OrderPreviewLineInput[]) => Promise<SalesmanOrderPreview>;
  placeAssistedOrder: (input: {
    shopId: string;
    serviceAreaId: string;
    lines: AssistedOrderLineInput[];
    notes?: string;
  }) => Promise<string>;
  sendConfirmationPlaceholder: (orderId: string) => Promise<ConfirmationResult>;
};

export type SubmitReviewedResult =
  | { kind: 'placed'; outcome: PlacedOrderOutcome }
  /** Server prices, stock or validity differ from what was reviewed; nothing submitted. */
  | { kind: 'prices_changed'; fresh: SalesmanOrderPreview }
  | { kind: 'failed'; failure: SubmitFailure };

export const PREVIEW_CHECK_TIMEOUT_MS = 20_000;
export const PLACE_TIMEOUT_MS = 30_000;

/**
 * Re-price, compare with what the salesman reviewed, then place exactly once.
 * place_assisted_order still re-prices server-side; this check only stops a
 * silent change between review and submit.
 */
export async function submitReviewedOrder(input: {
  api: SubmitOrderApi;
  shopId: string;
  serviceAreaId: string;
  lines: readonly OrderPreviewLineInput[];
  reviewed: SalesmanOrderPreview;
  notes: string;
  timeouts?: { previewMs: number; placeMs: number };
}): Promise<SubmitReviewedResult> {
  const timeouts = input.timeouts ?? {
    previewMs: PREVIEW_CHECK_TIMEOUT_MS,
    placeMs: PLACE_TIMEOUT_MS,
  };
  const lines = input.lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity }));

  let fresh: SalesmanOrderPreview;
  try {
    fresh = await withSubmitTimeout(input.api.previewOrderLines(lines), timeouts.previewMs);
  } catch (err) {
    return {
      kind: 'failed',
      failure: {
        kind: 'rejected',
        message: `Could not re-check prices, so nothing was submitted (${errorMessage(err, 'network error')}). Try again.`,
      },
    };
  }
  if (
    !previewMatchesCart(fresh, lines) ||
    !fresh.allValid ||
    hasPreviewChanges(diffPreviews(input.reviewed, fresh))
  ) {
    return { kind: 'prices_changed', fresh };
  }

  let orderId: string;
  try {
    orderId = await withSubmitTimeout(
      input.api.placeAssistedOrder({
        shopId: input.shopId,
        serviceAreaId: input.serviceAreaId,
        lines: fresh.lines.map((l) => ({
          skuId: l.skuId,
          quantity: l.quantity,
          agreedUnitPrice: l.unitPrice ?? 0,
        })),
        notes: input.notes.trim() || undefined,
      }),
      timeouts.placeMs,
    );
  } catch (err) {
    const failure = classifySubmitError(err);
    return {
      kind: 'failed',
      failure:
        failure.kind === 'rejected'
          ? { ...failure, message: friendlyOrderError(failure.message) }
          : failure,
    };
  }

  const outcome = await confirmPlacedOrder(orderId, (id) =>
    input.api.sendConfirmationPlaceholder(id),
  );
  return { kind: 'placed', outcome };
}
