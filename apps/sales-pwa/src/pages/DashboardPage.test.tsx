import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isButtonDisabled } from '@/test-utils/markup';
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

import { ToastProvider } from '@/components/Toast';
import { DashboardPage } from './DashboardPage';

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <DashboardPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = {};
});

describe('DashboardPage attendance — loading (F)', () => {
  it('shows loading and disables Start Day and End Day', () => {
    mocks.queries.attendance = { isLoading: true, isFetching: true };
    const html = render();
    expect(html).toContain('Loading attendance…');
    expect(html).not.toContain('Day not started yet');
    expect(isButtonDisabled(html, 'Start Day')).toBe(true);
    expect(isButtonDisabled(html, 'End Day')).toBe(true);
  });
});

describe('DashboardPage attendance — error (G)', () => {
  it('shows the error with Retry and keeps both actions disabled', () => {
    mocks.queries.attendance = {
      isError: true,
      error: new Error('JWT expired'),
    };
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not load today&#x27;s attendance: JWT expired');
    expect(html).toContain('Start Day and End Day are paused until it loads.');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
    expect(isButtonDisabled(html, 'Start Day')).toBe(true);
    expect(isButtonDisabled(html, 'End Day')).toBe(true);
    expect(html).not.toContain('Day not started yet');
  });
});

describe('Home — visits and quick actions', () => {
  it('opens Today’s Route / Visits from Home', () => {
    mocks.queries.attendance = { data: null };
    mocks.queries.dashboard = {
      data: {
        assignedRetailers: 12,
        todaysVisits: 5,
        pendingActivations: 2,
        ordersCollected: 7,
        revenueThisMonth: 42000,
        revenueThisMonthLabel: '₹42,000',
      },
    };
    const html = render();
    expect(html).toContain('Today&#x27;s route');
    expect(html).toContain('5 shops planned today');
    expect(/href="\/visits"/.test(html)).toBe(true);
    expect(/href="\/orders\/new"/.test(html)).toBe(true);
    expect(/href="\/customers\/new"/.test(html)).toBe(true);
    expect(html).toContain('₹42,000');
    expect(html).not.toContain('achieved of');
  });

  it('shows the target only when one exists', () => {
    mocks.queries.attendance = { data: null };
    mocks.queries.target = {
      data: {
        month: '2026-09-01',
        targetAmount: 4000,
        achievedAmount: 1000,
        remainingAmount: 3000,
        progressPercent: 25,
      },
    };
    const html = render();
    expect(html).toContain(
      `${formatRupees(1000)} achieved of ${formatRupees(4000)}`,
    );
    expect(html).toContain(`${formatRupees(3000)} remaining`);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('width:25%');
  });

  it('hides the target card when the target is missing', () => {
    mocks.queries.attendance = { data: null };
    mocks.queries.target = { data: null };
    const html = render();
    expect(html).not.toContain('achieved of');
    expect(html).not.toContain('role="progressbar"');
  });

  it('shows a KPI skeleton while the summary loads', () => {
    mocks.queries.attendance = { data: null };
    mocks.queries.dashboard = { isLoading: true };
    const html = render();
    expect(html).toContain('Loading your field summary…');
    expect(html).toContain('aria-busy="true"');
  });

  it('shows the summary error with Retry', () => {
    mocks.queries.attendance = { data: null };
    mocks.queries.dashboard = { isError: true, error: new Error('permission denied') };
    const html = render();
    expect(html).toContain('permission denied');
    expect(html.match(/>Retry<\/button>/g)?.length).toBe(1);
  });
});

describe('DashboardPage attendance — loaded', () => {
  it('enables only Start Day when no attendance exists for today', () => {
    mocks.queries.attendance = { data: null };
    const html = render();
    expect(html).toContain('Day not started yet');
    expect(isButtonDisabled(html, 'Start Day')).toBe(false);
    expect(isButtonDisabled(html, 'End Day')).toBe(true);
  });

  it('enables only End Day once the day has started', () => {
    mocks.queries.attendance = {
      data: {
        id: 'att-1',
        profileId: 'profile-1',
        workDate: '2026-09-26',
        status: 'PRESENT',
        dayStartedAt: '2026-09-26T03:30:00Z',
        dayEndedAt: null,
        dayStartedAtLabel: '09:00 am',
        dayEndedAtLabel: null,
      },
    };
    const html = render();
    expect(html).toContain('Started 09:00 am');
    expect(isButtonDisabled(html, 'Start Day')).toBe(true);
    expect(isButtonDisabled(html, 'End Day')).toBe(false);
  });
});
