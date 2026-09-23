/**
 * Human-friendly inventory display for product list and detail pages.
 * All conversions derive from SKU pack configuration — never hardcoded.
 */

import type { InventoryReadinessStatus } from '@/data/product-types';
import {
  formatPackLabel,
  OUTER_PACKAGES,
  packUnitPluralLabel,
  resolveOuterPackageKey,
  resolvePackUnit,
  roundMoney,
} from '@/data/pack-units';
import { buildMixedInventoryDisplay } from '@groaurum/catalogue-display';

export type InventoryEquivalentLine = {
  icon: string;
  label: string;
  detail?: string;
};

export type InventoryOverviewVm = {
  totalPacks: number;
  totalAvailablePacks: number;
  totalAvailableLabel: string;
  status: InventoryReadinessStatus;
  statusLabel: string;
  statusTone: 'positive' | 'warning' | 'danger' | 'muted';
  equivalents: InventoryEquivalentLine[];
  mixedSummary?: string;
};

export type SkuPackConfig = {
  availablePacks: number;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  packsPerOuter?: number | null;
  outerType?: string | null;
};

export type WarehouseStockRowVm = {
  locationId: string;
  locationName: string;
  skuCode: string;
  availablePacks: number;
  reservedPacks: number;
  onHandPacks: number;
  availableLabel: string;
  reservedLabel: string;
  onHandLabel: string;
};

export function stockStatusMeta(
  status: InventoryReadinessStatus,
): Pick<InventoryOverviewVm, 'statusLabel' | 'statusTone'> {
  switch (status) {
    case 'in_stock':
      return { statusLabel: 'Healthy Stock', statusTone: 'positive' };
    case 'low_stock':
      return { statusLabel: 'Low Stock', statusTone: 'warning' };
    case 'out_of_stock':
      return { statusLabel: 'Out of Stock', statusTone: 'danger' };
    default:
      return { statusLabel: 'Not Tracked', statusTone: 'muted' };
  }
}

export function inventoryReadinessFromPacks(availablePacks: number): InventoryReadinessStatus {
  if (availablePacks <= 0) return 'out_of_stock';
  if (availablePacks < 10) return 'low_stock';
  return 'in_stock';
}

export function formatAvailableStockLabel(input: SkuPackConfig): string {
  const packs = Math.max(0, Math.round(input.availablePacks));
  const packQty = input.netQuantity ?? 1;
  const packUnit = input.netQuantityUnit;
  const def = resolvePackUnit(packUnit);

  if (def?.family === 'weight' && def.toBase != null) {
    const totalGrams = packs * packQty * def.toBase;
    if (totalGrams >= 1000) {
      return `${roundMoney(totalGrams / 1000)} kg available`;
    }
    return `${roundMoney(totalGrams)} g available`;
  }

  if (def?.family === 'volume' && def.toBase != null) {
    const totalMl = packs * packQty * def.toBase;
    if (totalMl >= 1000) {
      return `${roundMoney(totalMl / 1000)} litres available`;
    }
    return `${roundMoney(totalMl)} ml available`;
  }

  const packWord = packUnitPluralLabel(packUnit, packs);
  return `${packs} ${packWord} available`;
}

export function formatPackagingLabel(input: {
  productName: string;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  packsPerOuter?: number | null;
  outerType?: string | null;
  variantLabel?: string | null;
}): string {
  const lines: string[] = [];
  if (input.variantLabel) {
    lines.push(input.variantLabel);
  } else {
    lines.push(input.productName);
  }
  if (input.netQuantity != null && input.netQuantityUnit) {
    lines.push(formatPackLabel(input.netQuantity, input.netQuantityUnit));
  }
  const perOuter = input.packsPerOuter;
  if (perOuter != null && perOuter > 0) {
    const outerKey = resolveOuterPackageKey(input.outerType) ?? 'box';
    const outerWord = OUTER_PACKAGES[outerKey].label;
    lines.push(`${perOuter} packs per ${outerWord}`);
  }
  return lines.join('\n');
}

export function buildInventoryEquivalents(input: SkuPackConfig): InventoryEquivalentLine[] {
  const mixed = buildMixedInventoryDisplay({
    totalPacks: input.availablePacks,
    netQuantity: input.netQuantity,
    netQuantityUnit: input.netQuantityUnit,
    packsPerOuter: input.packsPerOuter,
    outerType: input.outerType,
  });

  const lines: InventoryEquivalentLine[] = [];

  if (mixed.fullOuters > 0) {
    const outerKey = resolveOuterPackageKey(input.outerType) ?? 'bag';
    const outerDef = OUTER_PACKAGES[outerKey];
    lines.push({
      icon: '',
      label: `${mixed.fullOuters} ${mixed.fullOuters === 1 ? outerDef.label : outerDef.plural}`,
    });
  }
  if (mixed.loosePacks > 0) {
    lines.push({
      icon: '',
      label: `${mixed.loosePacks} ${packUnitPluralLabel(input.netQuantityUnit, mixed.loosePacks)}`,
      detail: input.netQuantity
        ? formatPackLabel(input.netQuantity, input.netQuantityUnit)
        : undefined,
    });
  }
  if (mixed.totalWeightLabel) {
    lines.push({
      icon: '',
      label: `Total Weight: ${mixed.totalWeightLabel}`,
    });
  }

  if (lines.length === 0 && mixed.totalPacks > 0) {
    lines.push({
      icon: '',
      label: mixed.mixedLabel,
    });
  }

  return lines;
}

export function buildInventoryOverview(input: SkuPackConfig): InventoryOverviewVm {
  const totalPacks = Math.max(0, Math.round(input.availablePacks));
  const status = inventoryReadinessFromPacks(totalPacks);
  const { statusLabel, statusTone } = stockStatusMeta(status);

  return {
    totalPacks,
    totalAvailablePacks: totalPacks,
    totalAvailableLabel: formatAvailableStockLabel(input),
    status,
    statusLabel,
    statusTone,
    equivalents: buildInventoryEquivalents(input),
    mixedSummary: buildMixedInventoryDisplay({
      totalPacks,
      netQuantity: input.netQuantity,
      netQuantityUnit: input.netQuantityUnit,
      packsPerOuter: input.packsPerOuter,
      outerType: input.outerType,
    }).mixedLabel,
  };
}

export function formatWarehouseQuantityLabel(
  packs: number,
  netQuantity?: number | null,
  netQuantityUnit?: string | null,
  packsPerOuter?: number | null,
  outerType?: string | null,
): string {
  if (packsPerOuter != null && packsPerOuter > 0) {
    return buildMixedInventoryDisplay({
      totalPacks: packs,
      netQuantity,
      netQuantityUnit,
      packsPerOuter,
      outerType,
    }).mixedLabel;
  }
  return formatAvailableStockLabel({
    availablePacks: packs,
    netQuantity,
    netQuantityUnit,
  }).replace(' available', '');
}

export function warehouseStockStatus(availablePacks: number): InventoryReadinessStatus {
  return inventoryReadinessFromPacks(availablePacks);
}

export function previewAdjustmentPacks(input: {
  quantity: number;
  unit: 'pack' | 'outer';
  packsPerOuter?: number | null;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  outerType?: string | null;
}): { packs: number; preview: string } | { error: string } {
  const qty = input.quantity;
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: 'Enter a positive quantity' };
  }

  let packs: number;
  if (input.unit === 'outer') {
    const per = input.packsPerOuter;
    if (per == null || per <= 0) {
      return { error: 'Outer packaging is not configured for this SKU' };
    }
    packs = Math.round(qty) * per;
  } else {
    packs = Math.round(qty);
  }

  const mixed = buildMixedInventoryDisplay({
    totalPacks: packs,
    netQuantity: input.netQuantity,
    netQuantityUnit: input.netQuantityUnit,
    packsPerOuter: input.packsPerOuter,
    outerType: input.outerType,
  });

  const roundedQty = Math.round(qty);
  const packWord = packUnitPluralLabel(input.netQuantityUnit, packs);
  const outerKey = resolveOuterPackageKey(input.outerType) ?? 'bag';
  const outerDef = OUTER_PACKAGES[outerKey];
  const titleCase = (word: string) =>
    word.length ? word[0]!.toUpperCase() + word.slice(1) : word;

  if (input.unit === 'outer' && input.packsPerOuter) {
    const outerWord = titleCase(
      roundedQty === 1 ? outerDef.label : outerDef.plural,
    );
    const parts = [
      `${roundedQty} ${outerWord}`,
      `${packs} ${packWord}`,
    ];
    if (mixed.totalWeightLabel) {
      parts.push(mixed.totalWeightLabel);
    }
    return {
      packs,
      preview: parts.join(' = '),
    };
  }

  const parts = [`${packs} ${packWord}`];
  if (
    input.packsPerOuter != null &&
    input.packsPerOuter > 0 &&
    mixed.fullOuters > 0
  ) {
    const outerWord = titleCase(
      mixed.fullOuters === 1 ? outerDef.label : outerDef.plural,
    );
    const outerBit =
      mixed.loosePacks > 0
        ? `${mixed.fullOuters} ${outerWord} + ${mixed.loosePacks} ${packUnitPluralLabel(input.netQuantityUnit, mixed.loosePacks)}`
        : `${mixed.fullOuters} ${outerWord}`;
    parts.unshift(outerBit);
  }
  if (mixed.totalWeightLabel) {
    parts.push(mixed.totalWeightLabel);
  }
  return {
    packs,
    preview: parts.join(' = '),
  };
}
