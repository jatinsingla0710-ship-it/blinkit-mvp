import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CustomerDetailPage } from './CustomerDetailPage';
import type { CustomerDetail } from '@/data/customers-types';
import { buildCustomerLedger } from '@/data/customer-ledger';
import { CustomerReceivePaymentModal } from '@/components/customers/CustomerReceivePaymentModal';
import { CustomerOpeningBalanceModal } from '@/components/customers/CustomerOpeningBalanceModal';
import { CustomerBillPhotosPanel } from '@/components/customers/CustomerBillPhotosPanel';
import { CustomerAccountSummaryCards } from '@/components/customers/account/CustomerAccountSummaryCards';
import { CustomerPrimaryActions } from '@/components/customers/CustomerPrimaryActions';

const mocks = vi.hoisted(() => ({
  customer: null as CustomerDetail | null,
  documents: [] as Array<{
    id: string;
    title: string | null;
    signedUrl: string | null;
    billNumber: string | null;
    billDate: string | null;
    createdAtLabel: string;
    notes: string | null;
  }>,
  documentsPending: false,
  recordCollection: vi.fn(),
  setOpening: vi.fn(),
  softDeleteDocument: vi.fn(),
  archiveCustomer: vi.fn(),
  canManage: true,
}));

vi.mock('@groaurum/auth/react', () => ({
  usePermissions: () => ({
    hasPermission: () => mocks.canManage,
  }),
}));

vi.mock('@/data/hooks', () => ({
  useCustomerDetailQuery: () => ({
    state: {
      isLoading: false,
      isError: false,
      isEmpty: !mocks.customer,
      data: mocks.customer,
      error: null,
    },
  }),
  useCustomerDocumentsQuery: () => ({
    data: mocks.documents,
    isPending: mocks.documentsPending,
  }),
  useSalesmenSnapshotQuery: () => ({
    state: { isLoading: false, isError: false, isEmpty: false, data: { rows: [] } },
  }),
  useServiceAreasListQuery: () => ({
    state: { isLoading: false, isError: false, isEmpty: false, data: [] },
  }),
}));

vi.mock('@/data/mutations', () => ({
  useRecordCustomerCollectionMutation: () => ({
    isPending: false,
    mutateAsync: mocks.recordCollection,
  }),
  useSetShopOpeningBalanceMutation: () => ({
    isPending: false,
    mutateAsync: mocks.setOpening,
  }),
  useCreateCustomerDocumentMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useUploadCustomerDocumentImageMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useSoftDeleteCustomerDocumentMutation: () => ({
    isPending: false,
    mutateAsync: mocks.softDeleteDocument,
  }),
  useArchiveCustomerMutation: () => ({
    isPending: false,
    mutateAsync: mocks.archiveCustomer,
  }),
  useUpdateCustomerMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useUpdateCustomerContactMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useReassignShopSalesmanMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

function sampleCustomer(overrides?: Partial<CustomerDetail>): CustomerDetail {
  const ledger = buildCustomerLedger({
    orders: [
      {
        id: 'o1',
        shop_id: 'c1',
        status: 'DELIVERED',
        total: 5000,
        created_at: '2026-04-10T10:00:00.000Z',
        order_code: 'GA-1',
      },
    ],
    payments: [],
    opening: {
      id: 'ob1',
      amount: 20000,
      asOfDate: '2026-04-01',
      note: 'Legacy',
    },
    shopCollections: [
      {
        id: 'sc1',
        amount: 8000,
        method: 'UPI',
        atIso: '2026-04-15T10:00:00.000Z',
      },
    ],
    shopId: 'c1',
  });

  return {
    id: 'c1',
    shopName: 'ABC Traders',
    ownerName: 'Ravi',
    phoneLabel: '9876543210',
    areaLabel: 'North',
    salesmanName: 'Amit',
    preferredPayment: 'not_set',
    status: 'active',
    digitalAccess: 'not_activated',
    digitalAccessVm: {
      status: 'not_activated',
      label: 'Not activated',
      description: '',
      tone: 'muted',
    },
    activationState: 'created',
    orderClass: 'repeat',
    orderClassLabel: 'Repeat',
    createdAtLabel: '01 Apr 2026',
    updatedAtLabel: '15 Apr 2026',
    health: {
      ordersThisMonth: 1,
      averageOrderValueLabel: '₹5,000',
      lastOrderDateLabel: '10 Apr 2026',
      lastPaymentStatus: 'PAID',
    },
    summary: {
      totalOrders: 1,
      totalSalesLabel: '₹5,000',
      currentOrders: 0,
      outForDelivery: 0,
      needsAttention: 0,
      outstandingLabel: ledger.outstandingLabel,
      fySalesLabel: '₹5,000',
      fyLabel: 'FY',
      completedSalesCount: 1,
      lastPurchaseLabel: '10 Apr 2026',
    },
    ledger,
    openingBalance: {
      id: 'ob1',
      amount: 20000,
      amountLabel: '₹20,000',
      asOfDate: '2026-04-01',
      asOfDateLabel: '01 Apr 2026',
      note: 'Legacy',
    },
    attentionItems: [],
    timeline: [],
    activation: [],
    orders: [
      {
        id: 'o1',
        orderCode: 'GA-1',
        valueLabel: '₹5,000',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'UNPAID',
        placedAtLabel: '10 Apr 2026',
        placedAtIso: '2026-04-10T10:00:00.000Z',
        totalAmount: 5000,
      },
    ],
    payments: [
      {
        id: 'sc1',
        orderCode: 'Receive payment',
        methodLabel: 'UPI',
        amountLabel: '₹8,000',
        status: 'PAID',
        atLabel: '15 Apr 2026',
        atIso: '2026-04-15T10:00:00.000Z',
        source: 'collection',
      },
    ],
    addresses: [],
    activity: [],
    documents: [],
    ...overrides,
  };
}

function renderPage(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/customers/c1']}>
      <Routes>
        <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.customer = sampleCustomer();
  mocks.documents = [];
  mocks.documentsPending = false;
  mocks.canManage = true;
  mocks.recordCollection.mockReset();
  mocks.setOpening.mockReset();
  mocks.softDeleteDocument.mockReset();
  mocks.archiveCustomer.mockReset();
});

describe('CustomerDetailPage (Phase 4D)', () => {
  it('loads customer and shows outstanding prominently', () => {
    const html = renderPage();
    expect(html).toContain('ABC Traders');
    expect(html).toContain('9876543210');
    expect(html).toContain('Outstanding');
    expect(html).toContain('₹17,000');
    expect(html).toContain('Receive payment');
    expect(html).toContain('Add bill photo');
    expect(html).toContain('₹20,000');
  });

  it('shows ledger with opening, sale, and collection labels', () => {
    const html = renderPage();
    expect(html).toContain('Opening balance');
    expect(html).toContain('Sale');
    expect(html).toContain('Collection');
    expect(html).toContain('Ledger');
    expect(html).toContain('Bills &amp; Photos');
  });

  it('shows bills count in tab when documents exist', () => {
    mocks.documents = [
      {
        id: 'd1',
        title: 'October bill',
        signedUrl: 'https://signed.example/bill.jpg',
        billNumber: 'B-9',
        billDate: '2026-10-01',
        createdAtLabel: '02 Oct 2026',
        notes: null,
      },
    ];
    const html = renderPage();
    expect(html).toContain('Bills &amp; Photos (1)');
  });
});

describe('CustomerAccountSummaryCards', () => {
  it('renders outstanding hero and opening balance', () => {
    const html = renderToStaticMarkup(
      <CustomerAccountSummaryCards
        totalSalesLabel="₹1,50,000"
        totalPaidLabel="₹1,30,000"
        outstandingLabel="₹20,000"
        outstanding={20000}
        openingBalance={{
          id: 'ob',
          amount: 20000,
          amountLabel: '₹20,000',
          asOfDate: '2026-04-01',
          asOfDateLabel: '01 Apr 2026',
          note: null,
        }}
      />,
    );
    expect(html).toContain('Outstanding');
    expect(html).toContain('ga-cust-account-kpi__value--hero');
    expect(html).toContain('Sales');
    expect(html).toContain('Paid');
    expect(html).toContain('Opening balance');
  });
});

describe('CustomerPrimaryActions', () => {
  it('renders receive payment and add bill photo', () => {
    const html = renderToStaticMarkup(
      <CustomerPrimaryActions
        canManage
        outstanding={1000}
        hasOpening={false}
        onReceivePayment={() => undefined}
        onAddBillPhoto={() => undefined}
        onOpeningBalance={() => undefined}
      />,
    );
    expect(html).toContain('Receive payment');
    expect(html).toContain('Add bill photo');
    expect(html).toContain('Set opening balance');
  });

  it('disables receive payment when nothing is outstanding', () => {
    const html = renderToStaticMarkup(
      <CustomerPrimaryActions
        canManage
        outstanding={0}
        hasOpening
        onReceivePayment={() => undefined}
        onAddBillPhoto={() => undefined}
        onOpeningBalance={() => undefined}
      />,
    );
    expect(html).toMatch(/disabled[^>]*>[\s\n]*Receive payment/);
    expect(html).toContain('Edit opening balance');
  });
});

describe('CustomerReceivePaymentModal', () => {
  it('shows outstanding, payment methods, and blocks submit when nothing due', () => {
    mocks.recordCollection.mockResolvedValue({
      id: 'col-1',
      amount: 5000,
      outstanding: 15000,
    });
    // SSR cannot click — assert copy and disabled submit for zero outstanding.
    const withDue = renderToStaticMarkup(
      <CustomerReceivePaymentModal
        open
        onClose={() => undefined}
        shopId="c1"
        shopName="ABC Traders"
        outstanding={20000}
        outstandingLabel="₹20,000"
      />,
    );
    expect(withDue).toContain('Receive payment');
    expect(withDue).toContain('Current outstanding');
    expect(withDue).toContain('₹20,000');
    expect(withDue).toContain('Payment method');
    expect(withDue).toContain('UPI');

    const zeroDue = renderToStaticMarkup(
      <CustomerReceivePaymentModal
        open
        onClose={() => undefined}
        shopId="c1"
        shopName="ABC Traders"
        outstanding={0}
        outstandingLabel="₹0"
      />,
    );
    expect(zeroDue).toContain('Nothing is outstanding for this customer.');
    expect(zeroDue).toMatch(/disabled[^>]*>[\s\n]*Receive payment/);
  });

  it('shows outstanding label used by overpayment validation', () => {
    const html = renderToStaticMarkup(
      <CustomerReceivePaymentModal
        open
        onClose={() => undefined}
        shopId="c1"
        shopName="ABC Traders"
        outstanding={1000}
        outstandingLabel="₹1,000"
      />,
    );
    expect(html).toContain('₹1,000');
  });
});

describe('CustomerOpeningBalanceModal', () => {
  it('explains opening balance in owner language', () => {
    const html = renderToStaticMarkup(
      <CustomerOpeningBalanceModal
        open
        onClose={() => undefined}
        shopId="c1"
        shopName="ABC Traders"
        existing={{
          id: 'ob1',
          amount: 20000,
          amountLabel: '₹20,000',
          asOfDate: '2026-04-01',
          asOfDateLabel: '01 Apr 2026',
          note: null,
        }}
      />,
    );
    expect(html).toContain('already owed before using RichlyBook');
    expect(html).toContain('₹20,000');
    expect(html).toContain('Customer owes you');
  });
});

describe('CustomerBillPhotosPanel', () => {
  it('shows empty state and uses signed URL for preview', () => {
    const empty = renderToStaticMarkup(
      <CustomerBillPhotosPanel
        shopId="c1"
        documents={[]}
        canManage
        onAdd={() => undefined}
      />,
    );
    expect(empty).toContain('No bills or documents added yet.');
    expect(empty).toContain('Add bill photo');

    const withDoc = renderToStaticMarkup(
      <CustomerBillPhotosPanel
        shopId="c1"
        documents={[
          {
            id: 'd1',
            shopId: 'c1',
            documentType: 'BILL_PHOTO',
            storagePath: 'd1/bill.jpg',
            mimeType: 'image/jpeg',
            byteSize: 1200,
            title: 'October bill',
            notes: null,
            billDate: '2026-10-01',
            billNumber: 'B-9',
            ocrStatus: 'NONE',
            uploadedByProfileId: null,
            createdAt: '2026-10-02T10:00:00.000Z',
            createdAtLabel: '02 Oct 2026',
            signedUrl: 'https://signed.example/bill.jpg',
          },
        ]}
        canManage
        onAdd={() => undefined}
      />,
    );
    expect(withDoc).toContain('https://signed.example/bill.jpg');
    expect(withDoc).toContain('October bill');
    expect(withDoc).toContain('Bill #B-9');
    expect(withDoc).toContain('Remove');
  });
});

describe('customer accounting integrity on page data', () => {
  it('opening + sale − collection = outstanding', () => {
    const customer = sampleCustomer();
    expect(customer.ledger.outstanding).toBe(17000);
    expect(customer.openingBalance?.amount).toBe(20000);
    expect(customer.payments.some((p) => p.source === 'collection')).toBe(true);
  });
});
