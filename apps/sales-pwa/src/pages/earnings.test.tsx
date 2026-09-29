import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';
import { formatRupees } from '@/lib/money';

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

import { PerformancePage } from './PerformancePage';

const earnings = {
  month: '2026-09-01',
  earningModel: 'SALARY_PLUS_COMMISSION',
  earnedCommission: 80,
  salaryApplies: true,
  salary: { monthlySalary: 15000, dailyAllowance: 0, otherAllowance: 0 },
  totalEarnings: 15080,
  totalIncludesSalary: true,
  awaitingOrderCount: 1,
  awaitingOrderValue: 500,
  awaitingOrders: [
    {
      orderId: 'order-wait',
      orderNumber: 'ORDERWAI',
      shopName: 'Sharma Stores',
      createdAt: '2026-09-20T08:00:00.000Z',
      orderStatus: 'OUT_FOR_DELIVERY',
      orderTotal: 500,
    },
  ],
  entries: [
    {
      orderId: 'order-earned',
      orderNumber: 'ORDEREAR',
      shopName: 'Gupta Traders',
      earnedAt: '2026-09-12T08:00:00.000Z',
      orderStatus: 'DELIVERED',
      commissionAmount: 80,
    },
  ],
  payslipsAvailable: false,
  target: null,
};

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PerformancePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = {};
});

describe('My Earnings', () => {
  it('shows a loading state', () => {
    mocks.queries.earnings = { isLoading: true };
    const html = render();
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading your earnings');
  });

  it('shows an error with Retry', () => {
    mocks.queries.earnings = { isError: true, error: new Error('ledger offline') };
    const html = render();
    expect(html).toContain('ledger offline');
    expect(html).toContain('role="alert"');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });

  it('shows an empty month without inventing commission', () => {
    mocks.queries.earnings = {
      data: {
        ...earnings,
        earnedCommission: 0,
        salaryApplies: false,
        salary: null,
        totalEarnings: 0,
        totalIncludesSalary: false,
        awaitingOrderCount: 0,
        awaitingOrderValue: 0,
        awaitingOrders: [],
        entries: [],
      },
    };
    const html = render();
    expect(html).toContain('No commission earned this month.');
    expect(html).toContain('No orders are waiting.');
    expect(html).toContain('Payslip history is not available.');
    expect(html).not.toContain('Estimated');
  });

  it('shows earned commission separately from orders that are not earned', () => {
    mocks.queries.earnings = { data: earnings };
    const html = render();
    expect(linkHref(html, 'Back to Profile')).toBe('/profile');
    const marker = 'Not earned yet</h2>';
    const earned = html.split(marker)[0] ?? '';
    const awaiting = (html.split(marker)[1] ?? '').split('Earned by order')[0] ?? '';
    expect(earned).toContain(formatRupees(80));
    expect(earned).toContain(formatRupees(15000));
    expect(earned).toContain(formatRupees(15080));
    expect(awaiting).toContain('Sharma Stores');
    expect(awaiting).toContain(formatRupees(500));
    expect(awaiting).toContain('Commission not earned');
    expect(awaiting).not.toContain(formatRupees(80));
    expect(html).toContain('Gupta Traders');
    expect(html).toContain('Payslip history is not available.');
  });
});
