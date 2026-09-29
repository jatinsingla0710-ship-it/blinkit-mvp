import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { SalesmanVisit } from '@groaurum/api-client';
import { isButtonDisabled } from '@/test-utils/markup';

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
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha' }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

import { ToastProvider } from '@/components/Toast';
import { VisitsPage } from './VisitsPage';

function visit(id: string, plannedAt: string, shopName: string): SalesmanVisit {
  return {
    id,
    shopId: id,
    shopName,
    areaLabel: 'North',
    plannedAt,
    plannedAtLabel: plannedAt,
    status: 'PLANNED',
    notes: null,
    deliveryLat: null,
    deliveryLng: null,
  };
}

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <VisitsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = {};
});

describe('today’s route page', () => {
  it('renders visits in planned-time order', () => {
    mocks.queries.visits = {
      data: [
        visit('late', '2026-09-28T15:00:00.000Z', 'Late Shop'),
        visit('early', '2026-09-28T09:00:00.000Z', 'Early Shop'),
      ],
      isSuccess: true,
    };
    const html = render();
    expect(html.indexOf('Early Shop')).toBeLessThan(html.indexOf('Late Shop'));
  });

  it('shows Retry when the route fails to load', () => {
    mocks.queries.visits = { isError: true, error: new Error('route offline') };
    const html = render();
    expect(html).toContain('route offline');
    expect(html).not.toContain('No visits planned today');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });
});
