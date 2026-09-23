import type { Category, Product, Sku, SkuPrice } from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import type { CrudRepository } from '@groaurum/data';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
  SkuCreateInput,
  SkuUpdateInput,
  PriceCreateInput,
} from '@groaurum/validation';
import { createDataError } from '@groaurum/data';
import { MemoryCache } from '../../cache/memory-cache';
import { createSupabaseCrudRepository } from './create-supabase-crud-repository';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  product_type: string;
  image_urls: string[];
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type SkuRow = {
  id: string;
  product_id: string;
  sku_code: string;
  name: string;
  specification: string | null;
  grade: string | null;
  product_type: string;
  selling_unit: string;
  net_quantity: number | null;
  net_quantity_unit: string | null;
  packs_per_carton: number | null;
  outer_type: string | null;
  pack_discount_type?: string | null;
  pack_discount_value?: number | null;
  container_price_mode?: string | null;
  container_custom_price?: number | null;
  container_discount_type?: string | null;
  container_discount_value?: number | null;
  moq: number;
  quantity_step: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PriceRow = {
  id: string;
  sku_id: string;
  trade_price: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  recorded_by_profile_id: string | null;
  created_at: string;
};

type RpcClient = GroAurumSupabaseClient & {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function mapCategory(row: CategoryRow): Category {
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

function mapProduct(row: ProductRow): Product {
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

function mapSku(row: SkuRow): Sku {
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
    outerType: row.outer_type ?? undefined,
    packDiscountType: (row.pack_discount_type ?? 'none') as Sku['packDiscountType'],
    packDiscountValue: Number(row.pack_discount_value ?? 0),
    containerPriceMode: (row.container_price_mode ?? 'calculated') as Sku['containerPriceMode'],
    containerCustomPrice:
      row.container_custom_price != null
        ? Number(row.container_custom_price)
        : undefined,
    containerDiscountType: (row.container_discount_type ?? 'none') as Sku['containerDiscountType'],
    containerDiscountValue: Number(row.container_discount_value ?? 0),
    moq: Number(row.moq),
    quantityStep: Number(row.quantity_step),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrice(row: PriceRow): SkuPrice {
  return {
    id: row.id,
    skuId: row.sku_id,
    tradePrice: Number(row.trade_price),
    currency: row.currency,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
    createdAt: row.created_at,
  };
}

export function createCategoriesRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<Category, Category, CategoryCreateInput, CategoryUpdateInput> & {
  ensureByName(name: string, isActive?: boolean): Promise<Category>;
} {
  const base = createSupabaseCrudRepository<
    CategoryRow,
    Category,
    Category,
    CategoryCreateInput,
    CategoryUpdateInput
  >({
    client,
    entity: 'categories',
    table: 'categories',
    cache,
    mapList: mapCategory,
    mapDetail: mapCategory,
    searchColumns: ['name'],
    toInsert: (input) => ({
      name: input.name,
      description: input.description ?? null,
      display_order: input.displayOrder ?? 0,
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.displayOrder !== undefined
        ? { display_order: input.displayOrder }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });

  const rpcClient = client as RpcClient;

  return {
    ...base,
    async create(input) {
      return this.ensureByName(input.name, input.isActive ?? true);
    },
    async ensureByName(name, isActive = true) {
      const trimmed = name.trim();
      if (!trimmed) {
        throw createDataError('unexpected', 'Category name is required');
      }
      const { data: id, error } = await rpcClient.rpc('admin_ensure_category', {
        p_name: trimmed,
        p_is_active: isActive,
      });
      if (error) {
        throw createDataError('unexpected', error.message, error);
      }
      const category = await base.getById(String(id));
      if (!category) {
        throw createDataError('unexpected', 'Category could not be loaded after ensure');
      }
      return category;
    },
  };
}

async function findDuplicateProductInCategory(
  client: GroAurumSupabaseClient,
  categoryId: string,
  name: string,
  excludeProductId?: string,
): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  let query = client
    .from('products')
    .select('id, name')
    .eq('category_id', categoryId)
    .is('deleted_at', null);
  if (excludeProductId) {
    query = query.neq('id', excludeProductId);
  }
  const { data, error } = await query;
  if (error) return null;

  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    if (row.name.trim().toLowerCase() === normalized) {
      return row.id;
    }
  }
  return null;
}

export function createProductsRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<Product, Product, ProductCreateInput, ProductUpdateInput> {
  const base = createSupabaseCrudRepository<
    ProductRow,
    Product,
    Product,
    ProductCreateInput,
    ProductUpdateInput
  >({
    client,
    entity: 'products',
    table: 'products',
    cache,
    mapList: mapProduct,
    mapDetail: mapProduct,
    searchColumns: ['name', 'product_type'],
    toInsert: (input) => ({
      category_id: input.categoryId,
      name: input.name.trim(),
      description: input.description ?? null,
      product_type: input.productType,
      image_urls: input.imageUrls ?? [],
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.productType !== undefined
        ? { product_type: input.productType }
        : {}),
      ...(input.imageUrls !== undefined ? { image_urls: input.imageUrls } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });

  return {
    ...base,
    async create(input) {
      const duplicateId = await findDuplicateProductInCategory(
        client,
        input.categoryId,
        input.name,
      );
      if (duplicateId) {
        throw createDataError(
          'unexpected',
          'A product with this name already exists in the selected category',
        );
      }
      return base.create(input);
    },
    async update(id, input) {
      if (input.name !== undefined || input.categoryId !== undefined) {
        const existing = await base.getById(id);
        if (existing) {
          const categoryId = input.categoryId ?? existing.categoryId;
          const name = input.name ?? existing.name;
          const duplicateId = await findDuplicateProductInCategory(
            client,
            categoryId,
            name,
            id,
          );
          if (duplicateId) {
            throw createDataError(
              'unexpected',
              'A product with this name already exists in the selected category',
            );
          }
        }
      }
      return base.update(id, input);
    },
  };
}

export function createSkusRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<Sku, Sku, SkuCreateInput, SkuUpdateInput> {
  return createSupabaseCrudRepository({
    client,
    entity: 'skus',
    table: 'skus',
    cache,
    mapList: mapSku,
    mapDetail: mapSku,
    searchColumns: ['sku_code', 'name'],
    toInsert: (input) => ({
      product_id: input.productId,
      sku_code: input.skuCode,
      name: input.name,
      specification: input.specification ?? null,
      grade: input.grade ?? null,
      product_type: input.productType,
      selling_unit: input.sellingUnit,
      net_quantity: input.netQuantity ?? null,
      net_quantity_unit: input.netQuantityUnit ?? null,
      packs_per_carton: input.packsPerCarton ?? null,
      outer_type: input.outerType ?? null,
      pack_discount_type: input.packDiscountType ?? 'none',
      pack_discount_value: input.packDiscountValue ?? 0,
      container_price_mode: input.containerPriceMode ?? 'calculated',
      container_custom_price: input.containerCustomPrice ?? null,
      container_discount_type: input.containerDiscountType ?? 'none',
      container_discount_value: input.containerDiscountValue ?? 0,
      moq: input.moq ?? 1,
      quantity_step: input.quantityStep ?? 1,
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.skuCode !== undefined ? { sku_code: input.skuCode } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.specification !== undefined
        ? { specification: input.specification }
        : {}),
      ...(input.grade !== undefined ? { grade: input.grade } : {}),
      ...(input.productType !== undefined
        ? { product_type: input.productType }
        : {}),
      ...(input.sellingUnit !== undefined
        ? { selling_unit: input.sellingUnit }
        : {}),
      ...(input.netQuantity !== undefined
        ? { net_quantity: input.netQuantity }
        : {}),
      ...(input.netQuantityUnit !== undefined
        ? { net_quantity_unit: input.netQuantityUnit }
        : {}),
      ...(input.packsPerCarton !== undefined
        ? { packs_per_carton: input.packsPerCarton }
        : {}),
      ...(input.outerType !== undefined
        ? { outer_type: input.outerType }
        : {}),
      ...(input.packDiscountType !== undefined
        ? { pack_discount_type: input.packDiscountType }
        : {}),
      ...(input.packDiscountValue !== undefined
        ? { pack_discount_value: input.packDiscountValue }
        : {}),
      ...(input.containerPriceMode !== undefined
        ? { container_price_mode: input.containerPriceMode }
        : {}),
      ...(input.containerCustomPrice !== undefined
        ? { container_custom_price: input.containerCustomPrice }
        : {}),
      ...(input.containerDiscountType !== undefined
        ? { container_discount_type: input.containerDiscountType }
        : {}),
      ...(input.containerDiscountValue !== undefined
        ? { container_discount_value: input.containerDiscountValue }
        : {}),
      ...(input.moq !== undefined ? { moq: input.moq } : {}),
      ...(input.quantityStep !== undefined
        ? { quantity_step: input.quantityStep }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });
}

/**
 * Pricing is append-only: trusted RPCs close the prior open row by effective_to
 * and insert the replacement row without mutating commercial history.
 * Admin ERP uses admin_set_sku_price (effective now) — never direct UPDATE of trade_price.
 */
export function createPricesRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<SkuPrice, SkuPrice, PriceCreateInput, Partial<PriceCreateInput>> {
  const base = createSupabaseCrudRepository<
    PriceRow,
    SkuPrice,
    SkuPrice,
    PriceCreateInput,
    Partial<PriceCreateInput>
  >({
    client,
    entity: 'prices',
    table: 'sku_prices',
    cache,
    softDelete: false,
    mapList: mapPrice,
    mapDetail: mapPrice,
    searchColumns: ['currency'],
    toInsert: (input) => ({
      sku_id: input.skuId,
      trade_price: input.tradePrice,
      currency: input.currency ?? 'INR',
      effective_from: new Date().toISOString(),
      recorded_by_profile_id: input.recordedByProfileId ?? null,
    }),
    toUpdate: () => ({}),
  });

  return {
    ...base,
    async create(input) {
      const rpcClient = client as RpcClient;
      const { data, error } = await rpcClient.rpc('admin_set_sku_price', {
        p_sku_id: input.skuId,
        p_trade_price: input.tradePrice,
        p_currency: input.currency ?? 'INR',
        p_recorded_by_profile_id: input.recordedByProfileId ?? null,
      });
      if (error) {
        throw error;
      }
      cache?.invalidate('prices:');
      return mapPrice(data as PriceRow);
    },
    async softDelete(id: string) {
      const rpcClient = client as RpcClient;
      const { error } = await rpcClient.rpc('admin_close_sku_price', {
        p_price_id: id,
        p_effective_to: new Date().toISOString(),
      });
      if (error) {
        throw error;
      }
      cache?.invalidate('prices:');
    },
    async update() {
      throw new Error(
        'sku_prices rows are append-only. Use create() (admin_set_sku_price) to set/update price.',
      );
    },
  };
}
