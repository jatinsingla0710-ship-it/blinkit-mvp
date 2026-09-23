/**
 * Customer catalogue / category query boundary.
 *
 * Mock mode: legacy MVP mock catalogue (may include demo products).
 * Supabase mode: real catalogue via CatalogueService — empty means empty, never falls back to mock.
 */
import { formatSellingUnitLabel, SELLING_UNITS, type SellingUnit } from '@groaurum/shared-types';
import type { Category as B2BCategory, Product as B2BProduct, Sku } from '@groaurum/shared-types';
import type { Category, Product, SellingUnitUi } from '@/types';
import { getActiveAdapterMode, getSupabaseCustomerServices } from './adapters/factory';
import * as mock from './mock';
import {
  formatAddActionLabel,
  resolveStockStatus,
  withB2bDefaults,
} from '@/utils/product-b2b';

const CATEGORY_FALLBACK_EMOJI = ['◆', '●', '◐', '◑', '○', '▢'] as const;

export type CatalogueLoadError = Error & { code?: 'BACKEND' | 'CONFIG' };

function backendError(message: string): CatalogueLoadError {
  const error = new Error(message) as CatalogueLoadError;
  error.code = 'BACKEND';
  return error;
}

function mapCategoryToLegacy(category: B2BCategory, index: number): Category {
  return {
    id: category.id,
    name: category.name,
    emoji: CATEGORY_FALLBACK_EMOJI[index % CATEGORY_FALLBACK_EMOJI.length],
    color: '#E8F6EE',
  };
}

function mapSellingUnit(unit: Sku['sellingUnit']): SellingUnitUi {
  const raw = String(unit ?? '').trim();
  if (!raw) return 'UNIT';
  const upper = raw.toUpperCase();
  if ((SELLING_UNITS as readonly string[]).includes(upper)) {
    return upper as SellingUnit;
  }
  return raw;
}

function mapSkuToLegacyProduct(
  sku: Sku,
  product: B2BProduct,
  price: number,
  shopId: string,
  available: number,
  priceTiers: Array<{ minQuantity: number; unitPrice: number }> = [],
  outerDiscountTiers: Array<{
    minOuterQuantity: number;
    discountPerOuterUnit: number;
  }> = [],
): Product {
  const sellingUnit = mapSellingUnit(sku.sellingUnit);
  const quantityStep = Number(sku.quantityStep) || 1;
  const moq = Number(sku.moq) || quantityStep;
  return withB2bDefaults({
    id: sku.id,
    storeId: shopId,
    categoryId: product.categoryId,
    name: product.name,
    price,
    mrp: price,
    unit: formatSellingUnitLabel(sku),
    imageEmoji: '📦',
    imageUrl: product.imageUrls[0] || undefined,
    imageUrls: product.imageUrls?.length ? product.imageUrls : undefined,
    stock: available,
    description: sku.specification ?? product.description,
    grade: sku.grade,
    specification: sku.specification,
    packsPerCarton: sku.packsPerCarton,
    outerType: sku.outerType,
    netQuantityUnit: sku.netQuantityUnit,
    packDiscountType: sku.packDiscountType,
    packDiscountValue: sku.packDiscountValue,
    containerPriceMode: sku.containerPriceMode,
    containerCustomPrice: sku.containerCustomPrice,
    containerDiscountType: sku.containerDiscountType,
    containerDiscountValue: sku.containerDiscountValue,
    sellingUnit,
    moq,
    quantityStep,
    priceTiers,
    outerDiscountTiers,
    stockStatus: resolveStockStatus(available),
    addActionLabel: formatAddActionLabel(sellingUnit, quantityStep),
  });
}

async function loadAvailableBySku(
  skuIds: string[],
): Promise<Map<string, number>> {
  const available = new Map<string, number>();
  if (!skuIds.length) return available;

  const services = getSupabaseCustomerServices();
  const client = services?.client;
  if (!client) {
    throw backendError('Supabase customer services are not configured.');
  }

  const { data, error } = await client
    .from('inventory_balances')
    .select('sku_id, available_quantity')
    .in('sku_id', skuIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const skuId = String(row.sku_id);
    const qty = Number(row.available_quantity ?? 0);
    available.set(skuId, (available.get(skuId) ?? 0) + qty);
  }
  return available;
}

export async function fetchCustomerCategories(): Promise<Category[]> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return mock.getCategories();
  }

  const services = getSupabaseCustomerServices();
  if (!services) {
    throw backendError('Supabase customer services are not configured.');
  }

  try {
    const categories = await services.catalogue.getCategories({ activeOnly: true });
    return categories.map(mapCategoryToLegacy);
  } catch (error) {
    throw backendError(
      error instanceof Error ? error.message : 'Failed to load categories from Supabase.',
    );
  }
}

/**
 * Catalogue products for the customer UI.
 * In Supabase mode, `shopId` is the linked shop id (not a dark store).
 * Returns only orderable SKUs (active + current price).
 */
async function loadOuterDiscountTiersBySku(
  skuIds: string[],
): Promise<
  Map<string, Array<{ minOuterQuantity: number; discountPerOuterUnit: number }>>
> {
  const map = new Map<
    string,
    Array<{ minOuterQuantity: number; discountPerOuterUnit: number }>
  >();
  if (!skuIds.length) return map;

  const services = getSupabaseCustomerServices();
  const client = services?.client;
  if (!client) return map;

  const { data, error } = await (
    client as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => {
            is: (col: string, val: null) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };
    }
  )
    .from('sku_outer_discount_tiers')
    .select('sku_id, min_outer_quantity, discount_per_outer_unit')
    .in('sku_id', skuIds)
    .is('effective_to', null)
    .order('min_outer_quantity', { ascending: true });

  if (error) return map;

  for (const row of (data ?? []) as Array<{
    sku_id: string;
    min_outer_quantity: number | string;
    discount_per_outer_unit: number | string;
  }>) {
    const skuId = String(row.sku_id);
    const tiers = map.get(skuId) ?? [];
    tiers.push({
      minOuterQuantity: Number(row.min_outer_quantity),
      discountPerOuterUnit: Number(row.discount_per_outer_unit),
    });
    map.set(skuId, tiers);
  }
  return map;
}

export async function fetchCustomerProducts(shopOrStoreId: string): Promise<Product[]> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return mock.getProductsByStore(shopOrStoreId);
  }

  const services = getSupabaseCustomerServices();
  if (!services) {
    throw backendError('Supabase customer services are not configured.');
  }

  try {
    const products = await services.catalogue.getProducts({ activeOnly: true });
    const priced: Array<{
      sku: Sku;
      product: B2BProduct;
      price: number;
    }> = [];

    for (const product of products) {
      const skus = await services.catalogue.getSkusByProductId(product.id);
      for (const sku of skus) {
        const price = await services.catalogue.getEffectiveSkuPrice(sku.id);
        if (!price) continue;
        priced.push({ sku, product, price: price.tradePrice });
      }
    }

    const availableBySku = await loadAvailableBySku(priced.map((row) => row.sku.id));
    const outerTiersBySku = await loadOuterDiscountTiersBySku(
      priced.map((row) => row.sku.id),
    );
    return priced.map((row) =>
      mapSkuToLegacyProduct(
        row.sku,
        row.product,
        row.price,
        shopOrStoreId,
        availableBySku.get(row.sku.id) ?? 0,
        [],
        outerTiersBySku.get(row.sku.id) ?? [],
      ),
    );
  } catch (error) {
    throw backendError(
      error instanceof Error ? error.message : 'Failed to load catalogue from Supabase.',
    );
  }
}

export async function fetchCustomerBestsellers(shopOrStoreId: string): Promise<Product[]> {
  const products = await fetchCustomerProducts(shopOrStoreId);
  return products.slice(0, 8);
}

export async function fetchCustomerProductsByCategory(
  shopOrStoreId: string,
  categoryId: string,
): Promise<Product[]> {
  const products = await fetchCustomerProducts(shopOrStoreId);
  return products.filter((p) => p.categoryId === categoryId);
}

export async function fetchCustomerProductById(
  shopOrStoreId: string,
  productOrSkuId: string,
): Promise<Product | undefined> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return (await mock.getProductById(productOrSkuId)) ?? undefined;
  }

  const products = await fetchCustomerProducts(shopOrStoreId);
  return products.find((p) => p.id === productOrSkuId);
}

export async function searchCustomerProducts(
  shopOrStoreId: string,
  query: string,
): Promise<Product[]> {
  const mode = getActiveAdapterMode();
  if (mode === 'mock') {
    return mock.searchProducts(shopOrStoreId, query);
  }

  const products = await fetchCustomerProducts(shopOrStoreId);
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      (p.grade?.toLowerCase().includes(q) ?? false) ||
      (p.specification?.toLowerCase().includes(q) ?? false),
  );
}
