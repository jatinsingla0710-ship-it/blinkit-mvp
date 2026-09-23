import type {
  Category,
  Product,
  Sku,
  SkuPrice,
} from '@groaurum/shared-types';

export interface CatalogueQuery {
  serviceAreaId?: string;
  categoryId?: string;
  search?: string;
  activeOnly?: boolean;
}

export interface CatalogueService {
  getCategories(query?: CatalogueQuery): Promise<Category[]>;
  getCategoryById(categoryId: string): Promise<Category | null>;
  getProducts(query?: CatalogueQuery): Promise<Product[]>;
  getProductById(productId: string): Promise<Product | null>;
  getSkusByProductId(productId: string): Promise<Sku[]>;
  getSkuById(skuId: string): Promise<Sku | null>;
  searchSkus(query: CatalogueQuery): Promise<Sku[]>;
  getEffectiveSkuPrice(skuId: string, at?: string): Promise<SkuPrice | null>;
}
