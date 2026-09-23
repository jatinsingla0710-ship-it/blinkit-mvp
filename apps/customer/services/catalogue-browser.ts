import type { Category, Product } from '@/types';

export type CatalogueStaticFilterId = 'all' | 'packed' | 'bulk';
export type CatalogueFilterId = CatalogueStaticFilterId | string;

export type CatalogueSortId = 'trade_price' | 'a_z' | 'available';

export type CatalogueFilterChip = {
  id: CatalogueFilterId;
  label: string;
};

export type CatalogueSortOption = {
  id: CatalogueSortId;
  label: string;
};

export const CATALOGUE_SORT_OPTIONS: CatalogueSortOption[] = [
  { id: 'trade_price', label: 'Trade Price' },
  { id: 'a_z', label: 'A-Z' },
  { id: 'available', label: 'Available' },
];

const STATIC_FILTERS: CatalogueFilterChip[] = [
  { id: 'all', label: 'All' },
  { id: 'packed', label: 'Packed' },
  { id: 'bulk', label: 'Bulk' },
];

/** Category chips come from the live / mock catalogue — never hardcoded names. */
export function buildCatalogueFilterChips(
  categories: Category[],
): CatalogueFilterChip[] {
  return [
    ...STATIC_FILTERS,
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
  ];
}

function categoryById(
  categories: Category[],
  categoryId: string,
): Category | undefined {
  return categories.find((c) => c.id === categoryId);
}

function isPackedSku(product: Product): boolean {
  return (
    product.sellingUnit === 'CARTON' ||
    product.sellingUnit === 'PACK' ||
    product.sellingUnit === 'BAG' ||
    product.sellingUnit === 'BOX' ||
    product.sellingUnit === 'PCS' ||
    product.sellingUnit === 'TIN' ||
    product.sellingUnit === 'BOTTLE' ||
    (product.packsPerCarton != null && product.packsPerCarton > 0)
  );
}

function isBulkSku(product: Product): boolean {
  return (
    product.sellingUnit === 'KG' ||
    product.sellingUnit === 'GRAM' ||
    product.sellingUnit === 'LITRE'
  );
}

export function matchesCatalogueSearch(
  product: Product,
  query: string,
  categories: Category[] = [],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const category = categoryById(categories, product.categoryId);
  return (
    product.name.toLowerCase().includes(q) ||
    product.unit.toLowerCase().includes(q) ||
    product.sellingUnit.toLowerCase().includes(q) ||
    (product.grade?.toLowerCase().includes(q) ?? false) ||
    (product.specification?.toLowerCase().includes(q) ?? false) ||
    (product.description?.toLowerCase().includes(q) ?? false) ||
    (category?.name.toLowerCase().includes(q) ?? false)
  );
}

export function matchesCatalogueFilter(
  product: Product,
  filter: CatalogueFilterId,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'packed') return isPackedSku(product);
  if (filter === 'bulk') return isBulkSku(product);
  return product.categoryId === filter;
}

function availabilityRank(product: Product): number {
  if (product.stockStatus === 'OUT_OF_STOCK' || product.stock <= 0) return 2;
  if (product.stockStatus === 'LOW_STOCK') return 1;
  return 0;
}

export function sortCatalogueProducts(
  products: Product[],
  sort: CatalogueSortId,
): Product[] {
  const next = [...products];
  switch (sort) {
    case 'trade_price':
      next.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
      break;
    case 'a_z':
      next.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'available':
      next.sort(
        (a, b) =>
          availabilityRank(a) - availabilityRank(b) ||
          a.name.localeCompare(b.name),
      );
      break;
  }
  return next;
}

/** Client-side browse pipeline for Catalogue v1. */
export function browseCatalogueProducts(input: {
  products: Product[];
  categories: Category[];
  query: string;
  filter: CatalogueFilterId;
  sort: CatalogueSortId;
}): Product[] {
  const filtered = input.products.filter(
    (product) =>
      matchesCatalogueSearch(product, input.query, input.categories) &&
      matchesCatalogueFilter(product, input.filter),
  );
  return sortCatalogueProducts(filtered, input.sort);
}
