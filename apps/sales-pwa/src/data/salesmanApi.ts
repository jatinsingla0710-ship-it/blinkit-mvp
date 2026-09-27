import type {
  CatalogueSkuRow,
  CreateRetailerInput,
  SalesmanAttendance,
  SalesmanDashboard,
  SalesmanDayActionResult,
  SalesmanPerformance,
  SalesmanRetailer,
  SalesmanService,
  SalesmanVisit,
  SalesVisitStatus,
} from '@groaurum/api-client';
import { createSupabaseSalesmanService } from '@groaurum/api-client';
import { getSalesSupabaseClient } from '@/lib/salesSupabaseClient';
import { resolveOperationalDataAdapter } from '@/lib/operationalEnv';

/** Public salesman API surface used by pages (excludes internal mappers). */
export type SalesmanApi = Omit<SalesmanService, '_maps'>;

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
    activationLabel: 'activated',
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
    lifecycleStatus: 'INVITED',
    activationStatus: 'app_link_sent',
    activationLabel: 'App link sent',
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
    pendingInvitationToken: 'mock-invite-token-gupta',
  },
  {
    id: 'mock-shop-3',
    tradeName: 'Verma Wholesale',
    legalName: 'Verma Bros',
    lifecycleStatus: 'LEAD',
    activationStatus: 'not_activated',
    activationLabel: 'Not activated',
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

function createMockSalesmanService(): SalesmanApi {
  const retailers = [...MOCK_RETAILERS];

  return {
    async getDashboard(_profileId: string): Promise<SalesmanDashboard> {
      return {
        assignedRetailers: retailers.length,
        todaysVisits: mockVisits.length,
        pendingActivations: retailers.filter(
          (r) => r.activationStatus !== 'activated',
        ).length,
        ordersCollected: 4,
        revenueThisMonth: 128500,
        revenueThisMonthLabel: '₹1,28,500',
      };
    },

    async startDay(workDate?: string): Promise<SalesmanDayActionResult> {
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

    async endDay(workDate?: string): Promise<SalesmanDayActionResult> {
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
        activationStatus: 'not_activated',
        activationLabel: 'Not activated',
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
      const token = `mock-invite-${shopId.slice(-6)}`;
      if (shop) {
        shop.pendingInvitationToken = token;
        shop.activationStatus = 'app_link_sent';
        shop.activationLabel = 'App link sent';
        shop.lifecycleStatus = 'INVITED';
      }
      return {
        token,
        mobile: mobile ?? shop?.primaryContactMobile ?? '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async recordAppLinkSent(shopId: string): Promise<void> {
      const shop = retailers.find((r) => r.id === shopId);
      if (shop && shop.activationStatus !== 'activated') {
        shop.activationStatus = 'app_link_sent';
        shop.activationLabel = 'App link sent';
      }
    },

    async listOrders() {
      return [];
    },

    async placeAssistedOrder(): Promise<string> {
      return `mock-order-${Date.now()}`;
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
        activationRateLabel: '67%',
        repeatCustomers: 2,
      };
    },

    async listServiceAreas() {
      return [
        { id: 'mock-area-1', name: 'Andheri East' },
        { id: 'mock-area-2', name: 'Bandra West' },
      ];
    },

    async listOrderableSkus(): Promise<CatalogueSkuRow[]> {
      return [
        {
          sku: {
            id: 'mock-sku-1',
            productId: 'mock-product-1',
            skuCode: 'RICE-25',
            name: 'Basmati Rice 25kg',
            productType: 'PACKED',
            sellingUnit: 'CARTON',
            packsPerCarton: 1,
            moq: 2,
            quantityStep: 2,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          product: {
            id: 'mock-product-1',
            categoryId: 'mock-cat-1',
            name: 'Basmati Rice',
            productType: 'PACKED',
            imageUrls: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          category: {
            id: 'mock-cat-1',
            name: 'Staples',
            displayOrder: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          unitPrice: 1850,
          availableQuantity: 40,
        },
        {
          sku: {
            id: 'mock-sku-2',
            productId: 'mock-product-2',
            skuCode: 'OIL-15',
            name: 'Sunflower Oil 15L',
            productType: 'PACKED',
            sellingUnit: 'CARTON',
            packsPerCarton: 1,
            moq: 1,
            quantityStep: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          product: {
            id: 'mock-product-2',
            categoryId: 'mock-cat-1',
            name: 'Sunflower Oil',
            productType: 'PACKED',
            imageUrls: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          category: {
            id: 'mock-cat-1',
            name: 'Staples',
            displayOrder: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          unitPrice: 2100,
          availableQuantity: 18,
        },
      ];
    },
  };
}

export function createSalesmanApi(): SalesmanApi {
  if (resolveOperationalDataAdapter() === 'supabase') {
    return createSupabaseSalesmanService(getSalesSupabaseClient());
  }

  return createMockSalesmanService();
}

/** True when Sales PWA is using in-memory mock/demo data (not Supabase). */
export function isSalesDataMockMode(): boolean {
  return resolveOperationalDataAdapter() !== 'supabase';
}
