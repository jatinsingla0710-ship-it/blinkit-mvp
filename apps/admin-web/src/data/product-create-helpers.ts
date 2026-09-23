/**
 * Helpers for Admin product create guided flow (pack name, initial stock).
 * Uses pack-units + sku-pack-pricing — does not invent new formulas.
 */
import {
  inventorySummary,
  packUnitPluralLabel,
  resolvePackUnit,
  toFamilyBase,
} from './pack-units';
import { classifyPackUnit, toKilograms } from './sku-pack-pricing';

export function autoSkuDisplayName(
  productName: string,
  packQuantity: number,
  packUnit: string,
): string {
  const name = productName.trim();
  const unit = packUnit.trim();
  if (!name || !Number.isFinite(packQuantity) || packQuantity <= 0 || !unit) {
    return name;
  }
  const compact = ['mg', 'g', 'kg', 'ml', 'pcs'].includes(unit.toLowerCase());
  if (compact) {
    return `${name} ${packQuantity}${unit}`;
  }
  return `${name} ${packQuantity} ${unit}`;
}

export function suggestSkuCode(
  productName: string,
  packQuantity: number,
  packUnit: string,
): string {
  const slug = productName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
  const qty = Number.isFinite(packQuantity) ? String(packQuantity) : '';
  const unit = packUnit.trim().toUpperCase();
  if (!slug) return '';
  return `${slug}-${qty}${unit}`.replace(/--+/g, '-');
}

function isPackCountUnit(
  stockUnit: string,
  packUnit: string,
): boolean {
  if (stockUnit === 'pack' || stockUnit === 'packs') return true;
  const packDef = resolvePackUnit(packUnit);
  if (!packDef) return false;
  // Weight/volume pack contents use measurable conversion, not unit-name counts.
  if (packDef.category === 'weight' || packDef.category === 'volume') {
    return false;
  }
  return (
    stockUnit === packDef.key ||
    stockUnit === packDef.plural ||
    stockUnit === packDef.label ||
    stockUnit === `${packDef.key}s`
  );
}

/**
 * Convert Admin-entered opening stock into on-hand quantity in selling packs.
 * Inventory balances store pack counts (existing architecture).
 */
export function openingStockToPackQuantity(input: {
  quantity: number;
  unit: string;
  packQuantity: number;
  packUnit: string;
}): { onHandPacks: number } | { error: string } {
  const { quantity, unit, packQuantity, packUnit } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'Initial stock must be greater than zero' };
  }
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) {
    return { error: 'Pack size is required before entering initial stock' };
  }

  const stockUnit = unit.trim().toLowerCase();
  const packPlural = packUnitPluralLabel(packUnit, 2);

  // Direct pack / bottle / bag / pcs counts → on-hand packs
  if (isPackCountUnit(stockUnit, packUnit)) {
    const rounded = Math.round(quantity);
    if (Math.abs(quantity - rounded) > 1e-6) {
      return { error: `Stock must be a whole number of ${packPlural}` };
    }
    return { onHandPacks: rounded };
  }

  const packKind = classifyPackUnit(packUnit);
  const stockKind = classifyPackUnit(stockUnit);

  if (packKind === 'mass' && stockKind === 'mass') {
    const stockKg = toKilograms(quantity, stockUnit);
    const packKg = toKilograms(packQuantity, packUnit);
    if (stockKg == null || packKg == null || packKg <= 0) {
      return { error: 'Could not convert stock/pack sizes to kilograms' };
    }
    const packs = stockKg / packKg;
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6) {
      return {
        error: `Stock does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { onHandPacks: rounded };
  }

  if (packKind === 'volume' && stockKind === 'volume') {
    const stockBase = toFamilyBase(quantity, stockUnit);
    const packBase = toFamilyBase(packQuantity, packUnit);
    if (!stockBase || !packBase || packBase.baseAmount <= 0) {
      return { error: 'Could not convert stock/pack sizes to millilitres' };
    }
    const packs = stockBase.baseAmount / packBase.baseAmount;
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6) {
      return {
        error: `Stock does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { onHandPacks: rounded };
  }

  if (packKind === 'piece' && stockKind === 'piece') {
    const packs = quantity / packQuantity;
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6 || rounded <= 0) {
      return {
        error: `Stock does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { onHandPacks: rounded };
  }

  if (stockUnit === packUnit.trim().toLowerCase() && packQuantity === 1) {
    return { onHandPacks: quantity };
  }

  return {
    error: `Initial stock unit must be ${packPlural}, or a compatible measurable unit`,
  };
}

export function formatInitialInventoryPreview(input: {
  quantity: number;
  unit: string;
  packQuantity: number;
  packUnit: string;
}): string | { error: string } {
  const converted = openingStockToPackQuantity(input);
  if ('error' in converted) return converted;
  return inventorySummary({
    quantity: converted.onHandPacks,
    packQuantity: input.packQuantity,
    packUnit: input.packUnit,
  });
}
