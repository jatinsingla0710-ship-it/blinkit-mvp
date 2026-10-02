/**
 * Business-friendly packaging display shared by Admin and Customer apps.
 * Inventory is stored in selling-pack units (inventory_balances); display decomposes to outers + loose.
 */

export type OuterPackageKey =
  | 'box'
  | 'carton'
  | 'case'
  | 'crate'
  | 'bundle'
  | 'bag';

export const OUTER_LABELS: Record<
  OuterPackageKey,
  { singular: string; plural: string }
> = {
  box: { singular: 'Box', plural: 'Boxes' },
  carton: { singular: 'Carton', plural: 'Cartons' },
  case: { singular: 'Case', plural: 'Cases' },
  crate: { singular: 'Crate', plural: 'Crates' },
  bundle: { singular: 'Bundle', plural: 'Bundles' },
  bag: { singular: 'Bag', plural: 'Bags' },
};

export type PackConfig = {
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  packsPerOuter?: number | null;
  outerType?: string | null;
};

export type MixedInventoryDisplay = {
  /** e.g. "5 Bags + 3 Pieces" */
  mixedLabel: string;
  /** e.g. "250 kg" */
  totalWeightLabel?: string;
  fullOuters: number;
  loosePacks: number;
  totalPacks: number;
};

export type PackagingSummary = {
  sellingUnitLabel: string;
  outerUnitLabel?: string;
  piecesPerOuter?: number;
  weightPerPieceLabel?: string;
  weightPerOuterLabel?: string;
  isValid: boolean;
  validationError?: string;
};

const WEIGHT_TO_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  tonne: 1_000_000,
};

const PIECE_ALIASES = new Set([
  'pcs',
  'pc',
  'piece',
  'pieces',
  'unit',
  'units',
]);

export function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

export function isWeightUnit(unit: string | null | undefined): boolean {
  return normalizeUnit(unit) in WEIGHT_TO_GRAMS;
}

export function isPieceUnit(unit: string | null | undefined): boolean {
  return PIECE_ALIASES.has(normalizeUnit(unit));
}

export function resolveOuterKey(
  value: string | null | undefined,
): OuterPackageKey {
  const key = normalizeUnit(value) as OuterPackageKey;
  if (key in OUTER_LABELS) return key;
  return 'bag';
}

export function sellingUnitLabel(unit: string | null | undefined): string {
  const u = normalizeUnit(unit);
  const named: Record<string, string> = {
    bottle: 'Bottle',
    can: 'Can',
    tin: 'Tin',
    packet: 'Packet',
    pack: 'Pack',
    pouch: 'Pouch',
    jar: 'Jar',
    box: 'Box',
    bag: 'Bag',
    carton: 'Carton',
    case: 'Case',
    crate: 'Crate',
    bundle: 'Bundle',
    dozen: 'Dozen',
    pair: 'Pair',
    drum: 'Drum',
    roll: 'Roll',
    tray: 'Tray',
    // Explicit selling-unit codes (skus.selling_unit) — not pack net-content size.
    // Do NOT map bare "g" here: net_quantity_unit "g" means pack contents → Pack.
    kg: 'Kg',
    kilogram: 'Kg',
    kilograms: 'Kg',
    gram: 'g',
    grams: 'g',
    litre: 'Litre',
    liter: 'Litre',
    litres: 'Litre',
    liters: 'Litre',
    l: 'Litre',
    ml: 'ml',
    millilitre: 'ml',
    milliliter: 'ml',
    pcs: 'Piece',
    pc: 'Piece',
  };
  if (named[u]) return named[u];
  if (isPieceUnit(u)) return 'Piece';
  // Net content units (e.g. pack is 250g) still display as Pack for inventory packs.
  if (isWeightUnit(u) || isVolumeUnit(u)) return 'Pack';
  return unit?.trim() || 'Unit';
}

function isVolumeUnit(unit: string): boolean {
  return ['ml', 'litre', 'liter', 'litres', 'liters', 'l'].includes(unit);
}

export function sellingUnitPlural(unit: string | null | undefined, count: number): string {
  const base = sellingUnitLabel(unit);
  if (count === 1) return base;
  if (base === 'Piece') return 'Pieces';
  if (base === 'Pack') return 'Packs';
  if (base === 'Bottle') return 'Bottles';
  if (base === 'Carton') return 'Cartons';
  if (base === 'Packet') return 'Packets';
  if (base === 'Box') return 'Boxes';
  if (base === 'Bag') return 'Bags';
  if (base === 'Case') return 'Cases';
  if (base === 'Crate') return 'Crates';
  if (base === 'Bundle') return 'Bundles';
  if (base === 'Litre') return 'Litres';
  if (base === 'Kg' || base === 'g' || base === 'ml') return base;
  return `${base}s`;
}

/** Outer package keys that can be a salesman-facing selling unit. */
const OUTER_SELLING_CODES = new Set([
  'box',
  'carton',
  'case',
  'crate',
  'bundle',
  'bag',
]);

/**
 * True when order qty (moq/step) is stored in whole outer multiples.
 * Inventory/order lines remain in packs; UI converts to outers.
 */
export function sellsInOuterUnits(input: {
  packsPerOuter?: number | null;
  outerType?: string | null;
  moq: number;
  quantityStep: number;
}): boolean {
  const ppo = Number(input.packsPerOuter ?? 0);
  if (!Number.isFinite(ppo) || ppo <= 1) return false;
  if (!input.outerType || !OUTER_SELLING_CODES.has(normalizeUnit(input.outerType))) {
    return false;
  }
  const step = Number(input.quantityStep) > 0 ? Number(input.quantityStep) : 1;
  const moq = Number(input.moq);
  const stepOk = Math.abs(step / ppo - Math.round(step / ppo)) < 1e-9;
  const moqOk = Math.abs(moq / ppo - Math.round(moq / ppo)) < 1e-9;
  return stepOk && moqOk && step >= ppo;
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatInr(amount: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`;
}

export function decomposePacksToOuter(input: {
  totalPacks: number;
  packsPerOuter: number;
}): { fullOuters: number; loosePacks: number } {
  const per = input.packsPerOuter;
  if (!Number.isFinite(per) || per <= 0) {
    return { fullOuters: 0, loosePacks: Math.max(0, Math.round(input.totalPacks)) };
  }
  const total = Math.max(0, Math.round(input.totalPacks));
  return {
    fullOuters: Math.floor(total / per),
    loosePacks: total % per,
  };
}

export function totalWeightGrams(input: {
  totalPacks: number;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
}): number | null {
  const qty = input.netQuantity ?? 0;
  const factor = WEIGHT_TO_GRAMS[normalizeUnit(input.netQuantityUnit)];
  if (!factor || qty <= 0) return null;
  return input.totalPacks * qty * factor;
}

export function formatWeightFromGrams(grams: number): string {
  if (grams >= 1000) {
    return `${roundMoney(grams / 1000)} kg`;
  }
  return `${roundMoney(grams)} g`;
}

export function buildMixedInventoryDisplay(input: {
  totalPacks: number;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  packsPerOuter?: number | null;
  outerType?: string | null;
}): MixedInventoryDisplay {
  const totalPacks = Math.max(0, Math.round(input.totalPacks));
  // Inventory counts packs. Net-content kg/g/ml is weight/volume of one pack, not the count unit.
  const packCountUnit =
    isWeightUnit(input.netQuantityUnit) ||
    isVolumeUnit(normalizeUnit(input.netQuantityUnit))
      ? 'pack'
      : (input.netQuantityUnit ?? 'pack');
  const perOuter = input.packsPerOuter;

  let mixedLabel: string;
  let fullOuters = 0;
  let loosePacks = totalPacks;

  if (perOuter != null && perOuter > 0) {
    const decomposed = decomposePacksToOuter({ totalPacks, packsPerOuter: perOuter });
    fullOuters = decomposed.fullOuters;
    loosePacks = decomposed.loosePacks;
    const outerKey = resolveOuterKey(input.outerType);
    const outerWord =
      fullOuters === 1
        ? OUTER_LABELS[outerKey].singular
        : OUTER_LABELS[outerKey].plural;
    const parts: string[] = [];
    if (fullOuters > 0) parts.push(`${fullOuters} ${outerWord}`);
    if (loosePacks > 0) {
      parts.push(
        `${loosePacks} ${sellingUnitPlural(packCountUnit, loosePacks)}`,
      );
    }
    mixedLabel = parts.length
      ? parts.join(' + ')
      : `0 ${sellingUnitPlural(packCountUnit, 2)}`;
  } else {
    mixedLabel = `${totalPacks} ${sellingUnitPlural(packCountUnit, totalPacks)}`;
  }

  const grams = totalWeightGrams({
    totalPacks,
    netQuantity: input.netQuantity,
    netQuantityUnit: input.netQuantityUnit,
  });

  return {
    mixedLabel,
    totalWeightLabel: grams != null ? formatWeightFromGrams(grams) : undefined,
    fullOuters,
    loosePacks,
    totalPacks,
  };
}

export function buildPackagingSummary(input: {
  netQuantity: number;
  netQuantityUnit: string;
  packsPerOuter?: number | null;
  outerType?: string | null;
}): PackagingSummary {
  const outerKey = resolveOuterKey(input.outerType);
  const outerLabels = OUTER_LABELS[outerKey];
  const weightPerPiece =
    isWeightUnit(input.netQuantityUnit) && input.netQuantity > 0
      ? `${input.netQuantity} ${normalizeUnit(input.netQuantityUnit)}`
      : undefined;

  let weightPerOuterLabel: string | undefined;
  let isValid = true;
  let validationError: string | undefined;

  if (input.packsPerOuter != null && input.packsPerOuter > 0) {
    const gramsPerPiece = totalWeightGrams({
      totalPacks: 1,
      netQuantity: input.netQuantity,
      netQuantityUnit: input.netQuantityUnit,
    });
    if (gramsPerPiece != null) {
      const totalGrams = gramsPerPiece * input.packsPerOuter;
      weightPerOuterLabel = formatWeightFromGrams(totalGrams);
    }
  }

  if (
    input.packsPerOuter != null &&
    input.packsPerOuter > 0 &&
    !Number.isInteger(input.packsPerOuter)
  ) {
    isValid = false;
    validationError = 'Pieces per outer package must be a whole number';
  }

  return {
    sellingUnitLabel: sellingUnitLabel(input.netQuantityUnit),
    outerUnitLabel: outerLabels.singular,
    piecesPerOuter: input.packsPerOuter ?? undefined,
    weightPerPieceLabel: weightPerPiece,
    weightPerOuterLabel,
    isValid,
    validationError,
  };
}

export function cartQuantitySummary(input: {
  quantity: number;
  packsPerOuter?: number | null;
  outerType?: string | null;
  netQuantityUnit?: string | null;
}): string | null {
  const per = input.packsPerOuter;
  if (!per || per <= 0) return null;
  const { fullOuters, loosePacks } = decomposePacksToOuter({
    totalPacks: input.quantity,
    packsPerOuter: per,
  });
  const outerKey = resolveOuterKey(input.outerType);
  const outerWord =
    fullOuters === 1
      ? OUTER_LABELS[outerKey].singular
      : OUTER_LABELS[outerKey].plural;
  const parts: string[] = [];
  if (fullOuters > 0) parts.push(`${fullOuters} ${outerWord}`);
  if (loosePacks > 0) {
    const packCountUnit =
      isWeightUnit(input.netQuantityUnit) ||
      isVolumeUnit(normalizeUnit(input.netQuantityUnit))
        ? 'pack'
        : (input.netQuantityUnit ?? 'pack');
    parts.push(`${loosePacks} ${sellingUnitPlural(packCountUnit, loosePacks)}`);
  }
  return parts.length ? `= ${parts.join(' + ')}` : null;
}
