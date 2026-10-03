import { describe, expect, it, vi } from 'vitest';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';
import { COMPANY_SETTING_KEY } from '@groaurum/validation';

function createServices(overrides: {
  list?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const repos = {
    settings: {
      list: overrides.list ?? vi.fn().mockResolvedValue([]),
      create: overrides.create ?? vi.fn(),
      update: overrides.update ?? vi.fn(),
    },
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices upsertSetting', () => {
  it('inserts when the setting_key does not exist', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'new-1' });
    const update = vi.fn();
    const { services } = createServices({
      list: vi.fn().mockResolvedValue([]),
      create,
      update,
    });

    await services.upsertSetting({
      settingKey: COMPANY_SETTING_KEY,
      settingValue: {
        companyName: 'GroAurum',
        email: 'ops@groaurum.in',
      },
      description: 'Company profile',
    });

    expect(create).toHaveBeenCalledWith({
      settingKey: COMPANY_SETTING_KEY,
      settingValue: {
        companyName: 'GroAurum',
        gstNumber: '',
        gstStateCode: '',
        pan: '',
        email: 'ops@groaurum.in',
        phone: '',
        logo: '',
        address: '',
      },
      description: 'Company profile',
      updatedByProfileId: undefined,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates an existing setting_key instead of inserting', async () => {
    const create = vi.fn();
    const update = vi.fn().mockResolvedValue({ id: 'row-1' });
    const { services } = createServices({
      list: vi.fn().mockResolvedValue([
        {
          id: 'row-1',
          settingKey: 'company',
          settingValue: { name: 'Old' },
        },
      ]),
      create,
      update,
    });

    await services.upsertSetting({
      settingKey: 'Company',
      settingValue: {
        companyName: 'GroAurum Wholesale',
        phoneLabel: '+911100000000',
        businessAddress: 'Okhla',
      },
    });

    expect(update).toHaveBeenCalledWith('row-1', {
      settingKey: 'Company',
      settingValue: {
        companyName: 'GroAurum Wholesale',
        gstNumber: '',
        gstStateCode: '',
        pan: '',
        email: '',
        phone: '+911100000000',
        logo: '',
        address: 'Okhla',
      },
      description: undefined,
      updatedByProfileId: undefined,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid company payloads before repository calls', () => {
    const create = vi.fn();
    const update = vi.fn();
    const list = vi.fn();
    const { services } = createServices({ create, update, list });

    expect(() =>
      services.upsertSetting({
        settingKey: COMPANY_SETTING_KEY,
        settingValue: { companyName: 'GroAurum', email: 'bad' },
      }),
    ).toThrow(/valid email/i);

    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects blank company names on write (no silent GroAurum default)', () => {
    const create = vi.fn();
    const list = vi.fn();
    const { services } = createServices({ create, list });

    expect(() =>
      services.upsertSetting({
        settingKey: COMPANY_SETTING_KEY,
        settingValue: { companyName: '   ' },
      }),
    ).toThrow();

    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not force company schema for unrelated setting keys', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pay-1' });
    const { services } = createServices({ create });

    await services.upsertSetting({
      settingKey: 'payments',
      settingValue: { codEnabled: true },
    });

    expect(create).toHaveBeenCalledWith({
      settingKey: 'payments',
      settingValue: { codEnabled: true },
      description: undefined,
      updatedByProfileId: undefined,
    });
  });
});
