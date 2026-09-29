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
import { CreateCustomerPage } from './CreateCustomerPage';
import { CreateOrderPage } from './CreateOrderPage';
import { CustomerDetailPage } from './CustomerDetailPage';
import { CustomersPage } from './CustomersPage';
import { PerformancePage } from './PerformancePage';
import { VisitsPage } from './VisitsPage';

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

beforeEach(() => {
  mocks.queries = {};
});

describe('every inner screen has a back link (no dead ends)', () => {
  it('Today’s Route → Home', () => {
    const html = render('/visits', '/visits', <VisitsPage />);
    expect(linkHref(html, 'Back to Home')).toBe('/');
  });

  it('Customer detail → Customers (loaded, loading, and not found)', () => {
    mocks.queries.retailer = { data: retailerFixture() };
    let html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(linkHref(html, 'Back to Customers')).toBe('/customers');

    mocks.queries.retailer = { isLoading: true };
    html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(linkHref(html, 'Back to Customers')).toBe('/customers');

    mocks.queries.retailer = { data: null };
    html = render('/customers/shop-1', '/customers/:shopId', <CustomerDetailPage />);
    expect(linkHref(html, 'Back to Customers')).toBe('/customers');
    expect(html).toContain('Customer not found');
  });

  it('New retailer → Customers', () => {
    const html = render('/customers/new', '/customers/new', <CreateCustomerPage />);
    expect(linkHref(html, 'Back to Customers')).toBe('/customers');
  });

  it('New order → the customer it was opened from, else Orders', () => {
    let html = render('/orders/new?shopId=shop-1', '/orders/new', <CreateOrderPage />);
    expect(linkHref(html, 'Back to Customer')).toBe('/customers/shop-1');

    html = render('/orders/new', '/orders/new', <CreateOrderPage />);
    expect(linkHref(html, 'Back to Orders')).toBe('/orders');
  });

  it('My Earnings → Profile', () => {
    const html = render('/profile/earnings', '/profile/earnings', <PerformancePage />);
    expect(linkHref(html, 'Back to Profile')).toBe('/profile');
    expect(html).toContain('My Earnings');
  });
});

describe('loading, error and empty states', () => {
  it('Customers shows a skeleton while loading', () => {
    mocks.queries.retailers = { isLoading: true };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading your customers…');
  });

  it('Customers shows the error with Retry when nothing is loaded', () => {
    mocks.queries.retailers = { isError: true, error: new Error('JWT expired') };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('JWT expired');
    expect(html).not.toContain('ga-sales-error-state--stale');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });

  it('Customers keeps the list and marks a failed refresh as stale', () => {
    mocks.queries.retailers = {
      data: [retailerFixture()],
      isError: true,
      error: new Error('timeout'),
    };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('ga-sales-error-state--stale');
  });

  it('Customers empty state points to Add customer', () => {
    mocks.queries.retailers = { data: [] };
    const html = render('/customers', '/customers', <CustomersPage />);
    expect(html).toContain('No customers yet');
    expect(linkHref(html, 'Add customer')).toBe('/customers/new');
  });

  it('Today’s Route empty state points to Customers', () => {
    mocks.queries.visits = { data: [] };
    const html = render('/visits', '/visits', <VisitsPage />);
    expect(html).toContain('No visits planned today');
    expect(linkHref(html, 'Go to customers')).toBe('/customers');
  });

  it('Today’s Route shows the error with Retry', () => {
    mocks.queries.visits = { isError: true, error: new Error('offline') };
    const html = render('/visits', '/visits', <VisitsPage />);
    expect(html).toContain('offline');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });

  it('New retailer surfaces a service-area load failure with Retry', () => {
    mocks.queries['service-areas'] = { isError: true, error: new Error('denied') };
    const html = render('/customers/new', '/customers/new', <CreateCustomerPage />);
    expect(html).toContain('denied');
    expect(isButtonDisabled(html, 'Retry areas')).toBe(false);
  });

  it('My Earnings shows a loading state', () => {
    mocks.queries.earnings = { isLoading: true };
    const html = render('/profile/earnings', '/profile/earnings', <PerformancePage />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading your earnings');
  });
});
