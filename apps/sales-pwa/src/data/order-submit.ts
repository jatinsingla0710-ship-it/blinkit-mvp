import type { SalesmanRetailer } from '@groaurum/api-client';

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
    return { canSubmit: false, reason: 'Retailers could not be loaded.' };
  }
  if (input.retailersLoading || input.retailers === undefined) {
    return { canSubmit: false, reason: 'Loading retailers…' };
  }
  if (!input.shopId) {
    return { canSubmit: false, reason: 'Select a retailer to continue.' };
  }
  const shop = input.retailers.find((r) => r.id === input.shopId);
  if (!shop) {
    return {
      canSubmit: false,
      reason:
        'This retailer is not in your assigned list. Pick a retailer from the list.',
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
