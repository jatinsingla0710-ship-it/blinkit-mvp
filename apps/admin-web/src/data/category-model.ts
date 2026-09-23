/** Categories module view models — mapped from catalogue taxonomy + product aggregates. */
export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
  activeProductCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  status: 'active' | 'inactive';
};
