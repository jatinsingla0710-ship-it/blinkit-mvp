/**
 * Central pack-unit compatibility for Admin product create / SKU pricing.
 * Used by Selling Pack + Initial Inventory UI and sku-pack-pricing helpers.
 *
 * Persistence mapping (unchanged schema):
 * - Pack size     → skus.net_quantity + skus.net_quantity_unit
 * - Outer count   → skus.packs_per_carton
 * - Pack price    → sku_prices.trade_price (per selling pack)
 * - selling_unit  → derived for order snapshots (not a separate UI field)
 */

export type UnitCategory = 'weight' | 'volume' | 'count' | 'packaging';

export type ConversionFamily = 'weight' | 'volume' | 'count' | 'none';

/** Price-entry bases shown in Admin; pack trade price is what we store. */
export type PriceBasis =
  | 'per_mg'
  | 'per_g'
  | 'per_kg'
  | 'per_tonne'
  | 'per_ml'
  | 'per_litre'
  | 'per_piece'
  | 'per_pair'
  | 'per_dozen'
  | 'per_bag'
  | 'per_bottle'
  | 'per_box'
  | 'per_packet'
  | 'per_pouch'
  | 'per_jar'
  | 'per_can'
  | 'per_carton'
  | 'per_drum'
  | 'per_pack';

export type PackUnitKey =
  | 'mg'
  | 'g'
  | 'kg'
  | 'tonne'
  | 'ml'
  | 'litre'
  | 'pcs'
  | 'pair'
  | 'dozen'
  | 'bag'
  | 'bottle'
  | 'box'
  | 'packet'
  | 'pouch'
  | 'jar'
  | 'can'
  | 'carton'
  | 'drum';

export type OuterPackageKey =
  | 'box'
  | 'carton'
  | 'case'
  | 'crate'
  | 'bundle'
  | 'bag';

export type PackUnitDefinition = {
  key: PackUnitKey;
  label: string;
  plural: string;
  category: UnitCategory;
  family: ConversionFamily;
  /** Factor relative to family base (weight→g, volume→ml). */
  toBase?: number;
  priceBases: readonly PriceBasis[];
  defaultPriceBasis: PriceBasis;
  /** Value written to skus.selling_unit for order snapshots. */
  sellingUnitCode: string;
};

export type OuterPackageDefinition = {
  key: OuterPackageKey;
  label: string;
  plural: string;
};

const WEIGHT_BASES = ['per_mg', 'per_g', 'per_kg', 'per_tonne', 'per_pack'] as const;
const VOLUME_BASES = ['per_ml', 'per_litre', 'per_pack'] as const;

export const PACK_UNITS: Record<PackUnitKey, PackUnitDefinition> = {
  mg: {
    key: 'mg',
    label: 'mg',
    plural: 'mg',
    category: 'weight',
    family: 'weight',
    toBase: 0.001,
    priceBases: WEIGHT_BASES,
    defaultPriceBasis: 'per_g',
    sellingUnitCode: 'PACK',
  },
  g: {
    key: 'g',
    label: 'g',
    plural: 'g',
    category: 'weight',
    family: 'weight',
    toBase: 1,
    priceBases: ['per_g', 'per_kg', 'per_pack'],
    defaultPriceBasis: 'per_kg',
    sellingUnitCode: 'PACK',
  },
  kg: {
    key: 'kg',
    label: 'kg',
    plural: 'kg',
    category: 'weight',
    family: 'weight',
    toBase: 1000,
    priceBases: ['per_kg', 'per_g', 'per_pack'],
    defaultPriceBasis: 'per_kg',
    sellingUnitCode: 'KG',
  },
  tonne: {
    key: 'tonne',
    label: 'tonne',
    plural: 'tonnes',
    category: 'weight',
    family: 'weight',
    toBase: 1_000_000,
    priceBases: ['per_tonne', 'per_kg', 'per_pack'],
    defaultPriceBasis: 'per_tonne',
    sellingUnitCode: 'PACK',
  },
  ml: {
    key: 'ml',
    label: 'ml',
    plural: 'ml',
    category: 'volume',
    family: 'volume',
    toBase: 1,
    priceBases: VOLUME_BASES,
    defaultPriceBasis: 'per_litre',
    sellingUnitCode: 'PACK',
  },
  litre: {
    key: 'litre',
    label: 'litre',
    plural: 'litres',
    category: 'volume',
    family: 'volume',
    toBase: 1000,
    priceBases: ['per_litre', 'per_ml', 'per_pack'],
    defaultPriceBasis: 'per_litre',
    sellingUnitCode: 'LITRE',
  },
  pcs: {
    key: 'pcs',
    label: 'pcs',
    plural: 'pcs',
    category: 'count',
    family: 'count',
    priceBases: ['per_piece', 'per_pack'],
    defaultPriceBasis: 'per_piece',
    sellingUnitCode: 'PCS',
  },
  pair: {
    key: 'pair',
    label: 'pair',
    plural: 'pairs',
    category: 'count',
    family: 'count',
    priceBases: ['per_pair', 'per_pack'],
    defaultPriceBasis: 'per_pair',
    sellingUnitCode: 'PAIR',
  },
  dozen: {
    key: 'dozen',
    label: 'dozen',
    plural: 'dozen',
    category: 'count',
    family: 'count',
    priceBases: ['per_dozen', 'per_pack'],
    defaultPriceBasis: 'per_dozen',
    sellingUnitCode: 'DOZEN',
  },
  bag: {
    key: 'bag',
    label: 'bag',
    plural: 'bags',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_bag', 'per_pack'],
    defaultPriceBasis: 'per_bag',
    sellingUnitCode: 'BAG',
  },
  bottle: {
    key: 'bottle',
    label: 'bottle',
    plural: 'bottles',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_bottle', 'per_pack'],
    defaultPriceBasis: 'per_bottle',
    sellingUnitCode: 'BOTTLE',
  },
  box: {
    key: 'box',
    label: 'box',
    plural: 'boxes',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_box', 'per_pack'],
    defaultPriceBasis: 'per_box',
    sellingUnitCode: 'BOX',
  },
  packet: {
    key: 'packet',
    label: 'packet',
    plural: 'packets',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_packet', 'per_pack'],
    defaultPriceBasis: 'per_packet',
    sellingUnitCode: 'PACK',
  },
  pouch: {
    key: 'pouch',
    label: 'pouch',
    plural: 'pouches',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_pouch', 'per_pack'],
    defaultPriceBasis: 'per_pouch',
    sellingUnitCode: 'PACK',
  },
  jar: {
    key: 'jar',
    label: 'jar',
    plural: 'jars',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_jar', 'per_pack'],
    defaultPriceBasis: 'per_jar',
    sellingUnitCode: 'PACK',
  },
  can: {
    key: 'can',
    label: 'can',
    plural: 'cans',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_can', 'per_pack'],
    defaultPriceBasis: 'per_can',
    sellingUnitCode: 'CAN',
  },
  carton: {
    key: 'carton',
    label: 'carton',
    plural: 'cartons',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_carton', 'per_pack'],
    defaultPriceBasis: 'per_carton',
    sellingUnitCode: 'CARTON',
  },
  drum: {
    key: 'drum',
    label: 'drum',
    plural: 'drums',
    category: 'packaging',
    family: 'none',
    priceBases: ['per_drum', 'per_pack'],
    defaultPriceBasis: 'per_drum',
    sellingUnitCode: 'PACK',
  },
};

/** Ordered for Pack Unit select (grouped visually by optgroup). */
export const PACK_UNIT_OPTIONS: PackUnitKey[] = [
  'mg',
  'g',
  'kg',
  'tonne',
  'ml',
  'litre',
  'pcs',
  'pair',
  'dozen',
  'bag',
  'bottle',
  'box',
  'packet',
  'pouch',
  'jar',
  'can',
  'carton',
  'drum',
];

export const OUTER_PACKAGES: Record<OuterPackageKey, OuterPackageDefinition> = {
  box: { key: 'box', label: 'Box', plural: 'boxes' },
  carton: { key: 'carton', label: 'Carton', plural: 'cartons' },
  case: { key: 'case', label: 'Case', plural: 'cases' },
  crate: { key: 'crate', label: 'Crate', plural: 'crates' },
  bundle: { key: 'bundle', label: 'Bundle', plural: 'bundles' },
  bag: { key: 'bag', label: 'Bag', plural: 'bags' },
};

export const OUTER_PACKAGE_OPTIONS: OuterPackageKey[] = [
  'box',
  'carton',
  'case',
  'crate',
  'bundle',
  'bag',
];

const UNIT_ALIASES: Record<string, PackUnitKey> = {
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gr: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  tonne: 'tonne',
  ton: 'tonne',
  tons: 'tonne',
  tonnes: 'tonne',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  l: 'litre',
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  liters: 'litre',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  unit: 'pcs',
  units: 'pcs',
  pair: 'pair',
  pairs: 'pair',
  dozen: 'dozen',
  doz: 'dozen',
  bag: 'bag',
  bags: 'bag',
  bottle: 'bottle',
  bottles: 'bottle',
  box: 'box',
  boxes: 'box',
  packet: 'packet',
  packets: 'packet',
  pack: 'packet',
  packs: 'packet',
  pouch: 'pouch',
  pouches: 'pouch',
  jar: 'jar',
  jars: 'jar',
  can: 'can',
  cans: 'can',
  tin: 'can',
  carton: 'carton',
  cartons: 'carton',
  drum: 'drum',
  drums: 'drum',
};

export function normalizeUnitKey(unit: string | null | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

export function resolvePackUnit(
  unit: string | null | undefined,
): PackUnitDefinition | null {
  const key = UNIT_ALIASES[normalizeUnitKey(unit)];
  return key ? PACK_UNITS[key] : null;
}

export function isKnownPackUnit(unit: string | null | undefined): boolean {
  return resolvePackUnit(unit) != null;
}

export function priceBasesForPackUnit(
  packUnit: string | null | undefined,
): readonly PriceBasis[] {
  return resolvePackUnit(packUnit)?.priceBases ?? (['per_pack'] as const);
}

export function defaultPriceBasisForPackUnit(
  packUnit: string | null | undefined,
): PriceBasis {
  return resolvePackUnit(packUnit)?.defaultPriceBasis ?? 'per_pack';
}

export function isPriceBasisCompatible(
  packUnit: string | null | undefined,
  priceBasis: PriceBasis,
): boolean {
  return priceBasesForPackUnit(packUnit).includes(priceBasis);
}

export function priceBasisLabel(basis: PriceBasis): string {
  const labels: Record<PriceBasis, string> = {
    per_mg: 'Per mg',
    per_g: 'Per g',
    per_kg: 'Per kg',
    per_tonne: 'Per tonne',
    per_ml: 'Per ml',
    per_litre: 'Per litre',
    per_piece: 'Per piece',
    per_pair: 'Per pair',
    per_dozen: 'Per dozen',
    per_bag: 'Per bag',
    per_bottle: 'Per bottle',
    per_box: 'Per box',
    per_packet: 'Per packet',
    per_pouch: 'Per pouch',
    per_jar: 'Per jar',
    per_can: 'Per can',
    per_carton: 'Per carton',
    per_drum: 'Per drum',
    per_pack: 'Per pack',
  };
  return labels[basis];
}

/** Derive skus.selling_unit from pack unit (keeps order snapshots working). */
export function deriveSellingUnitCode(
  packUnit: string | null | undefined,
): string {
  return resolvePackUnit(packUnit)?.sellingUnitCode ?? 'PACK';
}

export function packUnitPluralLabel(
  packUnit: string | null | undefined,
  count = 2,
): string {
  const def = resolvePackUnit(packUnit);
  if (!def) return count === 1 ? 'pack' : 'packs';
  if (def.category === 'weight' || def.category === 'volume') {
    return count === 1 ? 'pack' : 'packs';
  }
  return count === 1 ? def.label : def.plural;
}

export function formatPackLabel(
  quantity: number,
  packUnit: string | null | undefined,
): string {
  const unit = (packUnit ?? '').trim() || 'unit';
  return `${quantity} ${unit}`;
}

/** Round INR money to 2 decimals using integer paise. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Convert quantity to family base units (g or ml). */
export function toFamilyBase(
  quantity: number,
  unit: string | null | undefined,
): { family: ConversionFamily; baseAmount: number } | null {
  const def = resolvePackUnit(unit);
  if (!def || def.family === 'none' || def.toBase == null) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { family: def.family, baseAmount: quantity * def.toBase };
}

export function convertSameFamily(
  quantity: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
): number | null {
  const from = resolvePackUnit(fromUnit);
  const to = resolvePackUnit(toUnit);
  if (!from || !to || from.family !== to.family) return null;
  if (from.family === 'none' || from.toBase == null || to.toBase == null) {
    return null;
  }
  if (!Number.isFinite(quantity)) return null;
  return (quantity * from.toBase) / to.toBase;
}

export function categoryLabel(category: UnitCategory): string {
  switch (category) {
    case 'weight':
      return 'Weight';
    case 'volume':
      return 'Volume';
    case 'count':
      return 'Count';
    case 'packaging':
      return 'Packaging';
  }
}

export function packUnitsByCategory(): {
  category: UnitCategory;
  label: string;
  units: PackUnitDefinition[];
}[] {
  const order: UnitCategory[] = ['weight', 'volume', 'count', 'packaging'];
  return order.map((category) => ({
    category,
    label: categoryLabel(category),
    units: PACK_UNIT_OPTIONS.map((k) => PACK_UNITS[k]).filter(
      (u) => u.category === category,
    ),
  }));
}

/**
 * Human summary of outer packaging contents.
 * packsPerOuter is stored as skus.packs_per_carton.
 */
export function outerPackagingSummary(input: {
  packQuantity: number;
  packUnit: string | null | undefined;
  packsPerOuter: number;
  outerType: OuterPackageKey | string;
}): { packsLine: string; contentsLine: string | null } {
  const packWord = packUnitPluralLabel(input.packUnit, input.packsPerOuter);
  const outer =
    OUTER_PACKAGES[input.outerType as OuterPackageKey]?.label.toLowerCase() ??
    String(input.outerType || 'box').toLowerCase();
  const packsLine = `${input.packsPerOuter} ${packWord} per ${outer}`;

  const def = resolvePackUnit(input.packUnit);
  if (!def || def.toBase == null || def.family === 'none') {
    return { packsLine, contentsLine: null };
  }
  const totalBase = input.packQuantity * def.toBase * input.packsPerOuter;
  if (def.family === 'weight') {
    if (totalBase >= 1000) {
      return {
        packsLine,
        contentsLine: `Total contents: ${roundMoney(totalBase / 1000)} kg`,
      };
    }
    return {
      packsLine,
      contentsLine: `Total contents: ${roundMoney(totalBase)} g`,
    };
  }
  if (def.family === 'volume') {
    if (totalBase >= 1000) {
      return {
        packsLine,
        contentsLine: `Total contents: ${roundMoney(totalBase / 1000)} litres`,
      };
    }
    return {
      packsLine,
      contentsLine: `Total contents: ${roundMoney(totalBase)} ml`,
    };
  }
  return { packsLine, contentsLine: null };
}

export type MoqUnitOption = {
  /** 'packs' = selling packs; otherwise OuterPackageKey */
  value: string;
  label: string;
};

/** Compatible MOQ entry units for a product's pack + optional outer packaging. */
export function moqUnitOptions(input: {
  packUnit: string | null | undefined;
  packsPerOuter?: number | null;
  outerType?: string | null;
}): MoqUnitOption[] {
  const packWord = packUnitPluralLabel(input.packUnit, 2);
  const options: MoqUnitOption[] = [{ value: 'packs', label: packWord }];
  const packsPer = input.packsPerOuter;
  if (packsPer != null && packsPer > 0) {
    const outerKey = resolveOuterPackageKey(input.outerType) ?? 'box';
    const outer = OUTER_PACKAGES[outerKey];
    options.push({ value: outer.key, label: outer.plural });
  }
  return options;
}

export function resolveOuterPackageKey(
  value: string | null | undefined,
): OuterPackageKey | null {
  const key = (value ?? '').trim().toLowerCase();
  if ((OUTER_PACKAGE_OPTIONS as readonly string[]).includes(key)) {
    return key as OuterPackageKey;
  }
  return null;
}

/**
 * Convert MOQ entered in packs or outer packages → base selling-pack count
 * (stored as skus.moq).
 */
export function moqToBasePacks(input: {
  quantity: number;
  moqUnit: string;
  packsPerOuter?: number | null;
}): { packs: number } | { error: string } {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { error: 'Minimum order must be a positive number' };
  }
  const unit = input.moqUnit.trim().toLowerCase();
  const whole = Math.round(input.quantity);
  if (Math.abs(input.quantity - whole) > 1e-6) {
    return { error: 'Minimum order must be a whole number' };
  }

  if (unit === 'packs' || unit === 'pack') {
    return { packs: whole };
  }

  const outer = resolveOuterPackageKey(unit);
  if (!outer) {
    return { error: `Unknown minimum-order unit "${input.moqUnit}"` };
  }
  const packsPer = input.packsPerOuter;
  if (packsPer == null || packsPer <= 0) {
    return {
      error: 'Set outer packaging quantity before using boxes/cartons for MOQ',
    };
  }
  return { packs: whole * packsPer };
}

export function minimumOrderSummary(input: {
  /** Base pack count (skus.moq). */
  moq: number;
  packQuantity: number;
  packUnit: string | null | undefined;
  packsPerOuter?: number | null;
  outerType?: string | null;
  /** When MOQ was entered in outers, prefer that display. */
  displayUnit?: string | null;
  displayQuantity?: number | null;
}): string {
  const packWord = packUnitPluralLabel(input.packUnit, input.moq);
  const outerKey = resolveOuterPackageKey(input.displayUnit);
  const packsPer = input.packsPerOuter;
  const displayQty = input.displayQuantity;

  let base: string;
  if (
    outerKey &&
    displayQty != null &&
    Number.isFinite(displayQty) &&
    displayQty > 0 &&
    packsPer != null &&
    packsPer > 0
  ) {
    const outerWord =
      displayQty === 1
        ? OUTER_PACKAGES[outerKey].label.toLowerCase()
        : OUTER_PACKAGES[outerKey].plural;
    base = `Minimum order: ${displayQty} ${outerWord} (= ${input.moq} ${packWord})`;
  } else if (
    packsPer != null &&
    packsPer > 0 &&
    input.moq % packsPer === 0 &&
    input.moq / packsPer >= 1 &&
    resolveOuterPackageKey(input.outerType)
  ) {
    const outers = input.moq / packsPer;
    const ot = resolveOuterPackageKey(input.outerType)!;
    const outerWord =
      outers === 1
        ? OUTER_PACKAGES[ot].label.toLowerCase()
        : OUTER_PACKAGES[ot].plural;
    base = `Minimum order: ${outers} ${outerWord} (= ${input.moq} ${packWord})`;
  } else {
    base = `Minimum order: ${input.moq} ${packWord}`;
  }

  const def = resolvePackUnit(input.packUnit);
  if (!def || def.toBase == null || !Number.isFinite(input.moq) || input.moq <= 0) {
    return base;
  }
  const totalBase = input.moq * input.packQuantity * def.toBase;
  if (def.family === 'weight') {
    if (totalBase >= 1000) {
      return `${base} (${roundMoney(totalBase / 1000)} kg total)`;
    }
    return `${base} (${roundMoney(totalBase)} g total)`;
  }
  if (def.family === 'volume') {
    if (totalBase >= 1000) {
      return `${base} (${roundMoney(totalBase / 1000)} litres total)`;
    }
    return `${base} (${roundMoney(totalBase)} ml total)`;
  }
  return base;
}

/** Convert outer packages + loose packs → on-hand pack count. */
export function mixedStockToPacks(input: {
  outerCount?: number | null;
  loosePacks?: number | null;
  packsPerOuter?: number | null;
}): { onHandPacks: number } | { error: string } {
  const outers = Number(input.outerCount ?? 0);
  const loose = Number(input.loosePacks ?? 0);
  if (!Number.isFinite(outers) || outers < 0 || !Number.isFinite(loose) || loose < 0) {
    return { error: 'Stock quantities must be zero or greater' };
  }
  if (outers === 0 && loose === 0) {
    return { error: 'Enter stock as outer packages and/or loose packs' };
  }
  if (Math.abs(outers - Math.round(outers)) > 1e-6) {
    return { error: 'Outer package count must be a whole number' };
  }
  if (Math.abs(loose - Math.round(loose)) > 1e-6) {
    return { error: 'Loose pack count must be a whole number' };
  }

  let fromOuters = 0;
  if (outers > 0) {
    const packsPer = input.packsPerOuter;
    if (packsPer == null || packsPer <= 0) {
      return {
        error: 'Outer packaging is not configured for this product',
      };
    }
    fromOuters = Math.round(outers) * packsPer;
  }
  return { onHandPacks: fromOuters + Math.round(loose) };
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

export function mixedInventorySummary(input: {
  totalPacks: number;
  packsPerOuter?: number | null;
  outerType?: string | null;
  packQuantity: number;
  packUnit: string | null | undefined;
}): string {
  const packWord = packUnitPluralLabel(input.packUnit, input.totalPacks);
  const parts: string[] = [`${input.totalPacks} ${packWord} total`];

  const packsPer = input.packsPerOuter;
  if (packsPer != null && packsPer > 0) {
    const { fullOuters, loosePacks } = decomposePacksToOuter({
      totalPacks: input.totalPacks,
      packsPerOuter: packsPer,
    });
    const outerKey = resolveOuterPackageKey(input.outerType) ?? 'box';
    const outerWord =
      fullOuters === 1
        ? OUTER_PACKAGES[outerKey].label.toLowerCase()
        : OUTER_PACKAGES[outerKey].plural;
    if (fullOuters > 0 || loosePacks > 0) {
      const mix: string[] = [];
      if (fullOuters > 0) mix.push(`${fullOuters} full ${outerWord}`);
      if (loosePacks > 0) {
        mix.push(
          `${loosePacks} loose ${packUnitPluralLabel(input.packUnit, loosePacks)}`,
        );
      }
      parts.push(`= ${mix.join(' + ')}`);
    }
  }

  const content = inventorySummary({
    quantity: input.totalPacks,
    packQuantity: input.packQuantity,
    packUnit: input.packUnit,
  });
  const measurable = content.includes('=');
  if (measurable) {
    const eq = content.split('=').slice(1).join('=').trim();
    if (eq) parts.push(`· ${input.totalPacks} × ${formatPackLabel(input.packQuantity, input.packUnit)} = ${eq}`);
  }

  return parts.join(' ');
}

export function inventorySummary(input: {
  quantity: number;
  packQuantity: number;
  packUnit: string | null | undefined;
}): string {
  const packWord = packUnitPluralLabel(input.packUnit, input.quantity);
  const def = resolvePackUnit(input.packUnit);
  if (!def || def.toBase == null) {
    return `${input.quantity} ${packWord}`;
  }
  const totalBase = input.quantity * input.packQuantity * def.toBase;
  if (def.family === 'weight') {
    if (totalBase >= 1000) {
      return `${input.quantity} ${packWord} × ${formatPackLabel(input.packQuantity, input.packUnit)} = ${roundMoney(totalBase / 1000)} kg total`;
    }
    return `${input.quantity} ${packWord} × ${formatPackLabel(input.packQuantity, input.packUnit)} = ${roundMoney(totalBase)} g total`;
  }
  if (def.family === 'volume') {
    if (totalBase >= 1000) {
      return `${input.quantity} ${packWord} × ${formatPackLabel(input.packQuantity, input.packUnit)} = ${roundMoney(totalBase / 1000)} litres total`;
    }
    return `${input.quantity} ${packWord} × ${formatPackLabel(input.packQuantity, input.packUnit)} = ${roundMoney(totalBase)} ml total`;
  }
  return `${input.quantity} ${packWord}`;
}
