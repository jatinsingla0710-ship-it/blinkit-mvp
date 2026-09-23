import type { Category, Product } from '@/types';
import { categories, products } from './data';

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

export async function getCategories(): Promise<Category[]> {
  await delay();
  return categories;
}

export async function getProductsByStore(storeId: string): Promise<Product[]> {
  await delay();
  return products.filter((p) => p.storeId === storeId);
}

export async function getProductById(productId: string): Promise<Product | null> {
  await delay(100);
  return products.find((p) => p.id === productId) ?? null;
}

export async function getProductsByCategory(
  storeId: string,
  categoryId: string
): Promise<Product[]> {
  await delay();
  return products.filter(
    (p) => p.storeId === storeId && p.categoryId === categoryId
  );
}

export async function searchProducts(
  storeId: string,
  query: string
): Promise<Product[]> {
  await delay(120);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter(
    (p) =>
      p.storeId === storeId &&
      (p.name.toLowerCase().includes(q) ||
        p.categoryId.toLowerCase().includes(q) ||
        (p.grade?.toLowerCase().includes(q) ?? false) ||
        (p.specification?.toLowerCase().includes(q) ?? false) ||
        p.unit.toLowerCase().includes(q)),
  );
}

export async function getBestsellers(storeId: string): Promise<Product[]> {
  await delay();
  return products.filter((p) => p.storeId === storeId && p.bestseller);
}

export function getLiveStock(productId: string): number {
  return products.find((p) => p.id === productId)?.stock ?? 0;
}

export function decrementStock(productId: string, qty: number): boolean {
  const product = products.find((p) => p.id === productId);
  if (!product || product.stock < qty) return false;
  product.stock -= qty;
  return true;
}

export function findSubstitute(
  storeId: string,
  productId: string
): Product | null {
  const original = products.find((p) => p.id === productId);
  if (!original) return null;
  return (
    products.find(
      (p) =>
        p.storeId === storeId &&
        p.categoryId === original.categoryId &&
        p.id !== productId &&
        p.stock > 0
    ) ?? null
  );
}
