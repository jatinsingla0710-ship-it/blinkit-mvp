import type {
  Category,
  Product,
  ServiceArea,
  ServiceabilityRule,
  ServiceabilityRuleConfig,
  Shop,
  ShopAuthLink,
  ShopContact,
  Sku,
  StaffProfile,
  StaffRole,
} from '@groaurum/shared-types';
import type { Tables } from '../../database.types';

type CategoryRow = Tables<'categories'>;
type ProductRow = Tables<'products'>;
type SkuRow = Tables<'skus'>;
type ShopRow = Tables<'shops'>;
type ShopContactRow = Tables<'shop_contacts'>;
type ShopAuthLinkRow = Tables<'shop_auth_links'>;
type ServiceAreaRow = Tables<'service_areas'>;
type ServiceabilityRuleRow = Tables<'serviceability_rules'>;
type ProfileRow = Tables<'profiles'>;

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description ?? undefined,
    productType: row.product_type as Product['productType'],
    imageUrls: row.image_urls ?? [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSku(row: SkuRow): Sku | null {
  try {
    const extended = row as SkuRow & {
      outer_type?: string | null;
      pack_discount_type?: string | null;
      pack_discount_value?: number | null;
      container_price_mode?: string | null;
      container_custom_price?: number | null;
      container_discount_type?: string | null;
      container_discount_value?: number | null;
    };
    return {
      id: row.id,
      productId: row.product_id,
      skuCode: row.sku_code,
      name: row.name,
      specification: row.specification ?? undefined,
      grade: row.grade ?? undefined,
      productType: row.product_type as Sku['productType'],
      sellingUnit: row.selling_unit as Sku['sellingUnit'],
      netQuantity: row.net_quantity != null ? Number(row.net_quantity) : undefined,
      netQuantityUnit: row.net_quantity_unit ?? undefined,
      packsPerCarton: row.packs_per_carton ?? undefined,
      outerType: extended.outer_type ?? undefined,
      packDiscountType:
        (extended.pack_discount_type as Sku['packDiscountType']) ?? undefined,
      packDiscountValue:
        extended.pack_discount_value != null
          ? Number(extended.pack_discount_value)
          : undefined,
      containerPriceMode:
        (extended.container_price_mode as Sku['containerPriceMode']) ?? undefined,
      containerCustomPrice:
        extended.container_custom_price != null
          ? Number(extended.container_custom_price)
          : null,
      containerDiscountType:
        (extended.container_discount_type as Sku['containerDiscountType']) ??
        undefined,
      containerDiscountValue:
        extended.container_discount_value != null
          ? Number(extended.container_discount_value)
          : undefined,
      moq: Number(row.moq),
      quantityStep: Number(row.quantity_step),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export function mapShop(row: ShopRow): Shop {
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

export function mapShopContact(row: ShopContactRow): ShopContact {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    mobile: row.mobile,
    email: row.email ?? undefined,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapShopAuthLink(row: ShopAuthLinkRow): ShopAuthLink {
  return {
    id: row.id,
    shopId: row.shop_id,
    authUserId: row.auth_user_id,
    linkedAt: row.linked_at,
  };
}

export function mapServiceArea(row: ServiceAreaRow): ServiceArea {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapServiceabilityRule(row: ServiceabilityRuleRow): ServiceabilityRule | null {
  const configJson = row.config as Record<string, unknown>;
  let config: ServiceabilityRuleConfig;

  if (row.rule_type === 'PIN_CODE') {
    const pinCodes = configJson.pinCodes;
    if (!Array.isArray(pinCodes) || pinCodes.length === 0) return null;
    config = {
      ruleType: 'PIN_CODE',
      pinCodes: pinCodes.map(String),
    };
  } else if (row.rule_type === 'ADMIN_AREA') {
    const areaCodes = configJson.areaCodes;
    if (!Array.isArray(areaCodes) || areaCodes.length === 0) return null;
    config = {
      ruleType: 'ADMIN_AREA',
      areaCodes: areaCodes.map(String),
    };
  } else if (row.rule_type === 'POLYGON') {
    const polygonRef = configJson.polygonRef;
    if (typeof polygonRef !== 'string' || !polygonRef.trim()) return null;
    config = { ruleType: 'POLYGON', polygonRef };
  } else {
    return null;
  }

  return {
    id: row.id,
    serviceAreaId: row.service_area_id,
    ruleType: row.rule_type,
    isActive: row.is_active,
    config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    authUserId: row.id,
    displayName: row.display_name,
    mobile: row.mobile,
    roles: row.roles as StaffRole[],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
