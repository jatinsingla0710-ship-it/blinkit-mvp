import type {
  PriceRecordRow,
  SkuPriceListRow,
  SkuPricingDetail,
} from './pricing-types';

/**
 * Layout fixtures only — replace with Supabase append-only price queries.
 * History rows are never mutated in place; expired rows keep their values.
 */

function record(partial: PriceRecordRow): PriceRecordRow {
  return partial;
}

export const SKU_PRICE_LIST_FIXTURE: SkuPriceListRow[] = [
  {
    id: 'row-akh-10',
    skuId: 'sku-akh-10',
    skuCode: 'AKH-LA-10',
    skuName: 'Akhrot Giri · Light Amber',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    currentPriceLabel: '₹920',
    currentTradePrice: 920,
    unitPriceLabel: '₹92/kg',
    status: 'live',
    updatedAtLabel: '16 Jul 2026, 09:12',
  },
  {
    id: 'row-akh-ctn',
    skuId: 'sku-akh-ctn',
    skuCode: 'AKH-LA-CTN',
    skuName: 'Akhrot Giri · Carton',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    currentPriceLabel: '₹8,900',
    currentTradePrice: 8900,
    status: 'live',
    updatedAtLabel: '01 Jul 2026, 10:00',
  },
  {
    id: 'row-kis',
    skuId: 'sku-kis',
    skuCode: 'KIS-EL-CTN',
    skuName: 'Kishmish Green · Extra Long',
    productId: 'prod-kishmish',
    productName: 'Kishmish Green',
    currentPriceLabel: '₹210',
    currentTradePrice: 210,
    status: 'live',
    updatedAtLabel: '15 Jul 2026, 18:40',
  },
  {
    id: 'row-chilli',
    skuId: 'sku-chilli',
    skuCode: 'SPC-KC-1KG',
    skuName: 'Kashmiri Chilli · 1 KG pack',
    productId: 'prod-chilli',
    productName: 'Kashmiri Chilli',
    currentPriceLabel: '₹280',
    currentTradePrice: 280,
    unitPriceLabel: '₹280/kg',
    status: 'live',
    updatedAtLabel: '16 Jul 2026, 08:05',
  },
  {
    id: 'row-legacy',
    skuId: 'sku-legacy',
    skuCode: 'MIX-LEG-CTN',
    skuName: 'Legacy Gift Mix',
    productId: 'prod-legacy-mix',
    productName: 'Legacy Gift Mix',
    currentPriceLabel: '—',
    status: 'unpriced',
    updatedAtLabel: '01 Jun 2026, 16:00',
  },
];

const HISTORY_AKH_10: PriceRecordRow[] = [
  record({
    id: 'hist-akh-2',
    tradePriceLabel: '₹905',
    tradePrice: 905,
    effectiveFromLabel: '01 Jun 2026',
    effectiveToLabel: '10 Jul 2026',
    status: 'expired',
    createdAtLabel: '01 Jun 2026, 09:00',
    createdByLabel: 'Owner',
  }),
  record({
    id: 'hist-akh-1',
    tradePriceLabel: '₹880',
    tradePrice: 880,
    effectiveFromLabel: '01 Apr 2026',
    effectiveToLabel: '01 Jun 2026',
    status: 'expired',
    createdAtLabel: '01 Apr 2026, 11:00',
    createdByLabel: 'Owner',
  }),
];

const DETAIL_BY_SKU: Record<string, SkuPricingDetail> = {
  'sku-akh-10': {
    skuId: 'sku-akh-10',
    skuCode: 'AKH-LA-10',
    skuName: 'Akhrot Giri · Light Amber',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    sellingUnitLabel: 'KG',
    netQuantity: 10,
    netQuantityUnit: 'kg',
    current: record({
      id: 'hist-akh-3',
      tradePriceLabel: '₹920',
      tradePrice: 920,
      effectiveFromLabel: '10 Jul 2026',
      status: 'live',
      createdAtLabel: '09 Jul 2026, 16:20',
      createdByLabel: 'Owner',
    }),
    history: HISTORY_AKH_10,
    listStatus: 'live',
    updatedAtLabel: '16 Jul 2026, 09:12',
  },
  'sku-akh-ctn': {
    skuId: 'sku-akh-ctn',
    skuCode: 'AKH-LA-CTN',
    skuName: 'Akhrot Giri · Carton',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    sellingUnitLabel: 'CARTON',
    current: record({
      id: 'live-akh-ctn',
      tradePriceLabel: '₹8,900',
      tradePrice: 8900,
      effectiveFromLabel: '01 Jul 2026',
      status: 'live',
      createdAtLabel: '01 Jul 2026, 10:00',
      createdByLabel: 'Owner',
    }),
    history: [],
    listStatus: 'live',
    updatedAtLabel: '01 Jul 2026, 10:00',
  },
  'sku-kis': {
    skuId: 'sku-kis',
    skuCode: 'KIS-EL-CTN',
    skuName: 'Kishmish Green · Extra Long',
    productId: 'prod-kishmish',
    productName: 'Kishmish Green',
    sellingUnitLabel: 'CARTON',
    current: record({
      id: 'live-kis',
      tradePriceLabel: '₹210',
      tradePrice: 210,
      effectiveFromLabel: '01 Jul 2026',
      status: 'live',
      createdAtLabel: '01 Jul 2026, 12:00',
      createdByLabel: 'Owner',
    }),
    history: [],
    listStatus: 'live',
    updatedAtLabel: '15 Jul 2026, 18:40',
  },
  'sku-chilli': {
    skuId: 'sku-chilli',
    skuCode: 'SPC-KC-1KG',
    skuName: 'Kashmiri Chilli · 1 KG pack',
    productId: 'prod-chilli',
    productName: 'Kashmiri Chilli',
    sellingUnitLabel: 'PACK',
    netQuantity: 1,
    netQuantityUnit: 'kg',
    current: record({
      id: 'live-chilli',
      tradePriceLabel: '₹280',
      tradePrice: 280,
      effectiveFromLabel: '16 Jul 2026',
      status: 'live',
      createdAtLabel: '16 Jul 2026, 08:05',
      createdByLabel: 'Owner',
    }),
    history: [],
    listStatus: 'live',
    updatedAtLabel: '16 Jul 2026, 08:05',
  },
  'sku-legacy': {
    skuId: 'sku-legacy',
    skuCode: 'MIX-LEG-CTN',
    skuName: 'Legacy Gift Mix',
    productId: 'prod-legacy-mix',
    productName: 'Legacy Gift Mix',
    sellingUnitLabel: 'CARTON',
    current: null,
    history: [
      record({
        id: 'hist-legacy',
        tradePriceLabel: '₹1,450',
        tradePrice: 1450,
        effectiveFromLabel: '01 Jan 2026',
        effectiveToLabel: '01 Jun 2026',
        status: 'expired',
        createdAtLabel: '01 Jan 2026, 10:00',
        createdByLabel: 'Owner',
      }),
    ],
    listStatus: 'unpriced',
    updatedAtLabel: '01 Jun 2026, 16:00',
  },
};

export function getSkuPricingDetailFixture(
  skuId: string,
): SkuPricingDetail | null {
  return DETAIL_BY_SKU[skuId] ?? null;
}

export const EMPTY_SET_PRICE_DRAFT = {
  basisPrice: '',
  priceBasis: 'per_kg' as const,
};
