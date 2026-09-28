import { describe, expect, it } from 'vitest';
import { retailerFixture } from '@/test-utils/fixtures';
import { filterRetailers } from './customer-search';

const shops = [
  retailerFixture({
    id: 'a',
    tradeName: 'Sharma Stores',
    primaryContactName: 'Ravi',
    primaryContactMobile: '9876543210',
    areaLabel: 'North',
    city: 'Delhi',
  }),
  retailerFixture({
    id: 'b',
    tradeName: 'Mehta Mart',
    primaryContactName: 'Anita',
    primaryContactMobile: '9000000001',
    areaLabel: 'West',
    city: 'Mumbai',
  }),
];

describe('customer search (A)', () => {
  it('matches shop name, contact, mobile, and area', () => {
    expect(filterRetailers(shops, 'sharma').map((s) => s.id)).toEqual(['a']);
    expect(filterRetailers(shops, 'anita').map((s) => s.id)).toEqual(['b']);
    expect(filterRetailers(shops, '98765').map((s) => s.id)).toEqual(['a']);
    expect(filterRetailers(shops, 'west').map((s) => s.id)).toEqual(['b']);
    expect(filterRetailers(shops, '   ').map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterRetailers(shops, 'no-such-shop')).toEqual([]);
  });
});
