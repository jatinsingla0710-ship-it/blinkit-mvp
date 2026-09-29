import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SalesmanClaimsPanel } from './SalesmanClaimsPanel';

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, Record<string, unknown>>,
  reviewExpense: vi.fn(),
  reviewReturn: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    const key = String(options.queryKey[options.queryKey.length - 1]);
    return {
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      ...mocks.queries[key],
    };
  },
}));

vi.mock('@/data/adminDataClient', () => ({
  requireLiveAdminApi: () => ({}),
}));

vi.mock('@/data/mutations', () => ({
  useReviewSalesmanExpenseMutation: () => ({
    isPending: false,
    mutate: mocks.reviewExpense,
  }),
  useReviewReturnRequestMutation: () => ({
    isPending: false,
    mutate: mocks.reviewReturn,
  }),
}));

const pendingExpense = {
  id: 'exp-1',
  category: 'TRAVEL',
  amount: 240.5,
  expenseDate: '2026-09-20',
  note: 'Bus fare',
  receiptUrl: 'https://example.test/receipt.jpg',
  status: 'PENDING',
  reviewNote: null,
};

function render(canManage = true): string {
  return renderToStaticMarkup(<SalesmanClaimsPanel profileId="sales-1" canManage={canManage} />);
}

beforeEach(() => {
  mocks.queries = {};
  mocks.reviewExpense.mockReset();
  mocks.reviewReturn.mockReset();
});

describe('SalesmanClaimsPanel', () => {
  it('shows loading, error, and empty states', () => {
    mocks.queries.expenses = { isPending: true };
    mocks.queries.returns = { isPending: true };
    let html = render();
    expect(html).toContain('Loading expenses');
    expect(html).toContain('Loading returns');

    mocks.queries.expenses = { isError: true, error: new Error('expenses denied') };
    mocks.queries.returns = { isError: true, error: new Error('returns denied') };
    html = render();
    expect(html).toContain('expenses denied');
    expect(html).toContain('returns denied');

    mocks.queries.expenses = { data: [] };
    mocks.queries.returns = { data: [] };
    html = render();
    expect(html).toContain('No expenses');
    expect(html).toContain('No return requests');
  });

  it('offers approve and reject only for a pending claim the admin can manage', () => {
    mocks.queries.expenses = { data: [pendingExpense] };
    mocks.queries.returns = {
      data: [
        {
          id: 'ret-1',
          shopName: 'Sharma Stores',
          productName: 'Almonds',
          skuName: 'Almond 1kg',
          quantity: 1,
          reason: 'Damaged',
          note: null,
          photoUrl: null,
          status: 'APPROVED',
          reviewNote: 'Kept as a request',
        },
      ],
    };
    const html = render(true);
    expect(html).toContain('Bus fare');
    expect(html).toContain('receipt.jpg');
    expect(html).toContain('Approve');
    expect(html).toContain('Reject');
    expect(html).toContain('does not pay');
    expect(html).toContain('stay unchanged');
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('Approved');
    const approveCount = html.split('>Approve<').length - 1;
    expect(approveCount).toBe(1);
  });

  it('hides review buttons when the admin cannot manage salesmen', () => {
    mocks.queries.expenses = { data: [pendingExpense] };
    mocks.queries.returns = { data: [] };
    const html = render(false);
    expect(html).toContain('Pending');
    expect(html).not.toContain('>Approve<');
    expect(html).not.toContain('>Reject<');
  });
});
