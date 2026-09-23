import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  deliveryRouteCreateSchema,
  deliveryRouteUpdateSchema,
  inventoryAdjustSchema,
  orderCreateSchema,
  priceCreateSchema,
  productCreateSchema,
  productUpdateSchema,
  salesmanCreateSchema,
  serviceAreaCreateSchema,
  serviceAreaUpdateSchema,
  serviceabilityRuleCreateSchema,
  serviceabilityRuleUpdateSchema,
  COMPANY_SETTING_KEY,
  parseCompanySettingsWriteValue,
  settingUpsertSchema,
  skuCreateSchema,
  skuUpdateSchema,
  warehouseCreateSchema,
  warehouseUpdateSchema,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type CustomerCreateInput,
  type CustomerUpdateInput,
  type DeliveryRouteCreateInput,
  type DeliveryRouteUpdateInput,
  type InventoryAdjustInput,
  type OrderCreateInput,
  type PriceCreateInput,
  type ProductCreateInput,
  type ProductUpdateInput,
  type SalesmanCreateInput,
  type ServiceAreaCreateInput,
  type ServiceAreaUpdateInput,
  type ServiceabilityRuleCreateInput,
  type ServiceabilityRuleUpdateInput,
  type SettingUpsertInput,
  type SkuCreateInput,
  type SkuUpdateInput,
  type WarehouseCreateInput,
  type WarehouseUpdateInput,
} from '@groaurum/validation';
import type { Order } from '@groaurum/shared-types';
import { serviceAreaAcceptsPin } from '@groaurum/api-client';
import type { MemoryCache } from '../cache/memory-cache';
import { createDataError, invalidation, type EntityName } from '@groaurum/data';

/**
 * CRUD service layer — validates with Zod, then delegates to repositories.
 */
export class CrudServices {
  constructor(
    private readonly repos: DomainCrudRepositories,
    private readonly cache?: MemoryCache,
  ) {}

  private invalidate(entity: EntityName) {
    this.cache?.invalidate(`${entity}:`);
    return invalidation.entity(entity);
  }

  // --- Products ---
  createProduct(input: ProductCreateInput) {
    const parsed = productCreateSchema.parse(input);
    return this.repos.products.create(parsed).then((row) => {
      this.invalidate('products');
      return row;
    });
  }

  updateProduct(id: string, input: ProductUpdateInput) {
    const parsed = productUpdateSchema.parse(input);
    return this.repos.products.update(id, parsed).then((row) => {
      this.invalidate('products');
      return row;
    });
  }

  softDeleteProduct(id: string) {
    return this.repos.products.softDelete(id).then(() => {
      this.invalidate('products');
    });
  }

  // --- Categories ---
  createCategory(input: CategoryCreateInput) {
    const parsed = categoryCreateSchema.parse(input);
    return this.repos.categories.create(parsed).then((row) => {
      this.invalidate('categories');
      return row;
    });
  }

  ensureCategory(name: string, isActive = true) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw createDataError('unexpected', 'Category name is required');
    }
    return this.repos.categories.ensureByName(trimmed, isActive).then((row) => {
      this.invalidate('categories');
      return row;
    });
  }

  updateCategory(id: string, input: CategoryUpdateInput) {
    const parsed = categoryUpdateSchema.parse(input);
    return this.repos.categories.update(id, parsed).then((row) => {
      this.invalidate('categories');
      return row;
    });
  }

  softDeleteCategory(id: string) {
    return this.repos.categories.softDelete(id).then(() => {
      this.invalidate('categories');
    });
  }

  // --- SKUs ---
  createSku(input: SkuCreateInput) {
    const parsed = skuCreateSchema.parse(input);
    return this.repos.skus.create(parsed).then((row) => {
      this.invalidate('skus');
      this.invalidate('products');
      return row;
    });
  }

  updateSku(id: string, input: SkuUpdateInput) {
    const parsed = skuUpdateSchema.parse(input);
    return this.repos.skus.update(id, parsed).then((row) => {
      this.invalidate('skus');
      this.invalidate('products');
      return row;
    });
  }

  softDeleteSku(id: string) {
    return this.repos.skus.softDelete(id).then(() => {
      this.invalidate('skus');
      this.invalidate('products');
    });
  }

  // --- Inventory ---
  adjustInventory(input: InventoryAdjustInput) {
    const parsed = inventoryAdjustSchema.parse(input);
    return this.repos.inventory.create(parsed).then((row) => {
      this.invalidate('inventory');
      return row;
    });
  }

  updateInventoryBalance(id: string, input: InventoryAdjustInput) {
    const parsed = inventoryAdjustSchema.parse(input);
    return this.repos.inventory.update(id, parsed).then((row) => {
      this.invalidate('inventory');
      return row;
    });
  }

  // --- Pricing ---
  createPrice(input: PriceCreateInput) {
    const parsed = priceCreateSchema.parse(input);
    return this.repos.prices.create(parsed).then((row) => {
      this.invalidate('prices');
      return row;
    });
  }

  closePrice(id: string) {
    return this.repos.prices.softDelete(id).then(() => {
      this.invalidate('prices');
    });
  }

  // --- Customers ---
  async createCustomer(input: CustomerCreateInput) {
    const parsed = customerCreateSchema.parse(input);
    const [areas, rules] = await Promise.all([
      this.repos.serviceAreas.list(),
      this.repos.serviceabilityRules.list(),
    ]);
    if (
      !serviceAreaAcceptsPin(
        parsed.serviceAreaId,
        parsed.deliveryPinCode,
        [...areas],
        [...rules],
      )
    ) {
      throw createDataError(
        'unexpected',
        'PIN code is not serviceable in the selected service area.',
      );
    }
    return this.repos.customers.create(parsed).then((row) => {
      this.invalidate('customers');
      return row;
    });
  }

  updateCustomer(id: string, input: CustomerUpdateInput) {
    const parsed = customerUpdateSchema.parse(input);
    return this.repos.customers.update(id, parsed).then((row) => {
      this.invalidate('customers');
      return row;
    });
  }

  softDeleteCustomer(id: string) {
    return this.repos.customers.softDelete(id).then(() => {
      this.invalidate('customers');
    });
  }

  // --- Orders ---
  createOrder(input: OrderCreateInput) {
    const parsed = orderCreateSchema.parse(input);
    return this.repos.orders.create(parsed).then((row) => {
      this.invalidate('orders');
      return row;
    });
  }

  updateOrderStatus(id: string, status: Order['status']) {
    return this.repos.orders.update(id, { status }).then((row) => {
      this.invalidate('orders');
      return row;
    });
  }

  cancelOrder(id: string) {
    return this.repos.orders.softDelete(id).then(() => {
      this.invalidate('orders');
    });
  }

  // --- Salesmen ---
  createSalesman(input: SalesmanCreateInput) {
    const parsed = salesmanCreateSchema.parse(input);
    return this.repos.salesmen.create(parsed).then((row) => {
      this.invalidate('salesmen');
      return row;
    });
  }

  // --- Delivery ---
  createDeliveryRoute(input: DeliveryRouteCreateInput) {
    const parsed = deliveryRouteCreateSchema.parse(input);
    return this.repos.delivery.create(parsed).then((row) => {
      this.invalidate('delivery');
      return row;
    });
  }

  updateDeliveryRoute(id: string, input: DeliveryRouteUpdateInput) {
    const parsed = deliveryRouteUpdateSchema.parse(input);
    return this.repos.delivery.update(id, parsed).then((row) => {
      this.invalidate('delivery');
      return row;
    });
  }

  softDeleteDeliveryRoute(id: string) {
    return this.repos.delivery.softDelete(id).then(() => {
      this.invalidate('delivery');
    });
  }

  // --- Settings ---
  upsertSetting(input: SettingUpsertInput) {
    const parsed = settingUpsertSchema.parse(input);
    const settingKey = parsed.settingKey.trim();
    const settingValue =
      settingKey.toLowerCase() === COMPANY_SETTING_KEY
        ? parseCompanySettingsWriteValue(parsed.settingValue)
        : parsed.settingValue;

    const payload: SettingUpsertInput = {
      settingKey,
      settingValue,
      description: parsed.description,
      updatedByProfileId: parsed.updatedByProfileId,
    };

    return this.repos.settings.list().then((rows) => {
      const existing = rows.find(
        (row) =>
          row.settingKey.trim().toLowerCase() === settingKey.toLowerCase(),
      );
      if (existing) {
        return this.repos.settings.update(existing.id, payload);
      }
      return this.repos.settings.create(payload);
    }).then((row) => {
      this.invalidate('settings');
      return row;
    });
  }

  updateSetting(id: string, input: SettingUpsertInput) {
    const parsed = settingUpsertSchema.parse(input);
    const settingKey = parsed.settingKey.trim();
    const settingValue =
      settingKey.toLowerCase() === COMPANY_SETTING_KEY
        ? parseCompanySettingsWriteValue(parsed.settingValue)
        : parsed.settingValue;
    return this.repos.settings
      .update(id, {
        settingKey,
        settingValue,
        description: parsed.description,
        updatedByProfileId: parsed.updatedByProfileId,
      })
      .then((row) => {
        this.invalidate('settings');
        return row;
      });
  }

  // --- Service areas ---
  listServiceAreas() {
    return this.repos.serviceAreas.list();
  }

  createServiceArea(input: ServiceAreaCreateInput) {
    const parsed = serviceAreaCreateSchema.parse(input);
    return this.repos.serviceAreas.create(parsed).then((row) => {
      this.invalidate('service_areas');
      this.invalidate('settings');
      return row;
    });
  }

  updateServiceArea(id: string, input: ServiceAreaUpdateInput) {
    const parsed = serviceAreaUpdateSchema.parse(input);
    return this.repos.serviceAreas.update(id, parsed).then((row) => {
      this.invalidate('service_areas');
      this.invalidate('settings');
      return row;
    });
  }

  // --- Serviceability rules ---
  listServiceabilityRules() {
    return this.repos.serviceabilityRules.list();
  }

  createServiceabilityRule(input: ServiceabilityRuleCreateInput) {
    const parsed = serviceabilityRuleCreateSchema.parse(input);
    return this.repos.serviceabilityRules.create(parsed).then((row) => {
      this.invalidate('serviceability_rules');
      this.invalidate('service_areas');
      this.invalidate('settings');
      return row;
    });
  }

  updateServiceabilityRule(id: string, input: ServiceabilityRuleUpdateInput) {
    const parsed = serviceabilityRuleUpdateSchema.parse(input);
    return this.repos.serviceabilityRules.update(id, parsed).then((row) => {
      this.invalidate('serviceability_rules');
      this.invalidate('service_areas');
      this.invalidate('settings');
      return row;
    });
  }

  // --- Warehouses (operational locations) ---
  listWarehouses() {
    return this.repos.operationalLocations.list();
  }

  createWarehouse(input: WarehouseCreateInput) {
    const parsed = warehouseCreateSchema.parse(input);
    return this.repos.operationalLocations.create(parsed).then((row) => {
      this.invalidate('operational_locations');
      this.invalidate('settings');
      this.invalidate('inventory');
      return row;
    });
  }

  updateWarehouse(id: string, input: WarehouseUpdateInput) {
    const parsed = warehouseUpdateSchema.parse(input);
    return this.repos.operationalLocations.update(id, parsed).then((row) => {
      this.invalidate('operational_locations');
      this.invalidate('settings');
      this.invalidate('inventory');
      return row;
    });
  }
}

export function createCrudServices(
  repos: DomainCrudRepositories,
  cache?: MemoryCache,
): CrudServices {
  return new CrudServices(repos, cache);
}
