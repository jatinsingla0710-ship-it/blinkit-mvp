import type {
  CatalogueSkuRow,
  CreateRetailerInput,
  OrderPreviewErrorCode,
  OrderPreviewLineInput,
  SalesmanAttendance,
  SalesmanDashboard,
  SalesmanDayActionResult,
  SalesmanOrderDetail,
  SalesmanOrderLine,
  SalesmanOrderPreview,
  SalesmanOrderSummary,
  SalesmanPerformance,
  SalesmanEarnings,
  SalesmanTargetProgress,
  SalesmanExpense,
  SalesmanExpenseInput,
  SalesmanReturnInput,
  SalesmanReturnRequest,
  SalesmanMessage,
  SalesmanNotice,
  SalesmanVoiceNote,
  SalesmanRetailer,
  SalesmanOwnProfile,
  SalesmanVisit,
  SalesVisitStatus,
  UpdateOwnProfileInput,
} from '@groaurum/api-client';
import { formatOrderNumber } from '@groaurum/api-client';
import { isValidOrderQuantity } from '@/data/order-quantity';
import type { SalesmanApi } from './salesmanApi';

function localWorkDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeLabel(iso: string | null): string | null {
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

const MOCK_RETAILERS: SalesmanRetailer[] = [
  {
    id: 'mock-shop-1',
    tradeName: 'Sharma Kirana',
    legalName: 'Sharma Traders',
    lifecycleStatus: 'ACTIVATED',
    activationStatus: 'activated',
    activationLabel: 'Ready',
    areaLabel: 'Andheri East',
    pinCode: '400069',
    addressLine: '12 Market Road',
    city: 'Mumbai',
    state: 'MH',
    serviceAreaId: 'mock-area-1',
    deliveryLat: 19.1197,
    deliveryLng: 72.8468,
    primaryContactName: 'Ravi Sharma',
    primaryContactMobile: '+919800000101',
    lastOrderLabel: '12 Jul',
    pendingInvitationToken: null,
  },
  {
    id: 'mock-shop-2',
    tradeName: 'Gupta Stores',
    legalName: null,
    lifecycleStatus: 'LEAD',
    activationStatus: 'activated',
    activationLabel: 'Ready',
    areaLabel: 'Andheri East',
    pinCode: '400069',
    addressLine: '45 Lane 3',
    city: 'Mumbai',
    state: 'MH',
    serviceAreaId: 'mock-area-1',
    deliveryLat: null,
    deliveryLng: null,
    primaryContactName: 'Anita Gupta',
    primaryContactMobile: '+919800000102',
    lastOrderLabel: '—',
    pendingInvitationToken: null,
  },
  {
    id: 'mock-shop-3',
    tradeName: 'Verma Wholesale',
    legalName: 'Verma Bros',
    lifecycleStatus: 'LEAD',
    activationStatus: 'activated',
    activationLabel: 'Ready',
    areaLabel: 'Bandra West',
    pinCode: '400050',
    addressLine: '8 Hill Road',
    city: 'Mumbai',
    state: 'MH',
    serviceAreaId: 'mock-area-2',
    deliveryLat: null,
    deliveryLng: null,
    primaryContactName: 'Suresh Verma',
    primaryContactMobile: '+919800000103',
    lastOrderLabel: '—',
    pendingInvitationToken: null,
  },
];

let mockVisits: SalesmanVisit[] = [
  {
    id: 'mock-visit-1',
    shopId: 'mock-shop-1',
    shopName: 'Sharma Kirana',
    areaLabel: 'Andheri East',
    plannedAt: new Date().toISOString(),
    plannedAtLabel: 'Today · 10:00',
    status: 'VISITED',
    notes: 'Collected order',
  },
  {
    id: 'mock-visit-2',
    shopId: 'mock-shop-2',
    shopName: 'Gupta Stores',
    areaLabel: 'Andheri East',
    plannedAt: new Date().toISOString(),
    plannedAtLabel: 'Today · 11:30',
    status: 'PENDING',
    notes: null,
  },
  {
    id: 'mock-visit-3',
    shopId: 'mock-shop-3',
    shopName: 'Verma Wholesale',
    areaLabel: 'Bandra West',
    plannedAt: new Date().toISOString(),
    plannedAtLabel: 'Today · 15:00',
    status: 'PLANNED',
    notes: null,
  },
];

/** In-memory presence for mock Start Day / End Day. */
let mockAttendance: SalesmanAttendance | null = null;

function mockOrder(input: {
  id: string;
  shopId: string;
  shopName: string;
  status: string;
  createdAt: string;
  lines: SalesmanOrderLine[];
}): SalesmanOrderDetail {
  const total = input.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const created = new Date(input.createdAt);
  return {
    id: input.id,
    orderNumber: formatOrderNumber(input.id.replace(/^mock-order-/, '')),
    shopId: input.shopId,
    shopName: input.shopName,
    total,
    totalLabel: `₹${new Intl.NumberFormat('en-IN').format(total)}`,
    subtotal: total,
    adjustments: 0,
    status: input.status,
    source: 'SALESMAN_ASSISTED',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    dateLabel: created.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    dateTimeLabel: created.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    lines: input.lines,
  };
}

function mockLine(
  id: string,
  quantity: number,
  unitPrice: number,
  name = 'Basmati Rice 1kg',
): SalesmanOrderLine {
  return {
    id,
    skuId: 'mock-sku-1',
    productName: 'Basmati Rice',
    skuName: name,
    skuCode: 'RICE-1',
    specification: null,
    sellingUnit: 'PACK',
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const mockOrders: SalesmanOrderDetail[] = [
  mockOrder({
    id: 'mock-order-a17f3c20',
    shopId: 'mock-shop-1',
    shopName: 'Sharma Kirana',
    status: 'AWAITING_CUSTOMER_CONFIRMATION',
    createdAt: daysAgo(0),
    lines: [mockLine('l1', 50, 166)],
  }),
  mockOrder({
    id: 'mock-order-b28e4d31',
    shopId: 'mock-shop-2',
    shopName: 'Gupta Stores',
    status: 'OUT_FOR_DELIVERY',
    createdAt: daysAgo(2),
    lines: [mockLine('l2', 20, 166)],
  }),
  mockOrder({
    id: 'mock-order-c39f5e42',
    shopId: 'mock-shop-1',
    shopName: 'Sharma Kirana',
    status: 'DELIVERED',
    createdAt: daysAgo(6),
    lines: [mockLine('l3', 100, 166)],
  }),
  mockOrder({
    id: 'mock-order-d4a06f53',
    shopId: 'mock-shop-3',
    shopName: 'Verma Wholesale',
    status: 'CANCELLED',
    createdAt: daysAgo(9),
    lines: [mockLine('l4', 10, 166)],
  }),
];

let mockOwnProfile: SalesmanOwnProfile = {
  id: 'mock-salesman',
  displayName: 'Demo salesman',
  email: 'sales@example.com',
  preferredLanguage: 'en',
  avatarPath: null,
  avatarUrl: null,
  setupCompletedAt: '2026-01-01T00:00:00.000Z',
};

export function createMockSalesmanService(): SalesmanApi {
  const retailers = [...MOCK_RETAILERS];

  return {
    async getDashboard(_profileId: string): Promise<SalesmanDashboard> {
      return {
        assignedRetailers: retailers.length,
        todaysVisits: mockVisits.length,
        pendingActivations: 0,
        ordersCollected: 4,
        revenueThisMonth: 128500,
        revenueThisMonthLabel: '₹1,28,500',
      };
    },

    async startDay(
      workDate?: string,
      _location?: { lat: number; lng: number } | null,
    ): Promise<SalesmanDayActionResult> {
      const date = workDate ?? localWorkDate();
      if (
        mockAttendance &&
        mockAttendance.workDate === date &&
        mockAttendance.status === 'PRESENT' &&
        mockAttendance.dayStartedAt
      ) {
        return { ...mockAttendance, alreadyStarted: true };
      }
      const now = new Date().toISOString();
      mockAttendance = {
        id: `mock-att-${date}`,
        profileId: 'mock-salesman',
        workDate: date,
        status: 'PRESENT',
        dayStartedAt: now,
        dayEndedAt: null,
        dayStartedAtLabel: formatTimeLabel(now),
        dayEndedAtLabel: null,
      };
      return { ...mockAttendance, alreadyStarted: false };
    },

    async endDay(
      workDate?: string,
      _location?: { lat: number; lng: number } | null,
    ): Promise<SalesmanDayActionResult> {
      const date = workDate ?? localWorkDate();
      if (!mockAttendance || mockAttendance.workDate !== date) {
        throw new Error('Start Day first before ending the day');
      }
      if (mockAttendance.status !== 'PRESENT') {
        throw new Error(
          `End Day only applies to PRESENT attendance (current: ${mockAttendance.status})`,
        );
      }
      if (!mockAttendance.dayStartedAt) {
        throw new Error('Day was not started');
      }
      if (mockAttendance.dayEndedAt) {
        return { ...mockAttendance, alreadyEnded: true };
      }
      const now = new Date().toISOString();
      mockAttendance = {
        ...mockAttendance,
        dayEndedAt: now,
        dayEndedAtLabel: formatTimeLabel(now),
      };
      return { ...mockAttendance, alreadyEnded: false };
    },

    async getTodayAttendance(
      _profileId: string,
    ): Promise<SalesmanAttendance | null> {
      const today = localWorkDate();
      if (mockAttendance?.workDate === today) return { ...mockAttendance };
      return null;
    },

    async listRetailers(): Promise<SalesmanRetailer[]> {
      return [...retailers];
    },

    async getRetailer(shopId: string): Promise<SalesmanRetailer | null> {
      return retailers.find((r) => r.id === shopId) ?? null;
    },

    async createRetailer(input: CreateRetailerInput): Promise<string> {
      const id = `mock-shop-${Date.now()}`;
      retailers.push({
        id,
        tradeName: input.tradeName,
        legalName: input.legalName ?? null,
        lifecycleStatus: 'LEAD',
        activationStatus: 'activated',
        activationLabel: 'Ready',
        areaLabel: '—',
        pinCode: input.deliveryPinCode,
        addressLine: input.deliveryAddressLine,
        city: input.deliveryCity,
        state: input.deliveryState,
        serviceAreaId: input.serviceAreaId ?? null,
        deliveryLat: input.deliveryLat ?? null,
        deliveryLng: input.deliveryLng ?? null,
        primaryContactName: input.primaryContactName,
        primaryContactMobile: input.primaryContactMobile,
        lastOrderLabel: '—',
        pendingInvitationToken: null,
      });
      return id;
    },

    async setShopDeliveryLocation(
      shopId: string,
      deliveryLat: number,
      deliveryLng: number,
    ): Promise<{ shopId: string; deliveryLat: number; deliveryLng: number }> {
      const shop = retailers.find((r) => r.id === shopId);
      if (!shop) throw new Error('Shop not found');
      shop.deliveryLat = deliveryLat;
      shop.deliveryLng = deliveryLng;
      return { shopId, deliveryLat, deliveryLng };
    },

    async createInvitation(
      shopId: string,
      mobile?: string | null,
    ): Promise<{ token: string; mobile: string; expiresAt: string }> {
      const shop = retailers.find((r) => r.id === shopId);
      // Kept for SalesmanService compatibility. Sales UI never shows invitations.
      return {
        token: `mock-token-${shopId.slice(-6)}`,
        mobile: mobile ?? shop?.primaryContactMobile ?? '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async recordAppLinkSent(_shopId: string): Promise<void> {
      // Kept for SalesmanService compatibility. Sales UI never records app links.
    },

    async listOrders(): Promise<SalesmanOrderSummary[]> {
      return mockOrders.map(({ lines: _lines, ...summary }) => summary);
    },

    async getOrder(orderId: string): Promise<SalesmanOrderDetail | null> {
      return mockOrders.find((o) => o.id === orderId) ?? null;
    },

    async previewOrderLines(
      lines: OrderPreviewLineInput[],
    ): Promise<SalesmanOrderPreview> {
      const catalogue = await this.listOrderableSkus();
      const seen = new Set<string>();
      const out = lines.map((line) => {
        const row = catalogue.find((r) => r.sku.id === line.skuId);
        const fail = (errorCode: OrderPreviewErrorCode, message: string) => ({
          ...line,
          unitPrice: null,
          lineTotal: null,
          availableQuantity: row?.availableQuantity ?? null,
          ok: false,
          errorCode,
          message,
        });
        if (seen.has(line.skuId)) return fail('DUPLICATE_SKU', 'Already in the order');
        seen.add(line.skuId);
        if (!row) return fail('NOT_ORDERABLE', 'No longer available');
        if (!isValidOrderQuantity(row.sku, line.quantity)) {
          return fail('INVALID_STEP', `Quantity must be in steps of ${row.sku.quantityStep}`);
        }
        if (line.quantity > row.availableQuantity) {
          return fail('INSUFFICIENT_STOCK', `Only ${row.availableQuantity} available`);
        }
        const lineTotal = Math.round(line.quantity * row.unitPrice * 100) / 100;
        return {
          ...line,
          unitPrice: row.unitPrice,
          lineTotal,
          availableQuantity: row.availableQuantity,
          ok: true,
          errorCode: null,
          message: null,
        };
      });
      const total = out.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
      return {
        lines: out,
        itemCount: out.filter((l) => l.lineTotal != null).length,
        subtotal: total,
        total,
        currency: 'INR',
        allValid: out.every((l) => l.ok),
        pricedAt: new Date().toISOString(),
      };
    },

    async placeAssistedOrder(input): Promise<string> {
      const preview = await this.previewOrderLines(input.lines);
      if (!preview.allValid) {
        throw new Error(preview.lines.find((l) => !l.ok)?.message ?? 'Order rejected');
      }
      const catalogue = await this.listOrderableSkus();
      const shop = retailers.find((r) => r.id === input.shopId);
      const id = `mock-order-${Date.now().toString(16)}`;
      const now = new Date().toISOString();
      mockOrders.unshift(
        mockOrder({
          id,
          shopId: input.shopId,
          shopName: shop?.tradeName ?? '—',
          status: 'AWAITING_CUSTOMER_CONFIRMATION',
          createdAt: now,
          lines: preview.lines.map((l, i) => {
            const row = catalogue.find((r) => r.sku.id === l.skuId)!;
            return {
              id: `${id}-line-${i}`,
              skuId: l.skuId,
              productName: row.product.name,
              skuName: row.sku.name,
              skuCode: row.sku.skuCode,
              specification: null,
              sellingUnit: String(row.sku.sellingUnit),
              quantity: l.quantity,
              unitPrice: l.unitPrice ?? 0,
              lineTotal: l.lineTotal ?? 0,
            };
          }),
        }),
      );
      return id;
    },

    async sendConfirmationPlaceholder(orderId: string) {
      return {
        ok: true,
        message:
          'OTP confirmation placeholder recorded. SMS delivery is not wired yet.',
        orderId,
      };
    },

    async listTodaysVisits(_profileId: string): Promise<SalesmanVisit[]> {
      return [...mockVisits];
    },

    async listAllVisits(profileId: string): Promise<SalesmanVisit[]> {
      return this.listTodaysVisits(profileId);
    },

    async listShopOrders(shopId: string): Promise<SalesmanOrderSummary[]> {
      return (await this.listOrders('mock')).filter((order) => order.shopId === shopId);
    },

    async listShopVisits(shopId: string): Promise<SalesmanVisit[]> {
      return (await this.listAllVisits('mock')).filter((visit) => visit.shopId === shopId);
    },

    async getShopPhotoUrl(_shopId: string): Promise<string | null> {
      return null;
    },

    async uploadShopPhoto(shopId: string): Promise<{ path: string }> {
      return { path: `mock/${shopId}/shop` };
    },

    async checkInVisit(visitId: string, lat: number, lng: number) {
      const visit = mockVisits.find((row) => row.id === visitId);
      if (!visit) throw new Error('Visit not found');
      const hasShopGps = visit.deliveryLat != null && visit.deliveryLng != null;
      const distance = hasShopGps ? 42 : null;
      mockVisits = mockVisits.map((row) =>
        row.id === visitId
          ? {
              ...row,
              checkInAt: new Date().toISOString(),
              checkInDistanceMetres: distance,
              gpsVerification: hasShopGps ? ('verified' as const) : ('unavailable' as const),
            }
          : row,
      );
      return {
        visitId,
        status: visit.status,
        notes: visit.notes,
        latitude: lat,
        longitude: lng,
        distanceMetres: distance,
        gpsVerification: hasShopGps ? ('verified' as const) : ('unavailable' as const),
        checkedInAt: new Date().toISOString(),
        completedAt: null,
        photoPath: null,
      };
    },

    async completeVisit(input: {
      visitId: string;
      status: 'VISITED' | 'SHOP_CLOSED';
      lat: number;
      lng: number;
      notes?: string | null;
      photoPath?: string | null;
    }) {
      const visit = mockVisits.find((row) => row.id === input.visitId);
      if (!visit) throw new Error('Visit not found');
      if (!visit.checkInAt) throw new Error('Check in before completing this visit');
      if (visit.status === 'VISITED' || visit.status === 'SHOP_CLOSED') {
        throw new Error('Visit is already complete');
      }
      const notes = input.notes === undefined ? visit.notes : input.notes;
      mockVisits = mockVisits.map((row) =>
        row.id === input.visitId
          ? { ...row, status: input.status, notes }
          : row,
      );
      return {
        visitId: input.visitId,
        status: input.status,
        notes,
        latitude: input.lat,
        longitude: input.lng,
        distanceMetres: visit.checkInDistanceMetres ?? null,
        gpsVerification: visit.gpsVerification ?? 'unavailable',
        checkedInAt: visit.checkInAt,
        completedAt: new Date().toISOString(),
        photoPath: input.photoPath ?? null,
      };
    },

    async uploadVisitPhoto(shopId: string, visitId: string) {
      return { path: `mock/${shopId}/visits/${visitId}` };
    },

    async getOwnProfile(): Promise<SalesmanOwnProfile> {
      return { ...mockOwnProfile };
    },

    async updateOwnProfile(input: UpdateOwnProfileInput): Promise<SalesmanOwnProfile> {
      const name = input.displayName.trim();
      if (!name || name.length > 80) {
        throw new Error('Enter a name up to 80 characters');
      }
      if (input.preferredLanguage !== 'en' && input.preferredLanguage !== 'hi') {
        throw new Error('Preferred language is not supported');
      }
      mockOwnProfile = {
        ...mockOwnProfile,
        displayName: name,
        preferredLanguage: input.preferredLanguage,
        avatarPath: input.updateAvatar ? input.avatarPath ?? null : mockOwnProfile.avatarPath,
        setupCompletedAt: input.completeSetup
          ? mockOwnProfile.setupCompletedAt ?? new Date().toISOString()
          : mockOwnProfile.setupCompletedAt,
      };
      return { ...mockOwnProfile };
    },

    async uploadProfilePhoto() {
      mockOwnProfile = { ...mockOwnProfile, avatarPath: 'mock/profile' };
      return { path: 'mock/profile' };
    },

    async updateVisitStatus(
      visitId: string,
      status: SalesVisitStatus,
      notes?: string | null,
    ): Promise<void> {
      mockVisits = mockVisits.map((v) =>
        v.id === visitId
          ? { ...v, status, notes: notes === undefined ? v.notes : notes }
          : v,
      );
    },

    async getPerformance(_profileId: string): Promise<SalesmanPerformance> {
      return {
        ordersThisMonth: 4,
        revenueGeneratedLabel: '₹1,28,500',
        newRetailers: 1,
        activationRateLabel: '—',
        repeatCustomers: 2,
      };
    },

    async getMonthTarget(): Promise<SalesmanTargetProgress | null> {
      return {
        month: '2026-09-01',
        targetAmount: 100000,
        achievedAmount: 42000,
        remainingAmount: 58000,
        progressPercent: 42,
      };
    },

    async getEarnings(): Promise<SalesmanEarnings> {
      return {
        month: '2026-09-01',
        earningModel: 'SALARY_PLUS_COMMISSION',
        earnedCommission: 800,
        salaryApplies: true,
        salary: { monthlySalary: 18000, dailyAllowance: 100, otherAllowance: 0 },
        totalEarnings: 18800,
        totalIncludesSalary: true,
        awaitingOrderCount: 1,
        awaitingOrderValue: 2400,
        awaitingOrders: [
          {
            orderId: 'mock-order-awaiting',
            orderNumber: 'MOCKWAIT',
            shopName: 'Sharma Stores',
            createdAt: '2026-09-20T08:00:00.000Z',
            orderStatus: 'OUT_FOR_DELIVERY',
            orderTotal: 2400,
          },
        ],
        entries: [
          {
            orderId: 'mock-order-earned',
            orderNumber: 'MOCKDONE',
            shopName: 'Gupta Traders',
            earnedAt: '2026-09-12T08:00:00.000Z',
            orderStatus: 'DELIVERED',
            commissionAmount: 800,
          },
        ],
        payslipsAvailable: false,
        target: {
          month: '2026-09-01',
          targetAmount: 100000,
          achievedAmount: 42000,
          remainingAmount: 58000,
          progressPercent: 42,
        },
      };
    },

    async getPayrollStatusForMonth(): Promise<'DRAFT' | 'APPROVED' | 'PAID' | null> {
      return null;
    },

    async listExpenses(): Promise<SalesmanExpense[]> {
      return [];
    },

    async getExpense(): Promise<SalesmanExpense | null> {
      return null;
    },

    async createExpense(input: SalesmanExpenseInput): Promise<SalesmanExpense> {
      return {
        id: 'mock-expense',
        salesmanProfileId: 'mock',
        category: input.category,
        amount: input.amount,
        expenseDate: input.expenseDate,
        note: input.note ?? null,
        receiptPath: null,
        receiptUrl: null,
        status: 'PENDING',
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
      };
    },

    async updatePendingExpense(
      expenseId: string,
      input: SalesmanExpenseInput,
    ): Promise<SalesmanExpense> {
      return this.createExpense(input).then((row) => ({ ...row, id: expenseId }));
    },

    async uploadExpenseReceipt(expenseId: string): Promise<SalesmanExpense> {
      const row = await this.createExpense({
        category: 'TRAVEL',
        amount: 1,
        expenseDate: '2026-09-01',
      });
      return { ...row, id: expenseId, receiptPath: `mock/expenses/${expenseId}` };
    },

    async listReturnRequests(): Promise<SalesmanReturnRequest[]> {
      return [];
    },

    async getReturnRequest(): Promise<SalesmanReturnRequest | null> {
      return null;
    },

    async createReturnRequest(input: SalesmanReturnInput): Promise<SalesmanReturnRequest> {
      return {
        id: 'mock-return',
        salesmanProfileId: 'mock',
        shopId: 'mock-shop',
        shopName: 'Sharma Stores',
        orderId: input.orderId,
        skuId: input.skuId,
        productName: 'Almonds',
        skuName: 'Almond 1kg',
        skuCode: 'ALM-1KG',
        quantity: input.quantity,
        reason: input.reason,
        note: input.note ?? null,
        photoPath: null,
        photoUrl: null,
        status: 'PENDING',
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
      };
    },

    async uploadReturnPhoto(requestId: string): Promise<SalesmanReturnRequest> {
      const row = await this.createReturnRequest({
        orderId: 'mock-order',
        skuId: 'mock-sku',
        quantity: 1,
        reason: 'Damaged',
      });
      return { ...row, id: requestId, photoPath: `mock/returns/${requestId}` };
    },

    async listMessages(): Promise<SalesmanMessage[]> {
      return [];
    },

    async sendMessage(body: string): Promise<SalesmanMessage> {
      return {
        id: 'mock-message',
        salesmanProfileId: 'mock',
        senderProfileId: 'mock',
        body,
        createdAt: new Date().toISOString(),
      };
    },

    async listNotices(): Promise<SalesmanNotice[]> {
      return [];
    },

    async markNoticeRead(): Promise<void> {},

    async savePushSubscription(): Promise<void> {},

    async listVoiceNotes(): Promise<SalesmanVoiceNote[]> {
      return [];
    },

    async uploadVoiceNote(input: {
      shopId: string;
      visitId?: string | null;
      durationSeconds: number;
    }): Promise<SalesmanVoiceNote> {
      return {
        id: 'mock-voice',
        salesmanProfileId: 'mock',
        shopId: input.shopId,
        visitId: input.visitId ?? null,
        audioPath: null,
        audioUrl: null,
        durationSeconds: input.durationSeconds,
        createdAt: new Date().toISOString(),
      };
    },

    async listServiceAreas() {
      return [
        { id: 'mock-area-1', name: 'Andheri East' },
        { id: 'mock-area-2', name: 'Bandra West' },
      ];
    },

    async listOrderableSkus(): Promise<CatalogueSkuRow[]> {
      const now = new Date().toISOString();
      const category = {
        id: 'mock-cat-1',
        name: 'Staples',
        displayOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const row = (input: {
        n: number;
        code: string;
        product: string;
        name: string;
        netQuantity: number;
        netQuantityUnit: string;
        packsPerCarton?: number;
        outerType?: string;
        moq: number;
        step: number;
        price: number;
        stock: number;
      }): CatalogueSkuRow => ({
        sku: {
          id: `mock-sku-${input.n}`,
          productId: `mock-product-${input.n}`,
          skuCode: input.code,
          name: input.name,
          productType: 'PACKED',
          sellingUnit: 'PACK',
          netQuantity: input.netQuantity,
          netQuantityUnit: input.netQuantityUnit,
          packsPerCarton: input.packsPerCarton,
          outerType: input.outerType,
          moq: input.moq,
          quantityStep: input.step,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        product: {
          id: `mock-product-${input.n}`,
          categoryId: category.id,
          name: input.product,
          productType: 'PACKED',
          imageUrls: [],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        category,
        unitPrice: input.price,
        availableQuantity: input.stock,
      });
      return [
        row({
          n: 1,
          code: 'RICE-1',
          product: 'Basmati Rice',
          name: 'Basmati Rice 1kg',
          netQuantity: 1,
          netQuantityUnit: 'kg',
          packsPerCarton: 10,
          outerType: 'bag',
          moq: 5,
          step: 5,
          price: 166,
          stock: 480,
        }),
        row({
          n: 2,
          code: 'OIL-1L',
          product: 'Sunflower Oil',
          name: 'Sunflower Oil 1L',
          netQuantity: 1,
          netQuantityUnit: 'bottle',
          packsPerCarton: 12,
          outerType: 'carton',
          moq: 1,
          step: 1,
          price: 210,
          stock: 36,
        }),
        row({
          n: 3,
          code: 'DAL-1',
          product: 'Toor Dal',
          name: 'Toor Dal 1kg',
          netQuantity: 1,
          netQuantityUnit: 'kg',
          moq: 1,
          step: 1,
          price: 142,
          stock: 0,
        }),
      ];
    },
  };
}
