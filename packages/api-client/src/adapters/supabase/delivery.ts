import type { GroAurumSupabaseClient } from '../../supabase/client';
import { DEFAULT_SERVICE_TERRITORY } from '@groaurum/shared-types';

export type DeliveryRouteStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type DeliveryStopStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type DeliveryDashboard = {
  todaysRoutes: number;
  assignedDeliveries: number;
  codPendingLabel: string;
  codPendingAmount: number;
  completedDeliveries: number;
  failedDeliveries: number;
};

export type DeliveryRouteSummary = {
  id: string;
  routeCode: string;
  routeDate: string;
  routeDateLabel: string;
  status: DeliveryRouteStatus;
  statusLabel: string;
  areaLabel: string;
  stopCount: number;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  codExpectedLabel: string;
  codCollectedLabel: string;
};

export type DeliveryStopDetail = {
  id: string;
  routeId: string;
  sequence: number;
  status: DeliveryStopStatus;
  statusLabel: string;
  orderId: string;
  orderCode: string;
  orderStatus: string;
  shopName: string;
  addressLine: string;
  city: string;
  pinCode: string;
  contactName: string | null;
  contactMobile: string | null;
  amount: number;
  amountLabel: string;
  paymentStatus: string;
  paymentMethodIntent: string;
  collectionMethod: string | null;
  providerReference: string | null;
  cashCollectedAmount: number;
  onlineCollectedAmount: number;
  codExpected: number;
  codExpectedLabel: string;
  codCollected: boolean;
  /** Bank/UPI reported by driver; awaiting admin verification (not company-received). */
  awaitingVerification: boolean;
  navigationUrl: string;
};

/** Result of `delivery_report_digital_payment`. */
export type ReportDigitalPaymentResult = {
  amountDue: number;
  reportedAmount: number;
  paymentStatus: string;
  collectionMethod: string;
  providerReference: string | null;
  awaitingVerification: boolean;
  canCompleteDelivery: boolean;
  cashCollected: number;
  onlineCollected: number;
  remaining: number;
};

export type CodHistoryRow = {
  id: string;
  orderId: string;
  orderCode: string;
  shopName: string;
  amountLabel: string;
  statusLabel: string;
  methodLabel: string;
  atLabel: string;
};

export type RouteCompletionSummary = {
  routeId: string;
  completedDeliveries: number;
  failedDeliveries: number;
  codExpected: number;
  codCollected: number;
  codPending: number;
  closedAt: string;
};

/** Result of `delivery_record_cash_payment` (customer cash; remaining for online later). */
export type RecordCashPaymentResult = {
  amountDue: number;
  cashCollected: number;
  onlineCollected: number;
  remaining: number;
  paymentStatus: string;
  canCompleteDelivery: boolean;
  onlineProviderConfigured: boolean;
  onlineAction: string;
};

export function parseRecordCashPaymentRpcResult(
  data: unknown,
): RecordCashPaymentResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    amountDue: Number(row['amountDue'] ?? 0),
    cashCollected: Number(row['cashCollected'] ?? 0),
    onlineCollected: Number(row['onlineCollected'] ?? 0),
    remaining: Number(row['remaining'] ?? 0),
    paymentStatus: String(row['paymentStatus'] ?? ''),
    canCompleteDelivery: Boolean(row['canCompleteDelivery']),
    onlineProviderConfigured: Boolean(row['onlineProviderConfigured']),
    onlineAction: String(row['onlineAction'] ?? 'NOT_CONFIGURED'),
  };
}

/**
 * Call trusted RPC `delivery_record_cash_payment`.
 * Browser must not insert into payments / delivery_cod_custody directly.
 */
export async function invokeDeliveryRecordCashPayment(
  client: GroAurumSupabaseClient,
  input: { orderId: string; cashAmount: number },
): Promise<RecordCashPaymentResult> {
  const { data, error } = await client.rpc('delivery_record_cash_payment', {
    p_order_id: input.orderId,
    p_cash_amount: input.cashAmount,
  });
  if (error) throw error;
  return parseRecordCashPaymentRpcResult(data);
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
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

function shortCode(id: string, prefix: string): string {
  return `${prefix}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createSupabaseDeliveryService(client: GroAurumSupabaseClient) {
  async function listAssignedRoutes(profileId: string) {
    const { data, error } = await client
      .from('delivery_routes')
      .select('*')
      .eq('assigned_delivery_profile_id', profileId)
      .is('deleted_at', null)
      .order('route_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  return {
    async getDashboard(profileId: string): Promise<DeliveryDashboard> {
      const routes = await listAssignedRoutes(profileId);
      const today = todayDateString();
      const todaysRoutes = routes.filter(
        (r) => String(r.route_date).slice(0, 10) === today,
      );
      const routeIds = todaysRoutes.map((r) => r.id as string);

      if (!routeIds.length) {
        return {
          todaysRoutes: 0,
          assignedDeliveries: 0,
          codPendingLabel: formatInr(0),
          codPendingAmount: 0,
          completedDeliveries: 0,
          failedDeliveries: 0,
        };
      }

      const { data: stops } = await client
        .from('route_stops')
        .select('id, route_id, order_id, status')
        .in('route_id', routeIds);

      const stopRows = stops ?? [];
      const orderIds = stopRows.map((s) => s.order_id as string);
      const { data: payments } = orderIds.length
        ? await client.from('payments').select('*').in('order_id', orderIds)
        : { data: [] as Record<string, unknown>[] };

      const paymentRows = payments ?? [];
      let codPending = 0;
      for (const p of paymentRows) {
        const intent = String(p.method_intent ?? '');
        const status = String(p.status ?? '');
        if (intent === 'PAY_ON_DELIVERY' && status !== 'PAID') {
          codPending += Number(p.amount ?? 0);
        }
      }

      return {
        todaysRoutes: todaysRoutes.length,
        assignedDeliveries: stopRows.length,
        codPendingAmount: codPending,
        codPendingLabel: formatInr(codPending),
        completedDeliveries: stopRows.filter((s) => s.status === 'COMPLETED')
          .length,
        failedDeliveries: stopRows.filter((s) => s.status === 'FAILED').length,
      };
    },

    async listRoutes(profileId: string): Promise<DeliveryRouteSummary[]> {
      const routes = await listAssignedRoutes(profileId);
      if (!routes.length) return [];

      const routeIds = routes.map((r) => r.id as string);
      const areaIds = [
        ...new Set(
          routes
            .map((r) => r.service_area_id as string)
            .filter(Boolean),
        ),
      ];

      const [{ data: stops }, { data: areas }] = await Promise.all([
        client
          .from('route_stops')
          .select('id, route_id, order_id, status')
          .in('route_id', routeIds),
        areaIds.length
          ? client.from('service_areas').select('id, name').in('id', areaIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      const areaMap = new Map((areas ?? []).map((a) => [a.id, a.name]));
      const stopsByRoute = new Map<string, typeof stops>();
      for (const s of stops ?? []) {
        const rid = s.route_id as string;
        const list = stopsByRoute.get(rid) ?? [];
        list.push(s);
        stopsByRoute.set(rid, list);
      }

      const allOrderIds = (stops ?? []).map((s) => s.order_id as string);
      const { data: payments } = allOrderIds.length
        ? await client.from('payments').select('*').in('order_id', allOrderIds)
        : { data: [] as Record<string, unknown>[] };
      const payByOrder = new Map(
        (payments ?? []).map((p) => [p.order_id as string, p]),
      );

      return routes.map((r) => {
        const rid = r.id as string;
        const routeStops = stopsByRoute.get(rid) ?? [];
        let expected = 0;
        let collected = 0;
        for (const s of routeStops) {
          const p = payByOrder.get(s.order_id as string);
          if (!p) continue;
          if (String(p.method_intent) === 'PAY_ON_DELIVERY') {
            expected += Number(p.amount ?? 0);
            if (String(p.status) === 'PAID') collected += Number(p.amount ?? 0);
          }
        }
        const status = String(r.status) as DeliveryRouteStatus;
        return {
          id: rid,
          routeCode: shortCode(rid, 'RT'),
          routeDate: String(r.route_date),
          routeDateLabel: formatDate(String(r.route_date)),
          status,
          statusLabel: statusLabel(status),
          areaLabel: areaMap.get(r.service_area_id as string) ?? '—',
          stopCount: routeStops.length,
          completedCount: routeStops.filter((s) => s.status === 'COMPLETED')
            .length,
          failedCount: routeStops.filter((s) => s.status === 'FAILED').length,
          pendingCount: routeStops.filter(
            (s) => s.status === 'PENDING' || s.status === 'IN_PROGRESS',
          ).length,
          codExpectedLabel: formatInr(expected),
          codCollectedLabel: formatInr(collected),
        };
      });
    },

    async getRouteStops(routeId: string): Promise<DeliveryStopDetail[]> {
      const { data: stops, error } = await client
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId)
        .order('sequence', { ascending: true });
      if (error) throw error;
      const stopRows = stops ?? [];
      if (!stopRows.length) return [];

      const orderIds = stopRows.map((s) => s.order_id as string);
      const { data: orders } = await client
        .from('orders')
        .select('*')
        .in('id', orderIds);
      const orderMap = new Map((orders ?? []).map((o) => [o.id as string, o]));

      const shopIds = [
        ...new Set(
          (orders ?? [])
            .map((o) => o.shop_id as string)
            .filter(Boolean),
        ),
      ];
      const [{ data: shops }, { data: contacts }, { data: payments }] =
        await Promise.all([
          shopIds.length
            ? client
                .from('shops')
                .select(
                  'id, trade_name, delivery_address_line, delivery_city, delivery_pin_code',
                )
                .in('id', shopIds)
            : Promise.resolve({ data: [] as Record<string, unknown>[] }),
          shopIds.length
            ? client
                .from('shop_contacts')
                .select('shop_id, name, mobile, is_primary')
                .in('shop_id', shopIds)
            : Promise.resolve({ data: [] as Record<string, unknown>[] }),
          client.from('payments').select('*').in('order_id', orderIds),
        ]);

      const shopMap = new Map((shops ?? []).map((s) => [s.id as string, s]));
      const contactMap = new Map<string, { name: string; mobile: string }>();
      for (const c of contacts ?? []) {
        if (c.is_primary && !contactMap.has(c.shop_id as string)) {
          contactMap.set(c.shop_id as string, {
            name: String(c.name),
            mobile: String(c.mobile),
          });
        }
      }
      const payMap = new Map(
        (payments ?? []).map((p) => [p.order_id as string, p]),
      );

      return stopRows.map((s) => {
        const order = orderMap.get(s.order_id as string);
        const shop = order
          ? shopMap.get(order.shop_id as string)
          : undefined;
        const contact = order
          ? contactMap.get(order.shop_id as string)
          : undefined;
        const payment = payMap.get(s.order_id as string);
        const amount = Number(order?.total ?? payment?.amount ?? 0);
        const paymentStatus = payment ? String(payment.status) : 'UNPAID';
        const methodIntent = payment
          ? String(payment.method_intent)
          : 'PAY_ON_DELIVERY';
        const collectionMethod = payment?.collection_method
          ? String(payment.collection_method)
          : null;
        const providerReference = payment?.provider_reference
          ? String(payment.provider_reference)
          : null;
        const cashCollected = payment
          ? Number(payment.cash_collected_amount ?? 0)
          : 0;
        const onlineCollected = payment
          ? Number(payment.online_collected_amount ?? 0)
          : 0;
        const paid = paymentStatus === 'PAID';
        const awaitingVerification =
          paymentStatus === 'PAYMENT_PENDING' &&
          collectionMethod != null &&
          collectionMethod !== 'CASH_ON_DELIVERY';
        const codExpected =
          methodIntent === 'PAY_ON_DELIVERY' && !paid
            ? Math.max(amount - cashCollected - onlineCollected, 0)
            : 0;
        const address = shop
          ? `${String(shop.delivery_address_line)}, ${String(shop.delivery_city)} ${String(shop.delivery_pin_code)}`
          : '';
        const mapsQuery = encodeURIComponent(
          address || DEFAULT_SERVICE_TERRITORY.mapsQuery,
        );
        return {
          id: s.id as string,
          routeId: s.route_id as string,
          sequence: Number(s.sequence),
          status: String(s.status) as DeliveryStopStatus,
          statusLabel: statusLabel(String(s.status)),
          orderId: s.order_id as string,
          orderCode: shortCode(s.order_id as string, 'GA'),
          orderStatus: String(order?.status ?? '—'),
          shopName: shop ? String(shop.trade_name) : '—',
          addressLine: shop ? String(shop.delivery_address_line) : '—',
          city: shop ? String(shop.delivery_city) : '—',
          pinCode: shop ? String(shop.delivery_pin_code) : '—',
          contactName: contact?.name ?? null,
          contactMobile: contact?.mobile ?? null,
          amount,
          amountLabel: formatInr(amount),
          paymentStatus,
          paymentMethodIntent: methodIntent,
          collectionMethod,
          providerReference,
          cashCollectedAmount: cashCollected,
          onlineCollectedAmount: onlineCollected,
          codExpected,
          codExpectedLabel: formatInr(codExpected),
          codCollected: paid,
          awaitingVerification,
          navigationUrl: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
        };
      });
    },

    async startRoute(routeId: string): Promise<void> {
      const { error } = await client.rpc('delivery_start_route', {
        p_route_id: routeId,
      });
      if (error) throw error;
    },

    async markStopInProgress(stopId: string): Promise<void> {
      const { error } = await client.rpc('delivery_mark_stop_in_progress', {
        p_stop_id: stopId,
      });
      if (error) throw error;
    },

    async completeStop(input: {
      stopId: string;
      notes?: string | null;
      photoCaptured?: boolean;
      signatureCaptured?: boolean;
      collectCodAmount?: number | null;
    }): Promise<void> {
      const { error } = await client.rpc('delivery_complete_stop', {
        p_stop_id: input.stopId,
        p_notes: input.notes ?? null,
        p_photo_captured: input.photoCaptured ?? false,
        p_signature_captured: input.signatureCaptured ?? false,
        p_collect_cod_amount: input.collectCodAmount ?? null,
      });
      if (error) {
        // Preserve PostgREST/Postgres fields for callers / DEV consoles.
        if (typeof console !== 'undefined' && console.error) {
          console.error('[delivery_complete_stop]', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stopId: input.stopId,
          });
        }
        throw error;
      }
    },

    async failStop(input: {
      stopId: string;
      failureReason: string;
      notes?: string | null;
      photoCaptured?: boolean;
    }): Promise<void> {
      const { error } = await client.rpc('delivery_fail_stop', {
        p_stop_id: input.stopId,
        p_failure_reason: input.failureReason,
        p_notes: input.notes ?? null,
        p_photo_captured: input.photoCaptured ?? false,
      });
      if (error) throw error;
    },

    async collectCod(input: {
      orderId: string;
      amount: number;
      method?: string;
    }): Promise<void> {
      const { error } = await client.rpc('delivery_collect_cod', {
        p_order_id: input.orderId,
        p_collected_amount: input.amount,
        p_collection_method: input.method ?? 'CASH_ON_DELIVERY',
      });
      if (error) throw error;
    },

    /**
     * Record cash at stop. Remaining = due − cash − confirmed online.
     * Does not invent online payment confirmation.
     * Mutates only via trusted RPC `delivery_record_cash_payment`.
     */
    async recordCashPayment(input: {
      orderId: string;
      cashAmount: number;
    }): Promise<RecordCashPaymentResult> {
      return invokeDeliveryRecordCashPayment(client, input);
    },

    /**
     * Report bank/UPI/online payment claimed by customer.
     * Sets PAYMENT_PENDING awaiting admin verification — never invents PAID.
     */
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
      const { data, error } = await client.rpc(
        'delivery_report_digital_payment',
        {
          p_order_id: input.orderId,
          p_amount: input.amount,
          p_collection_method: input.collectionMethod,
          p_reference: input.reference ?? null,
          p_notes: input.notes ?? null,
        } as never,
      );
      if (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[delivery_report_digital_payment]', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            orderId: input.orderId,
          });
        }
        throw error;
      }
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        amountDue: Number(row['amountDue'] ?? 0),
        reportedAmount: Number(row['reportedAmount'] ?? 0),
        paymentStatus: String(row['paymentStatus'] ?? ''),
        collectionMethod: String(row['collectionMethod'] ?? ''),
        providerReference: row['providerReference']
          ? String(row['providerReference'])
          : null,
        awaitingVerification: Boolean(row['awaitingVerification']),
        canCompleteDelivery: Boolean(row['canCompleteDelivery']),
        cashCollected: Number(row['cashCollected'] ?? 0),
        onlineCollected: Number(row['onlineCollected'] ?? 0),
        remaining: Number(row['remaining'] ?? 0),
      };
    },

    async completeRoute(routeId: string): Promise<RouteCompletionSummary> {
      const { data, error } = await client.rpc('delivery_complete_route', {
        p_route_id: routeId,
      });
      if (error) throw error;
      const row = data as {
        routeId: string;
        completedDeliveries: number;
        failedDeliveries: number;
        codExpected: number;
        codCollected: number;
        codPending: number;
        closedAt: string;
      };
      return {
        routeId: row.routeId,
        completedDeliveries: Number(row.completedDeliveries ?? 0),
        failedDeliveries: Number(row.failedDeliveries ?? 0),
        codExpected: Number(row.codExpected ?? 0),
        codCollected: Number(row.codCollected ?? 0),
        codPending: Number(row.codPending ?? 0),
        closedAt: String(row.closedAt ?? new Date().toISOString()),
      };
    },

    async listCodHistory(profileId: string): Promise<CodHistoryRow[]> {
      const routes = await listAssignedRoutes(profileId);
      const routeIds = routes.map((r) => r.id as string);
      if (!routeIds.length) return [];

      const { data: stops } = await client
        .from('route_stops')
        .select('order_id, route_id')
        .in('route_id', routeIds);
      const orderIds = [...new Set((stops ?? []).map((s) => s.order_id as string))];
      if (!orderIds.length) return [];

      const { data: payments } = await client
        .from('payments')
        .select('*')
        .in('order_id', orderIds)
        .order('updated_at', { ascending: false });

      const { data: orders } = await client
        .from('orders')
        .select('id, shop_id')
        .in('id', orderIds);
      const shopIds = [
        ...new Set((orders ?? []).map((o) => o.shop_id as string)),
      ];
      const { data: shops } = shopIds.length
        ? await client.from('shops').select('id, trade_name').in('id', shopIds)
        : { data: [] as { id: string; trade_name: string }[] };

      const orderShop = new Map(
        (orders ?? []).map((o) => [o.id as string, o.shop_id as string]),
      );
      const shopName = new Map(
        (shops ?? []).map((s) => [s.id, s.trade_name]),
      );

      return (payments ?? []).map((p) => ({
        id: p.id as string,
        orderId: p.order_id as string,
        orderCode: shortCode(p.order_id as string, 'GA'),
        shopName:
          shopName.get(orderShop.get(p.order_id as string) ?? '') ?? '—',
        amountLabel: formatInr(Number(p.amount ?? 0)),
        statusLabel: statusLabel(String(p.status)),
        methodLabel: p.collection_method
          ? statusLabel(String(p.collection_method))
          : statusLabel(String(p.method_intent)),
        atLabel: formatDateTime(
          String(p.paid_at ?? p.updated_at ?? p.created_at),
        ),
      }));
    },
  };
}

export type DeliveryService = ReturnType<typeof createSupabaseDeliveryService>;
