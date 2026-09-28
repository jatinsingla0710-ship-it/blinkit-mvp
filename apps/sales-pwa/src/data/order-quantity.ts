import type { Sku } from '@groaurum/shared-types';
import {
  cartQuantitySummary,
  sellingUnitPlural,
} from '@groaurum/catalogue-display';

type QtySku = Pick<Sku, 'moq' | 'quantityStep'>;

const EPSILON = 1e-9;

function step(sku: QtySku): number {
  return sku.quantityStep > 0 ? sku.quantityStep : 1;
}

function isMultiple(qty: number, stepSize: number): boolean {
  const ratio = qty / stepSize;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON;
}

function tidy(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/**
 * Same rule as place_assisted_order: qty >= moq AND mod(qty, quantity_step) = 0.
 * (Not "moq + n*step": with MOQ 5 / step 10 the server rejects 15.)
 */
export function isValidOrderQuantity(sku: QtySku, qty: number): boolean {
  return (
    Number.isFinite(qty) &&
    qty > 0 &&
    qty + EPSILON >= sku.moq &&
    isMultiple(qty, step(sku))
  );
}

/** Smallest quantity the server accepts. */
export function minOrderQuantity(sku: QtySku): number {
  const s = step(sku);
  return tidy(Math.max(1, Math.ceil((sku.moq - EPSILON) / s)) * s);
}

/** Largest valid quantity within stock, or 0 when stock cannot cover the minimum. */
export function maxOrderQuantity(sku: QtySku, available: number): number {
  const s = step(sku);
  const max = tidy(Math.floor((available + EPSILON) / s) * s);
  return max >= minOrderQuantity(sku) ? max : 0;
}

export function stepUp(sku: QtySku, qty: number, available: number): number {
  const s = step(sku);
  const min = minOrderQuantity(sku);
  const next = qty < min ? min : tidy((Math.floor((qty + EPSILON) / s) + 1) * s);
  const max = maxOrderQuantity(sku, available);
  if (max === 0) return qty;
  return Math.min(next, max);
}

/** Returns 0 (remove from cart) below the minimum; never an invalid quantity. */
export function stepDown(sku: QtySku, qty: number): number {
  const s = step(sku);
  const min = minOrderQuantity(sku);
  const prev = tidy((Math.ceil((qty - EPSILON) / s) - 1) * s);
  return prev < min ? 0 : prev;
}

export type QuantityCommit = {
  quantity: number;
  /** Plain-language reason when the typed value was changed. */
  adjustedReason: string | null;
};

/**
 * Normalise a typed quantity: round up to the next valid quantity, cap at
 * stock. The cart only ever holds valid quantities (or 0 = removed).
 */
export function commitTypedQuantity(
  sku: QtySku,
  raw: string,
  available: number,
): QuantityCommit {
  const trimmed = raw.trim();
  if (!trimmed) return { quantity: 0, adjustedReason: null };
  const typed = Number(trimmed);
  if (!Number.isFinite(typed) || typed <= 0) {
    return { quantity: 0, adjustedReason: 'Enter a quantity above zero.' };
  }
  const max = maxOrderQuantity(sku, available);
  if (max === 0) {
    return { quantity: 0, adjustedReason: 'Not enough stock to order this item.' };
  }
  let qty = typed;
  let reason: string | null = null;
  if (!isValidOrderQuantity(sku, qty)) {
    const s = step(sku);
    qty = Math.max(minOrderQuantity(sku), tidy(Math.ceil((qty - EPSILON) / s) * s));
    reason =
      qty === minOrderQuantity(sku) && typed < sku.moq
        ? `Minimum order is ${minOrderQuantity(sku)}.`
        : `Quantity must be in steps of ${s}.`;
  }
  if (qty > max) {
    qty = max;
    reason = `Only ${max} can be ordered from current stock.`;
  }
  return { quantity: qty, adjustedReason: reason };
}

type PackSku = Pick<Sku, 'packsPerCarton' | 'outerType' | 'netQuantityUnit' | 'sellingUnit'>;

/** "50 Packs" — quantity in the selling unit the server stores. */
export function sellingQuantityLabel(sku: PackSku, qty: number): string {
  return `${qty} ${sellingUnitPlural(sku.netQuantityUnit ?? sku.sellingUnit, qty)}`;
}

/** "= 5 Bags" / "= 5 Bags + 3 Packs"; null when the SKU has no outer pack. */
export function outerBreakdownLabel(sku: PackSku, qty: number): string | null {
  if (!qty) return null;
  return cartQuantitySummary({
    quantity: qty,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
    netQuantityUnit: sku.netQuantityUnit ?? sku.sellingUnit,
  });
}

/** "10 Packs per Bag" for catalogue rows. */
export function packInfoLabel(sku: PackSku): string | null {
  if (!sku.packsPerCarton || sku.packsPerCarton <= 0) return null;
  const outer = cartQuantitySummary({
    quantity: sku.packsPerCarton,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
  });
  const outerWord = outer ? outer.replace(/^=\s*1\s+/, '') : 'outer';
  return `${sku.packsPerCarton} ${sellingUnitPlural(
    sku.netQuantityUnit ?? sku.sellingUnit,
    sku.packsPerCarton,
  )} per ${outerWord}`;
}
