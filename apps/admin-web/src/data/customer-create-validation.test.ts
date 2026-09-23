import { describe, expect, it } from 'vitest';
import { validateCustomerCreateForm } from './customer-create-validation';
import type { ServiceAreaListItem } from './service-area-model';
import type { SalesmanListRow } from './salesmen-types';

const AREA: ServiceAreaListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'South Delhi',
  description: '',
  status: 'active',
  displayOrder: 0,
  pinCodes: ['110017', '110074'],
  pinCount: 2,
  pinRuleId: 'rule-1',
};

const AREA_EAST: ServiceAreaListItem = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'East Delhi',
  description: '',
  status: 'active',
  displayOrder: 1,
  pinCodes: ['110074'],
  pinCount: 1,
  pinRuleId: 'rule-2',
};

const SALESMAN: SalesmanListRow = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Priya',
  territory: 'South Delhi',
  assignedCustomers: 1,
  ordersThisMonth: 1,
  collectionsLabel: '₹1',
  status: 'active',
  updatedAtLabel: 'Today',
};

const VALID = {
  tradeName: 'Sharma Kirana',
  legalName: '',
  ownerName: 'Ramesh Sharma',
  ownerMobile: '9876543210',
  ownerEmail: '',
  serviceAreaId: AREA.id,
  assignedSalesmanProfileId: SALESMAN.id,
  deliveryAddressLine: 'Shop 12, Main Market',
  deliveryCity: 'New Delhi',
  deliveryState: 'Delhi',
  deliveryPinCode: '110017',
};

describe('validateCustomerCreateForm', () => {
  it('accepts a valid customer payload and normalizes mobile', () => {
    const result = validateCustomerCreateForm(VALID, {
      serviceAreas: [AREA],
      salesmen: [SALESMAN],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.ownerMobile).toBe('+919876543210');
      expect(result.payload.serviceAreaId).toBe(AREA.id);
      expect(result.payload.assignedSalesmanProfileId).toBe(SALESMAN.id);
    }
  });

  it('rejects a missing shop name', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, tradeName: '   ' },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
  });

  it('rejects invalid PIN format', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryPinCode: '11007' },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a PIN that is not serviceable in the selected area', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryPinCode: '122001' },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('not serviceable');
    }
  });

  it('rejects missing service area and salesman', () => {
    expect(
      validateCustomerCreateForm(
        { ...VALID, serviceAreaId: '' },
        { serviceAreas: [AREA], salesmen: [SALESMAN] },
      ).ok,
    ).toBe(false);
    expect(
      validateCustomerCreateForm(VALID, { serviceAreas: [AREA], salesmen: [] }).ok,
    ).toBe(false);
    expect(
      validateCustomerCreateForm(VALID, { serviceAreas: [], salesmen: [SALESMAN] })
        .ok,
    ).toBe(false);
  });

  it('rejects invalid email and phone', () => {
    expect(
      validateCustomerCreateForm(
        { ...VALID, ownerEmail: 'not-an-email' },
        { serviceAreas: [AREA], salesmen: [SALESMAN] },
      ).ok,
    ).toBe(false);
    expect(
      validateCustomerCreateForm(
        { ...VALID, ownerMobile: '123' },
        { serviceAreas: [AREA], salesmen: [SALESMAN] },
      ).ok,
    ).toBe(false);
  });

  it('accepts optional shop coordinates', () => {
    const result = validateCustomerCreateForm(
      {
        ...VALID,
        deliveryLat: 28.6139,
        deliveryLng: 77.209,
      },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.deliveryLat).toBe(28.6139);
      expect(result.payload.deliveryLng).toBe(77.209);
    }
  });

  it('rejects partial coordinates', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryLat: 28.6139, deliveryLng: null },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('latitude and longitude');
    }
  });

  it('rejects a PIN with no matching active service area', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryPinCode: '122001', serviceAreaId: '' },
      { serviceAreas: [AREA], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('not serviceable');
    }
  });

  it('requires selecting a service area when multiple areas match the PIN', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryPinCode: '110074', serviceAreaId: '' },
      { serviceAreas: [AREA, AREA_EAST], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Select the service area');
    }
  });

  it('accepts a PIN covered by multiple areas when one is selected', () => {
    const result = validateCustomerCreateForm(
      { ...VALID, deliveryPinCode: '110074', serviceAreaId: AREA_EAST.id },
      { serviceAreas: [AREA, AREA_EAST], salesmen: [SALESMAN] },
    );
    expect(result.ok).toBe(true);
  });

  it('does not inject seed UUIDs', () => {
    const result = validateCustomerCreateForm(VALID, {
      serviceAreas: [AREA],
      salesmen: [SALESMAN],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.payload)).not.toContain(
        'a1000000-0000-4000-8000-000000000002',
      );
      expect(JSON.stringify(result.payload)).not.toContain(
        'a2000000-0000-4000-8000-000000000001',
      );
    }
  });
});
