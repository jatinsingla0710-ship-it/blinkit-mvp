import type {
  CatalogueQuery,
  CatalogueService,
} from '../../contracts/catalogue';
import type { Category, Product, Sku, SkuPrice } from '@groaurum/shared-types';
import { selectEffectiveSkuPrice } from '../../catalogue/effective-price';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapCategory, mapProduct, mapSku } from './mappers';

async function loadActiveCategoryIds(
  client: GroAurumSupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('categories')
    .select('id')
    .eq('is_active', true);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

async function loadActiveProductIds(
  client: GroAurumSupabaseClient,
  categoryIds?: Set<string>,
): Promise<Set<string>> {
  const query = client.from('products').select('id, category_id').eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  if (!categoryIds) {
    return new Set(rows.map((row) => row.id));
  }
  return new Set(
    rows.filter((row) => categoryIds.has(row.category_id)).map((row) => row.id),
  );
}

export function createSupabaseCatalogueService(
  client: GroAurumSupabaseClient,
): CatalogueService {
  return {
    async getCategories(query?: CatalogueQuery): Promise<Category[]> {
      let q = client.from('categories').select('*').order('display_order', {
        ascending: true,
      });
      if (query?.activeOnly !== false) {
        q = q.eq('is_active', true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapCategory);
    },

    async getCategoryById(categoryId: string): Promise<Category | null> {
      const { data, error } = await client
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCategory(data) : null;
    },

    async getProducts(query?: CatalogueQuery): Promise<Product[]> {
      const activeCategories = await loadActiveCategoryIds(client);
      let q = client.from('products').select('*').order('name', { ascending: true });
      if (query?.activeOnly !== false) {
        q = q.eq('is_active', true);
      }
      if (query?.categoryId) {
        q = q.eq('category_id', query.categoryId);
      }
      if (query?.search?.trim()) {
        q = q.ilike('name', `%${query.search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .filter((row) => activeCategories.has(row.category_id))
        .map(mapProduct);
    },

    async getProductById(productId: string): Promise<Product | null> {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.is_active) return null;
      const category = await this.getCategoryById(data.category_id);
      if (!category || !category.isActive) return null;
      return mapProduct(data);
    },

    async getSkusByProductId(productId: string): Promise<Sku[]> {
      const product = await this.getProductById(productId);
      if (!product) return [];

      const { data, error } = await client
        .from('skus')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;

      const skus: Sku[] = [];
      for (const row of data ?? []) {
        const sku = mapSku(row);
        if (!sku) continue;
        const price = await this.getEffectiveSkuPrice(sku.id);
        if (!price) continue;
        skus.push(sku);
      }
      return skus;
    },

    async getSkuById(skuId: string): Promise<Sku | null> {
      const { data, error } = await client
        .from('skus')
        .select('*')
        .eq('id', skuId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.is_active) return null;
      const sku = mapSku(data);
      if (!sku) return null;
      const product = await this.getProductById(sku.productId);
      if (!product) return null;
      const price = await this.getEffectiveSkuPrice(sku.id);
      if (!price) return null;
      return sku;
    },

    async searchSkus(query: CatalogueQuery): Promise<Sku[]> {
      const activeCategories = await loadActiveCategoryIds(client);
      const activeProducts = await loadActiveProductIds(client, activeCategories);

      let q = client.from('skus').select('*').eq('is_active', true);
      if (query.search?.trim()) {
        q = q.or(
          `name.ilike.%${query.search.trim()}%,sku_code.ilike.%${query.search.trim()}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;

      const results: Sku[] = [];
      for (const row of data ?? []) {
        if (!activeProducts.has(row.product_id)) continue;
        const sku = mapSku(row);
        if (!sku) continue;
        const price = await this.getEffectiveSkuPrice(sku.id);
        if (!price) continue;
        results.push(sku);
      }
      return results;
    },

    async getEffectiveSkuPrice(skuId: string, at?: string): Promise<SkuPrice | null> {
      const { data, error } = await client
        .from('sku_prices')
        .select('*')
        .eq('sku_id', skuId);
      if (error) throw error;
      return selectEffectiveSkuPrice(data ?? [], at ? new Date(at) : new Date());
    },
  };
}
