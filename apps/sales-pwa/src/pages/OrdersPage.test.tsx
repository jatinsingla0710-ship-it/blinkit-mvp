import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { SalesmanOrderSummary } from '@groaurum/api-client';
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

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha' }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

import { OrdersPage } from './OrdersPage';

function order(overrides: Partial<SalesmanOrderSummary>): SalesmanOrderSummary {
  return {
    id: 'a1b2c3d4-0000',
    orderNumber: 'A1B2C3D4',
    shopId: 'shop-1',
    shopName: 'Sharma Stores',
    total: 8275,
    totalLabel: '₹8,275',
    status: 'AWAITING_CUSTOMER_CONFIRMATION',
    createdAt: '2026-09-27T10:30:00.000Z',
    dateLabel: '27 Sept',
    dateTimeLabel: '27 Sept, 04:00 pm',
    ...overrides,
  };
}

function render(url = '/orders'): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <OrdersPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = {};
});

describe('OrdersPage list (A)', () => {
  it('lists pending orders with number, shop, date-time, total and status', () => {
    mocks.queries.orders = {
      isSuccess: true,
      data: [
        order({}),
        order({ id: 'b2', orderNumber: 'B2', status: 'OUT_FOR_DELIVERY', shopName: 'Gupta Stores' }),
      ],
    };
    const html = render();
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('#A1B2C3D4');
    expect(html).toContain('27 Sept, 04:00 pm');
    expect(html).toContain('₹8,275');
    expect(html).toContain('Awaiting customer approval');
    expect(html).not.toContain('Gupta Stores');
    expect(linkHref(html, 'New order')).toBe('/orders/new');
    expect(html).toMatch(/href="\/orders\/a1b2c3d4-0000"/);
  });
});

describe('OrdersPage status tabs (D)', () => {
  const all = [
    order({ id: 'p', status: 'AWAITING_CUSTOMER_CONFIRMATION', shopName: 'Pending Shop' }),
    order({ id: 'a', status: 'STOCK_RESERVED', shopName: 'Approved Shop' }),
    order({ id: 'd', status: 'DELIVERED', shopName: 'Delivered Shop' }),
    order({ id: 'c', status: 'CANCELLED', shopName: 'Cancelled Shop' }),
  ];

  it('shows counts on every tab', () => {
    mocks.queries.orders = { isSuccess: true, data: all };
    const html = render();
    for (const label of ['Pending (1)', 'Approved (1)', 'Delivered (1)', 'Cancelled (1)']) {
      expect(html).toContain(label);
    }
  });

  it.each([
    ['approved', 'Approved Shop'],
    ['delivered', 'Delivered Shop'],
    ['cancelled', 'Cancelled Shop'],
  ])('?tab=%s shows only that group', (tab, shop) => {
    mocks.queries.orders = { isSuccess: true, data: all };
    const html = render(`/orders?tab=${tab}`);
    expect(html).toContain(shop);
    expect(html).not.toContain('Pending Shop');
  });
});

describe('OrdersPage states (B, S)', () => {
  it('shows a loading skeleton, not "no orders", while loading', () => {
    mocks.queries.orders = { isLoading: true };
    const html = render();
    expect(html).toContain('Loading orders…');
    expect(html).not.toContain('No orders waiting');
  });

  it('shows an error with retry and never an empty list on failure', () => {
    mocks.queries.orders = { isError: true, error: new Error('permission denied') };
    const html = render();
    expect(html).toContain('Could not load your orders: permission denied');
    expect(isButtonDisabled(html, 'Retry orders')).toBe(false);
    expect(html).not.toContain('No orders waiting');
  });

  it('keeps the last loaded list when a refresh fails', () => {
    mocks.queries.orders = { isError: true, error: new Error('timeout'), data: [order({})] };
    const html = render();
    expect(html).toContain('showing the last loaded data');
    expect(html).toContain('Sharma Stores');
  });

  it('shows a tab-specific empty state only after a successful load', () => {
    mocks.queries.orders = { isSuccess: true, data: [] };
    expect(render()).toContain('No orders waiting for approval');
    expect(render('/orders?tab=delivered')).toContain('No delivered orders yet');
  });
});
