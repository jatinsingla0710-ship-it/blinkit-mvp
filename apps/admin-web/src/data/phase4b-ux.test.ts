import { describe, expect, it } from 'vitest';
import { SIDEBAR_NAV_GROUPS, isSidebarItemActive } from '@/data/nav';
import { ACCOUNTING_SECTION_LINKS, SALES_SECTION_LINKS } from '@/data/section-links';

describe('Phase 4B Admin UX navigation honesty', () => {
  it('keeps top-level nav compact without Pricing/Commission/Payments/Warehouses', () => {
    const labels = SIDEBAR_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toEqual([
      'Dashboard',
      'Customers',
      'Sales',
      'Products',
      'Inventory',
      'Delivery',
      'Salesmen',
      'Receivables',
      'Purchases',
      'Expenses',
      'Day Book',
      'Reports',
      'Settings',
    ]);
    expect(labels).not.toContain('Pricing');
    expect(labels).not.toContain('Commission');
    expect(labels).not.toContain('Payments');
    expect(labels).not.toContain('Warehouses');
    expect(labels).not.toContain('Service Areas');
    expect(labels).not.toContain('Payroll');
    expect(labels).not.toContain('Suppliers');
  });

  it('keeps Sales and Accounting related links without activation language', () => {
    const salesCopy = SALES_SECTION_LINKS.map((l) => `${l.label} ${l.description}`).join(' ');
    const accountingCopy = ACCOUNTING_SECTION_LINKS.map(
      (l) => `${l.label} ${l.description}`,
    ).join(' ');
    expect(salesCopy.toLowerCase()).not.toMatch(/activation|customer app|invite/);
    expect(accountingCopy.toLowerCase()).not.toMatch(/activation|customer app|invite/);
  });

  it('keeps deep routes under parent highlights', () => {
    const sales = SIDEBAR_NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.id === 'sales',
    )!;
    expect(isSidebarItemActive('/payments', sales)).toBe(true);
    expect(isSidebarItemActive('/orders/abc', sales)).toBe(true);

    const products = SIDEBAR_NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.id === 'products',
    )!;
    expect(isSidebarItemActive('/pricing', products)).toBe(true);
    expect(isSidebarItemActive('/pricing/commission', products)).toBe(false);

    const settings = SIDEBAR_NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.id === 'settings',
    )!;
    expect(isSidebarItemActive('/warehouses', settings)).toBe(true);
    expect(isSidebarItemActive('/service-areas', settings)).toBe(true);

    const purchases = SIDEBAR_NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.id === 'purchases',
    )!;
    expect(isSidebarItemActive('/purchases', purchases)).toBe(true);
    expect(isSidebarItemActive('/purchases/new', purchases)).toBe(true);
    expect(isSidebarItemActive('/suppliers', purchases)).toBe(true);
    expect(isSidebarItemActive('/suppliers/abc', purchases)).toBe(true);
  });
});
