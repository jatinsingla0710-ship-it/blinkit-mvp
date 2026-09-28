import { describe, expect, it } from 'vitest';
import { customerMobileError, newCustomerError, shopPhotoFileError } from './customer-form';

const valid = {
  tradeName: 'Sharma Stores',
  contactName: 'Ravi',
  mobile: '9876543210',
  serviceAreaId: 'area-1',
  addressLine: '1 Main Rd',
  city: 'Delhi',
  state: 'DL',
  pinCode: '110001',
};

describe('new customer validation (L, N)', () => {
  it('accepts a 10-digit mobile and rejects a short one', () => {
    expect(customerMobileError('9876543210')).toBeNull();
    expect(customerMobileError('+91 98765 43210')).toBeNull();
    expect(customerMobileError('12345')).toMatch(/valid mobile/);
  });

  it('requires a service area before save', () => {
    expect(newCustomerError({ ...valid, serviceAreaId: '' })).toBe(
      'Select a service area before saving.',
    );
    expect(newCustomerError(valid)).toBeNull();
  });

  it('does not require a photo', () => {
    expect(shopPhotoFileError({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(shopPhotoFileError({ type: 'image/gif', size: 1000 })).toMatch(/JPEG/);
    expect(shopPhotoFileError({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
