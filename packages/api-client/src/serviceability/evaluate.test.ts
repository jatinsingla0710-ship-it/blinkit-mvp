import { describe, expect, it } from 'vitest';
import { evaluateServiceabilityRules, serviceAreaAcceptsPin } from './evaluate';
import type { ServiceArea, ServiceabilityRule } from '@groaurum/shared-types';

const areaA: ServiceArea = {
  id: 'area-a',
  name: 'Alpha',
  isActive: true,
  displayOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const areaB: ServiceArea = {
  id: 'area-b',
  name: 'Beta',
  isActive: true,
  displayOrder: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const inactiveArea: ServiceArea = {
  ...areaA,
  id: 'area-inactive',
  name: 'Inactive',
  isActive: false,
};

describe('evaluateServiceabilityRules', () => {
  it('returns SERVICEABLE for matching active PIN_CODE rule', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-1',
        serviceAreaId: 'area-a',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([areaA, areaB], rules, {
      pinCode: '110017',
    });
    expect(result.status).toBe('SERVICEABLE');
    expect(result.serviceable).toBe(true);
    expect(result.serviceArea?.id).toBe('area-a');
    expect(result.matchedRuleId).toBe('rule-1');
  });

  it('returns NOT_SERVICEABLE for inactive service area', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-1',
        serviceAreaId: 'area-inactive',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([inactiveArea], rules, {
      pinCode: '110017',
    });
    expect(result.status).toBe('NOT_SERVICEABLE');
    expect(result.serviceable).toBe(false);
  });

  it('ignores inactive rules', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-1',
        serviceAreaId: 'area-a',
        ruleType: 'PIN_CODE',
        isActive: false,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([areaA], rules, { pinCode: '110017' });
    expect(result.status).toBe('NOT_SERVICEABLE');
  });

  it('returns INSUFFICIENT_ADDRESS_DATA when pin and admin area missing', () => {
    const result = evaluateServiceabilityRules([areaA], [], {});
    expect(result.status).toBe('INSUFFICIENT_ADDRESS_DATA');
  });

  it('returns NOT_SERVICEABLE when no rule matches', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-1',
        serviceAreaId: 'area-a',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([areaA], rules, { pinCode: '122001' });
    expect(result.status).toBe('NOT_SERVICEABLE');
  });

  it('prefers lower displayOrder when multiple areas match', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-b',
        serviceAreaId: 'area-b',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'rule-a',
        serviceAreaId: 'area-a',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([areaB, areaA], rules, {
      pinCode: '110017',
    });
    expect(result.serviceArea?.id).toBe('area-a');
    expect(result.matchedRuleId).toBe('rule-a');
  });

  it('matches ADMIN_AREA rules using adminAreaCode', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-admin',
        serviceAreaId: 'area-a',
        ruleType: 'ADMIN_AREA',
        isActive: true,
        config: { ruleType: 'ADMIN_AREA', areaCodes: ['DL-SOUTH'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const result = evaluateServiceabilityRules([areaA], rules, {
      adminAreaCode: 'DL-SOUTH',
    });
    expect(result.status).toBe('SERVICEABLE');
    expect(result.matchedRuleId).toBe('rule-admin');
  });
});

describe('serviceAreaAcceptsPin', () => {
  it('accepts a PIN listed on the selected active area', () => {
    const rules: ServiceabilityRule[] = [
      {
        id: 'rule-1',
        serviceAreaId: 'area-a',
        ruleType: 'PIN_CODE',
        isActive: true,
        config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    expect(serviceAreaAcceptsPin('area-a', '110017', [areaA], rules)).toBe(true);
    expect(serviceAreaAcceptsPin('area-a', '110074', [areaA], rules)).toBe(false);
    expect(serviceAreaAcceptsPin('area-b', '110017', [areaA, areaB], rules)).toBe(
      false,
    );
  });
});
