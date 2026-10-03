import { describe, expect, it } from 'vitest';
import {
  COMPANY_SETTING_KEY,
  companySettingsValueSchema,
  parseCompanySettingsValue,
  toCompanySettingsJson,
} from './company-settings';

describe('company settings JSON contract', () => {
  it('exports the stable company setting key', () => {
    expect(COMPANY_SETTING_KEY).toBe('company');
  });

  it('parses canonical keys', () => {
    expect(
      parseCompanySettingsValue({
        companyName: 'Acme Wholesale',
        gstNumber: '07AABCG1234D1Z5',
        pan: 'AABCG1234D',
        email: 'ops@acme.in',
        phone: '+911123456789',
        logo: 'logo.png',
        address: 'Okhla, New Delhi',
      }),
    ).toEqual({
      companyName: 'Acme Wholesale',
      gstNumber: '07AABCG1234D1Z5',
      gstStateCode: '',
      pan: 'AABCG1234D',
      email: 'ops@acme.in',
      phone: '+911123456789',
      logo: 'logo.png',
      address: 'Okhla, New Delhi',
    });
  });

  it('maps legacy keys into the canonical contract', () => {
    expect(
      parseCompanySettingsValue({
        name: 'GroAurum',
        city: 'New Delhi',
        phoneLabel: '+91 11 0000 0000',
        logoLabel: 'mark.png',
        businessAddress: 'Delhi NCR',
      }),
    ).toEqual({
      companyName: 'GroAurum',
      gstNumber: '',
      gstStateCode: '',
      pan: '',
      email: '',
      phone: '+91 11 0000 0000',
      logo: 'mark.png',
      address: 'Delhi NCR',
    });
  });

  it('defaults missing company name to GroAurum', () => {
    expect(parseCompanySettingsValue({})).toMatchObject({
      companyName: 'GroAurum',
    });
  });

  it('rejects empty company names on write schema', () => {
    expect(() =>
      companySettingsValueSchema.parse({ companyName: '   ' }),
    ).toThrow();
  });

  it('rejects invalid emails when provided', () => {
    expect(() =>
      companySettingsValueSchema.parse({
        companyName: 'GroAurum',
        email: 'not-an-email',
      }),
    ).toThrow(/valid email/i);
  });

  it('allows blank email', () => {
    expect(
      toCompanySettingsJson({
        companyName: 'GroAurum',
        gstNumber: '',
        pan: '',
        email: '',
        phone: '',
        logo: '',
        address: '',
      }).email,
    ).toBe('');
  });
});
