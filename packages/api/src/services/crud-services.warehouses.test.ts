import { describe, expect, it, vi } from 'vitest';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';

function createServices(overrides: {
  createWarehouse?: ReturnType<typeof vi.fn>;
  updateWarehouse?: ReturnType<typeof vi.fn>;
  listWarehouses?: ReturnType<typeof vi.fn>;
}) {
  const repos = {
    operationalLocations: {
      list: overrides.listWarehouses ?? vi.fn(),
      create: overrides.createWarehouse ?? vi.fn(),
      update: overrides.updateWarehouse ?? vi.fn(),
    },
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices warehouse methods', () => {
  it('rejects invalid warehouse names before calling the repository', () => {
    const createWarehouse = vi.fn();
    const { services } = createServices({ createWarehouse });
    expect(() =>
      services.createWarehouse({
        name: '   ',
        addressLine: 'Sector 37',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '110074',
      }),
    ).toThrow();
    expect(createWarehouse).not.toHaveBeenCalled();
  });

  it('rejects invalid PIN codes before calling the repository', () => {
    const createWarehouse = vi.fn();
    const { services } = createServices({ createWarehouse });
    expect(() =>
      services.createWarehouse({
        name: 'Test Warehouse',
        addressLine: 'Sector 37',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '11007',
      }),
    ).toThrow();
    expect(createWarehouse).not.toHaveBeenCalled();
  });

  it('creates a warehouse after validation', async () => {
    const createWarehouse = vi.fn().mockResolvedValue({ id: 'wh-1' });
    const { services } = createServices({ createWarehouse });
    await services.createWarehouse({
      name: 'Test Warehouse',
      addressLine: 'Sector 37',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
    });
    expect(createWarehouse).toHaveBeenCalledWith({
      name: 'Test Warehouse',
      addressLine: 'Sector 37',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
    });
  });

  it('deactivates a warehouse via update', async () => {
    const updateWarehouse = vi.fn().mockResolvedValue({ id: 'wh-1', isActive: false });
    const { services } = createServices({ updateWarehouse });
    await services.updateWarehouse('wh-1', { isActive: false });
    expect(updateWarehouse).toHaveBeenCalledWith('wh-1', { isActive: false });
  });
});
