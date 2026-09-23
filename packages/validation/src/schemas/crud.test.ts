import { describe, expect, it } from 'vitest';
import {
  categoryCreateSchema,
  parsePinCodeList,
  customerCreateSchema,
  indianMobileSchema,
  pinCodeSchema,
  pinCodesSchema,
  priceCreateSchema,
  productCreateSchema,
  serviceAreaCreateSchema,
  serviceabilityRuleCreateSchema,
  skuCreateSchema,
  warehouseCreateSchema,
} from './crud';

describe('Sprint 4 Zod CRUD schemas', () => {
  it('accepts a valid category', () => {
    const parsed = categoryCreateSchema.parse({
      name: 'Dry Fruits',
      displayOrder: 1,
    });
    expect(parsed.name).toBe('Dry Fruits');
  });

  it('rejects blank product names', () => {
    expect(() =>
      productCreateSchema.parse({
        categoryId: '11111111-1111-1111-1111-111111111111',
        name: '   ',
        productType: 'BULK',
      }),
    ).toThrow();
  });

  it('accepts grocery selling units including BAG and PCS', () => {
    const bag = skuCreateSchema.parse({
      productId: '11111111-1111-1111-1111-111111111111',
      skuCode: 'ATTA-10KG',
      name: 'Atta 10 KG Bag',
      productType: 'PACKED',
      sellingUnit: 'BAG',
    });
    expect(bag.sellingUnit).toBe('BAG');

    const pcs = skuCreateSchema.parse({
      productId: '11111111-1111-1111-1111-111111111111',
      skuCode: 'BISC-PCS',
      name: 'Biscuits Pack',
      productType: 'PACKED',
      sellingUnit: 'PCS',
    });
    expect(pcs.sellingUnit).toBe('PCS');
  });

  it('rejects negative trade prices', () => {
    expect(() =>
      priceCreateSchema.parse({
        skuId: '11111111-1111-4111-8111-111111111111',
        tradePrice: -1,
      }),
    ).toThrow();
  });
});

describe('service area and PIN validation', () => {
  it('accepts a valid service area name', () => {
    const parsed = serviceAreaCreateSchema.parse({
      name: 'South Delhi',
      description: 'Launch territory',
    });
    expect(parsed.name).toBe('South Delhi');
  });

  it('rejects a blank service area name', () => {
    expect(() => serviceAreaCreateSchema.parse({ name: '   ' })).toThrow();
  });

  it('accepts a 6-digit PIN code', () => {
    expect(pinCodeSchema.parse('110017')).toBe('110017');
  });

  it('rejects PIN codes that are not exactly 6 digits', () => {
    expect(() => pinCodeSchema.parse('11007')).toThrow();
    expect(() => pinCodeSchema.parse('1100178')).toThrow();
    expect(() => pinCodeSchema.parse('11001a')).toThrow();
    expect(() => pinCodeSchema.parse('110 017')).toThrow();
    expect(() => pinCodeSchema.parse(' 110017')).toThrow();
  });

  it('parses PIN lists from newlines and commas', () => {
    expect(parsePinCodeList('110017\n110019,110020')).toEqual([
      '110017',
      '110019',
      '110020',
    ]);
  });

  it('rejects duplicate PIN codes', () => {
    const result = pinCodesSchema.safeParse(['110017', '110019', '110017']);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('unique')),
      ).toBe(true);
    }
  });

  it('rejects an empty PIN list', () => {
    expect(pinCodesSchema.safeParse([]).success).toBe(false);
  });

  it('accepts a PIN_CODE rule with unique PINs', () => {
    const parsed = serviceabilityRuleCreateSchema.parse({
      serviceAreaId: 'a2000000-0000-4000-8000-000000000001',
      ruleType: 'PIN_CODE',
      pinCodes: [
        '110017',
        '110019',
        '110020',
        '110024',
        '110048',
        '110062',
        '110074',
      ],
    });
    expect(parsed.pinCodes).toHaveLength(7);
  });
});

describe('customer create validation', () => {
  const validCustomer = {
    tradeName: 'Sharma Kirana',
    ownerName: 'Ramesh Sharma',
    ownerMobile: '9876543210',
    serviceAreaId: '11111111-1111-4111-8111-111111111111',
    assignedSalesmanProfileId: '22222222-2222-4222-8222-222222222222',
    deliveryAddressLine: 'Shop 12, Main Market',
    deliveryCity: 'New Delhi',
    deliveryState: 'Delhi',
    deliveryPinCode: '110017',
  };

  it('accepts a valid customer and normalizes mobile', () => {
    const parsed = customerCreateSchema.parse(validCustomer);
    expect(parsed.ownerMobile).toBe('+919876543210');
    expect(parsed.serviceAreaId).toBe(validCustomer.serviceAreaId);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      customerCreateSchema.parse({ ...validCustomer, tradeName: '  ' }),
    ).toThrow();
    expect(() =>
      customerCreateSchema.parse({ ...validCustomer, ownerName: '  ' }),
    ).toThrow();
    expect(() =>
      customerCreateSchema.parse({
        ...validCustomer,
        serviceAreaId: undefined,
      }),
    ).toThrow();
    expect(() =>
      customerCreateSchema.parse({
        ...validCustomer,
        assignedSalesmanProfileId: undefined,
      }),
    ).toThrow();
  });

  it('rejects invalid phone, email, and PIN', () => {
    expect(() => indianMobileSchema.parse('12345')).toThrow();
    expect(() =>
      customerCreateSchema.parse({
        ...validCustomer,
        ownerEmail: 'bad-email',
      }),
    ).toThrow();
    expect(() =>
      customerCreateSchema.parse({
        ...validCustomer,
        deliveryPinCode: '11007',
      }),
    ).toThrow();
  });
});

describe('warehouse validation', () => {
  it('accepts a valid warehouse', () => {
    const parsed = warehouseCreateSchema.parse({
      name: 'GroAurum Warehouse 1',
      addressLine: 'Warehouse Complex, Sector 37',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
    });
    expect(parsed.name).toBe('GroAurum Warehouse 1');
    expect(parsed.pinCode).toBe('110074');
  });

  it('rejects a blank warehouse name', () => {
    expect(() =>
      warehouseCreateSchema.parse({
        name: '   ',
        addressLine: 'Sector 37',
        city: 'New Delhi',
        state: 'Delhi',
        pinCode: '110074',
      }),
    ).toThrow();
  });

  it('rejects blank city and state', () => {
    expect(() =>
      warehouseCreateSchema.parse({
        name: 'Test',
        addressLine: 'Sector 37',
        city: '   ',
        state: 'Delhi',
        pinCode: '110074',
      }),
    ).toThrow();
    expect(() =>
      warehouseCreateSchema.parse({
        name: 'Test',
        addressLine: 'Sector 37',
        city: 'Delhi',
        state: '   ',
        pinCode: '110074',
      }),
    ).toThrow();
  });

  it('rejects invalid PIN codes for warehouses', () => {
    expect(() =>
      warehouseCreateSchema.parse({
        name: 'Test',
        addressLine: 'Sector 37',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '11007',
      }),
    ).toThrow();
  });

  it('rejects blank address line', () => {
    expect(() =>
      warehouseCreateSchema.parse({
        name: 'Test',
        addressLine: '   ',
        city: 'Delhi',
        state: 'Delhi',
        pinCode: '110074',
      }),
    ).toThrow();
  });
});
