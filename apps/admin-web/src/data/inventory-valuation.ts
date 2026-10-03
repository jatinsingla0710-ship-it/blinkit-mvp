/**
 * Phase 4 — Weighted Average Cost (WAC) inventory valuation.
 * Mirrors SQL trigger inventory_movements_apply_wac.
 * Phase 5 reads stamped movement unit_cost for COGS — this module only values stock.
 */

export type InventoryWacBalance = {
  onHandQuantity: number;
  averageUnitCost: number | null;
  stockValue: number;
};

export type InventoryWacReceiptResult = InventoryWacBalance & {
  unitCostApplied: number;
};

export type InventoryWacIssueResult = InventoryWacBalance & {
  unitCostApplied: number | null;
};

function roundMoney(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function roundCost(value: number): number {
  return roundMoney(value, 4);
}

/**
 * Blend an inbound receipt into WAC.
 * newValue = oldValue + qty * unitCost
 * newAvg = newValue / newQty
 */
export function applyWacReceipt(
  balance: InventoryWacBalance,
  receiptQty: number,
  unitCost: number,
): InventoryWacReceiptResult {
  const qty = Number(receiptQty) || 0;
  const cost = roundCost(unitCost);
  if (qty <= 0) {
    throw new Error('Receipt quantity must be positive');
  }
  if (cost < 0) {
    throw new Error('Unit cost cannot be negative');
  }

  const oldQty = Number(balance.onHandQuantity) || 0;
  const oldValue = roundMoney(balance.stockValue);
  const newQty = roundMoney(oldQty + qty, 3);
  const newValue = roundMoney(oldValue + qty * cost);
  const averageUnitCost = newQty > 0 ? roundCost(newValue / newQty) : null;

  return {
    onHandQuantity: newQty,
    averageUnitCost,
    stockValue: newQty > 0 ? newValue : 0,
    unitCostApplied: cost,
  };
}

/**
 * Reduce stock at current average. Average is unchanged while qty remains.
 * When qty hits zero, average clears and stock value is 0.
 */
export function applyWacIssue(
  balance: InventoryWacBalance,
  issueQty: number,
): InventoryWacIssueResult {
  const qty = Number(issueQty) || 0;
  if (qty <= 0) {
    throw new Error('Issue quantity must be positive');
  }

  const oldQty = Number(balance.onHandQuantity) || 0;
  if (qty > oldQty + 1e-9) {
    throw new Error('Cannot issue more than on-hand quantity');
  }

  const newQty = roundMoney(oldQty - qty, 3);
  const avg = balance.averageUnitCost;

  if (newQty <= 0) {
    return {
      onHandQuantity: 0,
      averageUnitCost: null,
      stockValue: 0,
      unitCostApplied: avg,
    };
  }

  if (avg == null) {
    return {
      onHandQuantity: newQty,
      averageUnitCost: null,
      stockValue: roundMoney(balance.stockValue),
      unitCostApplied: null,
    };
  }

  const averageUnitCost = roundCost(avg);
  return {
    onHandQuantity: newQty,
    averageUnitCost,
    stockValue: roundMoney(newQty * averageUnitCost),
    unitCostApplied: averageUnitCost,
  };
}

export function formatWacUnitCost(averageUnitCost: number | null): string {
  if (averageUnitCost == null || !Number.isFinite(averageUnitCost)) {
    return '—';
  }
  return `₹${averageUnitCost.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}
