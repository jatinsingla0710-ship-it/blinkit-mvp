/**
 * Client-side inventory adjustment planning (mirrors RPC rules for UX/tests).
 * Authoritative enforcement remains in admin_adjust_inventory_balance.
 */

export type InventoryAdjustmentPlan =
  | {
      ok: true;
      delta: number;
      skipMovement: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export function planInventoryAdjustment(input: {
  currentOnHand: number;
  reservedQuantity: number;
  newOnHandQuantity: number;
}): InventoryAdjustmentPlan {
  const { currentOnHand, reservedQuantity, newOnHandQuantity } = input;

  if (!Number.isFinite(newOnHandQuantity) || newOnHandQuantity < 0) {
    return { ok: false, error: 'On-hand quantity must be a non-negative number' };
  }
  if (!Number.isFinite(currentOnHand) || !Number.isFinite(reservedQuantity)) {
    return { ok: false, error: 'Current inventory quantities are invalid' };
  }
  if (reservedQuantity < 0) {
    return { ok: false, error: 'Reserved quantity must be non-negative' };
  }
  if (newOnHandQuantity < reservedQuantity) {
    return {
      ok: false,
      error: `Cannot set on-hand (${newOnHandQuantity}) below reserved stock (${reservedQuantity}) for this warehouse`,
    };
  }

  const delta = newOnHandQuantity - currentOnHand;
  return {
    ok: true,
    delta,
    skipMovement: delta === 0,
  };
}
