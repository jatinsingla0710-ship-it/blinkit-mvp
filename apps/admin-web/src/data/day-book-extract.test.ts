import { describe, expect, it } from 'vitest';
import {
  applyDayBookMatches,
  matchCustomerFromHints,
  parseDayBookExtractJson,
  parseDayBookSourceText,
} from './day-book-extract';

describe('Phase 15 day book / rojnama extract', () => {
  it('parses expense, supplier, and ambiguous collection lines', () => {
    const extract = parseDayBookSourceText(
      ['Cash expense 1200', 'ABC supplier 15000', 'Ramesh 4500', 'Rahul received 8000'].join(
        '\n',
      ),
    );
    expect(extract.extractorLabel).toBe('line-rules');
    expect(extract.lines).toHaveLength(4);
    expect(extract.lines[0]?.kind).toBe('expense');
    expect(extract.lines[0]?.amount).toBe(1200);
    expect(extract.lines[1]?.kind).toBe('supplier_payment');
    expect(extract.lines[2]?.kind).toBe('unknown');
    expect(extract.lines[2]?.ambiguous).toBe(true);
    expect(extract.lines[3]?.kind).toBe('collection');
    expect(extract.lines[3]?.decision).toBe('needs_order');
  });

  it('matches customers and upgrades unknown lines when unique', () => {
    const customers = [
      { id: 'c1', shopName: 'Ramesh Traders', ownerName: 'Ramesh' },
    ];
    const suppliers = [{ id: 's1', name: 'ABC Traders', gstin: null }];
    const base = parseDayBookSourceText('Ramesh 4500\nABC Traders 15000');
    const matched = applyDayBookMatches(base, customers, suppliers);
    expect(matched.lines[0]?.kind).toBe('collection');
    expect(matched.lines[0]?.matchedCustomerId).toBe('c1');
    expect(matched.lines[0]?.decision).toBe('needs_order');
    expect(matched.lines[1]?.kind).toBe('supplier_payment');
    expect(matched.lines[1]?.matchedSupplierId).toBe('s1');
  });

  it('matchCustomerFromHints prefers exact shop/owner name', () => {
    expect(
      matchCustomerFromHints(
        [{ id: 'c1', shopName: 'Ramesh Traders', ownerName: 'Ramesh' }],
        { name: 'ramesh' },
      ).customerMatchConfidence,
    ).toBe('exact');
  });

  it('parses extract JSON safely', () => {
    const parsed = parseDayBookExtractJson({
      entryDate: '2026-10-03',
      extractorLabel: 'line-rules',
      lines: [{ rawText: 'x', kind: 'expense', amount: '99', decision: 'include' }],
    });
    expect(parsed.lines[0]?.amount).toBe(99);
    expect(parsed.lines[0]?.kind).toBe('expense');
  });
});
