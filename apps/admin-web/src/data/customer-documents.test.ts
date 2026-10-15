import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_DOCUMENT_BUCKET,
  CUSTOMER_DOCUMENT_MAX_BYTES,
  customerDocumentStoragePath,
} from './customer-documents';

describe('customer-documents helpers', () => {
  it('uses private customer-documents bucket and 10 MB limit', () => {
    expect(CUSTOMER_DOCUMENT_BUCKET).toBe('customer-documents');
    expect(CUSTOMER_DOCUMENT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it('builds document-scoped storage paths', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(customerDocumentStoragePath(id, 'image/jpeg')).toBe(
      `${id}/bill.jpg`,
    );
    expect(customerDocumentStoragePath(id, 'image/png')).toBe(
      `${id}/bill.png`,
    );
    expect(customerDocumentStoragePath(id, 'image/webp')).toBe(
      `${id}/bill.webp`,
    );
  });
});
