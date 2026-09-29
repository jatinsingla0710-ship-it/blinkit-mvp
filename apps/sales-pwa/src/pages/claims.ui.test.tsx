import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, Record<string, unknown>>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: () => Promise.resolve(),
    ...mocks.queries[String(options.queryKey[1])],
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha' }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

import { ToastProvider } from '@/components/Toast';
import { ExpenseDetailPage } from './ExpenseDetailPage';
import { ExpensesPage } from './ExpensesPage';
import { ReturnDetailPage } from './ReturnDetailPage';
import { ReturnFormPage } from './ReturnFormPage';
import { ReturnsPage } from './ReturnsPage';

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

const expense = {
  id: 'exp-1',
  category: 'TRAVEL',
  amount: 240,
  expenseDate: '2026-09-20',
  note: 'Bus to market',
  receiptUrl: 'https://example.test/receipt.jpg',
  status: 'PENDING',
  reviewNote: null,
};

beforeEach(() => {
  mocks.queries = {};
});

describe('expense screens', () => {
  it('loads, fails, and shows an empty list', () => {
    mocks.queries.expenses = { isLoading: true };
    let html = render('/profile/expenses', '/profile/expenses', <ExpensesPage />);
    expect(html).toContain('Loading expenses');
    expect(linkHref(html, 'Back to Profile')).toBe('/profile');

    mocks.queries.expenses = { isError: true, error: new Error('expenses offline') };
    html = render('/profile/expenses', '/profile/expenses', <ExpensesPage />);
    expect(html).toContain('expenses offline');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);

    mocks.queries.expenses = { data: [] };
    html = render('/profile/expenses', '/profile/expenses', <ExpensesPage />);
    expect(html).toContain('No expenses yet');
    expect(linkHref(html, 'Add expense')).toBe('/profile/expenses/new');
  });

  it('shows a pending expense and its receipt', () => {
    mocks.queries.expense = { isSuccess: true, data: expense };
    const html = render('/profile/expenses/exp-1', '/profile/expenses/:expenseId', <ExpenseDetailPage />);
    expect(html).toContain('Travel');
    expect(html).toContain('Pending');
    expect(html).toContain('Bus to market');
    expect(html).toContain('receipt.jpg');
    expect(linkHref(html, 'Back to Expenses')).toBe('/profile/expenses');
  });

  it('says when an expense is missing', () => {
    mocks.queries.expense = { isSuccess: true, data: null };
    const html = render('/profile/expenses/missing', '/profile/expenses/:expenseId', <ExpenseDetailPage />);
    expect(html).toContain('not found');
  });
});

describe('return screens', () => {
  it('loads, fails, and explains the empty list', () => {
    mocks.queries.returns = { isLoading: true };
    let html = render('/profile/returns', '/profile/returns', <ReturnsPage />);
    expect(html).toContain('Loading returns');

    mocks.queries.returns = { isError: true, error: new Error('returns offline') };
    html = render('/profile/returns', '/profile/returns', <ReturnsPage />);
    expect(html).toContain('returns offline');

    mocks.queries.returns = { data: [] };
    html = render('/profile/returns', '/profile/returns', <ReturnsPage />);
    expect(html).toContain('No return requests yet');
    expect(linkHref(html, 'Back to Profile')).toBe('/profile');
  });

  it('shows a submitted request without changing stock language into a completed return', () => {
    mocks.queries.return = {
      isSuccess: true,
      data: {
        id: 'ret-1',
        shopName: 'Sharma Stores',
        productName: 'Almonds',
        skuName: 'Almond 1kg',
        skuCode: 'ALM-1KG',
        quantity: 1,
        reason: 'Damaged',
        note: null,
        photoUrl: null,
        status: 'APPROVED',
        reviewNote: 'Noted',
      },
    };
    const html = render('/profile/returns/ret-1', '/profile/returns/:requestId', <ReturnDetailPage />);
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('Approved');
    expect(html).toContain('Damaged');
    expect(html).toContain('Stock, payment, and commission stay unchanged');
    expect(html).toContain('No photo');
  });

  it('shows an empty order list before a return can be filed', () => {
    mocks.queries['return-orders'] = { data: [] };
    const html = render('/customers/shop-1/return', '/customers/:shopId/return', <ReturnFormPage />);
    expect(html).toContain('no orders yet');
    expect(linkHref(html, 'Back to Customer')).toBe('/customers/shop-1');
  });
});
