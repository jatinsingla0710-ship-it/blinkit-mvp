import type { Category, Product, Sku } from '@groaurum/shared-types';
import { selectEffectiveSkuPrice } from '../../catalogue/effective-price';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { createSupabaseCatalogueService } from './catalogue';
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
  shopId: string;
  shopName: string;
  total: number;
  totalLabel: string;
  status: string;
  createdAt: string;
  dateLabel: string;
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
  const catalogue = createSupabaseCatalogueService(client);

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

      const { data: authLinks } = shopIds.length
        ? await client
            .from('shop_auth_links')
            .select('shop_id')
            .in('shop_id', shopIds)
        : { data: [] as { shop_id: string }[] };
      const authLinkSet = new Set(
        (authLinks ?? []).map((row) => row.shop_id as string),
      );

      const { count: visitCount } = await client
        .from('sales_visits')
        .select('id', { count: 'exact', head: true })
        .eq('salesman_profile_id', profileId)
        .gte('planned_at', startOfTodayIso())
        .lte('planned_at', endOfTodayIso());

      const pendingActivations = shops.filter((s) => {
        const sid = s.id as string;
        return !authLinkSet.has(sid);
      }).length;

      let ordersCollected = 0;
      let revenue = 0;
      if (shopIds.length) {
        const { data: orders } = await client
          .from('orders')
          .select('id, total, created_by_profile_id, created_at')
          .eq('created_by_profile_id', profileId)
          .gte('created_at', startOfMonthIso())
          .is('deleted_at', null);
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

      const [{ data: contacts }, { data: areas }, { data: invitations }, { data: authLinks }, { data: orders }] =
        await Promise.all([
          client
            .from('shop_contacts')
            .select('shop_id, name, mobile, is_primary')
            .in('shop_id', shopIds),
          areaIds.length
            ? client.from('service_areas').select('id, name').in('id', areaIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
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
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        ]);

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
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const orders = data ?? [];
      if (!orders.length) return [];

      const shopIds = [...new Set(orders.map((o) => o.shop_id as string))];
      const { data: shops } = await client
        .from('shops')
        .select('id, trade_name')
        .in('id', shopIds);
      const nameMap = new Map((shops ?? []).map((s) => [s.id, s.trade_name]));

      return orders.map((o) => ({
        id: o.id as string,
        shopId: o.shop_id as string,
        shopName: nameMap.get(o.shop_id as string) ?? '—',
        total: Number(o.total ?? 0),
        totalLabel: formatInr(Number(o.total ?? 0)),
        status: String(o.status),
        createdAt: String(o.created_at),
        dateLabel: formatDate(String(o.created_at)),
      }));
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
      const { data: shops } = await client
        .from('shops')
        .select('id, trade_name, service_area_id, delivery_city')
        .in('id', shopIds);
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
      const { data: shops } = await client
        .from('shops')
        .select('id, trade_name, delivery_city')
        .in('id', shopIds);
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

    async updateVisitStatus(
      visitId: string,
      status: SalesVisitStatus,
      notes?: string | null,
    ): Promise<void> {
      const patch: {
        status: SalesVisitStatus;
        notes: string | null;
        visited_at?: string;
      } = {
        status,
        notes: notes ?? null,
      };
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
      const { data: orders } = await client
        .from('orders')
        .select('id, total, shop_id, created_at')
        .eq('created_by_profile_id', profileId)
        .gte('created_at', startOfMonthIso())
        .is('deleted_at', null);

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

    async listOrderableSkus(): Promise<CatalogueSkuRow[]> {
      const [categories, products, skus] = await Promise.all([
        catalogue.getCategories({ activeOnly: true }),
        catalogue.getProducts({ activeOnly: true }),
        catalogue.searchSkus({ activeOnly: true }),
      ]);
      const productMap = new Map(products.map((p) => [p.id, p]));
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      const skuIds = skus.map((s) => s.id);
      const [{ data: prices }, { data: balances }] = await Promise.all([
        client
          .from('sku_prices')
          .select('*')
          .in('sku_id', skuIds)
          .is('effective_to', null),
        client
          .from('inventory_balances')
          .select('sku_id, available_quantity')
          .in('sku_id', skuIds),
      ]);

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

    // Expose raw mappers for typing convenience in app layer
    _maps: { mapCategory, mapProduct, mapSku },
  };
}

export type SalesmanService = ReturnType<typeof createSupabaseSalesmanService>;
