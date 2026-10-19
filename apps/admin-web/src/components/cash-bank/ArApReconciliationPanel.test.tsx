import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CASH_BANK_JOURNAL_ENTRY_LIMIT, buildArApReconciliation } from '@/data/ar-ap-reconciliation';
import { toArApReconciliationView } from '@/data/ar-ap-reconciliation-view';
import { ArApReconciliationPanel } from './ArApReconciliationPanel';

describe('ArApReconciliationPanel', () => {
  it('renders the incomplete headline and both sides', () => {
    const view = toArApReconciliationView(
      buildArApReconciliation({
        asOfDate: '2026-10-15',
        todayBusinessDate: '2026-10-15',
        domainReceivablesTotal: 10,
        booksArBalance: 10,
        domainPayablesTotal: 4,
        booksApBalance: 4,
        pendingSupplierPaymentTotal: 20,
        booksEntryCount: 1,
        entryLimit: CASH_BANK_JOURNAL_ENTRY_LIMIT,
      }),
    );
    const html = renderToStaticMarkup(<ArApReconciliationPanel view={view} />);
    expect(html).toContain('Books check');
    expect(html).toContain('does not say the books match');
    expect(html).toContain('Money Due');
    expect(html).toContain('Money to Pay');
    expect(html).toContain('Not compared');
    expect(html).not.toContain('match Books within');
  });
});
