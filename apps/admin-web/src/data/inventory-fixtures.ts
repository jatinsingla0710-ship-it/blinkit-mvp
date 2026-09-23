import type {
  InventoryListRow,
  InventorySkuDetail,
  InventorySnapshot,
  InventoryWarehouseBalance,
  StockAdjustmentRow,
  StockMovementRow,
  StockReservationRow,
} from './inventory-types';

/**
 * Layout fixtures only — replace with Supabase inventory / ledger queries.
 * Movement history is append-only; balances are derived, never rewritten.
 */

function enrichWarehouse(
  partial: Omit<
    InventoryWarehouseBalance,
    | 'mixedAvailableLabel'
    | 'mixedOnHandLabel'
    | 'mixedReservedLabel'
    | 'packsTotalLabel'
    | 'availablePacks'
    | 'reservedPacks'
  > &
    Partial<
      Pick<
        InventoryWarehouseBalance,
        | 'mixedAvailableLabel'
        | 'mixedOnHandLabel'
        | 'mixedReservedLabel'
        | 'packsTotalLabel'
        | 'availablePacks'
        | 'reservedPacks'
      >
    >,
): InventoryWarehouseBalance {
  return {
    ...partial,
    mixedAvailableLabel: partial.mixedAvailableLabel ?? partial.availableLabel,
    mixedOnHandLabel: partial.mixedOnHandLabel ?? partial.onHandLabel,
    mixedReservedLabel: partial.mixedReservedLabel ?? partial.reservedLabel,
    packsTotalLabel: partial.packsTotalLabel ?? partial.availableLabel,
    availablePacks: partial.availablePacks ?? partial.onHandQuantity,
    reservedPacks: partial.reservedPacks ?? 0,
  };
}

function enrichListRow(
  partial: Omit<
    InventoryListRow,
    | 'productId'
    | 'categoryName'
    | 'mixedStockLabel'
    | 'packsTotalLabel'
    | 'packagingLabel'
    | 'availablePacks'
    | 'warehouseCount'
    | 'warehouses'
  > &
    Partial<
      Pick<
        InventoryListRow,
        | 'productId'
        | 'categoryName'
        | 'mixedStockLabel'
        | 'packsTotalLabel'
        | 'packagingLabel'
        | 'availablePacks'
        | 'warehouseCount'
        | 'warehouses'
      >
    >,
): InventoryListRow {
  return {
    ...partial,
    productId: partial.productId ?? `prod-${partial.skuId}`,
    categoryName: partial.categoryName ?? 'Dry Fruits',
    mixedStockLabel: partial.mixedStockLabel ?? partial.availableLabel,
    packsTotalLabel: partial.packsTotalLabel ?? partial.availableLabel,
    packagingLabel: partial.packagingLabel ?? partial.unitLabel,
    availablePacks:
      partial.availablePacks ??
      (partial.status === 'out_of_stock' ? 0 : 10),
    warehouseCount: partial.warehouseCount ?? 1,
    warehouses: partial.warehouses ?? [
      {
        balanceId: partial.id,
        warehouseName: partial.warehouseName,
        mixedStockLabel: partial.mixedStockLabel ?? partial.availableLabel,
        status: partial.status,
      },
    ],
  };
}

function enrichDetailTotals(
  detail: InventorySkuDetail,
): InventorySkuDetail {
  const totalAvailablePacks = detail.warehouses.reduce(
    (sum, wh) => sum + wh.availablePacks,
    0,
  );
  return {
    ...detail,
    categoryName: detail.categoryName || 'Dry Fruits',
    packagingLabel: detail.packagingLabel || detail.unitLabel,
    totalAvailablePacks:
      detail.totalAvailablePacks ?? totalAvailablePacks,
    totalMixedStockLabel:
      detail.totalMixedStockLabel || detail.availableLabel,
    totalPacksLabel: detail.totalPacksLabel || detail.availableLabel,
    overallStatus: detail.overallStatus ?? detail.status,
  };
}

export const INVENTORY_LIST_FIXTURE: InventoryListRow[] = [
  enrichListRow({
    id: 'sku-akh-10',
    skuId: 'sku-akh-10',
    skuCode: 'AKH-LA-10',
    skuName: 'Akhrot Giri · Light Amber',
    productName: 'Akhrot Giri',
    productId: 'prod-akhrot',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    availableLabel: '12 KG',
    mixedStockLabel: '12 KG',
    packsTotalLabel: '12 packs total',
    packagingLabel: 'Bulk kg',
    reservedLabel: '8 KG',
    incomingLabel: '50 KG',
    reorderLevelLabel: '50 KG',
    status: 'low',
    unitLabel: 'KG',
    availablePacks: 12,
    warehouseCount: 2,
    warehouses: [
      {
        balanceId: 'inv-akh-10-cp',
        warehouseName: 'Hub — CP',
        mixedStockLabel: '12 KG',
        status: 'low',
      },
      {
        balanceId: 'inv-akh-10-saket',
        warehouseName: 'Hub — Saket',
        mixedStockLabel: '200 KG',
        status: 'healthy',
      },
    ],
  }),
  enrichListRow({
    id: 'sku-akh-ctn',
    skuId: 'sku-akh-ctn',
    skuCode: 'AKH-LA-CTN',
    skuName: 'Akhrot Giri · Carton',
    productName: 'Akhrot Giri',
    productId: 'prod-akhrot',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    availableLabel: '18 Carton',
    mixedStockLabel: '18 Cartons',
    packsTotalLabel: '18 packs total',
    packagingLabel: 'Carton',
    reservedLabel: '2 Carton',
    incomingLabel: '0 Carton',
    reorderLevelLabel: '10 Carton',
    status: 'healthy',
    unitLabel: 'Carton',
    availablePacks: 18,
  }),
  enrichListRow({
    id: 'sku-kis',
    skuId: 'sku-kis',
    skuCode: 'KIS-EL-CTN',
    skuName: 'Kishmish Green · Extra Long',
    productName: 'Kishmish Green',
    warehouseId: 'wh-saket',
    warehouseName: 'Hub — Saket',
    availableLabel: '120 Carton',
    mixedStockLabel: '120 Cartons',
    packsTotalLabel: '120 packs total',
    reservedLabel: '14 Carton',
    incomingLabel: '24 Carton',
    reorderLevelLabel: '40 Carton',
    status: 'incoming',
    unitLabel: 'Carton',
    availablePacks: 120,
  }),
  enrichListRow({
    id: 'sku-chilli',
    skuId: 'sku-chilli',
    skuCode: 'SPC-KC-1KG',
    skuName: 'Kashmiri Chilli · 1 KG pack',
    productName: 'Kashmiri Chilli',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    availableLabel: '160 Pack',
    mixedStockLabel: '16 Boxes + 0 Packs',
    packsTotalLabel: '160 packs total',
    packagingLabel: '1 kg · 10 Packs per Box',
    reservedLabel: '0 Pack',
    incomingLabel: '0 Pack',
    reorderLevelLabel: '40 Pack',
    status: 'healthy',
    unitLabel: 'Pack',
    availablePacks: 160,
  }),
  enrichListRow({
    id: 'sku-legacy',
    skuId: 'sku-legacy',
    skuCode: 'MIX-LEG-CTN',
    skuName: 'Legacy Gift Mix',
    productName: 'Legacy Gift Mix',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    availableLabel: '0 Carton',
    mixedStockLabel: 'Out of Stock',
    packsTotalLabel: '0 packs total',
    reservedLabel: '0 Carton',
    incomingLabel: '0 Carton',
    reorderLevelLabel: '5 Carton',
    status: 'out_of_stock',
    unitLabel: 'Carton',
    availablePacks: 0,
  }),
];

export const INVENTORY_SNAPSHOT_FIXTURE: InventorySnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  kpis: [
    {
      id: 'total_products',
      label: 'Products in Inventory',
      value: '5',
      hint: 'Tracked SKUs',
    },
    {
      id: 'total_stock',
      label: 'Total Stock',
      value: '4',
      hint: 'With available qty',
      tone: 'positive',
    },
    {
      id: 'low_stock',
      label: 'Low Stock',
      value: '1',
      tone: 'warning',
    },
    {
      id: 'out_of_stock',
      label: 'Out of Stock',
      value: '1',
      tone: 'danger',
    },
    {
      id: 'warehouses',
      label: 'Warehouses',
      value: '2',
      hint: 'Locations with stock rows',
    },
  ],
  rows: INVENTORY_LIST_FIXTURE,
};

const MOVEMENTS_AKH: StockMovementRow[] = [
  {
    id: 'mv-akh-1',
    type: 'customer_order',
    typeLabel: 'Customer Order',
    quantityLabel: '-20 KG',
    warehouseName: 'Hub — CP',
    referenceLabel: 'GA-14K2',
    note: 'Route GA-14',
    atLabel: '15 Jul 2026, 17:10',
    recordedByLabel: 'System',
  },
  {
    id: 'mv-akh-2',
    type: 'supplier_receipt',
    typeLabel: 'Supplier Receipt',
    quantityLabel: '+50 KG',
    warehouseName: 'Hub — CP',
    referenceLabel: 'PO-8821',
    atLabel: '12 Jul 2026, 09:00',
    recordedByLabel: 'Warehouse',
  },
  {
    id: 'mv-akh-3',
    type: 'damage',
    typeLabel: 'Damage',
    quantityLabel: '-2 KG',
    warehouseName: 'Hub — CP',
    note: 'Broken bag on receipt',
    atLabel: '12 Jul 2026, 09:20',
    recordedByLabel: 'Warehouse',
  },
  {
    id: 'mv-akh-4',
    type: 'manual_adjustment',
    typeLabel: 'Manual Adjustment',
    quantityLabel: '+4 KG',
    warehouseName: 'Hub — CP',
    note: 'Cycle count correction',
    atLabel: '08 Jul 2026, 11:45',
    recordedByLabel: 'Owner',
  },
];

const RESERVATIONS_AKH: StockReservationRow[] = [
  {
    id: 'rsv-akh-1',
    orderCode: 'GA-14K2',
    shopName: 'Sharma Kirana',
    quantityLabel: '5 KG',
    statusLabel: 'Active',
    reservedAtLabel: '15 Jul 2026, 16:55',
    expiresAtLabel: '16 Jul 2026, 12:00',
  },
  {
    id: 'rsv-akh-2',
    orderCode: 'GA-14M8',
    shopName: 'Gupta Traders',
    quantityLabel: '3 KG',
    statusLabel: 'Active',
    reservedAtLabel: '16 Jul 2026, 08:20',
  },
];

const ADJUSTMENTS_AKH: StockAdjustmentRow[] = [
  {
    id: 'adj-akh-1',
    reasonLabel: 'Cycle count',
    quantityLabel: '+4 KG',
    warehouseName: 'Hub — CP',
    atLabel: '08 Jul 2026, 11:45',
    recordedByLabel: 'Owner',
    note: 'Matched physical count',
  },
  {
    id: 'adj-akh-2',
    reasonLabel: 'Damage write-off',
    quantityLabel: '-2 KG',
    warehouseName: 'Hub — CP',
    atLabel: '12 Jul 2026, 09:20',
    recordedByLabel: 'Warehouse',
  },
];

const WAREHOUSES_AKH: InventoryWarehouseBalance[] = [
  enrichWarehouse({
    balanceId: 'inv-akh-10-cp',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    warehouseActive: true,
    onHandLabel: '20 KG',
    reservedLabel: '8 KG',
    availableLabel: '12 KG',
    onHandQuantity: 20,
    availablePacks: 12,
    reservedPacks: 8,
    status: 'low',
    updatedAtLabel: '16 Jul 2026, 09:12',
  }),
  enrichWarehouse({
    balanceId: 'inv-akh-10-saket',
    warehouseId: 'wh-saket',
    warehouseName: 'Hub — Saket',
    warehouseActive: true,
    onHandLabel: '250 KG',
    reservedLabel: '50 KG',
    availableLabel: '200 KG',
    onHandQuantity: 250,
    availablePacks: 200,
    reservedPacks: 50,
    status: 'healthy',
    updatedAtLabel: '15 Jul 2026, 18:00',
  }),
];

const MOVEMENTS_AKH_SAKET: StockMovementRow[] = [
  {
    id: 'mv-akh-saket-1',
    type: 'supplier_receipt',
    typeLabel: 'Supplier Receipt',
    quantityLabel: '+250 KG',
    warehouseName: 'Hub — Saket',
    referenceLabel: 'PO-8890',
    atLabel: '10 Jul 2026, 11:00',
    recordedByLabel: 'Warehouse',
  },
];

const RESERVATIONS_AKH_SAKET: StockReservationRow[] = [
  {
    id: 'rsv-akh-saket-1',
    orderCode: 'GA-16S1',
    shopName: 'South Mart',
    quantityLabel: '50 KG',
    statusLabel: 'Active',
    reservedAtLabel: '15 Jul 2026, 17:30',
  },
];

function singleWarehouseDetail(
  partial: Omit<
    InventorySkuDetail,
    | 'warehouses'
    | 'warehouseActive'
    | 'onHandLabel'
    | 'balanceId'
    | 'categoryName'
    | 'totalAvailablePacks'
    | 'totalMixedStockLabel'
    | 'totalPacksLabel'
    | 'overallStatus'
    | 'packagingLabel'
  > & {
    balanceId: string;
    onHandLabel: string;
    onHandQuantity?: number;
    categoryName?: string;
    packagingLabel?: string;
  },
): InventorySkuDetail {
  const availablePacks = partial.onHandQuantity ?? 0;
  return enrichDetailTotals({
    ...partial,
    categoryName: partial.categoryName ?? 'Dry Fruits',
    packagingLabel: partial.packagingLabel ?? partial.unitLabel,
    totalAvailablePacks: availablePacks,
    totalMixedStockLabel: partial.availableLabel,
    totalPacksLabel: partial.availableLabel,
    overallStatus: partial.status,
    warehouseActive: true,
    warehouses: [
      enrichWarehouse({
        balanceId: partial.balanceId,
        warehouseId: partial.warehouseId,
        warehouseName: partial.warehouseName,
        warehouseActive: true,
        onHandLabel: partial.onHandLabel,
        reservedLabel: partial.reservedLabel,
        availableLabel: partial.availableLabel,
        onHandQuantity: availablePacks,
        availablePacks,
        status: partial.status,
        updatedAtLabel: partial.updatedAtLabel,
      }),
    ],
  });
}

export const INVENTORY_DETAIL_FIXTURES: Record<string, InventorySkuDetail> = {
  'sku-akh-10': enrichDetailTotals({
    skuId: 'sku-akh-10',
    skuCode: 'AKH-LA-10',
    skuName: 'Akhrot Giri · Light Amber',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    categoryName: 'Dry Fruits',
    packagingLabel: 'Bulk kg',
    totalAvailablePacks: 212,
    totalMixedStockLabel: '212 KG',
    totalPacksLabel: '212 packs total',
    overallStatus: 'healthy',
    warehouses: WAREHOUSES_AKH,
    balanceId: 'inv-akh-10-cp',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    warehouseActive: true,
    unitLabel: 'KG',
    onHandLabel: '20 KG',
    availableLabel: '12 KG',
    reservedLabel: '8 KG',
    incomingLabel: '50 KG',
    reorderLevelLabel: '50 KG',
    onHandQuantity: 20,
    stockValueLabel: '₹11,040',
    status: 'low',
    updatedAtLabel: '16 Jul 2026, 09:12',
    movements: MOVEMENTS_AKH,
    reservations: RESERVATIONS_AKH,
    adjustments: ADJUSTMENTS_AKH,
  }),
  'sku-akh-ctn': singleWarehouseDetail({
    skuId: 'sku-akh-ctn',
    skuCode: 'AKH-LA-CTN',
    skuName: 'Akhrot Giri · Carton',
    productId: 'prod-akhrot',
    productName: 'Akhrot Giri',
    balanceId: 'inv-akh-ctn-cp',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    unitLabel: 'Carton',
    onHandLabel: '20 Carton',
    availableLabel: '18 Carton',
    reservedLabel: '2 Carton',
    incomingLabel: '0 Carton',
    reorderLevelLabel: '10 Carton',
    onHandQuantity: 20,
    stockValueLabel: '₹1,60,200',
    status: 'healthy',
    updatedAtLabel: '15 Jul 2026, 14:00',
    movements: [
      {
        id: 'mv-ctn-1',
        type: 'customer_order',
        typeLabel: 'Customer Order',
        quantityLabel: '-2 Carton',
        warehouseName: 'Hub — CP',
        referenceLabel: 'GA-13P1',
        atLabel: '14 Jul 2026, 16:00',
        recordedByLabel: 'System',
      },
      {
        id: 'mv-ctn-2',
        type: 'supplier_receipt',
        typeLabel: 'Supplier Receipt',
        quantityLabel: '+20 Carton',
        warehouseName: 'Hub — CP',
        referenceLabel: 'PO-8802',
        atLabel: '01 Jul 2026, 10:30',
        recordedByLabel: 'Warehouse',
      },
    ],
    reservations: [
      {
        id: 'rsv-ctn-1',
        orderCode: 'GA-15A1',
        shopName: 'Mehta Wholesale',
        quantityLabel: '2 Carton',
        statusLabel: 'Active',
        reservedAtLabel: '16 Jul 2026, 07:40',
      },
    ],
    adjustments: [],
  }),
  'sku-kis': singleWarehouseDetail({
    skuId: 'sku-kis',
    skuCode: 'KIS-EL-CTN',
    skuName: 'Kishmish Green · Extra Long',
    productId: 'prod-kishmish',
    productName: 'Kishmish Green',
    balanceId: 'inv-kis-saket',
    warehouseId: 'wh-saket',
    warehouseName: 'Hub — Saket',
    unitLabel: 'Carton',
    onHandLabel: '134 Carton',
    availableLabel: '120 Carton',
    reservedLabel: '14 Carton',
    incomingLabel: '24 Carton',
    reorderLevelLabel: '40 Carton',
    onHandQuantity: 134,
    stockValueLabel: '₹25,200',
    status: 'incoming',
    updatedAtLabel: '15 Jul 2026, 18:40',
    movements: [
      {
        id: 'mv-kis-1',
        type: 'supplier_receipt',
        typeLabel: 'Supplier Receipt',
        quantityLabel: '+12 Carton',
        warehouseName: 'Hub — Saket',
        referenceLabel: 'PO-8840',
        atLabel: '08 Jul 2026, 14:22',
        recordedByLabel: 'Warehouse',
      },
      {
        id: 'mv-kis-2',
        type: 'customer_order',
        typeLabel: 'Customer Order',
        quantityLabel: '-6 Carton',
        warehouseName: 'Hub — Saket',
        referenceLabel: 'GA-12R4',
        atLabel: '10 Jul 2026, 11:05',
        recordedByLabel: 'System',
      },
    ],
    reservations: [
      {
        id: 'rsv-kis-1',
        orderCode: 'GA-15B2',
        shopName: 'City Dry Fruits',
        quantityLabel: '14 Carton',
        statusLabel: 'Active',
        reservedAtLabel: '15 Jul 2026, 17:00',
      },
    ],
    adjustments: [],
  }),
  'sku-chilli': singleWarehouseDetail({
    skuId: 'sku-chilli',
    skuCode: 'SPC-KC-1KG',
    skuName: 'Kashmiri Chilli · 1 KG pack',
    productId: 'prod-chilli',
    productName: 'Kashmiri Chilli',
    balanceId: 'inv-chilli-cp',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    unitLabel: 'Pack',
    onHandLabel: '160 Pack',
    availableLabel: '160 Pack',
    reservedLabel: '0 Pack',
    incomingLabel: '0 Pack',
    reorderLevelLabel: '40 Pack',
    onHandQuantity: 160,
    stockValueLabel: '₹44,800',
    status: 'healthy',
    updatedAtLabel: '16 Jul 2026, 08:05',
    movements: [
      {
        id: 'mv-ch-1',
        type: 'supplier_receipt',
        typeLabel: 'Supplier Receipt',
        quantityLabel: '+160 Pack',
        warehouseName: 'Hub — CP',
        referenceLabel: 'PO-8851',
        atLabel: '16 Jul 2026, 08:00',
        recordedByLabel: 'Warehouse',
      },
    ],
    reservations: [],
    adjustments: [],
  }),
  'sku-legacy': singleWarehouseDetail({
    skuId: 'sku-legacy',
    skuCode: 'MIX-LEG-CTN',
    skuName: 'Legacy Gift Mix',
    productId: 'prod-legacy-mix',
    productName: 'Legacy Gift Mix',
    balanceId: 'inv-legacy-cp',
    warehouseId: 'wh-cp',
    warehouseName: 'Hub — CP',
    unitLabel: 'Carton',
    onHandLabel: '0 Carton',
    availableLabel: '0 Carton',
    reservedLabel: '0 Carton',
    incomingLabel: '0 Carton',
    reorderLevelLabel: '5 Carton',
    onHandQuantity: 0,
    stockValueLabel: '₹0',
    status: 'out_of_stock',
    updatedAtLabel: '01 Jun 2026, 16:00',
    movements: [
      {
        id: 'mv-leg-1',
        type: 'customer_order',
        typeLabel: 'Customer Order',
        quantityLabel: '-4 Carton',
        warehouseName: 'Hub — CP',
        referenceLabel: 'GA-09Z1',
        atLabel: '28 May 2026, 15:10',
        recordedByLabel: 'System',
      },
      {
        id: 'mv-leg-2',
        type: 'manual_adjustment',
        typeLabel: 'Manual Adjustment',
        quantityLabel: '-1 Carton',
        warehouseName: 'Hub — CP',
        note: 'Archived SKU clearance',
        atLabel: '01 Jun 2026, 16:00',
        recordedByLabel: 'Owner',
      },
    ],
    reservations: [],
    adjustments: [
      {
        id: 'adj-leg-1',
        reasonLabel: 'Clearance',
        quantityLabel: '-1 Carton',
        warehouseName: 'Hub — CP',
        atLabel: '01 Jun 2026, 16:00',
        recordedByLabel: 'Owner',
        note: 'Archived SKU clearance',
      },
    ],
  }),
};

export function getInventorySkuDetailFixture(
  skuId: string,
  balanceId?: string | null,
): InventorySkuDetail | null {
  const base = INVENTORY_DETAIL_FIXTURES[skuId];
  if (!base) return null;

  if (skuId === 'sku-akh-10' && balanceId === 'inv-akh-10-saket') {
    const saket = WAREHOUSES_AKH[1]!;
    return {
      ...base,
      warehouses: WAREHOUSES_AKH,
      balanceId: saket.balanceId,
      warehouseId: saket.warehouseId,
      warehouseName: saket.warehouseName,
      warehouseActive: saket.warehouseActive,
      onHandLabel: saket.onHandLabel,
      availableLabel: saket.availableLabel,
      reservedLabel: saket.reservedLabel,
      onHandQuantity: saket.onHandQuantity,
      status: saket.status,
      updatedAtLabel: saket.updatedAtLabel,
      stockValueLabel: '₹2,30,000',
      incomingLabel: '0 KG',
      movements: MOVEMENTS_AKH_SAKET,
      reservations: RESERVATIONS_AKH_SAKET,
      adjustments: [],
    };
  }

  return base;
}
