import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { retailerFixture } from '@/test-utils/fixtures';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, Record<string, unknown>>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: false,
    error: null,
    refetch: () => Promise.resolve(),
    ...mocks.queries[String(options.queryKey[1])],
  }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha' }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

vi.mock('@/data/salesmanApi', () => ({
  isSalesDataMockMode: () => false,
}));

import { ToastProvider } from '@/components/Toast';
import { CustomerCreatedConfirmation } from './CreateCustomerPage';
import { CustomerDetailPage } from './CustomerDetailPage';
import { CustomersPage } from './CustomersPage';

function render(path: string, pattern: string, element: ReactElement): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const order = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  orderNumber: 'A1B2C3D4',
  shopId: 'shop-1',
  shopName: 'Sharma Stores',
  total: 1200,
  totalLabel: '₹1,200',
  status: 'CONFIRMED',
  createdAt: '2026-09-20T10:30:00.000Z',
  dateLabel: '20 Sept',
  dateTimeLabel: '20 Sept, 4:00 pm',
};

const visit = {
  id: 'visit-1',
  shopId: 'shop-1',
  shopName: 'Sharma Stores',
  areaLabel: 'North',
  plannedAt: '2026-09-20T09:00:00.000Z',
  plannedAtLabel: '20 Sept, 2:30 pm',
  status: 'VISITED' as const,
  notes: 'Asked for rice next week',
  visitedAt: '2026-09-20T09:20:00.000Z',
  visitedAtLabel: '20 Sept, 2:50 pm',
};

beforeEach(() => {
  mocks.queries = {};
});

describe('customer list (A, B, C)', () => {
  it('shows shop, area, mobile, and last order — not a balance', () => {
    mocks.queries.retailers = {
      data: [retailerFixture({ lastOrderLabel: '20 Sept' })],
      isSuccess: true,
    };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('Search customers');
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('North');
    expect(html).toContain('9876543210');
    expect(html).toContain('Last order: 20 Sept');
    expect(html).not.toContain('Outstanding');
    expect(html).not.toContain('balance');
  });

  it('empty list is only the real empty state', () => {
    mocks.queries.retailers = { data: [], isSuccess: true };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('No retailers yet');
    expect(html).not.toContain('Search customers');
  });

  it('a failed load is an error with Retry, not an empty list', () => {
    mocks.queries.retailers = { isError: true, error: new Error('permission denied') };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('permission denied');
    expect(html).not.toContain('No retailers yet');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });
});

describe('customer detail actions and history (D–K, T, U)', () => {
  it('shows the shop profile', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('Ravi');
    expect(html).toContain('9876543210');
    expect(html).toContain('North');
    expect(html).toContain('1 Main Rd');
  });

  it('Call and WhatsApp use the shop mobile', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(linkHref(html, 'Call')).toBe('tel:+919876543210');
    expect(linkHref(html, 'WhatsApp')).toContain('https://wa.me/919876543210');
  });

  it('disables Call and WhatsApp when there is no mobile', () => {
    mocks.queries.retailer = {
      data: retailerFixture({ primaryContactMobile: null }),
      isSuccess: true,
    };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(isButtonDisabled(html, 'Call')).toBe(true);
    expect(isButtonDisabled(html, 'WhatsApp')).toBe(true);
  });

  it('Directions uses saved coordinates (T)', () => {
    mocks.queries.retailer = {
      data: retailerFixture({ deliveryLat: 28.6139, deliveryLng: 77.209 }),
      isSuccess: true,
    };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    const href = linkHref(html, 'Directions') ?? '';
    expect(href).toContain('destination=28.6139,77.209');
    expect(html).toContain('Location saved');
  });

  it('missing GPS says location is not saved and does not open maps (U)', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('Location not saved');
    expect(isButtonDisabled(html, 'Directions')).toBe(true);
    expect(linkHref(html, 'Directions')).toBeNull();
    expect(html).toContain('Use Current Location');
  });

  it('New order opens the existing flow with this shop', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(linkHref(html, 'New order')).toBe('/orders/new?shopId=shop-1');
  });

  it('lists this shop’s orders and links to the existing detail page (H)', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    mocks.queries['shop-orders'] = { data: [order], isSuccess: true };
    mocks.queries['shop-visits'] = { data: [], isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('A1B2C3D4');
    expect(html).toContain('₹1,200');
    expect(html).toContain(`href="/orders/${order.id}"`);
  });

  it('order history failure is Retry, not “no orders” (I)', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    mocks.queries['shop-orders'] = { isError: true, error: new Error('orders down') };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('orders down');
    expect(html).not.toContain('No orders yet');
    expect(isButtonDisabled(html, 'Retry orders')).toBe(false);
  });

  it('empty orders offer Create first order', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    mocks.queries['shop-orders'] = { data: [], isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('No orders yet');
    expect(linkHref(html, 'Create first order')).toBe('/orders/new?shopId=shop-1');
  });

  it('shows visit date, status, notes, and actual time (J)', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    mocks.queries['shop-visits'] = { data: [visit], isSuccess: true };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('Asked for rice next week');
    expect(html).toContain('Visited');
    expect(html).toContain('20 Sept, 2:50 pm');
  });

  it('visit history failure is Retry, not “no visits” (K)', () => {
    mocks.queries.retailer = { data: retailerFixture(), isSuccess: true };
    mocks.queries['shop-visits'] = { isError: true, error: new Error('visits down') };
    const html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(html).toContain('visits down');
    expect(html).not.toContain('No visits yet');
    expect(isButtonDisabled(html, 'Retry visits')).toBe(false);
  });
});

describe('new customer confirmation (M, O, P)', () => {
  it('offers Open customer and Create order for the new shop', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CustomerCreatedConfirmation
          shopId="shop-new"
          tradeName="Sharma Stores"
          photoWarning={null}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('Retailer added');
    expect(linkHref(html, 'Open customer')).toBe('/customers/shop-new');
    expect(linkHref(html, 'Create order')).toBe('/orders/new?shopId=shop-new');
  });
});
