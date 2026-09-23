import { describe, expect, it } from 'vitest';
import {
  invoiceDocumentDateLabel,
  salesInvoiceHref,
} from './order-helpers';

describe('sales H1 invoice helpers', () => {
  it('uses sale conversion date when a sale exists', () => {
    expect(
      invoiceDocumentDateLabel({
        placedAtLabel: '01 Jan 2026, 10:00',
        placedDateLabel: '01 Jan 2026',
        sale: { convertedAtLabel: '15 Feb 2026, 14:30' },
      }),
    ).toBe('15 Feb 2026, 14:30');
  });

  it('falls back to placed date when no sale', () => {
    expect(
      invoiceDocumentDateLabel({
        placedAtLabel: '01 Jan 2026, 10:00',
        placedDateLabel: '01 Jan 2026',
      }),
    ).toBe('01 Jan 2026');
  });

  it('builds honest sales register invoice links', () => {
    expect(salesInvoiceHref('ord-1')).toBe('/sales/ord-1');
    expect(salesInvoiceHref('ord-1', { preview: true })).toBe(
      '/sales/ord-1?preview=1',
    );
  });
});
