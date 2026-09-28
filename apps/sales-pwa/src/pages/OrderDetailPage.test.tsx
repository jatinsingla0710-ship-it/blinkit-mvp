import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SalesmanOrderDetail } from '@groaurum/api-client';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, Record<string, unknown>>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
    error: null,
    refetch: () => Promise.resolve(),
    ...mocks.queries[String(options.queryKey[1])],
  }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

import { OrderDetailPage } from './OrderDetailPage';

const detail: SalesmanOrderDetail = {
  id: 'a1b2c3d4-0000',
  orderNumber: 'A1B2C3D4',
  shopId: 'shop-1',
  shopName: 'Sharma Stores',
  total: 8773,
  totalLabel: '₹8,773',
  subtotal: 8773,
  adjustments: 0,
  status: 'CONFIRMED',
  source: 'SALESMAN_ASSISTED',
  createdAt: '2026-09-27T10:30:00.000Z',
  updatedAt: '2026-09-27T10:30:00.000Z',
  dateLabel: '27 Sept',
  dateTimeLabel: '27 Sept, 04:00 pm',
  lines: [
    {
      id: 'l1',
      skuId: 'sku-1',
      productName: 'Basmati Rice',
      skuName: 'Basmati 1kg',
      skuCode: 'BAS-1KG',
      specification: null,
      sellingUnit: 'PACK',
      quantity: 50,
      unitPrice: 165.5,
      lineTotal: 8275,
    },
    {
      id: 'l2',
      skuId: 'sku-2',
      productName: 'Sunflower Oil',
      skuName: 'Oil 1L',
      skuCode: 'OIL-1L',
      specification: null,
      sellingUnit: 'BOTTLE',
      quantity: 3,
      unitPrice: 166,
      lineTotal: 498,
    },
  ],
};

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/orders/a1b2c3d4-0000']}>
      <Routes>
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = {};
});

describe('OrderDetailPage (C)', () => {
  it('shows number, shop, date, status, every line and the order total', () => {
    mocks.queries.order = { isSuccess: true, data: detail };
    const html = render();
    expect(html).toContain('Order #A1B2C3D4');
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('27 Sept, 04:00 pm');
    expect(html).toContain('Approved by customer');
    expect(html).toContain('Basmati Rice');
    expect(html).toContain('Basmati 1kg · BAS-1KG');
    expect(html).toContain('50 Packs × ₹165.5');
    expect(html).toContain('₹8,275');
    expect(html).toContain('3 Bottles × ₹166');
    expect(html).toContain('₹498');
    expect(html).toContain('Order total');
    expect(html).toContain('₹8,773');
    expect(linkHref(html, 'Back to Orders')).toBe('/orders');
  });
});

describe('OrderDetailPage states (B, S)', () => {
  it('loading shows a skeleton', () => {
    mocks.queries.order = { isLoading: true };
    expect(render()).toContain('Loading order…');
  });

  it('errors show a retry, not an empty order', () => {
    mocks.queries.order = { isError: true, error: new Error('permission denied') };
    const html = render();
    expect(html).toContain('Could not load this order: permission denied');
    expect(isButtonDisabled(html, 'Retry order')).toBe(false);
    expect(html).not.toContain('Order not found');
    expect(html).not.toContain('₹0');
  });

  it('a missing or hidden order says so', () => {
    mocks.queries.order = { isSuccess: true, data: null };
    expect(render()).toContain('Order not found');
  });
});
