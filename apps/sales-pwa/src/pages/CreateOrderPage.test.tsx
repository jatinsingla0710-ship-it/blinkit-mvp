import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { CatalogueSkuRow } from '@groaurum/api-client';
import { retailerFixture } from '@/test-utils/fixtures';
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
    error: null,
    refetch: () => Promise.resolve(),
    ...mocks.queries[String(options.queryKey[1])],
  }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

import { CreateOrderPage, PlacedOrderResult } from './CreateOrderPage';

const PLACE = 'Place assisted order';

const skuRow = {
  sku: { id: 'sku-1', name: 'Basmati 5kg', moq: 1, quantityStep: 1 },
  product: { id: 'prod-1' },
  category: null,
  unitPrice: 450,
  availableQuantity: 20,
} as unknown as CatalogueSkuRow;

function render(url: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <CreateOrderPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.queries = { 'orderable-skus': { data: [skuRow] } };
});

describe('CreateOrderPage submit gate (H)', () => {
  it('cannot submit from ?shopId= alone while retailers are loading', () => {
    mocks.queries.retailers = { isLoading: true };
    const html = render('/orders/new?shopId=shop-1');
    expect(isButtonDisabled(html, PLACE)).toBe(true);
    expect(html).toContain('Loading retailers…');
  });

  it('cannot submit when ?shopId= is not an assigned retailer', () => {
    mocks.queries.retailers = { data: [retailerFixture({ id: 'shop-2' })] };
    const html = render('/orders/new?shopId=shop-1');
    expect(isButtonDisabled(html, PLACE)).toBe(true);
    expect(html).toContain('not in your assigned list');
  });

  it('blocks the order with an explanation when the shop has no service area', () => {
    mocks.queries.retailers = { data: [retailerFixture({ serviceAreaId: null })] };
    const html = render('/orders/new?shopId=shop-1');
    expect(isButtonDisabled(html, PLACE)).toBe(true);
    expect(html).toContain('Sharma Stores has no service area');
  });

  it('shows retailer load errors with a retry and blocks submit', () => {
    mocks.queries.retailers = { isError: true, error: new Error('permission denied') };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Could not load your retailers: permission denied');
    expect(isButtonDisabled(html, 'Retry retailers')).toBe(false);
    expect(isButtonDisabled(html, PLACE)).toBe(true);
  });

  it('shows product load errors with a retry and blocks submit', () => {
    mocks.queries.retailers = { data: [retailerFixture()] };
    mocks.queries['orderable-skus'] = { isError: true, error: new Error('timeout') };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Could not load products: timeout');
    expect(isButtonDisabled(html, 'Retry products')).toBe(false);
    expect(isButtonDisabled(html, PLACE)).toBe(true);
  });

  it('enables submit once the shop and catalogue have loaded', () => {
    mocks.queries.retailers = { data: [retailerFixture()] };
    const html = render('/orders/new?shopId=shop-1');
    expect(isButtonDisabled(html, PLACE)).toBe(false);
  });
});

describe('PlacedOrderResult (I)', () => {
  function renderResult(outcome: Parameters<typeof PlacedOrderResult>[0]['outcome']) {
    return renderToStaticMarkup(
      <MemoryRouter>
        <PlacedOrderResult outcome={outcome} shopId="shop-1" />
      </MemoryRouter>,
    );
  }

  it('never shows the success state when confirmation failed', () => {
    const html = renderResult({
      kind: 'confirmation_failed',
      orderId: 'order-1',
      message: 'reissue failed',
    });
    expect(html).not.toContain('ga-sales-success');
    expect(html).not.toContain('Order placed');
    expect(html).toContain('Order created — confirmation not sent');
    expect(html).toContain('reissue failed');
    expect(html).toContain('Do not place this order again');
  });

  it('shows success only when confirmation was sent', () => {
    const html = renderResult({
      kind: 'confirmation_sent',
      orderId: 'order-1',
      message: 'queued',
    });
    expect(html).toContain('ga-sales-success');
    expect(html).toContain('Order placed');
  });
});
