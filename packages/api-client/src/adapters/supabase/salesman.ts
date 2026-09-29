import type { Category, Product, Sku } from '@groaurum/shared-types';
import { selectEffectiveSkuPrice } from '../../catalogue/effective-price';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapCategory, mapProduct, mapSku } from './mappers';

export type SalesVisitStatus = 'PLANNED' | 'VISITED' | 'PENDING' | 'MISSED' | 'SHOP_CLOSED';

export type SalesActivationStatus =
  | 'not_activated'
  | 'app_link_sent'
  | 'activated'
  | 'access_disabled';

export type SalesmanDashboard = {
  assignedRetailers: number;
  todaysVisits: number;
  pendingActivations: number;
  ordersCollected: number;
  revenueThisMonthLabel: string;
  revenueThisMonth: number;
};

export type SalesmanRetailer = {
  id: string;
  tradeName: string;
  legalName: string | null;
  lifecycleStatus: string;
  activationStatus: SalesActivationStatus;
  activationLabel: string;
  areaLabel: string;
  pinCode: string;
  addressLine: string;
  city: string;
  state: string;
  serviceAreaId: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  primaryContactName: string | null;
  primaryContactMobile: string | null;
  lastOrderLabel: string;
  pendingInvitationToken: string | null;
};

export type SalesmanOrderSummary = {
  id: string;
  /** Short display reference; orders have no separate number column. */
  orderNumber: string;
  shopId: string;
  shopName: string;
  total: number;
  totalLabel: string;
  status: string;
  createdAt: string;
  dateLabel: string;
  dateTimeLabel: string;
};

export type SalesmanOrderLine = {
  id: string;
  skuId: string;
  productName: string;
  skuName: string;
  skuCode: string;
  specification: string | null;
  sellingUnit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SalesmanOrderDetail = SalesmanOrderSummary & {
  source: string;
  subtotal: number;
  adjustments: number;
  updatedAt: string;
  lines: SalesmanOrderLine[];
};

export type OrderPreviewLineInput = {
  skuId: string;
  quantity: number;
};

export type OrderPreviewErrorCode =
  | 'DUPLICATE_SKU'
  | 'INVALID_QUANTITY'
  | 'NOT_ORDERABLE'
  | 'BELOW_MOQ'
  | 'INVALID_STEP'
  | 'NO_PRICE'
  | 'PRICE_SPLIT'
  | 'NO_INVENTORY'
  | 'INSUFFICIENT_STOCK';

export type OrderPreviewLine = {
  skuId: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  availableQuantity: number | null;
  ok: boolean;
  errorCode: OrderPreviewErrorCode | null;
  message: string | null;
};

/** Server-priced cart from preview_assisted_order_lines (read-only). */
export type SalesmanOrderPreview = {
  lines: OrderPreviewLine[];
  itemCount: number;
  subtotal: number;
  total: number;
  currency: string;
  allValid: boolean;
  pricedAt: string;
};

export type VisitGpsResult = {
  visitId: string;
  status: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMetres: number | null;
  gpsVerification: 'verified' | 'unavailable';
  checkedInAt: string | null;
  completedAt: string | null;
  photoPath: string | null;
};

export type CompleteVisitInput = {
  visitId: string;
  status: 'VISITED' | 'SHOP_CLOSED';
  lat: number;
  lng: number;
  /** Undefined leaves stored notes unchanged. Null or blank clears them. */
  notes?: string | null;
  photoPath?: string | null;
};

export type SalesmanVisit = {
  id: string;
  shopId: string;
  shopName: string;
  areaLabel: string;
  plannedAt: string;
  plannedAtLabel: string;
  status: SalesVisitStatus;
  notes: string | null;
  /** Set when the visit row has visited_at. Omitted by list methods that do not select it. */
  visitedAt?: string | null;
  visitedAtLabel?: string | null;
  contactName?: string | null;
  contactMobile?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  checkInAt?: string | null;
  checkInDistanceMetres?: number | null;
  gpsVerification?: 'verified' | 'unavailable' | null;
};

export type SalesmanPerformance = {
  ordersThisMonth: number;
  revenueGeneratedLabel: string;
  newRetailers: number;
  activationRateLabel: string;
  repeatCustomers: number;
};

export type SalesmanEarningModel = 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';

/** Calculated from the target row plus delivered-and-paid sales. */
export type SalesmanTargetProgress = {
  month: string;
  targetAmount: number;
  achievedAmount: number;
  remainingAmount: number;
  progressPercent: number;
};

export type SalesmanSalarySnapshot = {
  monthlySalary: number;
  dailyAllowance: number;
  otherAllowance: number;
};

/** One order's earned commission, summed from salesman_commission_entries. */
export type SalesmanCommissionLine = {
  orderId: string;
  orderNumber: string;
  shopName: string;
  earnedAt: string;
  orderStatus: string;
  commissionAmount: number;
};

/** An order with no earned commission row. No estimated commission is attached. */
export type SalesmanAwaitingOrder = {
  orderId: string;
  orderNumber: string;
  shopName: string;
  createdAt: string;
  orderStatus: string;
  orderTotal: number;
};

export type SalesmanEarnings = {
  month: string;
  earningModel: SalesmanEarningModel | null;
  earnedCommission: number;
  salaryApplies: boolean;
  salary: SalesmanSalarySnapshot | null;
  totalEarnings: number;
  totalIncludesSalary: boolean;
  awaitingOrderCount: number;
  awaitingOrderValue: number;
  awaitingOrders: SalesmanAwaitingOrder[];
  entries: SalesmanCommissionLine[];
  payslipsAvailable: false;
  target: SalesmanTargetProgress | null;
};

export type SalesmanClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SalesmanExpenseCategory = 'TRAVEL' | 'FOOD' | 'PHONE' | 'OTHER';

export type SalesmanExpense = {
  id: string;
  salesmanProfileId: string;
  category: SalesmanExpenseCategory;
  amount: number;
  expenseDate: string;
  note: string | null;
  receiptPath: string | null;
  receiptUrl: string | null;
  status: SalesmanClaimStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SalesmanExpenseInput = {
  category: SalesmanExpenseCategory;
  amount: number;
  expenseDate: string;
  note?: string | null;
};

export type SalesmanReturnRequest = {
  id: string;
  salesmanProfileId: string;
  shopId: string;
  shopName: string;
  orderId: string;
  skuId: string;
  productName: string;
  skuName: string;
  skuCode: string;
  quantity: number;
  reason: string;
  note: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  status: SalesmanClaimStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SalesmanReturnInput = {
  orderId: string;
  skuId: string;
  quantity: number;
  reason: string;
  note?: string | null;
};

export type SalesmanMessage = {
  id: string;
  salesmanProfileId: string;
  senderProfileId: string;
  body: string;
  createdAt: string;
};

export type SalesmanNotice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SalesmanVoiceNote = {
  id: string;
  salesmanProfileId: string;
  shopId: string;
  visitId: string | null;
  audioPath: string | null;
  audioUrl: string | null;
  durationSeconds: number;
  createdAt: string;
};

/** Salesman H4 attendance / presence status. */
export type SalesmanAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'WEEKLY_OFF';

export type SalesmanAttendance = {
  id: string;
  profileId: string;
  workDate: string;
  status: SalesmanAttendanceStatus;
  dayStartedAt: string | null;
  dayEndedAt: string | null;
  dayStartedAtLabel: string | null;
  dayEndedAtLabel: string | null;
};

export type SalesmanDayActionResult = SalesmanAttendance & {
  alreadyStarted?: boolean;
  alreadyEnded?: boolean;
};

export type CreateRetailerInput = {
  tradeName: string;
  primaryContactName: string;
  primaryContactMobile: string;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPinCode: string;
  serviceAreaId?: string | null;
  legalName?: string | null;
  /** Optional shop GPS (shops.delivery_lat / delivery_lng). */
  deliveryLat?: number | null;
  deliveryLng?: number | null;
};

export type AssistedOrderLineInput = {
  skuId: string;
  quantity: number;
  agreedUnitPrice: number;
};

export type CatalogueSkuRow = {
  sku: Sku;
  product: Product;
  category: Category | null;
  unitPrice: number;
  availableQuantity: number;
};

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function asRpcRecord(data: unknown, label: string): Record<string, unknown> {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`${label} did not return a result.`);
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} did not return a result.`);
  }
  return value as Record<string, unknown>;
}

function rpcNumber(row: Record<string, unknown>, key: string, label: string): number {
  const n = Number(row[key]);
  if (!Number.isFinite(n)) throw new Error(`${label} did not return a result.`);
  return n;
}

function rpcString(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} did not return a result.`);
  }
  return value;
}

export function parseSalesmanTarget(data: unknown): SalesmanTargetProgress | null {
  if (data == null) return null;
  const row = asRpcRecord(data, 'Target');
  return {
    month: rpcString(row, 'month', 'Target').slice(0, 10),
    targetAmount: rpcNumber(row, 'targetAmount', 'Target'),
    achievedAmount: rpcNumber(row, 'achievedAmount', 'Target'),
    remainingAmount: rpcNumber(row, 'remainingAmount', 'Target'),
    progressPercent: rpcNumber(row, 'progressPercent', 'Target'),
  };
}

const EARNING_MODELS = new Set<SalesmanEarningModel>([
  'SALARY',
  'COMMISSION',
  'SALARY_PLUS_COMMISSION',
]);

function parseSalary(value: unknown): SalesmanSalarySnapshot | null {
  if (value == null) return null;
  const row = asRpcRecord(value, 'Earnings');
  return {
    monthlySalary: rpcNumber(row, 'monthlySalary', 'Earnings'),
    dailyAllowance: rpcNumber(row, 'dailyAllowance', 'Earnings'),
    otherAllowance: rpcNumber(row, 'otherAllowance', 'Earnings'),
  };
}

function parseCommissionLine(value: unknown): SalesmanCommissionLine {
  const row = asRpcRecord(value, 'Earnings');
  return {
    orderId: rpcString(row, 'orderId', 'Earnings'),
    orderNumber: rpcString(row, 'orderNumber', 'Earnings'),
    shopName: rpcString(row, 'shopName', 'Earnings'),
    earnedAt: rpcString(row, 'earnedAt', 'Earnings'),
    orderStatus: rpcString(row, 'orderStatus', 'Earnings'),
    commissionAmount: rpcNumber(row, 'commissionAmount', 'Earnings'),
  };
}

function parseAwaitingOrder(value: unknown): SalesmanAwaitingOrder {
  const row = asRpcRecord(value, 'Earnings');
  return {
    orderId: rpcString(row, 'orderId', 'Earnings'),
    orderNumber: rpcString(row, 'orderNumber', 'Earnings'),
    shopName: rpcString(row, 'shopName', 'Earnings'),
    createdAt: rpcString(row, 'createdAt', 'Earnings'),
    orderStatus: rpcString(row, 'orderStatus', 'Earnings'),
    orderTotal: rpcNumber(row, 'orderTotal', 'Earnings'),
  };
}

export function parseSalesmanEarnings(data: unknown): SalesmanEarnings {
  const row = asRpcRecord(data, 'Earnings');
  const modelRaw = row['earningModel'];
  const earningModel =
    typeof modelRaw === 'string' && EARNING_MODELS.has(modelRaw as SalesmanEarningModel)
      ? (modelRaw as SalesmanEarningModel)
      : null;
  const entriesRaw = row['entries'];
  const awaitingRaw = row['awaitingOrders'];
  if (!Array.isArray(entriesRaw) || !Array.isArray(awaitingRaw)) {
    throw new Error('Earnings did not return a result.');
  }
  if (typeof row['salaryApplies'] !== 'boolean' || typeof row['totalIncludesSalary'] !== 'boolean') {
    throw new Error('Earnings did not return a result.');
  }
  if (row['payslipsAvailable'] !== false) {
    throw new Error('Earnings did not return a result.');
  }
  return {
    month: rpcString(row, 'month', 'Earnings').slice(0, 10),
    earningModel,
    earnedCommission: rpcNumber(row, 'earnedCommission', 'Earnings'),
    salaryApplies: row['salaryApplies'],
    salary: parseSalary(row['salary']),
    totalEarnings: rpcNumber(row, 'totalEarnings', 'Earnings'),
    totalIncludesSalary: row['totalIncludesSalary'],
    awaitingOrderCount: rpcNumber(row, 'awaitingOrderCount', 'Earnings'),
    awaitingOrderValue: rpcNumber(row, 'awaitingOrderValue', 'Earnings'),
    awaitingOrders: awaitingRaw.map(parseAwaitingOrder),
    entries: entriesRaw.map(parseCommissionLine),
    payslipsAvailable: false,
    target: parseSalesmanTarget(row['target']),
  };
}

export function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapPreview(data: unknown): SalesmanOrderPreview {
  const row = (data ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : [];
  return {
    lines: lines.map((l) => ({
      skuId: String(l.skuId),
      quantity: Number(l.quantity),
      unitPrice: numOrNull(l.unitPrice),
      lineTotal: numOrNull(l.lineTotal),
      availableQuantity: numOrNull(l.availableQuantity),
      ok: l.ok === true,
      errorCode: (l.errorCode as OrderPreviewErrorCode | null) ?? null,
      message: (l.message as string | null) ?? null,
    })),
    itemCount: Number(row.itemCount ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    currency: String(row.currency ?? 'INR'),
    allValid: row.allValid === true,
    pricedAt: String(row.pricedAt ?? new Date().toISOString()),
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Private bucket. Path is `{profileId}/{shopId}/shop`. Not product-media. */
export const SALESMAN_MEDIA_BUCKET = 'salesman-media';

const SHOP_PHOTO_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function shopPhotoObjectPath(profileId: string, shopId: string): string {
  return `${profileId}/${shopId}/shop`;
}

/** Private object under the existing salesman-media policy: {uid}/{shopId}/visits/{visitId}. */
export function visitPhotoObjectPath(
  profileId: string,
  shopId: string,
  visitId: string,
): string {
  return `${profileId}/${shopId}/visits/${visitId}`;
}

/** Private object under salesman-media: {uid}/profile. Not a shop folder. */
export function profilePhotoObjectPath(profileId: string): string {
  return `${profileId}/profile`;
}

export function expenseReceiptObjectPath(profileId: string, expenseId: string): string {
  return `${profileId}/expenses/${expenseId}`;
}

export function returnPhotoObjectPath(profileId: string, requestId: string): string {
  return `${profileId}/returns/${requestId}`;
}

export function voiceNoteObjectPath(profileId: string, shopId: string, noteId: string): string {
  return `${profileId}/${shopId}/voice/${noteId}`;
}

export type SalesLanguage = 'en' | 'hi';

export type SalesmanOwnProfile = {
  id: string;
  displayName: string;
  email: string | null;
  preferredLanguage: SalesLanguage;
  avatarPath: string | null;
  avatarUrl: string | null;
  setupCompletedAt: string | null;
};

export type UpdateOwnProfileInput = {
  displayName: string;
  preferredLanguage: SalesLanguage;
  updateAvatar?: boolean;
  avatarPath?: string | null;
  completeSetup?: boolean;
};

export type ShopPhotoUpload = {
  bytes: ArrayBuffer;
  contentType: string;
};

function toOrderSummary(
  o: {
    id: unknown;
    shop_id: unknown;
    total: unknown;
    status: unknown;
    created_at: unknown;
  },
  shopName: string,
): SalesmanOrderSummary {
  const id = String(o.id);
  const createdAt = String(o.created_at);
  const total = Number(o.total ?? 0);
  return {
    id,
    orderNumber: formatOrderNumber(id),
    shopId: String(o.shop_id),
    shopName,
    total,
    totalLabel: formatInr(total),
    status: String(o.status),
    createdAt,
    dateLabel: formatDate(createdAt),
    dateTimeLabel: formatDateTime(createdAt),
  };
}

function isStorageNotFound(error: { message?: string; statusCode?: string | number }): boolean {
  const message = String(error.message ?? '').toLowerCase();
  const status = String(error.statusCode ?? '');
  return status === '404' || message.includes('not found');
}

async function requireAuthUserId(client: GroAurumSupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

function deriveSalesAppAccess(input: {
  isActive: boolean;
  hasAuthLink: boolean;
  hasAppLinkSent: boolean;
}): SalesActivationStatus {
  if (!input.isActive) return 'access_disabled';
  if (input.hasAuthLink) return 'activated';
  if (input.hasAppLinkSent) return 'app_link_sent';
  return 'not_activated';
}

/** Sales screens do not show an activation label. Keep the field for the service type. */
function salesActivationLabel(_status: SalesActivationStatus): string {
  return '';
}

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Local calendar date YYYY-MM-DD (not UTC). */
function localWorkDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function mapAttendanceRow(row: {
  id: string;
  profile_id: string;
  work_date: string;
  status: string;
  day_started_at: string | null;
  day_ended_at: string | null;
}): SalesmanAttendance {
  const dayStartedAt = row.day_started_at ? String(row.day_started_at) : null;
  const dayEndedAt = row.day_ended_at ? String(row.day_ended_at) : null;
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    workDate: String(row.work_date).slice(0, 10),
    status: String(row.status) as SalesmanAttendanceStatus,
    dayStartedAt,
    dayEndedAt,
    dayStartedAtLabel: formatTimeLabel(dayStartedAt),
    dayEndedAtLabel: formatTimeLabel(dayEndedAt),
  };
}

function mapVisitGpsResult(data: unknown): VisitGpsResult {
  if (data == null || typeof data !== 'object') {
    throw new Error('Visit update returned no result');
  }
  const row = data as Record<string, unknown>;
  return {
    visitId: String(row.visitId ?? ''),
    status: row.status == null ? null : String(row.status),
    notes: row.notes == null ? null : String(row.notes),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    distanceMetres: row.distanceMetres == null ? null : Number(row.distanceMetres),
    gpsVerification: row.gpsVerification === 'unavailable' ? 'unavailable' : 'verified',
    checkedInAt: row.checkedInAt == null ? null : String(row.checkedInAt),
    completedAt: row.completedAt == null ? null : String(row.completedAt),
    photoPath: row.photoPath == null ? null : String(row.photoPath),
  };
}

function mapDayActionResult(
  data: Record<string, unknown>,
): SalesmanDayActionResult {
  const dayStartedAt =
    data.dayStartedAt != null ? String(data.dayStartedAt) : null;
  const dayEndedAt = data.dayEndedAt != null ? String(data.dayEndedAt) : null;
  return {
    id: String(data.id),
    profileId: String(data.profileId),
    workDate: String(data.workDate).slice(0, 10),
    status: String(data.status) as SalesmanAttendanceStatus,
    dayStartedAt,
    dayEndedAt,
    dayStartedAtLabel: formatTimeLabel(dayStartedAt),
    dayEndedAtLabel: formatTimeLabel(dayEndedAt),
    alreadyStarted:
      typeof data.alreadyStarted === 'boolean'
        ? data.alreadyStarted
        : undefined,
    alreadyEnded:
      typeof data.alreadyEnded === 'boolean' ? data.alreadyEnded : undefined,
  };
}

const VOICE_CONTENT_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']);

const CLAIM_STATUSES = new Set<SalesmanClaimStatus>(['PENDING', 'APPROVED', 'REJECTED']);
const EXPENSE_CATEGORIES = new Set<SalesmanExpenseCategory>(['TRAVEL', 'FOOD', 'PHONE', 'OTHER']);

function assertPhoto(file: ShopPhotoUpload): void {
  if (!SHOP_PHOTO_CONTENT_TYPES.has(file.contentType)) {
    throw new Error('Use a JPEG, PNG, or WebP photo.');
  }
}

function claimStatus(value: unknown, label: string): SalesmanClaimStatus {
  const status = String(value ?? '');
  if (!CLAIM_STATUSES.has(status as SalesmanClaimStatus)) {
    throw new Error(`${label} did not return a result.`);
  }
  return status as SalesmanClaimStatus;
}

async function signedMediaUrl(
  client: GroAurumSupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const signed = await client.storage.from(SALESMAN_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (signed.error) {
    if (!isStorageNotFound(signed.error)) throw signed.error;
    return null;
  }
  return signed.data?.signedUrl ?? null;
}

type ExpenseRow = {
  id: string;
  salesman_profile_id: string;
  category: string;
  amount: number;
  expense_date: string;
  note: string | null;
  receipt_path: string | null;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

async function mapExpenseRow(
  client: GroAurumSupabaseClient,
  row: ExpenseRow,
): Promise<SalesmanExpense> {
  if (!EXPENSE_CATEGORIES.has(row.category as SalesmanExpenseCategory)) {
    throw new Error('Expense did not return a result.');
  }
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    category: row.category as SalesmanExpenseCategory,
    amount: Number(row.amount),
    expenseDate: String(row.expense_date).slice(0, 10),
    note: row.note,
    receiptPath: row.receipt_path,
    receiptUrl: await signedMediaUrl(client, row.receipt_path),
    status: claimStatus(row.status, 'Expense'),
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapExpenseJson(data: unknown): SalesmanExpense {
  const row = asRpcRecord(data, 'Expense');
  const category = String(row['category'] ?? '');
  if (!EXPENSE_CATEGORIES.has(category as SalesmanExpenseCategory)) {
    throw new Error('Expense did not return a result.');
  }
  return {
    id: rpcString(row, 'id', 'Expense'),
    salesmanProfileId: rpcString(row, 'salesmanProfileId', 'Expense'),
    category: category as SalesmanExpenseCategory,
    amount: rpcNumber(row, 'amount', 'Expense'),
    expenseDate: rpcString(row, 'expenseDate', 'Expense').slice(0, 10),
    note: row['note'] == null ? null : String(row['note']),
    receiptPath: row['receiptPath'] == null ? null : String(row['receiptPath']),
    receiptUrl: null,
    status: claimStatus(row['status'], 'Expense'),
    reviewNote: row['reviewNote'] == null ? null : String(row['reviewNote']),
    reviewedAt: row['reviewedAt'] == null ? null : String(row['reviewedAt']),
    createdAt: rpcString(row, 'createdAt', 'Expense'),
  };
}

type ReturnRow = {
  id: string;
  salesman_profile_id: string;
  shop_id: string;
  shop_name: string;
  order_id: string;
  sku_id: string;
  product_name: string;
  sku_name: string;
  sku_code: string;
  quantity: number;
  reason: string;
  note: string | null;
  photo_path: string | null;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

async function mapReturnRow(
  client: GroAurumSupabaseClient,
  row: ReturnRow,
): Promise<SalesmanReturnRequest> {
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    shopId: row.shop_id,
    shopName: row.shop_name,
    orderId: row.order_id,
    skuId: row.sku_id,
    productName: row.product_name,
    skuName: row.sku_name,
    skuCode: row.sku_code,
    quantity: Number(row.quantity),
    reason: row.reason,
    note: row.note,
    photoPath: row.photo_path,
    photoUrl: await signedMediaUrl(client, row.photo_path),
    status: claimStatus(row.status, 'Return'),
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapMessageRow(row: {
  id: string;
  salesman_profile_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
}): SalesmanMessage {
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    senderProfileId: row.sender_profile_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapMessageJson(data: unknown): SalesmanMessage {
  const row = asRpcRecord(data, 'Message');
  return {
    id: rpcString(row, 'id', 'Message'),
    salesmanProfileId: rpcString(row, 'salesmanProfileId', 'Message'),
    senderProfileId: rpcString(row, 'senderProfileId', 'Message'),
    body: rpcString(row, 'body', 'Message'),
    createdAt: rpcString(row, 'createdAt', 'Message'),
  };
}

function mapVoiceJson(data: unknown): SalesmanVoiceNote {
  const row = asRpcRecord(data, 'Voice note');
  return {
    id: rpcString(row, 'id', 'Voice note'),
    salesmanProfileId: row['salesmanProfileId'] == null ? '' : String(row['salesmanProfileId']),
    shopId: rpcString(row, 'shopId', 'Voice note'),
    visitId: row['visitId'] == null ? null : String(row['visitId']),
    audioPath: row['audioPath'] == null ? null : String(row['audioPath']),
    audioUrl: null,
    durationSeconds: rpcNumber(row, 'durationSeconds', 'Voice note'),
    createdAt: rpcString(row, 'createdAt', 'Voice note'),
  };
}

async function mapVoiceRow(
  client: GroAurumSupabaseClient,
  row: {
    id: string;
    salesman_profile_id: string;
    shop_id: string;
    visit_id: string | null;
    audio_path: string | null;
    duration_seconds: number;
    created_at: string;
  },
): Promise<SalesmanVoiceNote> {
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    shopId: row.shop_id,
    visitId: row.visit_id,
    audioPath: row.audio_path,
    audioUrl: await signedMediaUrl(client, row.audio_path),
    durationSeconds: Number(row.duration_seconds),
    createdAt: row.created_at,
  };
}

function mapReturnJson(data: unknown): SalesmanReturnRequest {
  const row = asRpcRecord(data, 'Return');
  return {
    id: rpcString(row, 'id', 'Return'),
    salesmanProfileId: rpcString(row, 'salesmanProfileId', 'Return'),
    shopId: rpcString(row, 'shopId', 'Return'),
    shopName: rpcString(row, 'shopName', 'Return'),
    orderId: rpcString(row, 'orderId', 'Return'),
    skuId: rpcString(row, 'skuId', 'Return'),
    productName: rpcString(row, 'productName', 'Return'),
    skuName: rpcString(row, 'skuName', 'Return'),
    skuCode: rpcString(row, 'skuCode', 'Return'),
    quantity: rpcNumber(row, 'quantity', 'Return'),
    reason: rpcString(row, 'reason', 'Return'),
    note: row['note'] == null ? null : String(row['note']),
    photoPath: row['photoPath'] == null ? null : String(row['photoPath']),
    photoUrl: null,
    status: claimStatus(row['status'], 'Return'),
    reviewNote: row['reviewNote'] == null ? null : String(row['reviewNote']),
    reviewedAt: row['reviewedAt'] == null ? null : String(row['reviewedAt']),
    createdAt: rpcString(row, 'createdAt', 'Return'),
  };
}

export function createSupabaseSalesmanService(client: GroAurumSupabaseClient) {
  async function listAssignedShopsRaw() {
    const { data, error } = await client
      .from('shops')
      .select('*')
      .is('deleted_at', null)
      .order('trade_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  return {
    async getDashboard(profileId: string): Promise<SalesmanDashboard> {
      const shops = await listAssignedShopsRaw();
      const shopIds = shops.map((s) => s.id as string);

      let authLinks: { shop_id: string }[] = [];
      if (shopIds.length) {
        const { data, error } = await client
          .from('shop_auth_links')
          .select('shop_id')
          .in('shop_id', shopIds);
        if (error) throw error;
        authLinks = data ?? [];
      }
      const authLinkSet = new Set(authLinks.map((row) => row.shop_id as string));

      const { count: visitCount, error: visitError } = await client
        .from('sales_visits')
        .select('id', { count: 'exact', head: true })
        .eq('salesman_profile_id', profileId)
        .gte('planned_at', startOfTodayIso())
        .lte('planned_at', endOfTodayIso());
      if (visitError) throw visitError;

      const pendingActivations = shops.filter((s) => {
        const sid = s.id as string;
        return !authLinkSet.has(sid);
      }).length;

      let ordersCollected = 0;
      let revenue = 0;
      if (shopIds.length) {
        const { data: orders, error: ordersError } = await client
          .from('orders')
          .select('id, total, created_by_profile_id, created_at')
          .eq('created_by_profile_id', profileId)
          .gte('created_at', startOfMonthIso());
        if (ordersError) throw ordersError;
        const rows = orders ?? [];
        ordersCollected = rows.length;
        revenue = rows.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      }

      return {
        assignedRetailers: shops.length,
        todaysVisits: visitCount ?? 0,
        pendingActivations,
        ordersCollected,
        revenueThisMonth: revenue,
        revenueThisMonthLabel: formatInr(revenue),
      };
    },

    async listRetailers(): Promise<SalesmanRetailer[]> {
      const shops = await listAssignedShopsRaw();
      if (!shops.length) return [];

      const shopIds = shops.map((s) => s.id as string);
      const areaIds = [
        ...new Set(
          shops
            .map((s) => s.service_area_id as string | null)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const [contactsRes, areasRes, invitationsRes, authLinksRes, ordersRes] =
        await Promise.all([
          client
            .from('shop_contacts')
            .select('shop_id, name, mobile, is_primary')
            .in('shop_id', shopIds),
          areaIds.length
            ? client.from('service_areas').select('id, name').in('id', areaIds)
            : Promise.resolve({
                data: [] as { id: string; name: string }[],
                error: null,
              }),
          client
            .from('shop_invitations')
            .select('shop_id, token, status')
            .in('shop_id', shopIds)
            .eq('status', 'PENDING'),
          client
            .from('shop_auth_links')
            .select('shop_id')
            .in('shop_id', shopIds),
          client
            .from('orders')
            .select('shop_id, created_at')
            .in('shop_id', shopIds)
            .order('created_at', { ascending: false }),
        ]);
      for (const res of [
        contactsRes,
        areasRes,
        invitationsRes,
        authLinksRes,
        ordersRes,
      ]) {
        if (res.error) throw res.error;
      }
      const contacts = contactsRes.data;
      const areas = areasRes.data;
      const invitations = invitationsRes.data;
      const authLinks = authLinksRes.data;
      const orders = ordersRes.data;

      const areaMap = new Map((areas ?? []).map((a) => [a.id, a.name]));
      const contactMap = new Map<string, { name: string; mobile: string }>();
      for (const c of contacts ?? []) {
        if (c.is_primary && !contactMap.has(c.shop_id)) {
          contactMap.set(c.shop_id, { name: c.name, mobile: c.mobile });
        }
      }
      const inviteMap = new Map<string, string>();
      for (const inv of invitations ?? []) {
        if (!inviteMap.has(inv.shop_id)) inviteMap.set(inv.shop_id, inv.token);
      }
      const authLinkSet = new Set(
        (authLinks ?? []).map((row) => row.shop_id as string),
      );
      const lastOrderMap = new Map<string, string>();
      for (const o of orders ?? []) {
        if (!lastOrderMap.has(o.shop_id)) {
          lastOrderMap.set(o.shop_id, formatDate(String(o.created_at)));
        }
      }

      return shops.map((s) => {
        const sid = s.id as string;
        const isActive = s.is_active !== false;
        const hasAuthLink = authLinkSet.has(sid);
        const hasAppLinkSent =
          Boolean(s.last_app_link_sent_at) || inviteMap.has(sid);
        const activation = deriveSalesAppAccess({
          isActive,
          hasAuthLink,
          hasAppLinkSent,
        });
        const contact = contactMap.get(sid);
        return {
          id: sid,
          tradeName: String(s.trade_name),
          legalName: (s.legal_name as string | null) ?? null,
          lifecycleStatus: String(s.lifecycle_status),
          activationStatus: activation,
          activationLabel: salesActivationLabel(activation),
          areaLabel: areaMap.get(s.service_area_id as string) ?? '—',
          pinCode: String(s.delivery_pin_code),
          addressLine: String(s.delivery_address_line),
          city: String(s.delivery_city),
          state: String(s.delivery_state),
          serviceAreaId: (s.service_area_id as string | null) ?? null,
          deliveryLat:
            s.delivery_lat == null ? null : Number(s.delivery_lat),
          deliveryLng:
            s.delivery_lng == null ? null : Number(s.delivery_lng),
          primaryContactName: contact?.name ?? null,
          primaryContactMobile: contact?.mobile ?? null,
          lastOrderLabel: lastOrderMap.get(s.id as string) ?? '—',
          pendingInvitationToken: inviteMap.get(s.id as string) ?? null,
        };
      });
    },

    async getRetailer(shopId: string): Promise<SalesmanRetailer | null> {
      const all = await this.listRetailers();
      return all.find((r) => r.id === shopId) ?? null;
    },

    async createRetailer(input: CreateRetailerInput): Promise<string> {
      const { data, error } = await client.rpc('salesman_create_retailer', {
        p_trade_name: input.tradeName,
        p_primary_contact_name: input.primaryContactName,
        p_primary_contact_mobile: input.primaryContactMobile,
        p_delivery_address_line: input.deliveryAddressLine,
        p_delivery_city: input.deliveryCity,
        p_delivery_state: input.deliveryState,
        p_delivery_pin_code: input.deliveryPinCode,
        p_service_area_id: input.serviceAreaId ?? null,
        p_legal_name: input.legalName ?? null,
        p_delivery_lat: input.deliveryLat ?? null,
        p_delivery_lng: input.deliveryLng ?? null,
      });
      if (error) throw error;
      return data as string;
    },

    async setShopDeliveryLocation(
      shopId: string,
      deliveryLat: number,
      deliveryLng: number,
    ): Promise<{ shopId: string; deliveryLat: number; deliveryLng: number }> {
      const { data, error } = await client.rpc(
        'salesman_set_shop_delivery_location',
        {
          p_shop_id: shopId,
          p_delivery_lat: deliveryLat,
          p_delivery_lng: deliveryLng,
        },
      );
      if (error) throw error;
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        shopId: String(row['shopId'] ?? shopId),
        deliveryLat: Number(row['deliveryLat'] ?? deliveryLat),
        deliveryLng: Number(row['deliveryLng'] ?? deliveryLng),
      };
    },

    async createInvitation(
      shopId: string,
      mobile?: string | null,
    ): Promise<{ token: string; mobile: string; expiresAt: string }> {
      const { data, error } = await client.rpc('salesman_create_invitation', {
        p_shop_id: shopId,
        p_mobile: mobile ?? null,
      });
      if (error) throw error;
      const row = data as unknown as {
        token: string;
        mobile: string;
        expiresAt: string;
      };
      return {
        token: row.token,
        mobile: row.mobile,
        expiresAt: row.expiresAt,
      };
    },

    async recordAppLinkSent(shopId: string): Promise<void> {
      const { error } = await client.rpc('record_customer_app_link_sent', {
        p_shop_id: shopId,
      });
      if (error) throw error;
    },

    async listOrders(profileId: string): Promise<SalesmanOrderSummary[]> {
      const { data, error } = await client
        .from('orders')
        .select('id, shop_id, total, status, created_at')
        .eq('created_by_profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const orders = data ?? [];
      if (!orders.length) return [];

      const shopIds = [...new Set(orders.map((o) => o.shop_id as string))];
      const { data: shops, error: shopsError } = await client
        .from('shops')
        .select('id, trade_name')
        .in('id', shopIds);
      if (shopsError) throw shopsError;
      const nameMap = new Map((shops ?? []).map((s) => [s.id, s.trade_name]));

      return orders.map((o) =>
        toOrderSummary(o, nameMap.get(o.shop_id as string) ?? '—'),
      );
    },

    /** Orders for one assigned shop. RLS still scopes rows; errors are thrown. */
    async listShopOrders(shopId: string): Promise<SalesmanOrderSummary[]> {
      const { data, error } = await client
        .from('orders')
        .select('id, shop_id, total, status, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const orders = data ?? [];
      if (!orders.length) return [];

      const { data: shop, error: shopError } = await client
        .from('shops')
        .select('id, trade_name')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;
      const shopName = shop?.trade_name ? String(shop.trade_name) : '—';
      return orders.map((o) => toOrderSummary(o, shopName));
    },

    /** Null when the order does not exist or RLS hides it from this salesman. */
    async getOrder(orderId: string): Promise<SalesmanOrderDetail | null> {
      const { data: order, error } = await client
        .from('orders')
        .select(
          'id, shop_id, total, subtotal, adjustments, status, source, created_at, updated_at',
        )
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;

      const [linesRes, shopRes] = await Promise.all([
        client
          .from('order_lines')
          .select(
            'id, sku_id, product_name_snapshot, sku_name_snapshot, sku_code_snapshot, specification_snapshot, selling_unit_snapshot, quantity, agreed_unit_price, line_total, created_at',
          )
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        client
          .from('shops')
          .select('id, trade_name')
          .eq('id', order.shop_id as string)
          .maybeSingle(),
      ]);
      if (linesRes.error) throw linesRes.error;
      if (shopRes.error) throw shopRes.error;

      const createdAt = String(order.created_at);
      const total = Number(order.total ?? 0);
      return {
        id: String(order.id),
        orderNumber: formatOrderNumber(String(order.id)),
        shopId: String(order.shop_id),
        shopName: (shopRes.data?.trade_name as string | undefined) ?? '—',
        total,
        totalLabel: formatInr(total),
        subtotal: Number(order.subtotal ?? 0),
        adjustments: Number(order.adjustments ?? 0),
        status: String(order.status),
        source: String(order.source),
        createdAt,
        updatedAt: String(order.updated_at),
        dateLabel: formatDate(createdAt),
        dateTimeLabel: formatDateTime(createdAt),
        lines: (linesRes.data ?? []).map((l) => ({
          id: String(l.id),
          skuId: String(l.sku_id),
          productName: String(l.product_name_snapshot),
          skuName: String(l.sku_name_snapshot),
          skuCode: String(l.sku_code_snapshot),
          specification: (l.specification_snapshot as string | null) ?? null,
          sellingUnit: String(l.selling_unit_snapshot),
          quantity: Number(l.quantity),
          unitPrice: Number(l.agreed_unit_price),
          lineTotal: Number(l.line_total),
        })),
      };
    },

    /** Read-only server pricing for a cart; never creates an order. */
    async previewOrderLines(
      lines: OrderPreviewLineInput[],
    ): Promise<SalesmanOrderPreview> {
      const { data, error } = await client.rpc('preview_assisted_order_lines', {
        p_lines: lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
      });
      if (error) throw error;
      return mapPreview(data);
    },

    async placeAssistedOrder(input: {
      shopId: string;
      serviceAreaId: string;
      lines: AssistedOrderLineInput[];
      notes?: string;
    }): Promise<string> {
      const { data, error } = await client.rpc('place_assisted_order', {
        p_shop_id: input.shopId,
        p_service_area_id: input.serviceAreaId,
        p_lines: input.lines.map((l) => ({
          skuId: l.skuId,
          quantity: l.quantity,
        })),
        p_notes: input.notes ?? 'Assisted order — awaiting customer confirmation',
      });
      if (error) throw error;
      return data as string;
    },

    /**
     * Reissues / confirms challenge + queues notification_outbox (provider-independent).
     * Does not claim WhatsApp/SMS delivery.
     */
    async sendConfirmationPlaceholder(orderId: string): Promise<{
      ok: boolean;
      message: string;
      orderId: string;
    }> {
      const { data: challenge, error } = await client
        .from('order_confirmation_challenges')
        .select('id, token, status, expires_at')
        .eq('order_id', orderId)
        .eq('status', 'PENDING')
        .maybeSingle();
      if (error) throw error;
      if (challenge) {
        return {
          ok: true,
          message:
            'Approval challenge ready. Notification queued in outbox (pending provider).',
          orderId,
        };
      }
      const { data, error: reissueError } = await client.rpc(
        'reissue_order_approval_challenge',
        { p_order_id: orderId },
      );
      if (reissueError) {
        return {
          ok: false,
          message: reissueError.message,
          orderId,
        };
      }
      return {
        ok: true,
        message: `Reapproval queued (${String((data as { challengeId?: string })?.challengeId ?? 'ok')}). Provider delivery not claimed.`,
        orderId,
      };
    },

    async listTodaysVisits(profileId: string): Promise<SalesmanVisit[]> {
      const { data, error } = await client
        .from('sales_visits')
        .select('*')
        .eq('salesman_profile_id', profileId)
        .gte('planned_at', startOfTodayIso())
        .lte('planned_at', endOfTodayIso())
        .order('planned_at', { ascending: true });
      if (error) throw error;
      const visits = data ?? [];
      if (!visits.length) return [];

      const shopIds = [...new Set(visits.map((v) => v.shop_id as string))];
      const [shopsRes, contactsRes] = await Promise.all([
        client
          .from('shops')
          .select('id, trade_name, delivery_city, delivery_lat, delivery_lng')
          .in('id', shopIds),
        client
          .from('shop_contacts')
          .select('shop_id, name, mobile, is_primary')
          .in('shop_id', shopIds),
      ]);
      if (shopsRes.error) throw shopsRes.error;
      if (contactsRes.error) throw contactsRes.error;
      const shopMap = new Map(
        (shopsRes.data ?? []).map((s) => [
          s.id,
          {
            name: String(s.trade_name),
            area: String(s.delivery_city ?? '—'),
            lat: s.delivery_lat == null ? null : Number(s.delivery_lat),
            lng: s.delivery_lng == null ? null : Number(s.delivery_lng),
          },
        ]),
      );
      const contactMap = new Map<string, { name: string; mobile: string }>();
      for (const contact of contactsRes.data ?? []) {
        if (contact.is_primary && !contactMap.has(contact.shop_id)) {
          contactMap.set(contact.shop_id, {
            name: contact.name,
            mobile: contact.mobile,
          });
        }
      }

      return visits
        .map((v) => {
          const shop = shopMap.get(v.shop_id as string);
          const contact = contactMap.get(v.shop_id as string);
          const distance = v.check_in_distance_m;
          const gpsVerification: 'verified' | 'unavailable' | null =
            v.check_in_at == null
              ? null
              : distance == null
                ? 'unavailable'
                : 'verified';
          return {
            id: v.id as string,
            shopId: v.shop_id as string,
            shopName: shop?.name ?? '—',
            areaLabel: shop?.area ?? '—',
            plannedAt: String(v.planned_at),
            plannedAtLabel: formatDateTime(String(v.planned_at)),
            status: String(v.status) as SalesVisitStatus,
            notes: (v.notes as string | null) ?? null,
            contactName: contact?.name ?? null,
            contactMobile: contact?.mobile ?? null,
            deliveryLat: shop?.lat ?? null,
            deliveryLng: shop?.lng ?? null,
            checkInAt: (v.check_in_at as string | null) ?? null,
            checkInDistanceMetres: distance == null ? null : Number(distance),
            gpsVerification,
          };
        })
        .sort((a, b) => a.plannedAt.localeCompare(b.plannedAt) || a.id.localeCompare(b.id));
    },

    async listAllVisits(profileId: string): Promise<SalesmanVisit[]> {
      const { data, error } = await client
        .from('sales_visits')
        .select('*')
        .eq('salesman_profile_id', profileId)
        .order('planned_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      const visits = data ?? [];
      if (!visits.length) return [];

      const shopIds = [...new Set(visits.map((v) => v.shop_id as string))];
      const { data: shops, error: shopsError } = await client
        .from('shops')
        .select('id, trade_name, delivery_city')
        .in('id', shopIds);
      if (shopsError) throw shopsError;
      const shopMap = new Map(
        (shops ?? []).map((s) => [
          s.id,
          { name: String(s.trade_name), area: String(s.delivery_city ?? '—') },
        ]),
      );

      return visits.map((v) => {
        const shop = shopMap.get(v.shop_id as string);
        return {
          id: v.id as string,
          shopId: v.shop_id as string,
          shopName: shop?.name ?? '—',
          areaLabel: shop?.area ?? '—',
          plannedAt: String(v.planned_at),
          plannedAtLabel: formatDateTime(String(v.planned_at)),
          status: String(v.status) as SalesVisitStatus,
          notes: (v.notes as string | null) ?? null,
        };
      });
    },

    /** Visits for one shop. Reads sales_visits; does not write notes or status. */
    async listShopVisits(shopId: string): Promise<SalesmanVisit[]> {
      const { data, error } = await client
        .from('sales_visits')
        .select('id, shop_id, planned_at, status, notes, visited_at')
        .eq('shop_id', shopId)
        .order('planned_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      const visits = data ?? [];
      if (!visits.length) return [];

      const { data: shop, error: shopError } = await client
        .from('shops')
        .select('id, trade_name, delivery_city')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;

      return visits.map((v) => {
        const visitedAt = (v.visited_at as string | null) ?? null;
        return {
          id: v.id as string,
          shopId: v.shop_id as string,
          shopName: shop?.trade_name ? String(shop.trade_name) : '—',
          areaLabel: shop?.delivery_city ? String(shop.delivery_city) : '—',
          plannedAt: String(v.planned_at),
          plannedAtLabel: formatDateTime(String(v.planned_at)),
          status: String(v.status) as SalesVisitStatus,
          notes: (v.notes as string | null) ?? null,
          visitedAt,
          visitedAtLabel: visitedAt ? formatDateTime(visitedAt) : null,
        };
      });
    },

    /**
     * `notes` undefined leaves the stored notes untouched; `null` clears them.
     */
    async updateVisitStatus(
      visitId: string,
      status: SalesVisitStatus,
      notes?: string | null,
    ): Promise<void> {
      const patch: {
        status: SalesVisitStatus;
        notes?: string | null;
        visited_at?: string;
      } = { status };
      if (notes !== undefined) {
        patch.notes = notes;
      }
      if (status === 'VISITED') {
        patch.visited_at = new Date().toISOString();
      }
      const { error } = await client
        .from('sales_visits')
        .update(patch)
        .eq('id', visitId);
      if (error) throw error;
    },

    async getPerformance(profileId: string): Promise<SalesmanPerformance> {
      const shops = await listAssignedShopsRaw();
      const { data: orders, error: ordersError } = await client
        .from('orders')
        .select('id, total, shop_id, created_at')
        .eq('created_by_profile_id', profileId)
        .gte('created_at', startOfMonthIso());
      if (ordersError) throw ordersError;

      const orderRows = orders ?? [];
      const revenue = orderRows.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      const shopOrderCounts = new Map<string, number>();
      for (const o of orderRows) {
        const sid = o.shop_id as string;
        shopOrderCounts.set(sid, (shopOrderCounts.get(sid) ?? 0) + 1);
      }
      const repeatCustomers = [...shopOrderCounts.values()].filter((n) => n > 1).length;

      const monthStart = new Date(startOfMonthIso()).getTime();
      const newRetailers = shops.filter((s) => {
        const created = new Date(String(s.created_at)).getTime();
        return created >= monthStart;
      }).length;

      const activated = shops.filter((s) => {
        const life = String(s.lifecycle_status);
        return (
          life === 'ACTIVATED' ||
          life === 'FIRST_ORDER' ||
          life === 'REPEAT_CUSTOMER'
        );
      }).length;
      const rate =
        shops.length === 0 ? 0 : Math.round((activated / shops.length) * 100);

      return {
        ordersThisMonth: orderRows.length,
        revenueGeneratedLabel: formatInr(revenue),
        newRetailers,
        activationRateLabel: `${rate}%`,
        repeatCustomers,
      };
    },

    /** Null when this salesman has no target for the month. */
    async getMonthTarget(): Promise<SalesmanTargetProgress | null> {
      const { data, error } = await client.rpc('salesman_month_target', {
        p_month: null,
      });
      if (error) throw error;
      return parseSalesmanTarget(data);
    },

    /**
     * Earned commission comes only from salesman_commission_entries.
     * Orders without a ledger row are returned without a commission amount.
     */
    async getEarnings(): Promise<SalesmanEarnings> {
      const { data, error } = await client.rpc('salesman_earnings_month', {
        p_month: null,
      });
      if (error) throw error;
      return parseSalesmanEarnings(data);
    },

    async listExpenses(): Promise<SalesmanExpense[]> {
      const { data, error } = await client
        .from('salesman_expenses')
        .select(
          'id, salesman_profile_id, category, amount, expense_date, note, receipt_path, status, review_note, reviewed_at, created_at',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return Promise.all((data ?? []).map((row) => mapExpenseRow(client, row)));
    },

    async getExpense(expenseId: string): Promise<SalesmanExpense | null> {
      const { data, error } = await client
        .from('salesman_expenses')
        .select(
          'id, salesman_profile_id, category, amount, expense_date, note, receipt_path, status, review_note, reviewed_at, created_at',
        )
        .eq('id', expenseId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapExpenseRow(client, data) : null;
    },

    async createExpense(input: SalesmanExpenseInput): Promise<SalesmanExpense> {
      const { data, error } = await client.rpc('salesman_create_expense', {
        p_category: input.category,
        p_amount: input.amount,
        p_expense_date: input.expenseDate,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return mapExpenseJson(data);
    },

    async updatePendingExpense(
      expenseId: string,
      input: SalesmanExpenseInput,
    ): Promise<SalesmanExpense> {
      const { data, error } = await client.rpc('salesman_update_pending_expense', {
        p_expense_id: expenseId,
        p_category: input.category,
        p_amount: input.amount,
        p_expense_date: input.expenseDate,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return mapExpenseJson(data);
    },

    async uploadExpenseReceipt(
      expenseId: string,
      file: ShopPhotoUpload,
    ): Promise<SalesmanExpense> {
      assertPhoto(file);
      const profileId = await requireAuthUserId(client);
      const path = expenseReceiptObjectPath(profileId, expenseId);
      const { error: uploadError } = await client.storage
        .from(SALESMAN_MEDIA_BUCKET)
        .upload(path, file.bytes, { contentType: file.contentType, upsert: true });
      if (uploadError) throw uploadError;
      const { data, error } = await client.rpc('salesman_set_expense_receipt', {
        p_expense_id: expenseId,
        p_receipt_path: path,
      });
      if (error) throw error;
      return mapExpenseJson(data);
    },

    async listReturnRequests(): Promise<SalesmanReturnRequest[]> {
      const { data, error } = await client
        .from('salesman_return_requests')
        .select(
          'id, salesman_profile_id, shop_id, shop_name, order_id, sku_id, product_name, sku_name, sku_code, quantity, reason, note, photo_path, status, review_note, reviewed_at, created_at',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return Promise.all((data ?? []).map((row) => mapReturnRow(client, row)));
    },

    async getReturnRequest(requestId: string): Promise<SalesmanReturnRequest | null> {
      const { data, error } = await client
        .from('salesman_return_requests')
        .select(
          'id, salesman_profile_id, shop_id, shop_name, order_id, sku_id, product_name, sku_name, sku_code, quantity, reason, note, photo_path, status, review_note, reviewed_at, created_at',
        )
        .eq('id', requestId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapReturnRow(client, data) : null;
    },

    async createReturnRequest(input: SalesmanReturnInput): Promise<SalesmanReturnRequest> {
      const { data, error } = await client.rpc('salesman_create_return_request', {
        p_order_id: input.orderId,
        p_sku_id: input.skuId,
        p_quantity: input.quantity,
        p_reason: input.reason,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return mapReturnJson(data);
    },

    async uploadReturnPhoto(
      requestId: string,
      file: ShopPhotoUpload,
    ): Promise<SalesmanReturnRequest> {
      assertPhoto(file);
      const profileId = await requireAuthUserId(client);
      const path = returnPhotoObjectPath(profileId, requestId);
      const { error: uploadError } = await client.storage
        .from(SALESMAN_MEDIA_BUCKET)
        .upload(path, file.bytes, { contentType: file.contentType, upsert: true });
      if (uploadError) throw uploadError;
      const { data, error } = await client.rpc('salesman_set_return_photo', {
        p_request_id: requestId,
        p_photo_path: path,
      });
      if (error) throw error;
      return mapReturnJson(data);
    },

    async listMessages(): Promise<SalesmanMessage[]> {
      const { data, error } = await client
        .from('salesman_messages')
        .select('id, salesman_profile_id, sender_profile_id, body, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapMessageRow);
    },

    async sendMessage(body: string): Promise<SalesmanMessage> {
      const { data, error } = await client.rpc('salesman_send_message', { p_body: body });
      if (error) throw error;
      return mapMessageJson(data);
    },

    async listNotices(): Promise<SalesmanNotice[]> {
      const { data, error } = await client
        .from('salesman_notices')
        .select('id, title, body, href, read_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        href: row.href,
        readAt: row.read_at,
        createdAt: row.created_at,
      }));
    },

    async markNoticeRead(noticeId: string): Promise<void> {
      const { error } = await client.rpc('salesman_mark_notice_read', {
        p_notice_id: noticeId,
      });
      if (error) throw error;
    },

    async savePushSubscription(input: {
      endpoint: string;
      p256dh: string;
      authKey: string;
    }): Promise<void> {
      const { error } = await client.rpc('salesman_save_push_subscription', {
        p_endpoint: input.endpoint,
        p_p256dh: input.p256dh,
        p_auth_key: input.authKey,
      });
      if (error) throw error;
    },

    async listVoiceNotes(shopId?: string): Promise<SalesmanVoiceNote[]> {
      let query = client
        .from('salesman_voice_notes')
        .select(
          'id, salesman_profile_id, shop_id, visit_id, audio_path, duration_seconds, created_at',
        )
        .order('created_at', { ascending: false });
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query;
      if (error) throw error;
      return Promise.all((data ?? []).map((row) => mapVoiceRow(client, row)));
    },

    async uploadVoiceNote(input: {
      shopId: string;
      visitId?: string | null;
      durationSeconds: number;
      bytes: ArrayBuffer;
      contentType: string;
    }): Promise<SalesmanVoiceNote> {
      if (!VOICE_CONTENT_TYPES.has(input.contentType)) {
        throw new Error('Use a WebM, MP4, MPEG, or Ogg recording.');
      }
      const { data, error } = await client.rpc('salesman_create_voice_note', {
        p_shop_id: input.shopId,
        p_visit_id: input.visitId ?? null,
        p_duration_seconds: input.durationSeconds,
      });
      if (error) throw error;
      const created = mapVoiceJson(data);
      const profileId = await requireAuthUserId(client);
      const path = voiceNoteObjectPath(profileId, created.shopId, created.id);
      const uploaded = await client.storage
        .from(SALESMAN_MEDIA_BUCKET)
        .upload(path, input.bytes, { contentType: input.contentType, upsert: false });
      if (uploaded.error) throw uploaded.error;
      const saved = await client.rpc('salesman_set_voice_note_path', {
        p_note_id: created.id,
        p_audio_path: path,
      });
      if (saved.error) throw saved.error;
      return { ...mapVoiceJson(saved.data), audioUrl: null };
    },

    async listServiceAreas(): Promise<{ id: string; name: string }[]> {
      const { data, error } = await client
        .from('service_areas')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({ id: a.id, name: a.name }));
    },

    async startDay(
      workDate?: string,
      location?: { lat: number; lng: number } | null,
    ): Promise<SalesmanDayActionResult> {
      const { data, error } = await client.rpc('salesman_start_day', {
        p_work_date: workDate ?? null,
        p_lat: location?.lat ?? null,
        p_lng: location?.lng ?? null,
      });
      if (error) throw error;
      return mapDayActionResult((data ?? {}) as Record<string, unknown>);
    },

    async endDay(
      workDate?: string,
      location?: { lat: number; lng: number } | null,
    ): Promise<SalesmanDayActionResult> {
      const { data, error } = await client.rpc('salesman_end_day', {
        p_work_date: workDate ?? null,
        p_lat: location?.lat ?? null,
        p_lng: location?.lng ?? null,
      });
      if (error) throw error;
      return mapDayActionResult((data ?? {}) as Record<string, unknown>);
    },

    async checkInVisit(
      visitId: string,
      lat: number,
      lng: number,
    ): Promise<VisitGpsResult> {
      const { data, error } = await client.rpc('salesman_check_in_visit', {
        p_visit_id: visitId,
        p_lat: lat,
        p_lng: lng,
      });
      if (error) throw error;
      return mapVisitGpsResult(data);
    },

    async completeVisit(input: CompleteVisitInput): Promise<VisitGpsResult> {
      const { data, error } = await client.rpc('salesman_complete_visit', {
        p_visit_id: input.visitId,
        p_status: input.status,
        p_lat: input.lat,
        p_lng: input.lng,
        p_update_notes: input.notes !== undefined,
        p_notes: input.notes === undefined ? null : input.notes,
        p_photo_path: input.photoPath ?? null,
      });
      if (error) throw error;
      return mapVisitGpsResult(data);
    },

    async getOwnProfile(): Promise<SalesmanOwnProfile> {
      const profileId = await requireAuthUserId(client);
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const { data, error } = await client
        .from('profiles')
        .select(
          'id, display_name, preferred_language, avatar_path, profile_setup_completed_at',
        )
        .eq('id', profileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Profile not found');
      const avatarPath = data.avatar_path;
      let avatarUrl: string | null = null;
      if (avatarPath) {
        const signed = await client.storage
          .from(SALESMAN_MEDIA_BUCKET)
          .createSignedUrl(avatarPath, 60 * 60);
        if (signed.error) {
          if (!isStorageNotFound(signed.error)) throw signed.error;
        } else {
          avatarUrl = signed.data?.signedUrl ?? null;
        }
      }
      const language: SalesLanguage = data.preferred_language === 'hi' ? 'hi' : 'en';
      return {
        id: data.id,
        displayName: data.display_name,
        email: authData.user?.email ?? null,
        preferredLanguage: language,
        avatarPath,
        avatarUrl,
        setupCompletedAt: data.profile_setup_completed_at,
      };
    },

    async updateOwnProfile(input: UpdateOwnProfileInput): Promise<SalesmanOwnProfile> {
      const { data, error } = await client.rpc('salesman_update_own_profile', {
        p_display_name: input.displayName,
        p_preferred_language: input.preferredLanguage,
        p_update_avatar: input.updateAvatar ?? false,
        p_avatar_path: input.avatarPath ?? null,
        p_complete_setup: input.completeSetup ?? false,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Profile update did not return a result.');
      }
      const row = data as Record<string, unknown>;
      const profileId = String(row['id'] ?? '');
      if (!profileId) throw new Error('Profile update did not return a result.');
      const current = await this.getOwnProfile();
      return {
        ...current,
        id: profileId,
        displayName: String(row['displayName'] ?? current.displayName),
        preferredLanguage: row['preferredLanguage'] === 'hi' ? 'hi' : 'en',
        avatarPath:
          row['avatarPath'] == null ? null : String(row['avatarPath']),
        setupCompletedAt:
          row['profileSetupCompletedAt'] == null
            ? null
            : String(row['profileSetupCompletedAt']),
      };
    },

    async uploadProfilePhoto(file: ShopPhotoUpload): Promise<{ path: string }> {
      if (!SHOP_PHOTO_CONTENT_TYPES.has(file.contentType)) {
        throw new Error('Use a JPEG, PNG, or WebP photo.');
      }
      const profileId = await requireAuthUserId(client);
      const path = profilePhotoObjectPath(profileId);
      const { error } = await client.storage.from(SALESMAN_MEDIA_BUCKET).upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
      if (error) throw error;
      return { path };
    },

    async uploadVisitPhoto(
      shopId: string,
      visitId: string,
      file: ShopPhotoUpload,
    ): Promise<{ path: string }> {
      if (!SHOP_PHOTO_CONTENT_TYPES.has(file.contentType)) {
        throw new Error('Use a JPEG, PNG, or WebP photo.');
      }
      const profileId = await requireAuthUserId(client);
      const { data: shop, error: shopError } = await client
        .from('shops')
        .select('id')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shop) throw new Error('This shop is not assigned to you.');
      const path = visitPhotoObjectPath(profileId, shopId, visitId);
      const { error } = await client.storage.from(SALESMAN_MEDIA_BUCKET).upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
      if (error) throw error;
      return { path };
    },

    async getTodayAttendance(
      profileId: string,
    ): Promise<SalesmanAttendance | null> {
      const workDate = localWorkDate();
      const { data, error } = await client
        .from('salesman_attendance')
        .select(
          'id, profile_id, work_date, status, day_started_at, day_ended_at',
        )
        .eq('profile_id', profileId)
        .eq('work_date', workDate)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapAttendanceRow(
        data as {
          id: string;
          profile_id: string;
          work_date: string;
          status: string;
          day_started_at: string | null;
          day_ended_at: string | null;
        },
      );
    },

    /** Two round trips total: catalogue rows, then prices + stock for all SKUs at once. */
    async listOrderableSkus(): Promise<CatalogueSkuRow[]> {
      const [categoriesRes, productsRes, skusRes] = await Promise.all([
        client
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null),
        client
          .from('products')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        client
          .from('skus')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
      ]);
      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (skusRes.error) throw skusRes.error;

      const categoryMap = new Map(
        (categoriesRes.data ?? []).map((row) => {
          const c = mapCategory(row);
          return [c.id, c] as const;
        }),
      );
      const productMap = new Map<string, Product>();
      for (const row of productsRes.data ?? []) {
        if (!categoryMap.has(row.category_id)) continue;
        const p = mapProduct(row);
        productMap.set(p.id, p);
      }
      const skus = (skusRes.data ?? [])
        .filter((row) => productMap.has(row.product_id))
        .map(mapSku)
        .filter((s): s is Sku => s != null);
      if (!skus.length) return [];

      const skuIds = skus.map((s) => s.id);
      const [
        { data: prices, error: pricesError },
        { data: balances, error: balancesError },
      ] = await Promise.all([
        // Window filtering happens in selectEffectiveSkuPrice, mirroring
        // resolve_sku_base_trade_price (a future effective_to is still current).
        client.from('sku_prices').select('*').in('sku_id', skuIds),
        client
          .from('inventory_balances')
          .select('sku_id, available_quantity')
          .in('sku_id', skuIds),
      ]);
      if (pricesError) throw pricesError;
      if (balancesError) throw balancesError;

      const priceBySku = new Map<string, number>();
      for (const sku of skus) {
        const skuPrices = (prices ?? []).filter((p) => p.sku_id === sku.id);
        const effective = selectEffectiveSkuPrice(
          skuPrices.map((p) => ({
            id: p.id as string,
            sku_id: p.sku_id as string,
            trade_price: Number(
              (p as { trade_price?: number | string }).trade_price ?? 0,
            ),
            currency: String((p as { currency?: string }).currency ?? 'INR'),
            effective_from: String(p.effective_from),
            effective_to: p.effective_to ? String(p.effective_to) : null,
            created_at: String(
              (p as { created_at?: string }).created_at ?? p.effective_from,
            ),
          })),
        );
        if (effective) priceBySku.set(sku.id, effective.tradePrice);
      }

      const availMap = new Map<string, number>();
      for (const b of balances ?? []) {
        const cur = availMap.get(b.sku_id) ?? 0;
        availMap.set(b.sku_id, Math.max(cur, Number(b.available_quantity ?? 0)));
      }

      return skus
        .map((sku) => {
          const product = productMap.get(sku.productId);
          if (!product) return null;
          const unitPrice = priceBySku.get(sku.id);
          if (unitPrice == null) return null;
          return {
            sku,
            product,
            category: categoryMap.get(product.categoryId) ?? null,
            unitPrice,
            availableQuantity: availMap.get(sku.id) ?? 0,
          };
        })
        .filter((row): row is CatalogueSkuRow => row != null);
    },

    /**
     * Signed URL for this salesman's shop photo, or null when no object exists.
     * Other storage failures throw — they are not "no photo".
     */
    async getShopPhotoUrl(shopId: string): Promise<string | null> {
      const profileId = await requireAuthUserId(client);
      const folder = `${profileId}/${shopId}`;
      const { data: listed, error: listError } = await client.storage
        .from(SALESMAN_MEDIA_BUCKET)
        .list(folder, { limit: 10 });
      if (listError) {
        if (isStorageNotFound(listError)) return null;
        throw listError;
      }
      const file = (listed ?? []).find((item) => item.name === 'shop');
      if (!file) return null;
      const path = shopPhotoObjectPath(profileId, shopId);
      const { data, error } = await client.storage
        .from(SALESMAN_MEDIA_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) {
        if (isStorageNotFound(error)) return null;
        throw error;
      }
      return data?.signedUrl ?? null;
    },

    /**
     * Uploads only under `{auth.uid}/{shopId}/shop` after the shop row is visible
     * to this salesman. Upsert replaces the previous photo.
     */
    async uploadShopPhoto(
      shopId: string,
      file: ShopPhotoUpload,
    ): Promise<{ path: string }> {
      if (!SHOP_PHOTO_CONTENT_TYPES.has(file.contentType)) {
        throw new Error('Use a JPEG, PNG, or WebP photo.');
      }
      const profileId = await requireAuthUserId(client);
      const { data: shop, error: shopError } = await client
        .from('shops')
        .select('id')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shop) {
        throw new Error('This shop is not assigned to you.');
      }
      const path = shopPhotoObjectPath(profileId, shopId);
      const { error } = await client.storage.from(SALESMAN_MEDIA_BUCKET).upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
      if (error) throw error;
      return { path };
    },

    // Expose raw mappers for typing convenience in app layer
    _maps: { mapCategory, mapProduct, mapSku },
  };
}

export type SalesmanService = ReturnType<typeof createSupabaseSalesmanService>;
