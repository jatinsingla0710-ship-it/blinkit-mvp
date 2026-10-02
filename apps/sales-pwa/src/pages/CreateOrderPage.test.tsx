import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type {
  CatalogueSkuRow,
  SalesmanOrderDetail,
  SalesmanOrderPreview,
} from '@groaurum/api-client';
import { retailerFixture } from '@/test-utils/fixtures';
import { findButton, isButtonDisabled, linkHref } from '@/test-utils/markup';
import type { OrderDraft } from '@/data/order-draft';

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, Record<string, unknown>>,
  draft: null as OrderDraft | null,
  online: true,
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
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha' }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({}),
}));

vi.mock('@/lib/useOnlineStatus', () => ({
  useOnlineStatus: () => mocks.online,
}));

vi.mock('@/data/order-draft', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    loadOrderDraft: () => mocks.draft,
    saveOrderDraft: () => true,
  };
});

import { ToastProvider } from '@/components/Toast';
import { CreateOrderPage } from './CreateOrderPage';
import { OrderConfirmation } from './create-order/OrderConfirmation';
import { OrderReview } from './create-order/OrderReview';

const REVIEW = 'Review order';

const now = '2026-09-27T10:00:00.000Z';
const riceRow = {
  sku: {
    id: 'sku-1',
    productId: 'prod-1',
    skuCode: 'BAS-1KG',
    name: 'Basmati 1kg',
    productType: 'PACKED',
    sellingUnit: 'PACK',
    netQuantity: 1,
    netQuantityUnit: 'kg',
    packsPerCarton: 10,
    outerType: 'bag',
    moq: 5,
    quantityStep: 5,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  product: {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: 'Basmati Rice',
    productType: 'PACKED',
    imageUrls: ['https://cdn.example.test/rice.jpg'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  category: null,
  unitPrice: 166,
  availableQuantity: 480,
} as unknown as CatalogueSkuRow;

const dalRow = {
  ...riceRow,
  sku: { ...riceRow.sku, id: 'sku-2', skuCode: 'DAL-1', name: 'Toor Dal 1kg', packsPerCarton: undefined, moq: 1, quantityStep: 1 },
  product: { ...riceRow.product, id: 'prod-2', name: 'Toor Dal', imageUrls: [] },
  unitPrice: 142,
  availableQuantity: 0,
} as unknown as CatalogueSkuRow;

function preview(qty: number, total: number, ok = true): SalesmanOrderPreview {
  return {
    lines: [
      {
        skuId: 'sku-1',
        quantity: qty,
        unitPrice: total / qty,
        lineTotal: total,
        availableQuantity: 480,
        ok,
        errorCode: ok ? null : 'INSUFFICIENT_STOCK',
        message: ok ? null : 'Only 40 available',
      },
    ],
    itemCount: 1,
    subtotal: total,
    total,
    currency: 'INR',
    allValid: ok,
    pricedAt: now,
  };
}

function render(url: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <CreateOrderPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function withCart(qty = 50) {
  mocks.draft = {
    version: 1,
    shopId: 'shop-1',
    lines: [{ skuId: 'sku-1', quantity: qty }],
    notes: '',
    updatedAt: now,
  };
}

beforeEach(() => {
  mocks.queries = {
    retailers: { data: [retailerFixture()] },
    'orderable-skus': { data: [riceRow, dalRow] },
  };
  mocks.draft = null;
  mocks.online = true;
});

describe('shop first (R, S)', () => {
  it('asks for the retailer first and offers search', () => {
    const html = render('/orders/new');
    expect(html).toContain('Search your customers');
    expect(html).toContain('Sharma Stores');
    expect(html).not.toContain('Search products');
    expect(findButton(html, REVIEW)).toBeNull();
  });

  it('cannot continue from ?shopId= alone while retailers are loading', () => {
    mocks.queries.retailers = { isLoading: true };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Loading customers…');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
    expect(html).not.toContain('Search products');
  });

  it('cannot continue when ?shopId= is not an assigned retailer', () => {
    mocks.queries.retailers = { data: [retailerFixture({ id: 'shop-2' })] };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('not in your assigned list');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
    expect(html).not.toContain('Search products');
  });

  it('R: blocks with an explanation when the shop has no service area', () => {
    withCart();
    mocks.queries.retailers = { data: [retailerFixture({ serviceAreaId: null })] };
    mocks.queries['order-preview'] = { data: preview(50, 8275) };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Sharma Stores has no service area');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('shows retailer load errors with a retry and blocks continuing', () => {
    mocks.queries.retailers = { isError: true, error: new Error('permission denied') };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Could not load your customers: permission denied');
    expect(isButtonDisabled(html, 'Retry customers')).toBe(false);
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });
});

describe('catalogue (F, S)', () => {
  it('shows image, name, price per selling unit, pack info; hides stock qty', () => {
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Search products');
    expect(html).toContain('Product name or SKU code');
    expect(html).toContain('src="https://cdn.example.test/rice.jpg"');
    expect(html).toContain('Basmati 1kg');
    expect(html).toContain('₹166');
    expect(html).toContain('/ Pack');
    expect(html).toContain('10 Packs per Bag');
    expect(html).not.toContain('In stock:');
    expect(html).toContain('Minimum 5 Packs');
  });

  it('marks out-of-stock products and does not let them be added', () => {
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Out of stock');
    expect(isButtonDisabled(html, 'Out of stock')).toBe(true);
    expect(isButtonDisabled(html, 'Add')).toBe(false);
  });

  it('shows product load errors with a retry', () => {
    mocks.queries['orderable-skus'] = { isError: true, error: new Error('timeout') };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Could not load products: timeout');
    expect(isButtonDisabled(html, 'Retry products')).toBe(false);
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('shows an empty catalogue message', () => {
    mocks.queries['orderable-skus'] = { data: [] };
    expect(render('/orders/new?shopId=shop-1')).toContain('No products to order yet');
  });

  it('shows a loading skeleton for products', () => {
    mocks.queries['orderable-skus'] = { isLoading: true };
    expect(render('/orders/new?shopId=shop-1')).toContain('Loading products…');
  });
});

describe('cart running total (H, J, L, M)', () => {
  it('shows the server total, pack breakdown and draft label', () => {
    withCart(50);
    mocks.queries['order-preview'] = { data: preview(50, 8275) };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('1 item');
    expect(html).toContain('₹8,275');
    expect(html).toContain('50 Packs = 5 Bags');
    expect(html).toContain('Line total <strong>₹8,275</strong>');
    expect(html).toContain('Draft — not submitted. Saved on this phone.');
    expect(isButtonDisabled(html, REVIEW)).toBe(false);
  });

  it('never shows a client-computed total while the server preview is pending', () => {
    withCart(50);
    mocks.queries['order-preview'] = { isFetching: true };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Calculating…');
    expect(html).not.toContain('₹8,300');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('ignores a preview for a different quantity (no stale total)', () => {
    withCart(55);
    mocks.queries['order-preview'] = { data: preview(50, 8275) };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Calculating…');
    expect(html).not.toContain('₹8,275');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('highlights server line problems and blocks review', () => {
    withCart(50);
    mocks.queries['order-preview'] = { data: preview(50, 8275, false) };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Only 40 available');
    expect(html).toContain('Fix the highlighted items to continue.');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('M: offline keeps the draft, labels it, and blocks pricing and review', () => {
    withCart(50);
    mocks.online = false;
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Offline');
    expect(html).toContain('Draft saved on this phone. Prices and submit need internet.');
    expect(html).toContain('50 Packs = 5 Bags');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });

  it('T: a failed preview shows an error with retry, never ₹0', () => {
    withCart(50);
    mocks.queries['order-preview'] = { isError: true, error: new Error('timeout') };
    const html = render('/orders/new?shopId=shop-1');
    expect(html).toContain('Total unavailable');
    expect(html).toContain('Couldn’t get prices: timeout');
    expect(isButtonDisabled(html, 'Retry prices')).toBe(false);
    expect(html).not.toContain('₹0');
    expect(isButtonDisabled(html, REVIEW)).toBe(true);
  });
});

describe('review step (O, T)', () => {
  const rowsBySku = new Map([[riceRow.sku.id, riceRow]]);
  function renderReview(props: Partial<Parameters<typeof OrderReview>[0]> = {}) {
    return renderToStaticMarkup(
      <MemoryRouter>
        <OrderReview
          shop={retailerFixture()}
          reviewed={preview(50, 8275)}
          rowsBySku={rowsBySku}
          notes=""
          onNotesChange={() => undefined}
          submitting={false}
          online
          failure={null}
          pricesChanged={false}
          onSubmit={() => undefined}
          onEdit={() => undefined}
          {...props}
        />
      </MemoryRouter>,
    );
  }

  it('shows shop, product, quantity, unit price, line total and grand total', () => {
    const html = renderReview();
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('Basmati Rice');
    expect(html).toContain('Basmati 1kg · BAS-1KG');
    expect(html).toContain('50 Packs = 5 Bags × ₹165.5');
    expect(html).toContain('Order total');
    expect(isButtonDisabled(html, 'Submit order · ₹8,275')).toBe(false);
  });

  it('O: disables submit while submitting', () => {
    const html = renderReview({ submitting: true });
    expect(isButtonDisabled(html, 'Submitting…')).toBe(true);
    expect(isButtonDisabled(html, 'Edit items')).toBe(true);
  });

  it('T: an uncertain result blocks resubmit and points to order history', () => {
    const html = renderReview({ failure: { kind: 'uncertain', message: 'timeout' } });
    expect(html).toContain('We couldn’t confirm whether this order was placed.');
    expect(isButtonDisabled(html, 'Submit order · ₹8,275')).toBe(true);
    expect(linkHref(html, 'Check order history')).toBe('/orders?tab=pending');
  });

  it('a rejection explains that nothing was placed and allows a fix', () => {
    const html = renderReview({
      failure: { kind: 'rejected', message: 'Not enough stock for one of the items.' },
    });
    expect(html).toContain('Order not placed: Not enough stock for one of the items.');
    expect(isButtonDisabled(html, 'Submit order · ₹8,275')).toBe(false);
  });

  it('warns when prices changed since review', () => {
    expect(renderReview({ pricesChanged: true })).toContain('Prices or stock changed');
  });

  it('cannot submit offline', () => {
    const html = renderReview({ online: false });
    expect(html).toContain('You are offline');
    expect(isButtonDisabled(html, 'Submit order · ₹8,275')).toBe(true);
  });
});

describe('confirmation (P, Q)', () => {
  const saved = {
    id: 'a1b2c3d4-0000',
    orderNumber: 'A1B2C3D4',
    shopName: 'Sharma Stores',
    total: 8275,
    status: 'AWAITING_CUSTOMER_CONFIRMATION',
  } as SalesmanOrderDetail;

  function renderConfirmation(props: Partial<Parameters<typeof OrderConfirmation>[0]>) {
    return renderToStaticMarkup(
      <MemoryRouter>
        <OrderConfirmation
          outcome={{ kind: 'confirmation_sent', orderId: 'a1b2c3d4-0000', message: 'queued' }}
          shopName="Sharma Stores"
          reviewedTotal={8275}
          order={saved}
          onNewOrder={() => undefined}
          {...props}
        />
      </MemoryRouter>,
    );
  }

  it('P: shows number, shop, total, real status and what happens next', () => {
    const html = renderConfirmation({});
    expect(html).toContain('Order placed');
    expect(html).toContain('#A1B2C3D4');
    expect(html).toContain('Sharma Stores');
    expect(html).toContain('₹8,275');
    expect(html).toContain('Awaiting customer approval');
    expect(html).toContain('What happens next');
    expect(html).not.toContain('Approved by customer');
    expect(html).not.toContain('Delivered');
    expect(linkHref(html, 'View order')).toBe('/orders/a1b2c3d4-0000');
  });

  it('Q: a failed approval request says the order exists and must not be re-placed', () => {
    const html = renderConfirmation({
      outcome: { kind: 'confirmation_failed', orderId: 'a1b2c3d4-0000', message: 'provider down' },
    });
    expect(html).toContain('Order created — confirmation not sent');
    expect(html).toContain('Order #A1B2C3D4 was created');
    expect(html).toContain('provider down');
    expect(html).toContain('Do not place this order again.');
    expect(html).not.toContain('ga-sales-success');
    expect(isButtonDisabled(html, 'Start another order')).toBe(false);
  });

  it('does not guess the status when it could not be read back', () => {
    const html = renderConfirmation({ order: null });
    expect(html).toContain('#A1B2C3D4');
    expect(html).toContain('Couldn’t load the status');
    expect(html).not.toContain('Awaiting customer approval');
  });
});
