import { describe, expect, it, vi } from 'vitest';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';

function createServices(overrides: {
  createArea?: ReturnType<typeof vi.fn>;
  updateArea?: ReturnType<typeof vi.fn>;
  listAreas?: ReturnType<typeof vi.fn>;
  createRule?: ReturnType<typeof vi.fn>;
  updateRule?: ReturnType<typeof vi.fn>;
  listRules?: ReturnType<typeof vi.fn>;
}) {
  const repos = {
    serviceAreas: {
      list: overrides.listAreas ?? vi.fn(),
      create: overrides.createArea ?? vi.fn(),
      update: overrides.updateArea ?? vi.fn(),
    },
    serviceabilityRules: {
      list: overrides.listRules ?? vi.fn(),
      create: overrides.createRule ?? vi.fn(),
      update: overrides.updateRule ?? vi.fn(),
    },
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices service area methods', () => {
  it('rejects invalid service area names before calling the repository', () => {
    const createArea = vi.fn();
    const { services } = createServices({ createArea });
    expect(() => services.createServiceArea({ name: '   ' })).toThrow();
    expect(createArea).not.toHaveBeenCalled();
  });

  it('rejects duplicate PIN codes before calling the repository', () => {
    const createRule = vi.fn();
    const { services } = createServices({ createRule });
    expect(() =>
      services.createServiceabilityRule({
        serviceAreaId: 'a2000000-0000-4000-8000-000000000001',
        ruleType: 'PIN_CODE',
        pinCodes: ['110017', '110017'],
      }),
    ).toThrow();
    expect(createRule).not.toHaveBeenCalled();
  });

  it('creates a PIN rule after validation', async () => {
    const createRule = vi.fn().mockResolvedValue({ id: 'rule-1' });
    const { services } = createServices({ createRule });
    await services.createServiceabilityRule({
      serviceAreaId: 'a2000000-0000-4000-8000-000000000001',
      ruleType: 'PIN_CODE',
      pinCodes: ['110017', '110074'],
    });
    expect(createRule).toHaveBeenCalledWith({
      serviceAreaId: 'a2000000-0000-4000-8000-000000000001',
      ruleType: 'PIN_CODE',
      pinCodes: ['110017', '110074'],
    });
  });
});
