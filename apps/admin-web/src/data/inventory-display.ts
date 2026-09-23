/**
 * Human-readable inventory labels for Admin Inventory pages.
 * Reuses catalogue packaging/conversion helpers — does not invent stock math.
 */

import { buildMixedInventoryDisplay } from '@groaurum/catalogue-display';
import {
  formatPackLabel,
  OUTER_PACKAGES,
  packUnitPluralLabel,
  resolveOuterPackageKey,
  type OuterPackageKey,
} from '@/data/pack-units';
import type { InventoryHealthStatus } from '@/data/inventory-types';

export type InventoryPackConfig = {
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
  packsPerOuter?: number | null;
  outerType?: string | null;
};

export function inventoryOuterLabel(
  outerType?: string | null,
  count = 1,
): string {
  const key = (resolveOuterPackageKey(outerType) ?? 'bag') as OuterPackageKey;
  const def = OUTER_PACKAGES[key];
  if (!def) return count === 1 ? 'Outer' : 'Outers';
  return count === 1 ? def.label : def.plural.replace(/^./, (c) => c.toUpperCase());
}

export function formatInventoryPackagingLabel(config: InventoryPackConfig): string {
  const parts: string[] = [];
  if (config.netQuantity != null && config.netQuantityUnit) {
    parts.push(formatPackLabel(config.netQuantity, config.netQuantityUnit));
  }
  if (config.packsPerOuter != null && config.packsPerOuter > 0) {
    const outer = inventoryOuterLabel(config.outerType, 1);
    parts.push(`${config.packsPerOuter} Packs per ${outer}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Pack';
}

export function buildInventoryStockLabels(
  packs: number,
  config: InventoryPackConfig,
): {
  mixedLabel: string;
  packsTotalLabel: string;
  weightLabel?: string;
} {
  const totalPacks = Math.max(0, Math.round(packs));
  const mixed = buildMixedInventoryDisplay({
    totalPacks,
    netQuantity: config.netQuantity,
    netQuantityUnit: config.netQuantityUnit,
    packsPerOuter: config.packsPerOuter,
    outerType: config.outerType,
  });
  const packWord = packUnitPluralLabel(config.netQuantityUnit, totalPacks);
  return {
    mixedLabel: mixed.mixedLabel,
    packsTotalLabel: `${totalPacks} ${packWord} total`,
    weightLabel: mixed.totalWeightLabel
      ? `${mixed.totalWeightLabel} total`
      : undefined,
  };
}

/** Map existing inventory health status (unchanged threshold). */
export function inventoryStatusHeadline(
  status: InventoryHealthStatus,
): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'low':
      return 'Low Stock';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'incoming':
      return 'Incoming';
    default:
      return status;
  }
}
