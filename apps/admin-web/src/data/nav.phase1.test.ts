import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_NAV,
  SIDEBAR_NAV_GROUPS,
  isSidebarItemActive,
} from './nav';
import {
  INVENTORY_SECTION_LINKS,
  PRODUCTS_SECTION_LINKS,
  SALES_SECTION_LINKS,
  SETTINGS_SECTION_LINKS,
  TEAM_SECTION_LINKS,
} from './section-links';

describe('Phase 1 Admin navigation', () => {
  it('keeps top-level sidebar free of secondary modules', () => {
    const labels = SIDEBAR_NAV.map((item) => item.label);
    expect(labels).toEqual([
      'Dashboard',
      'Customers',
      'Sales',
      'Products',
      'Inventory',
      'Delivery',
      'Salesmen',
      'Reports',
      'Settings',
    ]);
    expect(labels).not.toContain('Pricing');
    expect(labels).not.toContain('Commission');
    expect(labels).not.toContain('Payments');
    expect(labels).not.toContain('Service Areas');
    expect(labels).not.toContain('Warehouses');
    expect(labels).not.toContain('Categories');
  });

  it('groups nav into Business and Team sections', () => {
    const business = SIDEBAR_NAV_GROUPS.find((g) => g.id === 'business');
    const team = SIDEBAR_NAV_GROUPS.find((g) => g.id === 'team');
    expect(business?.label).toBe('Business');
    expect(business?.items.map((i) => i.id)).toEqual([
      'customers',
      'sales',
      'products',
      'inventory',
      'delivery',
    ]);
    expect(team?.items.map((i) => i.id)).toEqual(['salesmen']);
  });

  it('highlights Sales for orders, invoices, and collections', () => {
    const sales = SIDEBAR_NAV.find((item) => item.id === 'sales')!;
    expect(isSidebarItemActive('/orders', sales)).toBe(true);
    expect(isSidebarItemActive('/orders/abc', sales)).toBe(true);
    expect(isSidebarItemActive('/sales', sales)).toBe(true);
    expect(isSidebarItemActive('/payments', sales)).toBe(true);
    expect(isSidebarItemActive('/products', sales)).toBe(false);
  });

  it('keeps commission under Salesmen, not Products', () => {
    const products = SIDEBAR_NAV.find((item) => item.id === 'products')!;
    const salesmen = SIDEBAR_NAV.find((item) => item.id === 'salesmen')!;
    expect(isSidebarItemActive('/pricing', products)).toBe(true);
    expect(isSidebarItemActive('/pricing/sku-1', products)).toBe(true);
    expect(isSidebarItemActive('/pricing/commission', products)).toBe(false);
    expect(isSidebarItemActive('/pricing/commission', salesmen)).toBe(true);
  });

  it('highlights Settings for service areas and warehouses', () => {
    const settings = SIDEBAR_NAV.find((item) => item.id === 'settings')!;
    expect(isSidebarItemActive('/settings', settings)).toBe(true);
    expect(isSidebarItemActive('/service-areas', settings)).toBe(true);
    expect(isSidebarItemActive('/warehouses', settings)).toBe(true);
  });

  it('exposes secondary modules through section links', () => {
    expect(SALES_SECTION_LINKS.map((l) => l.to)).toEqual([
      '/orders',
      '/sales',
      '/payments',
    ]);
    expect(PRODUCTS_SECTION_LINKS.map((l) => l.to)).toEqual([
      '/products',
      '/categories',
      '/pricing',
    ]);
    expect(INVENTORY_SECTION_LINKS.map((l) => l.to)).toContain('/warehouses');
    expect(TEAM_SECTION_LINKS.map((l) => l.to)).toContain('/pricing/commission');
    expect(SETTINGS_SECTION_LINKS.map((l) => l.to)).toEqual([
      '/settings',
      '/service-areas',
      '/warehouses',
    ]);
  });
});
