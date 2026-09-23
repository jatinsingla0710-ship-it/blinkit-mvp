import type {
  CodHistoryRow,
  DeliveryDashboard,
  DeliveryRouteSummary,
  DeliveryService,
  DeliveryStopDetail,
  RecordCashPaymentResult,
  ReportDigitalPaymentResult,
  RouteCompletionSummary,
} from '@groaurum/api-client';
import {
  createSupabaseDeliveryService,
  invokeDeliveryRecordCashPayment,
} from '@groaurum/api-client';
import { getDeliverySupabaseClient } from '@/lib/deliverySupabaseClient';
import { resolveOperationalDataAdapter } from '@/lib/operationalEnv';

/** Public delivery API surface used by pages — must include recordCashPayment. */
export type DeliveryApi = DeliveryService;

const MOCK_ROUTE_ID = 'mock-route-1';
const MOCK_STOP_1 = 'mock-stop-1';
const MOCK_STOP_2 = 'mock-stop-2';

let mockRoutes: DeliveryRouteSummary[] = [];
let mockStops: DeliveryStopDetail[] = [];
let mockCodHistory: CodHistoryRow[] = [];
let mockCompletion: RouteCompletionSummary | null = null;

function seedMockDeliveryState(): void {
  mockRoutes = [
    {
      id: MOCK_ROUTE_ID,
      routeCode: 'RT-MOCK01',
      routeDate: new Date().toISOString().slice(0, 10),
      routeDateLabel: 'Today',
      status: 'PLANNED',
      statusLabel: 'planned',
      areaLabel: 'Andheri East',
      stopCount: 2,
      completedCount: 0,
      failedCount: 0,
      pendingCount: 2,
      codExpectedLabel: '₹4,800',
      codCollectedLabel: '₹0',
    },
  ];
  mockStops = [
    {
      id: MOCK_STOP_1,
      routeId: MOCK_ROUTE_ID,
      sequence: 1,
      status: 'PENDING',
      statusLabel: 'pending',
      orderId: 'mock-order-1',
      orderCode: 'GA-MOCK01',
      orderStatus: 'OUT_FOR_DELIVERY',
      shopName: 'Sharma Kirana',
      addressLine: '12 Market Road',
      city: 'Mumbai',
      pinCode: '400069',
      contactName: 'Ravi Sharma',
      contactMobile: '+919800000101',
      amount: 2400,
      amountLabel: '₹2,400',
      paymentStatus: 'UNPAID',
      paymentMethodIntent: 'PAY_ON_DELIVERY',
      collectionMethod: null,
      providerReference: null,
      cashCollectedAmount: 0,
      onlineCollectedAmount: 0,
      codExpected: 2400,
      codExpectedLabel: '₹2,400',
      codCollected: false,
      awaitingVerification: false,
      navigationUrl:
        'https://www.google.com/maps/search/?api=1&query=12%20Market%20Road%20Mumbai',
    },
    {
      id: MOCK_STOP_2,
      routeId: MOCK_ROUTE_ID,
      sequence: 2,
      status: 'PENDING',
      statusLabel: 'pending',
      orderId: 'mock-order-2',
      orderCode: 'GA-MOCK02',
      orderStatus: 'OUT_FOR_DELIVERY',
      shopName: 'Gupta Stores',
      addressLine: '45 Lane 3',
      city: 'Mumbai',
      pinCode: '400069',
      contactName: 'Anita Gupta',
      contactMobile: '+919800000102',
      amount: 2400,
      amountLabel: '₹2,400',
      paymentStatus: 'UNPAID',
      paymentMethodIntent: 'PAY_ON_DELIVERY',
      collectionMethod: null,
      providerReference: null,
      cashCollectedAmount: 0,
      onlineCollectedAmount: 0,
      codExpected: 2400,
      codExpectedLabel: '₹2,400',
      codCollected: false,
      awaitingVerification: false,
      navigationUrl:
        'https://www.google.com/maps/search/?api=1&query=45%20Lane%203%20Mumbai',
    },
  ];
  mockCodHistory = [];
  mockCompletion = null;
}

seedMockDeliveryState();

/** Reset DEMO mock in-memory state (tests only). */
export function resetMockDeliveryApiState(): void {
  seedMockDeliveryState();
}

function refreshRouteCounts(): void {
  const stops = mockStops.filter((s) => s.routeId === MOCK_ROUTE_ID);
  const completed = stops.filter((s) => s.status === 'COMPLETED').length;
  const failed = stops.filter((s) => s.status === 'FAILED').length;
  const pending = stops.filter(
    (s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS',
  ).length;
  mockRoutes = mockRoutes.map((r) =>
    r.id === MOCK_ROUTE_ID
      ? {
          ...r,
          completedCount: completed,
          failedCount: failed,
          pendingCount: pending,
          stopCount: stops.length,
        }
      : r,
  );
}

/**
 * DEMO/mock cash recording — in-memory only, not a real payment confirmation.
 */
export function mockRecordCashPayment(
  orderId: string,
  cashAmount: number,
): RecordCashPaymentResult {
  const stop = mockStops.find((s) => s.orderId === orderId);
  if (!stop) throw new Error('Order not on route');
  if (cashAmount < 0) throw new Error('Invalid cash amount');
  if (cashAmount > stop.amount + 1e-9) {
    throw new Error('Cash cannot exceed amount due');
  }
  const online = stop.onlineCollectedAmount ?? 0;
  if (cashAmount + online > stop.amount + 1e-9) {
    throw new Error('Cash + online exceeds amount due');
  }
  const remaining =
    Math.round((stop.amount - cashAmount - online) * 100) / 100;
  const paid = remaining <= 0;
  mockStops = mockStops.map((s) => {
    if (s.orderId !== orderId) return s;
    if (paid) {
      mockCodHistory = [
        {
          id: `mock-cod-${Date.now()}`,
          orderId: s.orderId,
          orderCode: s.orderCode,
          shopName: s.shopName,
          amountLabel: `₹${cashAmount.toLocaleString('en-IN')}`,
          statusLabel: 'paid',
          methodLabel: 'cash on delivery (DEMO)',
          atLabel: 'Just now',
        },
        ...mockCodHistory,
      ];
    }
    return {
      ...s,
      cashCollectedAmount: cashAmount,
      onlineCollectedAmount: online,
      codCollected: paid,
      awaitingVerification: false,
      collectionMethod: paid ? 'CASH_ON_DELIVERY' : s.collectionMethod,
      paymentStatus: paid
        ? 'PAID'
        : cashAmount > 0
          ? 'PAYMENT_PENDING'
          : s.paymentStatus,
    };
  });
  return {
    amountDue: stop.amount,
    cashCollected: cashAmount,
    onlineCollected: online,
    remaining: Math.max(remaining, 0),
    paymentStatus: paid
      ? 'PAID'
      : cashAmount > 0
        ? 'PAYMENT_PENDING'
        : 'UNPAID',
    canCompleteDelivery: paid,
    onlineProviderConfigured: false,
    onlineAction: paid ? 'NOT_REQUIRED' : 'NOT_CONFIGURED',
  };
}

export function mockReportDigitalPayment(
  orderId: string,
  amount: number,
  collectionMethod: 'UPI_ON_DELIVERY' | 'CARD_ON_DELIVERY' | 'ONLINE_GATEWAY' | 'OTHER',
  reference?: string | null,
): ReportDigitalPaymentResult {
  const stop = mockStops.find((s) => s.orderId === orderId);
  if (!stop) throw new Error('Order not on route');
  if (amount <= 0) throw new Error('Reported amount must be positive');
  if (amount > stop.amount + 1e-9) {
    throw new Error('Reported amount cannot exceed order total');
  }
  mockStops = mockStops.map((s) =>
    s.orderId === orderId
      ? {
          ...s,
          paymentStatus: 'PAYMENT_PENDING',
          collectionMethod,
          providerReference: reference?.trim() || null,
          awaitingVerification: true,
          codCollected: false,
        }
      : s,
  );
  return {
    amountDue: stop.amount,
    reportedAmount: amount,
    paymentStatus: 'PAYMENT_PENDING',
    collectionMethod,
    providerReference: reference?.trim() || null,
    awaitingVerification: true,
    canCompleteDelivery: true,
    cashCollected: stop.cashCollectedAmount ?? 0,
    onlineCollected: 0,
    remaining: stop.amount,
  };
}

/** Seed a DEMO stop with a custom amount due (tests). */
export function seedMockStopAmountDue(orderId: string, amountDue: number): void {
  mockStops = mockStops.map((s) =>
    s.orderId === orderId
      ? {
          ...s,
          amount: amountDue,
          amountLabel: `₹${amountDue.toLocaleString('en-IN')}`,
          codExpected: amountDue,
          codExpectedLabel: `₹${amountDue.toLocaleString('en-IN')}`,
          cashCollectedAmount: 0,
          onlineCollectedAmount: 0,
          codCollected: false,
          awaitingVerification: false,
          collectionMethod: null,
          providerReference: null,
          paymentStatus: 'UNPAID',
        }
      : s,
  );
}

export function createMockDeliveryService(): DeliveryApi {
  return {
    async getDashboard(_profileId: string): Promise<DeliveryDashboard> {
      const pendingCod = mockStops
        .filter(
          (s) =>
            s.paymentMethodIntent === 'PAY_ON_DELIVERY' && !s.codCollected,
        )
        .reduce((sum, s) => sum + s.codExpected, 0);
      return {
        todaysRoutes: mockRoutes.length,
        assignedDeliveries: mockStops.length,
        codPendingAmount: pendingCod,
        codPendingLabel: `₹${pendingCod.toLocaleString('en-IN')}`,
        completedDeliveries: mockStops.filter((s) => s.status === 'COMPLETED')
          .length,
        failedDeliveries: mockStops.filter((s) => s.status === 'FAILED')
          .length,
      };
    },

    async listRoutes(_profileId: string): Promise<DeliveryRouteSummary[]> {
      return [...mockRoutes];
    },

    async getRouteStops(routeId: string): Promise<DeliveryStopDetail[]> {
      return mockStops.filter((s) => s.routeId === routeId);
    },

    async startRoute(routeId: string): Promise<void> {
      mockRoutes = mockRoutes.map((r) =>
        r.id === routeId
          ? { ...r, status: 'IN_PROGRESS', statusLabel: 'in progress' }
          : r,
      );
      mockCompletion = null;
    },

    async markStopInProgress(stopId: string): Promise<void> {
      mockStops = mockStops.map((s) =>
        s.id === stopId
          ? { ...s, status: 'IN_PROGRESS', statusLabel: 'in progress' }
          : s,
      );
      refreshRouteCounts();
    },

    async completeStop(input: {
      stopId: string;
      notes?: string | null;
      photoCaptured?: boolean;
      signatureCaptured?: boolean;
      collectCodAmount?: number | null;
    }): Promise<void> {
      const stop = mockStops.find((s) => s.id === input.stopId);
      if (!stop) throw new Error('Stop not found');
      if (input.collectCodAmount != null) {
        mockRecordCashPayment(stop.orderId, Number(input.collectCodAmount));
      }
      const latest = mockStops.find((s) => s.id === input.stopId)!;
      if (
        latest.paymentMethodIntent === 'PAY_ON_DELIVERY' &&
        !latest.codCollected &&
        !latest.awaitingVerification
      ) {
        throw new Error(
          'DEMO: remaining unpaid — cannot complete delivery',
        );
      }
      mockStops = mockStops.map((s) =>
        s.id === input.stopId
          ? { ...s, status: 'COMPLETED', statusLabel: 'completed' }
          : s,
      );
      refreshRouteCounts();
    },

    async failStop(input: {
      stopId: string;
      failureReason: string;
      notes?: string | null;
      photoCaptured?: boolean;
    }): Promise<void> {
      void input.failureReason;
      void input.notes;
      void input.photoCaptured;
      mockStops = mockStops.map((s) =>
        s.id === input.stopId
          ? { ...s, status: 'FAILED', statusLabel: 'failed' }
          : s,
      );
      refreshRouteCounts();
    },

    async collectCod(input: {
      orderId: string;
      amount: number;
      method?: string;
    }): Promise<void> {
      void input.method;
      mockRecordCashPayment(input.orderId, input.amount);
    },

    async recordCashPayment(input: {
      orderId: string;
      cashAmount: number;
    }): Promise<RecordCashPaymentResult> {
      return mockRecordCashPayment(input.orderId, input.cashAmount);
    },

    async reportDigitalPayment(input: {
      orderId: string;
      amount: number;
      collectionMethod:
        | 'UPI_ON_DELIVERY'
        | 'CARD_ON_DELIVERY'
        | 'ONLINE_GATEWAY'
        | 'OTHER';
      reference?: string | null;
      notes?: string | null;
    }): Promise<ReportDigitalPaymentResult> {
      void input.notes;
      return mockReportDigitalPayment(
        input.orderId,
        input.amount,
        input.collectionMethod,
        input.reference,
      );
    },

    async completeRoute(routeId: string): Promise<RouteCompletionSummary> {
      const stops = mockStops.filter((s) => s.routeId === routeId);
      const open = stops.some(
        (s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS',
      );
      if (open) {
        throw new Error('Complete or fail all stops before closing the route');
      }
      const completed = stops.filter((s) => s.status === 'COMPLETED').length;
      const failed = stops.filter((s) => s.status === 'FAILED').length;
      const codExpected = stops
        .filter((s) => s.paymentMethodIntent === 'PAY_ON_DELIVERY')
        .reduce((sum, s) => sum + s.codExpected, 0);
      const codCollected = stops
        .filter((s) => s.codCollected)
        .reduce((sum, s) => sum + s.codExpected, 0);
      mockRoutes = mockRoutes.map((r) =>
        r.id === routeId
          ? { ...r, status: 'COMPLETED', statusLabel: 'completed' }
          : r,
      );
      mockCompletion = {
        routeId,
        completedDeliveries: completed,
        failedDeliveries: failed,
        codExpected,
        codCollected,
        codPending: Math.max(0, codExpected - codCollected),
        closedAt: new Date().toISOString(),
      };
      return mockCompletion;
    },

    async listCodHistory(_profileId: string): Promise<CodHistoryRow[]> {
      return [...mockCodHistory];
    },
  };
}

/**
 * Build Delivery PWA API.
 * Always binds `recordCashPayment` explicitly so Vite prebundle of api-client
 * cannot drop the method at runtime.
 */
export function createDeliveryApi(): DeliveryApi {
  if (resolveOperationalDataAdapter() === 'supabase') {
    const client = getDeliverySupabaseClient();
    const service = createSupabaseDeliveryService(client);
    // Explicit bind: trusted RPC only — never browser CRUD to payments/custody.
    const recordCashPayment = async (input: {
      orderId: string;
      cashAmount: number;
    }): Promise<RecordCashPaymentResult> => {
      if (typeof service.recordCashPayment === 'function') {
        return service.recordCashPayment(input);
      }
      return invokeDeliveryRecordCashPayment(client, input);
    };
    const reportDigitalPayment = async (input: {
      orderId: string;
      amount: number;
      collectionMethod:
        | 'UPI_ON_DELIVERY'
        | 'CARD_ON_DELIVERY'
        | 'ONLINE_GATEWAY'
        | 'OTHER';
      reference?: string | null;
      notes?: string | null;
    }): Promise<ReportDigitalPaymentResult> => {
      if (typeof service.reportDigitalPayment === 'function') {
        return service.reportDigitalPayment(input);
      }
      throw new Error('reportDigitalPayment is not available on delivery service');
    };
    return {
      ...service,
      recordCashPayment,
      reportDigitalPayment,
    };
  }

  return createMockDeliveryService();
}
