import type {
  DeliveryRoute,
  InventoryBalance,
  Order,
  Shop,
  StaffProfile,
} from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import {
  createDataError,
  createNoopRealtimeBus,
  type CrudRepository,
  type ListOptions,
  type RealtimeBus,
} from '@groaurum/data';
import type {
  CustomerCreateInput,
  CustomerUpdateInput,
  DeliveryRouteCreateInput,
  DeliveryRouteUpdateInput,
  InventoryAdjustInput,
  OrderCreateInput,
  SalesmanCreateInput,
  SettingUpsertInput,
} from '@groaurum/validation';
import { MemoryCache } from '../../cache/memory-cache';
import { createSupabaseCrudRepository } from './create-supabase-crud-repository';
import { planInventoryAdjustment } from '../../services/inventory-adjustment';

type RpcClient = GroAurumSupabaseClient & {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

type ShopRow = {
  id: string;
  trade_name: string;
  legal_name: string | null;
  lifecycle_status: Shop['lifecycleStatus'];
  service_area_id: string | null;
  assigned_salesman_profile_id: string | null;
  delivery_address_line: string;
  delivery_city: string;
  delivery_state: string;
  delivery_pin_code: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type InventoryRow = {
  id: string;
  sku_id: string;
  operational_location_id: string;
  on_hand_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
  mobile: string;
  roles: StaffProfile['roles'];
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type RouteRow = {
  id: string;
  service_area_id: string;
  route_date: string;
  assigned_delivery_profile_id: string | null;
  status: DeliveryRoute['status'];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  description: string | null;
  updated_by_profile_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  shop_id: string;
  status: Order['status'];
  source: Order['source'];
  created_by_profile_id: string;
  payment_id: string | null;
  service_area_id: string;
  expected_delivery_at: string | null;
  subtotal: number;
  adjustments: number;
  total: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

function mapShop(row: ShopRow): Shop {
  return {
    id: row.id,
    tradeName: row.trade_name,
    legalName: row.legal_name ?? undefined,
    lifecycleStatus: row.lifecycle_status,
    serviceAreaId: row.service_area_id,
    assignedSalesmanProfileId: row.assigned_salesman_profile_id,
    deliveryAddressLine: row.delivery_address_line,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    deliveryPinCode: row.delivery_pin_code,
    deliveryLat: row.delivery_lat ?? undefined,
    deliveryLng: row.delivery_lng ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInventory(row: InventoryRow): InventoryBalance {
  return {
    id: row.id,
    skuId: row.sku_id,
    operationalLocationId: row.operational_location_id,
    onHandQuantity: Number(row.on_hand_quantity),
    reservedQuantity: Number(row.reserved_quantity),
    availableQuantity: Number(row.available_quantity),
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    authUserId: row.id,
    displayName: row.display_name,
    mobile: row.mobile,
    roles: row.roles,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoute(row: RouteRow): DeliveryRoute {
  return {
    id: row.id,
    serviceAreaId: row.service_area_id,
    routeDate: row.route_date,
    assignedDeliveryProfileId: row.assigned_delivery_profile_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrder(row: OrderRow, lines: Order['lines'] = []): Order {
  return {
    id: row.id,
    shopId: row.shop_id,
    status: row.status,
    source: row.source,
    createdByProfileId: row.created_by_profile_id,
    paymentId: row.payment_id,
    serviceAreaId: row.service_area_id,
    expectedDeliveryAt: row.expected_delivery_at ?? undefined,
    totals: {
      subtotal: Number(row.subtotal),
      adjustments: Number(row.adjustments),
      total: Number(row.total),
      currency: row.currency ?? 'INR',
    },
    lines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SettingRecord = {
  id: string;
  settingKey: string;
  settingValue: Record<string, unknown>;
  description?: string;
  updatedByProfileId?: string;
  createdAt: string;
  updatedAt: string;
};

function mapSetting(row: SettingsRow): SettingRecord {
  return {
    id: row.id,
    settingKey: row.setting_key,
    settingValue: row.setting_value ?? {},
    description: row.description ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCustomersRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<Shop, Shop, CustomerCreateInput, CustomerUpdateInput> {
  const base = createSupabaseCrudRepository<
    ShopRow,
    Shop,
    Shop,
    CustomerCreateInput,
    CustomerUpdateInput
  >({
    client,
    entity: 'customers',
    table: 'shops',
    cache,
    mapList: mapShop,
    mapDetail: mapShop,
    searchColumns: ['trade_name', 'legal_name', 'delivery_city', 'delivery_pin_code'],
    toInsert: (input) => ({
      trade_name: input.tradeName,
      legal_name: input.legalName || null,
      lifecycle_status: 'LEAD',
      service_area_id: input.serviceAreaId,
      assigned_salesman_profile_id: input.assignedSalesmanProfileId,
      delivery_address_line: input.deliveryAddressLine,
      delivery_city: input.deliveryCity,
      delivery_state: input.deliveryState,
      delivery_pin_code: input.deliveryPinCode,
      delivery_lat: input.deliveryLat ?? null,
      delivery_lng: input.deliveryLng ?? null,
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.tradeName !== undefined ? { trade_name: input.tradeName } : {}),
      ...(input.legalName !== undefined ? { legal_name: input.legalName } : {}),
      ...(input.serviceAreaId !== undefined
        ? { service_area_id: input.serviceAreaId }
        : {}),
      // assignedSalesmanProfileId must use admin_reassign_shop_salesman (H2).
      ...(input.deliveryAddressLine !== undefined
        ? { delivery_address_line: input.deliveryAddressLine }
        : {}),
      ...(input.deliveryCity !== undefined
        ? { delivery_city: input.deliveryCity }
        : {}),
      ...(input.deliveryState !== undefined
        ? { delivery_state: input.deliveryState }
        : {}),
      ...(input.deliveryPinCode !== undefined
        ? { delivery_pin_code: input.deliveryPinCode }
        : {}),
      ...(input.deliveryLat !== undefined
        ? { delivery_lat: input.deliveryLat }
        : {}),
      ...(input.deliveryLng !== undefined
        ? { delivery_lng: input.deliveryLng }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });

  return {
    ...base,
    async create(input: CustomerCreateInput, options?: ListOptions) {
      const shop = await base.create(input, options);
      try {
        await insertCustomerRelatedRows(client, shop.id, input);
        return shop;
      } catch (error) {
        await base.softDelete(shop.id).catch(() => undefined);
        throw error;
      }
    },
    async update(id: string, input: CustomerUpdateInput, options?: ListOptions) {
      if (input.assignedSalesmanProfileId !== undefined) {
        throw createDataError(
          'forbidden',
          'Reassign salesman via admin_reassign_shop_salesman (not customer update)',
        );
      }
      return base.update(id, input, options);
    },
  };
}

async function insertCustomerRelatedRows(
  client: GroAurumSupabaseClient,
  shopId: string,
  input: CustomerCreateInput,
): Promise<void> {
  const contact = await client.from('shop_contacts').insert({
    shop_id: shopId,
    name: input.ownerName,
    mobile: input.ownerMobile,
    email: input.ownerEmail ?? null,
    is_primary: true,
  });
  if (contact.error) {
    throw createDataError(
      'unexpected',
      contact.error.message || 'Failed to create customer contact',
      contact.error,
    );
  }

  const assignment = await client.from('shop_salesman_assignments').insert({
    shop_id: shopId,
    salesman_profile_id: input.assignedSalesmanProfileId,
    reason: 'Created by Admin ERP',
  });
  if (assignment.error) {
    throw createDataError(
      'unexpected',
      assignment.error.message || 'Failed to assign salesman',
      assignment.error,
    );
  }

  const address = await client.from('customer_addresses').insert({
    shop_id: shopId,
    label: 'Delivery',
    address_line: input.deliveryAddressLine,
    city: input.deliveryCity,
    state: input.deliveryState,
    pin_code: input.deliveryPinCode,
    lat: input.deliveryLat ?? null,
    lng: input.deliveryLng ?? null,
    is_default: true,
  });
  if (address.error) {
    throw createDataError(
      'unexpected',
      address.error.message || 'Failed to create customer address',
      address.error,
    );
  }
}

export function createInventoryRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
  realtimeBus?: RealtimeBus,
): CrudRepository<
  InventoryBalance,
  InventoryBalance,
  InventoryAdjustInput,
  InventoryAdjustInput
> {
  const realtime = realtimeBus ?? createNoopRealtimeBus();
  const mem = cache ?? new MemoryCache();

  return {
    async list(options?: ListOptions) {
      if (options?.signal?.aborted) {
        throw createDataError('timeout', 'Request aborted');
      }
      const cacheKey = 'inventory:list';
      const cached = mem.get<readonly InventoryBalance[]>(cacheKey);
      if (cached) return cached;
      const { data, error } = await client.from('inventory_balances').select('*');
      if (error) throw createDataError('unexpected', error.message, error);
      const rows = ((data ?? []) as InventoryRow[]).map(mapInventory);
      mem.set(cacheKey, rows);
      return rows;
    },
    async getById(id: string) {
      const { data, error } = await client
        .from('inventory_balances')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw createDataError('unexpected', error.message, error);
      return data ? mapInventory(data as InventoryRow) : null;
    },
    async search(query: string) {
      const all = await this.list();
      const q = query.trim().toLowerCase();
      if (!q) return all;
      return all.filter((row) => row.skuId.toLowerCase().includes(q));
    },
    async create(input: InventoryAdjustInput) {
      const { data, error } = await client
        .from('inventory_balances')
        .insert({
          sku_id: input.skuId,
          operational_location_id: input.operationalLocationId,
          on_hand_quantity: input.onHandQuantity,
          reserved_quantity: 0,
        })
        .select('*')
        .single();
      if (error) throw createDataError('unexpected', error.message, error);
      await client.from('inventory_movements').insert({
        sku_id: input.skuId,
        operational_location_id: input.operationalLocationId,
        movement_type: 'RECEIPT',
        quantity_delta: input.onHandQuantity,
        reason: input.reason ?? 'Initial balance',
      });
      mem.invalidate('inventory:');
      return mapInventory(data as InventoryRow);
    },
    async update(id: string, input: InventoryAdjustInput) {
      const existing = await this.getById(id);
      if (!existing) {
        throw createDataError('not_found', `Inventory balance ${id} not found`);
      }

      if (
        input.skuId !== existing.skuId ||
        input.operationalLocationId !== existing.operationalLocationId
      ) {
        throw createDataError(
          'unexpected',
          'Adjustment SKU/location must match the selected inventory balance',
        );
      }

      const plan = planInventoryAdjustment({
        currentOnHand: existing.onHandQuantity,
        reservedQuantity: existing.reservedQuantity,
        newOnHandQuantity: input.onHandQuantity,
      });
      if (!plan.ok) {
        throw createDataError('unexpected', plan.error);
      }

      const rpcClient = client as RpcClient;
      const { data, error } = await rpcClient.rpc(
        'admin_adjust_inventory_balance',
        {
          p_balance_id: id,
          p_new_on_hand_quantity: input.onHandQuantity,
          p_reason: input.reason ?? 'Admin adjustment',
          p_actor_profile_id: input.actorProfileId ?? null,
        },
      );
      if (error) {
        throw createDataError('unexpected', error.message, error);
      }
      if (!data) {
        throw createDataError(
          'unexpected',
          'Inventory adjustment RPC returned no balance row',
        );
      }

      mem.invalidate('inventory:');
      return mapInventory(data as InventoryRow);
    },
    async softDelete() {
      throw createDataError(
        'unexpected',
        'Inventory balances are not soft-deleted; adjust quantity to zero instead.',
      );
    },
    subscribe(listener) {
      return realtime.subscribe('inventory', (event) => {
        mem.invalidate('inventory:');
        listener({
          type: event.type === 'INVALIDATE' ? 'INVALIDATE' : event.type,
          entity: 'inventory',
          id: event.id,
          at: event.at,
        });
      });
    },
  };
}

export function createSalesmenRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<
  StaffProfile,
  StaffProfile,
  SalesmanCreateInput,
  Partial<SalesmanCreateInput>
> {
  const base = createSupabaseCrudRepository<
    ProfileRow,
    StaffProfile,
    StaffProfile,
    SalesmanCreateInput,
    Partial<SalesmanCreateInput>
  >({
    client,
    entity: 'salesmen',
    table: 'profiles',
    cache,
    mapList: mapProfile,
    mapDetail: mapProfile,
    searchColumns: ['display_name', 'mobile'],
    toInsert: (input) => ({
      id: input.authUserId,
      display_name: input.displayName,
      mobile: input.mobile,
      roles: ['SALESMAN'],
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.displayName !== undefined
        ? { display_name: input.displayName }
        : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });

  return {
    ...base,
    async list(options) {
      const all = await base.list(options);
      return all.filter((p) => p.roles.includes('SALESMAN'));
    },
    async search(query, options) {
      const rows = await base.search(query, options);
      return rows.filter((p) => p.roles.includes('SALESMAN'));
    },
  };
}

export function createDeliveryRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
  realtimeBus?: RealtimeBus,
): CrudRepository<
  DeliveryRoute,
  DeliveryRoute,
  DeliveryRouteCreateInput,
  DeliveryRouteUpdateInput
> {
  return createSupabaseCrudRepository({
    client,
    entity: 'delivery',
    table: 'delivery_routes',
    cache,
    realtime: realtimeBus,
    mapList: mapRoute,
    mapDetail: mapRoute,
    searchColumns: ['status'],
    toInsert: (input) => ({
      service_area_id: input.serviceAreaId,
      route_date: input.routeDate,
      assigned_delivery_profile_id: input.assignedDeliveryProfileId ?? null,
      status: input.status ?? 'DRAFT',
    }),
    toUpdate: (input) => ({
      ...(input.serviceAreaId !== undefined
        ? { service_area_id: input.serviceAreaId }
        : {}),
      ...(input.routeDate !== undefined ? { route_date: input.routeDate } : {}),
      ...(input.assignedDeliveryProfileId !== undefined
        ? { assigned_delivery_profile_id: input.assignedDeliveryProfileId }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    }),
    deactivateOnSoftDelete: false,
  });
}

export function createSettingsRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<
  SettingRecord,
  SettingRecord,
  SettingUpsertInput,
  SettingUpsertInput
> {
  return createSupabaseCrudRepository({
    client,
    entity: 'settings',
    table: 'settings',
    cache,
    mapList: mapSetting,
    mapDetail: mapSetting,
    searchColumns: ['setting_key', 'description'],
    toInsert: (input) => ({
      setting_key: input.settingKey,
      setting_value: input.settingValue,
      description: input.description ?? null,
      updated_by_profile_id: input.updatedByProfileId ?? null,
    }),
    toUpdate: (input) => ({
      ...(input.settingKey !== undefined
        ? { setting_key: input.settingKey }
        : {}),
      ...(input.settingValue !== undefined
        ? { setting_value: input.settingValue }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.updatedByProfileId !== undefined
        ? { updated_by_profile_id: input.updatedByProfileId }
        : {}),
    }),
    deactivateOnSoftDelete: false,
  });
}

/**
 * Orders: create inserts header + lines. update/softDelete limited (cancel via status).
 */
export function createOrdersRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
  realtimeBus?: RealtimeBus,
): CrudRepository<Order, Order, OrderCreateInput, { status?: Order['status'] }> {
  const mem = cache ?? new MemoryCache();
  const realtime = realtimeBus ?? createNoopRealtimeBus();

  return {
    async list() {
      const cacheKey = 'orders:list';
      const cached = mem.get<readonly Order[]>(cacheKey);
      if (cached) return cached;
      const { data, error } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw createDataError('unexpected', error.message, error);
      const rows = ((data ?? []) as OrderRow[]).map((row) => mapOrder(row));
      mem.set(cacheKey, rows);
      return rows;
    },
    async getById(id: string) {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw createDataError('unexpected', error.message, error);
      if (!data) return null;
      const { data: lineRows, error: lineError } = await client
        .from('order_lines')
        .select('*')
        .eq('order_id', id);
      if (lineError) {
        throw createDataError('unexpected', lineError.message, lineError);
      }
      const lines = ((lineRows ?? []) as Array<{
        id: string;
        order_id: string;
        sku_id: string;
        product_name_snapshot: string;
        sku_name_snapshot: string;
        sku_code_snapshot: string;
        specification_snapshot: string | null;
        selling_unit_snapshot: string;
        quantity: number;
        agreed_unit_price: number;
        line_total: number;
      }>).map((line) => ({
        id: line.id,
        orderId: line.order_id,
        skuId: line.sku_id,
        productNameSnapshot: line.product_name_snapshot,
        skuNameSnapshot: line.sku_name_snapshot,
        skuCodeSnapshot: line.sku_code_snapshot,
        specificationSnapshot: line.specification_snapshot ?? undefined,
        sellingUnitSnapshot:
          line.selling_unit_snapshot as Order['lines'][number]['sellingUnitSnapshot'],
        quantity: Number(line.quantity),
        agreedUnitPrice: Number(line.agreed_unit_price),
        lineTotal: Number(line.line_total),
      }));
      return mapOrder(data as OrderRow, lines);
    },
    async search(query: string) {
      const all = await this.list();
      const q = query.trim().toLowerCase();
      if (!q) return all;
      return all.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.shopId.toLowerCase().includes(q) ||
          o.status.toLowerCase().includes(q),
      );
    },
    async create(input: OrderCreateInput) {
      const { data, error } = await client.rpc('place_assisted_order', {
        p_shop_id: input.shopId,
        p_service_area_id: input.serviceAreaId,
        p_lines: input.lines.map((line) => ({
          skuId: line.skuId,
          quantity: line.quantity,
          agreedUnitPrice: line.agreedUnitPrice,
        })),
        p_notes: `Assisted order · attributed salesman ${input.createdByProfileId}`,
      });
      if (error) throw createDataError('unexpected', error.message, error);
      const orderId = data as string;
      mem.invalidate('orders:');
      const created = await this.getById(orderId);
      if (!created) {
        throw createDataError(
          'not_found',
          `Order ${orderId} not found after place_assisted_order`,
        );
      }
      return created;
    },
    async update(id: string, input: { status?: Order['status'] }) {
      if (!input.status) {
        throw createDataError('unexpected', 'Order update requires status');
      }
      const { error } = await client.rpc('update_order_status_admin', {
        p_order_id: id,
        p_to_status: input.status,
        p_note: null,
      });
      if (error) throw createDataError('unexpected', error.message, error);
      mem.invalidate('orders:');
      const updated = await this.getById(id);
      if (!updated) {
        throw createDataError('not_found', `Order ${id} not found after status update`);
      }
      return updated;
    },
    async softDelete(id: string) {
      const { error } = await client.rpc('admin_cancel_order', {
        p_order_id: id,
        p_note: 'Order cancelled',
      });
      if (error) throw createDataError('unexpected', error.message, error);
      mem.invalidate('orders:');
    },
    subscribe(listener) {
      return realtime.subscribe('orders', (event) => {
        mem.invalidate('orders:');
        listener({
          type: event.type === 'INVALIDATE' ? 'INVALIDATE' : event.type,
          entity: 'orders',
          id: event.id,
          at: event.at,
        });
      });
    },
  };
}
