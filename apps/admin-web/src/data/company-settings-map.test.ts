import { describe, expect, it } from 'vitest';
import {
  mapCompanySettingsToInvoiceCompany,
  mapCompanySettingsToProfile,
} from './company-settings-map';

describe('company settings mapping', () => {
  it('maps live seed-shaped JSON into the Company Profile form model', () => {
    expect(
      mapCompanySettingsToProfile({
        name: 'GroAurum',
        city: 'New Delhi',
      }),
    ).toEqual({
      companyName: 'GroAurum',
      gstNumber: '',
      gstStateCode: '',
      pan: '',
      email: '',
      phone: '',
      logo: '',
      address: '',
    });
  });

  it('prefers canonical keys over legacy aliases', () => {
    expect(
      mapCompanySettingsToProfile({
        companyName: 'Canonical Co',
        name: 'Legacy Co',
        phone: '111',
        phoneLabel: '222',
        address: 'A',
        businessAddress: 'B',
        logo: 'logo-a',
        logoLabel: 'logo-b',
      }),
    ).toMatchObject({
      companyName: 'Canonical Co',
      phone: '111',
      address: 'A',
      logo: 'logo-a',
    });
  });

  it('maps invoice seller fields from the canonical contract', () => {
    expect(
      mapCompanySettingsToInvoiceCompany({
        companyName: 'GroAurum Wholesale',
        email: 'ops@groaurum.in',
        phone: '+91 11 4400',
        address: 'Okhla',
        logo: 'https://cdn.example/logo.png',
        gstNumber: '07AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
      }),
    ).toEqual({
      companyName: 'GroAurum Wholesale',
      sellerName: 'GroAurum Wholesale',
      email: 'ops@groaurum.in',
      phoneLabel: '+91 11 4400',
      businessAddress: 'Okhla',
      logoUrl: 'https://cdn.example/logo.png',
      gstNumber: '07AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
    });
  });

  it('omits blank GSTIN and PAN from the invoice company map', () => {
    expect(
      mapCompanySettingsToInvoiceCompany({
        companyName: 'GroAurum',
        gstNumber: '  ',
        pan: '',
      }),
    ).toEqual({
      companyName: 'GroAurum',
      sellerName: 'GroAurum',
      email: '—',
      phoneLabel: '—',
      businessAddress: '—',
    });
  });

  it('uses em-dash placeholders for blank invoice contact fields', () => {
    expect(
      mapCompanySettingsToInvoiceCompany({ companyName: 'GroAurum' }),
    ).toEqual({
      companyName: 'GroAurum',
      sellerName: 'GroAurum',
      email: '—',
      phoneLabel: '—',
      businessAddress: '—',
    });
  });
});
