import type { Sku } from '@groaurum/shared-types';
import {
  OUTER_LABELS,
  cartQuantitySummary,
  resolveOuterKey,
  sellsInOuterUnits,
  sellingUnitPlural,
} from '@groaurum/catalogue-display';

type QtySku = Pick<Sku, 'moq' | 'quantityStep'>;
type PackSku = Pick<
  Sku,
  | 'packsPerCarton'
  | 'outerType'
  | 'netQuantityUnit'
  | 'sellingUnit'
  | 'moq'
  | 'quantityStep'
  | 'containerPriceMode'
  | 'containerCustomPrice'
>;

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

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Whether the salesman should order in outer packages (Box/Bag/…). */
export function skuSellsInOuterUnits(sku: PackSku & QtySku): boolean {
  return sellsInOuterUnits({
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
    moq: sku.moq,
    quantityStep: sku.quantityStep,
  });
}

/** Packs per one UI order unit (outer or pack). */
export function packsPerOrderUnit(sku: PackSku & QtySku): number {
  if (skuSellsInOuterUnits(sku) && sku.packsPerCarton && sku.packsPerCarton > 0) {
    return sku.packsPerCarton;
  }
  return 1;
}

/** Pack qty → salesman-facing order qty. */
export function toOrderUnits(sku: PackSku & QtySku, packQty: number): number {
  const factor = packsPerOrderUnit(sku);
  return tidy(packQty / factor);
}

/** Salesman-facing order qty → pack qty for cart/server. */
export function toPackQuantity(sku: PackSku & QtySku, orderUnits: number): number {
  return tidy(orderUnits * packsPerOrderUnit(sku));
}

/**
 * Same rule as place_assisted_order: qty >= moq AND mod(qty, quantity_step) = 0.
 * Quantity is always in **packs** (server inventory unit).
 */
export function isValidOrderQuantity(sku: QtySku, qty: number): boolean {
  return (
    Number.isFinite(qty) &&
    qty > 0 &&
    qty + EPSILON >= sku.moq &&
    isMultiple(qty, step(sku))
  );
}

/** Smallest pack quantity the server accepts. */
export function minOrderQuantity(sku: QtySku): number {
  const s = step(sku);
  return tidy(Math.max(1, Math.ceil((sku.moq - EPSILON) / s)) * s);
}

/** Largest valid pack quantity within stock, or 0 when stock cannot cover the minimum. */
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
  /** Pack quantity for cart/server (0 = remove). */
  quantity: number;
  /** Plain-language reason when the typed value was changed. */
  adjustedReason: string | null;
};

/**
 * Normalise a typed quantity in **order units** (Box/Kg/Pack as shown to salesman).
 * Returns pack quantity for the cart.
 */
export function commitTypedQuantity(
  sku: PackSku & QtySku,
  raw: string,
  available: number,
): QuantityCommit {
  const trimmed = raw.trim();
  if (!trimmed) return { quantity: 0, adjustedReason: null };
  const typedOrder = Number(trimmed);
  if (!Number.isFinite(typedOrder) || typedOrder <= 0) {
    return { quantity: 0, adjustedReason: 'Enter a quantity above zero.' };
  }
  const max = maxOrderQuantity(sku, available);
  if (max === 0) {
    return { quantity: 0, adjustedReason: 'Not enough stock to order this item.' };
  }

  let packQty = toPackQuantity(sku, typedOrder);
  let reason: string | null = null;
  if (!isValidOrderQuantity(sku, packQty)) {
    const s = step(sku);
    packQty = Math.max(minOrderQuantity(sku), tidy(Math.ceil((packQty - EPSILON) / s) * s));
    const minOrder = toOrderUnits(sku, minOrderQuantity(sku));
    const stepOrder = toOrderUnits(sku, s);
    reason =
      packQty === minOrderQuantity(sku) && typedOrder < minOrder
        ? `Minimum order is ${formatOrderQuantity(sku, minOrderQuantity(sku))}.`
        : `Quantity must be in steps of ${stepOrder}.`;
  }
  if (packQty > max) {
    packQty = max;
    reason = `Only ${formatOrderQuantity(sku, max)} can be ordered from current stock.`;
  }
  return { quantity: packQty, adjustedReason: reason };
}

/** Singular/plural label for the salesman order unit (Box, Kg, Pack…). */
export function orderUnitWord(sku: PackSku & QtySku, orderUnits: number): string {
  if (skuSellsInOuterUnits(sku) && sku.outerType) {
    const key = resolveOuterKey(sku.outerType);
    const meta = OUTER_LABELS[key];
    return orderUnits === 1 ? meta.singular : meta.plural;
  }
  // Prefer configured selling unit (KG, BOX, PCS…) over pack net-content unit (g/ml).
  const unit = sku.sellingUnit || sku.netQuantityUnit;
  return sellingUnitPlural(unit, orderUnits);
}

/** "2 Boxes" / "1.5 Kg" / "50 Packs" — salesman-facing quantity. */
export function formatOrderQuantity(sku: PackSku & QtySku, packQty: number): string {
  const orderQty = toOrderUnits(sku, packQty);
  const shown =
    Math.abs(orderQty - Math.round(orderQty)) < EPSILON
      ? String(Math.round(orderQty))
      : String(tidy(orderQty));
  return `${shown} ${orderUnitWord(sku, orderQty)}`;
}

/** @deprecated Prefer formatOrderQuantity — kept for existing call sites. */
export function sellingQuantityLabel(sku: PackSku, qty: number): string {
  return formatOrderQuantity(sku, qty);
}

/** Price shown on the card: per Box when selling by outer, else per selling unit. */
export function displayUnitPrice(
  sku: PackSku & QtySku,
  packUnitPrice: number,
): { price: number; unitLabel: string } {
  if (skuSellsInOuterUnits(sku) && sku.packsPerCarton && sku.packsPerCarton > 0) {
    const custom =
      sku.containerPriceMode === 'custom' &&
      sku.containerCustomPrice != null &&
      Number.isFinite(sku.containerCustomPrice)
        ? Number(sku.containerCustomPrice)
        : null;
    const price =
      custom != null && custom > 0
        ? roundMoney(custom)
        : roundMoney(packUnitPrice * sku.packsPerCarton);
    return { price, unitLabel: orderUnitWord(sku, 1) };
  }
  return {
    price: roundMoney(packUnitPrice),
    unitLabel: orderUnitWord(sku, 1),
  };
}

/** "= 5 Bags" / "= 5 Bags + 3 Packs"; null when selling already in outers or no outer. */
export function outerBreakdownLabel(sku: PackSku, qty: number): string | null {
  if (!qty) return null;
  if (
    sellsInOuterUnits({
      packsPerOuter: sku.packsPerCarton,
      outerType: sku.outerType,
      moq: sku.moq,
      quantityStep: sku.quantityStep,
    })
  ) {
    return null;
  }
  return cartQuantitySummary({
    quantity: qty,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
    // Inventory pack count label — not net-content unit (g/kg).
    netQuantityUnit: 'pack',
  });
}

/** "40 Packs per Box" for catalogue rows. */
export function packInfoLabel(sku: PackSku): string | null {
  if (!sku.packsPerCarton || sku.packsPerCarton <= 0) return null;
  const outer = cartQuantitySummary({
    quantity: sku.packsPerCarton,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
  });
  const outerWord = outer ? outer.replace(/^=\s*1\s+/, '') : 'outer';
  // Always "Packs" for the inventory pack count — not net-content unit (g/kg).
  return `${sku.packsPerCarton} ${sellingUnitPlural('pack', sku.packsPerCarton)} per ${outerWord}`;
}

/** Min / step copy in salesman units, e.g. "Minimum 1 Box". */
export function orderRulesLabel(sku: PackSku & QtySku): string | null {
  const minPacks = minOrderQuantity(sku);
  const stepPacks = step(sku);
  const minOrder = toOrderUnits(sku, minPacks);
  const stepOrder = toOrderUnits(sku, stepPacks);
  if (minOrder <= 1 && stepOrder <= 1 && !skuSellsInOuterUnits(sku)) {
    return null;
  }
  const parts: string[] = [];
  if (minOrder > 1 || skuSellsInOuterUnits(sku)) {
    parts.push(`Minimum ${formatOrderQuantity(sku, minPacks)}`);
  }
  if (stepOrder !== 1 || skuSellsInOuterUnits(sku)) {
    parts.push(`Step ${stepOrder} ${orderUnitWord(sku, stepOrder)}`);
  }
  return parts.length ? parts.join(' · ') : null;
}
