import { describe, expect, it } from 'vitest';
import type { ServiceAreaListItem } from './service-area-model';
import {
  findActiveServiceAreasForPin,
  lookupPinServiceability,
  resolveServiceAreaIdForPin,
  serviceAreaOptionsForPin,
} from './customer-pin-lookup';

const SOUTH: ServiceAreaListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'South Delhi',
  description: '',
  status: 'active',
  displayOrder: 0,
  pinCodes: ['110017', '110074'],
  pinCount: 2,
  pinRuleId: 'rule-south',
};

const EAST: ServiceAreaListItem = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'East Delhi',
  description: '',
  status: 'active',
  displayOrder: 1,
  pinCodes: ['110074', '110091'],
  pinCount: 2,
  pinRuleId: 'rule-east',
};

const INACTIVE: ServiceAreaListItem = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Inactive Area',
  description: '',
  status: 'inactive',
  displayOrder: 2,
  pinCodes: ['110074'],
  pinCount: 1,
  pinRuleId: 'rule-inactive',
};

const AREAS = [SOUTH, EAST, INACTIVE];

describe('customer pin lookup', () => {
  it('finds matching active service areas for a PIN', () => {
    expect(findActiveServiceAreasForPin('110074', AREAS).map((area) => area.id)).toEqual([
      SOUTH.id,
      EAST.id,
    ]);
    expect(findActiveServiceAreasForPin('110017', AREAS).map((area) => area.id)).toEqual([
      SOUTH.id,
    ]);
  });

  it('returns a single matched service area', () => {
    const result = lookupPinServiceability('110017', AREAS);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.area.id).toBe(SOUTH.id);
    }
  });

  it('returns multiple matches without choosing arbitrarily', () => {
    const result = lookupPinServiceability('110074', AREAS);
    expect(result).toEqual({
      status: 'multiple',
      pinCode: '110074',
      areas: [SOUTH, EAST],
    });
  });

  it('reports when no active service area matches the PIN', () => {
    expect(lookupPinServiceability('122001', AREAS)).toEqual({
      status: 'not_serviceable',
      pinCode: '122001',
    });
  });

  it('clears stale service area when PIN changes to an unmatched value', () => {
    expect(resolveServiceAreaIdForPin('122001', AREAS, SOUTH.id)).toBe('');
  });

  it('keeps a valid selected area when multiple areas match', () => {
    expect(resolveServiceAreaIdForPin('110074', AREAS, EAST.id)).toBe(EAST.id);
    expect(resolveServiceAreaIdForPin('110074', AREAS, SOUTH.id)).toBe(SOUTH.id);
  });

  it('clears an invalid selected area when multiple areas match', () => {
    expect(
      resolveServiceAreaIdForPin(
        '110074',
        AREAS,
        '99999999-9999-4999-8999-999999999999',
      ),
    ).toBe('');
  });

  it('limits service area options to PIN matches once lookup is known', () => {
    expect(serviceAreaOptionsForPin('110017', AREAS).map((area) => area.id)).toEqual([
      SOUTH.id,
    ]);
    expect(serviceAreaOptionsForPin('110074', AREAS).map((area) => area.id)).toEqual([
      SOUTH.id,
      EAST.id,
    ]);
    expect(serviceAreaOptionsForPin('122001', AREAS)).toEqual([]);
  });

  it('does not hardcode a service area UUID during lookup', () => {
    const result = lookupPinServiceability('110017', AREAS);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.area.id).toBe(SOUTH.id);
      expect(result.area.id).not.toBe('a2000000-0000-4000-8000-000000000001');
    }
  });
});
