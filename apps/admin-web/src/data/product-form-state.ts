/**
 * Shared form state for Create / Edit product and SKU pack configuration.
 * Hydrates from ProductDetail + primary SKU — same fields persisted at create time.
 */
import type { ProductDetail, ProductSkuRow } from '@/data/product-types';
import {
  isKnownPackUnit,
  resolveOuterPackageKey,
  type OuterPackageKey,
  type PackUnitKey,
  type PriceBasis,
} from '@/data/pack-units';
import {
  basisPriceFromPackTrade,
  defaultPriceBasisForPackUnit,
} from '@/data/sku-pack-pricing';

export type MoqUnitValue = 'packs' | OuterPackageKey;

export type DiscountTypeUi = 'none' | 'percent' | 'fixed';
export type ContainerPriceModeUi = 'calculated' | 'custom';
export type CategoryInputMode = 'existing' | 'new';

export type OuterDiscountTierFormRow = {
  minOuterQuantity: string;
  discountPerOuterUnit: string;
};

export type ProductConfigurationFormState = {
  name: string;
  categoryInputMode: CategoryInputMode;
  categoryId: string;
  newCategoryName: string;
  description: string;
  productType: ProductDetail['productType'];
  isActive: boolean;
  skuCode: string;
  packQuantity: string;
  packUnit: PackUnitKey;
  priceBasis: PriceBasis;
  basisPrice: string;
  outerPackQty: string;
  outerType: OuterPackageKey;
  moq: string;
  moqUnit: MoqUnitValue;
  containerPriceMode: ContainerPriceModeUi;
  containerCustomPrice: string;
  outerDiscountTiers: OuterDiscountTierFormRow[];
  warehouseId: string;
  initialOuterQty: string;
  initialLooseQty: string;
};

export const EMPTY_PRODUCT_FORM: ProductConfigurationFormState = {
  name: '',
  categoryInputMode: 'existing',
  categoryId: '',
  newCategoryName: '',
  description: '',
  productType: 'PACKED',
  isActive: false,
  skuCode: '',
  packQuantity: '250',
  packUnit: 'g',
  priceBasis: 'per_kg',
  basisPrice: '',
  outerPackQty: '',
  outerType: 'box',
  moq: '1',
  moqUnit: 'packs',
  containerPriceMode: 'calculated',
  containerCustomPrice: '',
  outerDiscountTiers: [],
  warehouseId: '',
  initialOuterQty: '',
  initialLooseQty: '',
};

/** Reverse stored MOQ (packs) into admin display quantity + unit. */
export function inferMoqDisplay(input: {
  moqPacks: number;
  packsPerOuter?: number | null;
  outerType?: string | null;
}): { moq: string; moqUnit: MoqUnitValue } {
  const { moqPacks, packsPerOuter } = input;
  const outerKey = resolveOuterPackageKey(input.outerType ?? '');
  if (
    outerKey &&
    packsPerOuter != null &&
    packsPerOuter > 0 &&
    moqPacks > 0 &&
    moqPacks % packsPerOuter === 0
  ) {
    return {
      moq: String(moqPacks / packsPerOuter),
      moqUnit: outerKey,
    };
  }
  return { moq: String(moqPacks || 1), moqUnit: 'packs' };
}

function resolvePackUnitKey(unit: string | null | undefined): PackUnitKey {
  if (unit && isKnownPackUnit(unit)) {
    return unit.toLowerCase() as PackUnitKey;
  }
  return 'g';
}

function resolveOuterTypeKey(
  outerType: string | null | undefined,
): OuterPackageKey {
  const key = resolveOuterPackageKey(outerType ?? '');
  return key ?? 'box';
}

/** Hydrate product + primary SKU into the shared configuration form. */
export function formStateFromProductDetail(
  product: ProductDetail,
  sku?: ProductSkuRow | null,
): ProductConfigurationFormState {
  const base: ProductConfigurationFormState = {
    ...EMPTY_PRODUCT_FORM,
    name: product.name,
    categoryId: product.categoryId,
    description: product.description ?? '',
    productType: product.productType,
    isActive: product.isActive,
    outerDiscountTiers: (product.outerDiscountTiers ?? []).map((t) => ({
      minOuterQuantity: String(t.minOuterQuantity),
      discountPerOuterUnit: String(t.discountPerOuterUnit),
    })),
  };

  if (!sku) return base;

  const packUnit = resolvePackUnitKey(sku.netQuantityUnit);
  const priceBasis = defaultPriceBasisForPackUnit(packUnit);
  let basisPrice = '';

  const tradePrice = sku.currentTradePrice;
  if (
    sku.netQuantity != null &&
    tradePrice != null &&
    Number.isFinite(tradePrice) &&
    tradePrice > 0
  ) {
    const fromPack = basisPriceFromPackTrade({
      packTradePrice: tradePrice,
      priceBasis,
      packQuantity: sku.netQuantity,
      packUnit,
    });
    if (!('error' in fromPack)) {
      basisPrice = String(Number(fromPack.basisPrice.toFixed(4)));
    }
  }

  const outerType = resolveOuterTypeKey(sku.outerType);
  const moqDisplay = inferMoqDisplay({
    moqPacks: sku.moq,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
  });

  return {
    ...base,
    skuCode: sku.skuCode,
    packQuantity:
      sku.netQuantity != null ? String(sku.netQuantity) : base.packQuantity,
    packUnit,
    priceBasis,
    basisPrice,
    outerPackQty:
      sku.packsPerCarton != null ? String(sku.packsPerCarton) : '',
    outerType,
    moq: moqDisplay.moq,
    moqUnit: moqDisplay.moqUnit,
    containerPriceMode: sku.containerPriceMode ?? 'calculated',
    containerCustomPrice:
      sku.containerCustomPrice != null
        ? String(sku.containerCustomPrice)
        : '',
  };
}

export function skuDiscountPayloadFromForm(form: ProductConfigurationFormState) {
  return {
    packDiscountType: 'none' as const,
    packDiscountValue: 0,
    containerPriceMode: form.containerPriceMode,
    containerCustomPrice:
      form.containerPriceMode === 'custom' &&
      form.containerCustomPrice.trim() !== ''
        ? Number(form.containerCustomPrice)
        : null,
    containerDiscountType: 'none' as const,
    containerDiscountValue: 0,
  };
}

/** Hydrate a single SKU row for the SKU add/edit modal. */
export function formStateFromSkuRow(
  sku: ProductSkuRow,
): Pick<
  ProductConfigurationFormState,
  | 'skuCode'
  | 'packQuantity'
  | 'packUnit'
  | 'priceBasis'
  | 'basisPrice'
  | 'outerPackQty'
  | 'outerType'
  | 'moq'
  | 'moqUnit'
> {
  const full = formStateFromProductDetail(
    {
      id: '',
      name: '',
      categoryId: '',
      categoryName: '',
      productType: 'PACKED',
      isActive: true,
      publishStatus: 'published',
      inventoryStatus: 'not_tracked',
      skuCount: 1,
      currentTradePriceLabel: '—',
      updatedAtLabel: '',
      createdAtLabel: '',
      hasImage: false,
      skus: [sku],
      priceHistory: [],
      inventoryMovements: [],
      images: [],
      checklist: [],
      canPublish: false,
      priceTiers: [],
      outerDiscountTiers: [],
      warehouseStock: [],
    },
    sku,
  );
  return {
    skuCode: full.skuCode,
    packQuantity: full.packQuantity,
    packUnit: full.packUnit,
    priceBasis: full.priceBasis,
    basisPrice: full.basisPrice,
    outerPackQty: full.outerPackQty,
    outerType: full.outerType,
    moq: full.moq,
    moqUnit: full.moqUnit,
  };
}
