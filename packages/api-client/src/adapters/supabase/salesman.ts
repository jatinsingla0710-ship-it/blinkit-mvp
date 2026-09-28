import type { Category, Product, Sku } from '@groaurum/shared-types';
import { selectEffectiveSkuPrice } from '../../catalogue/effective-price';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapCategory, mapProduct, mapSku } from './mappers';

export type SalesVisitStatus = 'PLANNED' | 'VISITED' | 'PENDING' | 'MISSED';

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
};

export type SalesmanPerformance = {
  ordersThisMonth: number;
  revenueGeneratedLabel: string;
  newRetailers: number;
  activationRateLabel: string;
  repeatCustomers: number;
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

function salesActivationLabel(status: SalesActivationStatus): string {
  switch (status) {
    case 'activated':
      return 'Activated';
    case 'app_link_sent':
      return 'App link sent';
    case 'access_disabled':
      return 'Access disabled';
    default:
      return 'Not activated';
  }
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
      const { data: shops, error: shopsError } = await client
        .from('shops')
        .select('id, trade_name, service_area_id, delivery_city')
        .in('id', shopIds);
      if (shopsError) throw shopsError;
      const shopMap = new Map(
        (shops ?? []).map((s) => [
          s.id,
          {
            name: String(s.trade_name),
            area: String(s.delivery_city ?? '—'),
          },
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

    async listServiceAreas(): Promise<{ id: string; name: string }[]> {
      const { data, error } = await client
        .from('service_areas')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({ id: a.id, name: a.name }));
    },

    async startDay(workDate?: string): Promise<SalesmanDayActionResult> {
      const { data, error } = await client.rpc('salesman_start_day', {
        p_work_date: workDate ?? null,
      });
      if (error) throw error;
      return mapDayActionResult((data ?? {}) as Record<string, unknown>);
    },

    async endDay(workDate?: string): Promise<SalesmanDayActionResult> {
      const { data, error } = await client.rpc('salesman_end_day', {
        p_work_date: workDate ?? null,
      });
      if (error) throw error;
      return mapDayActionResult((data ?? {}) as Record<string, unknown>);
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
