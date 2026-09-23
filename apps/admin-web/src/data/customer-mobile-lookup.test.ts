import { describe, expect, it } from 'vitest';
import {
  formatDuplicateMobileWarning,
  isMobileLookupReady,
  normalizeMobileForLookup,
} from './customer-mobile-lookup';

describe('customer mobile lookup', () => {
  it('normalizes 10-digit and +91 numbers', () => {
    expect(normalizeMobileForLookup('9876543210')).toBe('+919876543210');
    expect(normalizeMobileForLookup('+91 98765 43210')).toBe('+919876543210');
    expect(normalizeMobileForLookup('919876543210')).toBe('+919876543210');
  });

  it('rejects incomplete numbers', () => {
    expect(normalizeMobileForLookup('98765')).toBeNull();
    expect(isMobileLookupReady('98765')).toBe(false);
    expect(isMobileLookupReady('9876543210')).toBe(true);
  });

  it('formats duplicate warning without blocking create', () => {
    const message = formatDuplicateMobileWarning([
      {
        shopId: 's1',
        shopName: 'ABC Grocery',
        ownerName: 'Owner',
        mobile: '+919876543210',
        isActive: true,
      },
      {
        shopId: 's2',
        shopName: 'XYZ Traders',
        ownerName: 'Owner',
        mobile: '+919876543210',
        isActive: true,
      },
    ]);
    expect(message).toContain('ABC Grocery');
    expect(message).toContain('XYZ Traders');
    expect(message).toMatch(/still create/i);
  });
});
