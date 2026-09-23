/**
 * Format quantity + unit for Admin commercial / inventory surfaces.
 * Does not invent conversion rules — callers pass the display unit string.
 */
import {
  classifyPackUnit,
  toKilograms,
} from './sku-pack-pricing';

export function formatQuantityWithUnit(
  quantity: number | string | null | undefined,
  unit: string | null | undefined,
): string {
  const qty =
    typeof quantity === 'number'
      ? quantity
      : quantity == null || quantity === ''
        ? NaN
        : Number(quantity);
  const qtyLabel = Number.isFinite(qty)
    ? String(qty)
    : quantity == null
      ? '—'
      : String(quantity).trim() || '—';
  const unitLabel = (unit ?? '').trim();
  if (!unitLabel) return qtyLabel;
  return `${qtyLabel} ${unitLabel}`;
}

/** Normalize selling_unit_snapshot / selling_unit for invoice / order lines. */
export function humanizeSellingUnit(unit: string | null | undefined): string {
  const raw = (unit ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const aliases: Record<string, string> = {
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    g: 'g',
    gram: 'g',
    grams: 'g',
    pcs: 'pcs',
    pc: 'pcs',
    piece: 'pcs',
    pieces: 'pcs',
    pack: 'packs',
    packs: 'packs',
    bag: 'bags',
    bags: 'bags',
    carton: 'cartons',
    cartons: 'cartons',
    box: 'boxes',
    boxes: 'boxes',
  };
  return aliases[lower] ?? lower;
}

/**
 * Inventory quantity label. For PACK + mass net quantity, show mass equivalent
 * (e.g. 240 × 250 g packs → "60 kg") using existing pack conversion helpers.
 */
export function formatInventoryQuantityLabel(input: {
  quantity: number;
  sellingUnit?: string | null;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
}): string {
  const qty = input.quantity;
  const selling = (input.sellingUnit ?? '').trim().toUpperCase();
  const netQty = Number(input.netQuantity);
  const netUnit = input.netQuantityUnit ?? '';

  if (
    selling === 'PACK' &&
    Number.isFinite(netQty) &&
    netQty > 0 &&
    classifyPackUnit(netUnit) === 'mass'
  ) {
    const packKg = toKilograms(netQty, netUnit);
    if (packKg != null && packKg > 0) {
      const totalKg = qty * packKg;
      if (totalKg >= 1) {
        const rounded =
          Math.abs(totalKg - Math.round(totalKg)) < 1e-6
            ? Math.round(totalKg)
            : Number(totalKg.toFixed(3));
        return formatQuantityWithUnit(rounded, 'kg');
      }
      const grams = totalKg * 1000;
      const roundedG =
        Math.abs(grams - Math.round(grams)) < 1e-6
          ? Math.round(grams)
          : Number(grams.toFixed(1));
      return formatQuantityWithUnit(roundedG, 'g');
    }
  }

  if (
    selling === 'PACK' &&
    Number.isFinite(netQty) &&
    netQty > 0 &&
    classifyPackUnit(netUnit) === 'piece'
  ) {
    const total = qty * netQty;
    return formatQuantityWithUnit(total, 'pcs');
  }

  const unitDisplay =
    humanizeSellingUnit(input.sellingUnit) ||
    (input.sellingUnit ?? '').trim() ||
    'units';
  return formatQuantityWithUnit(qty, unitDisplay);
}
