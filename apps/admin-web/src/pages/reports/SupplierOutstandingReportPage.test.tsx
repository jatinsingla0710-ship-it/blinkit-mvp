import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SupplierOutstandingReportPage } from './SupplierOutstandingReportPage';

const mocks = vi.hoisted(() => ({
  snapshot: {
    generatedAtLabel: '20 Oct 2026',
    totalOutstanding: 1000,
    totalOutstandingLabel: '₹1,000',
    totalSupplierCredit: 0,
    totalSupplierCreditLabel: '₹0',
    suppliersWithDues: 1,
    rows: [
      {
        supplierId: 's1',
        supplierName: 'Acme Oils',
        contactLabel: 'Ravi',
        mobileLabel: '999',
        totalPurchases: 1000,
        totalPurchasesLabel: '₹1,000',
        totalPaid: 0,
        totalPaidLabel: '₹0',
        outstanding: 1000,
        outstandingLabel: '₹1,000',
        supplierCredit: 0,
        supplierCreditLabel: '₹0',
        lastPaymentAtLabel: null,
        oldestOpenDays: 20,
        ageingBucket: 'days_1_30' as const,
        ageingLabel: '1–30 days',
        ledgerHref: '/suppliers/s1',
        payHref: '/suppliers/s1/pay',
      },
    ],
  },
}));

vi.mock('@/data/hooks', () => ({
  useSupplierPayablesSnapshotQuery: () => ({
    state: {
      isLoading: false,
      isError: false,
      isEmpty: false,
      data: mocks.snapshot,
      error: null,
    },
  }),
}));

describe('SupplierOutstandingReportPage', () => {
  it('shows supplier ledger dues and a link to Money to Pay', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SupplierOutstandingReportPage />
      </MemoryRouter>,
    );
    expect(html).toContain('Supplier Outstanding');
    expect(html).toContain('Acme Oils');
    expect(html).toContain('/payables');
    expect(html).toContain('To pay (filtered)');
    expect(html).not.toContain('invent');
  });
});
