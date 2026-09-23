import { describe, expect, it, vi } from 'vitest';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';
import { isDataError } from '@groaurum/data';

const AREA_ID = '11111111-1111-4111-8111-111111111111';
const SALESMAN_ID = '22222222-2222-4222-8222-222222222222';

const validInput = {
  tradeName: 'Sharma Kirana',
  ownerName: 'Ramesh Sharma',
  ownerMobile: '9876543210',
  serviceAreaId: AREA_ID,
  assignedSalesmanProfileId: SALESMAN_ID,
  deliveryAddressLine: 'Shop 12, Main Market',
  deliveryCity: 'New Delhi',
  deliveryState: 'Delhi',
  deliveryPinCode: '110017',
};

function createServices(overrides: {
  createCustomer?: ReturnType<typeof vi.fn>;
  listAreas?: ReturnType<typeof vi.fn>;
  listRules?: ReturnType<typeof vi.fn>;
}) {
  const repos = {
    customers: {
      create: overrides.createCustomer ?? vi.fn().mockResolvedValue({ id: 'shop-1' }),
    },
    serviceAreas: {
      list:
        overrides.listAreas ??
        vi.fn().mockResolvedValue([
          {
            id: AREA_ID,
            name: 'South Delhi',
            isActive: true,
            displayOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]),
    },
    serviceabilityRules: {
      list:
        overrides.listRules ??
        vi.fn().mockResolvedValue([
          {
            id: 'rule-1',
            serviceAreaId: AREA_ID,
            ruleType: 'PIN_CODE',
            isActive: true,
            config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]),
    },
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices customer create', () => {
  it('rejects invalid input before calling the repository', async () => {
    const createCustomer = vi.fn();
    const { services } = createServices({ createCustomer });
    await expect(
      services.createCustomer({ ...validInput, tradeName: '   ' }),
    ).rejects.toThrow();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('rejects a PIN that is not serviceable in the selected area', async () => {
    const createCustomer = vi.fn();
    const { services } = createServices({ createCustomer });
    await expect(
      services.createCustomer({ ...validInput, deliveryPinCode: '122001' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('not serviceable'),
    });
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('creates a customer after PIN and required-field validation', async () => {
    const createCustomer = vi.fn().mockResolvedValue({
      id: 'shop-1',
      serviceAreaId: AREA_ID,
      assignedSalesmanProfileId: SALESMAN_ID,
    });
    const { services } = createServices({ createCustomer });
    const row = await services.createCustomer(validInput);
    expect(row.serviceAreaId).toBe(AREA_ID);
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(createCustomer.mock.calls[0][0].assignedSalesmanProfileId).toBe(
      SALESMAN_ID,
    );
    expect(createCustomer.mock.calls[0][0].ownerMobile).toBe('+919876543210');
  });

  it('does not swallow serviceability failures as success', async () => {
    const { services } = createServices({});
    try {
      await services.createCustomer({ ...validInput, deliveryPinCode: '999999' });
      throw new Error('expected failure');
    } catch (error) {
      expect(isDataError(error)).toBe(true);
    }
  });
});
