/**
 * Phase 5A — supplier + purchasing view models and helpers.
 * Purchase cost is independent of selling price / MRP.
 */

import { formatDate, formatDateTime, formatInr } from '@/data/live/format';
import type { PurchaseAccountingVm } from '@/data/purchase-accounting';
import type { SupplierPaymentMethod } from '@/data/supplier-ledger';
import type { GstSupplyType } from '@/data/gst';
import { GST_SUPPLY_TYPE_LABELS } from '@/data/gst';

export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  mobileLabel: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  notes: string | null;
  isActive: boolean;
  statusLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
};

export type SupplierInput = {
  name: string;
  contactPerson?: string | null;
  mobile?: string | null;
  email?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  gstin?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type PurchaseItemInput = {
  skuId: string;
  quantity: number;
  unitCost: number;
};

export type PurchaseItemRow = {
  id: string;
  skuId: string;
  productName: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  quantityLabel: string;
  unitCost: number;
  unitCostLabel: string;
  lineTotal: number;
  lineTotalLabel: string;
};

export type PurchaseListRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  purchaseDate: string;
  purchaseDateLabel: string;
  billNumber: string;
  status: PurchaseStatus;
  statusLabel: string;
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  supplyType: GstSupplyType;
  total: number;
  totalLabel: string;
};

export type PurchaseBillPaymentRow = {
  id: string;
  paymentDate: string;
  paymentDateLabel: string;
  amount: number;
  amountLabel: string;
  paymentMethod: SupplierPaymentMethod | string;
  paymentMethodLabel: string;
  referenceNumber: string | null;
};

export type PurchaseDetail = PurchaseListRow & {
  notes: string | null;
  receivedAtLabel: string | null;
  items: PurchaseItemRow[];
  subtotalLabel: string;
  taxAmountLabel: string;
  canEdit: boolean;
  canReceive: boolean;
  accounting: PurchaseAccountingVm;
  billPayments: PurchaseBillPaymentRow[];
};

export type PurchaseDraftInput = {
  purchaseId?: string | null;
  supplierId: string;
  warehouseId: string;
  purchaseDate: string;
  billNumber: string;
  taxAmount?: number;
  supplyType?: GstSupplyType;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  notes?: string | null;
  items: PurchaseItemInput[];
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Draft',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export function purchaseLineTotal(quantity: number, unitCost: number): number {
  return Math.round((Number(quantity) || 0) * (Number(unitCost) || 0) * 100) / 100;
}

export function purchaseTotals(
  items: readonly PurchaseItemInput[],
  taxAmount = 0,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = Math.round(
    items.reduce(
      (sum, item) => sum + purchaseLineTotal(item.quantity, item.unitCost),
      0,
    ) * 100,
  ) / 100;
  const tax = Math.max(0, Math.round((Number(taxAmount) || 0) * 100) / 100);
  return {
    subtotal,
    taxAmount: tax,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}

export function filterSupplierRows(
  rows: readonly SupplierRow[],
  query: string,
  status: 'all' | 'active' | 'inactive' = 'all',
): SupplierRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status === 'active' && !row.isActive) return false;
    if (status === 'inactive' && row.isActive) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.mobileLabel?.toLowerCase().includes(q) ?? false) ||
      (row.contactPerson?.toLowerCase().includes(q) ?? false) ||
      (row.gstin?.toLowerCase().includes(q) ?? false) ||
      (row.city?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function filterPurchaseRows(
  rows: readonly PurchaseListRow[],
  opts: {
    query?: string;
    status?: 'all' | PurchaseStatus;
    dateFrom?: string;
    dateTo?: string;
  },
): PurchaseListRow[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const status = opts.status ?? 'all';
  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false;
    if (opts.dateFrom && row.purchaseDate < opts.dateFrom) return false;
    if (opts.dateTo && row.purchaseDate > opts.dateTo) return false;
    if (!q) return true;
    return (
      row.billNumber.toLowerCase().includes(q) ||
      row.supplierName.toLowerCase().includes(q) ||
      row.warehouseName.toLowerCase().includes(q)
    );
  });
}

export function mapSupplierDbRow(row: {
  id: string;
  name: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): SupplierRow {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    mobileLabel: row.mobile,
    email: row.email,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    gstin: row.gstin,
    notes: row.notes,
    isActive: row.is_active,
    statusLabel: row.is_active ? 'Active' : 'Inactive',
    createdAtLabel: formatDateTime(row.created_at),
    updatedAtLabel: formatDateTime(row.updated_at),
  };
}

export function mapPurchaseItemDbRow(row: {
  id: string;
  sku_id: string;
  product_name: string;
  sku_code: string;
  sku_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}): PurchaseItemRow {
  return {
    id: row.id,
    skuId: row.sku_id,
    productName: row.product_name,
    skuCode: row.sku_code,
    skuName: row.sku_name,
    quantity: Number(row.quantity) || 0,
    quantityLabel: String(Number(row.quantity) || 0),
    unitCost: Number(row.unit_cost) || 0,
    unitCostLabel: formatInr(Number(row.unit_cost) || 0),
    lineTotal: Number(row.line_total) || 0,
    lineTotalLabel: formatInr(Number(row.line_total) || 0),
  };
}

export function mapPurchaseListFields(input: {
  id: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  purchaseDate: string;
  billNumber: string;
  status: string;
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  supplyType?: string | null;
  total: number;
}): PurchaseListRow {
  const status = (input.status.toUpperCase() as PurchaseStatus) || 'DRAFT';
  const supplyRaw = (input.supplyType ?? 'UNSET').toUpperCase();
  const supplyType: GstSupplyType =
    supplyRaw === 'INTRA' || supplyRaw === 'INTER' || supplyRaw === 'UNSET'
      ? supplyRaw
      : 'UNSET';
  return {
    id: input.id,
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    warehouseId: input.warehouseId,
    warehouseName: input.warehouseName,
    purchaseDate: input.purchaseDate.slice(0, 10),
    purchaseDateLabel: formatDate(input.purchaseDate),
    billNumber: input.billNumber,
    status,
    statusLabel: PURCHASE_STATUS_LABELS[status] ?? status,
    itemCount: input.itemCount,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    cgstAmount: Number(input.cgstAmount) || 0,
    sgstAmount: Number(input.sgstAmount) || 0,
    igstAmount: Number(input.igstAmount) || 0,
    supplyType,
    total: input.total,
    totalLabel: formatInr(input.total),
  };
}

export function purchaseSupplyTypeLabel(supplyType: GstSupplyType): string {
  return GST_SUPPLY_TYPE_LABELS[supplyType];
}

export const PURCHASING_SECTION_LINKS = [
  {
    to: '/purchases',
    label: 'Purchases',
    description: 'Supplier bills and stock receipts',
  },
  {
    to: '/purchases/scan',
    label: 'Bill photo',
    description: 'Upload a bill photo → review → draft',
  },
  {
    to: '/payables',
    label: 'Money to Pay',
    description: 'Supplier balances due',
  },
  {
    to: '/suppliers',
    label: 'Suppliers',
    description: 'Vendor master',
  },
  {
    to: '/inventory',
    label: 'Inventory',
    description: 'Stock on hand',
  },
  {
    to: '/expenses',
    label: 'Expenses',
    description: 'Non-stock business money out',
  },
] as const;
