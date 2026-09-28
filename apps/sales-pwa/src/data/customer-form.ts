/** Client check aligned with public.normalize_mobile. The database still enforces it. */
export function customerMobileError(mobile: string): string | null {
  const trimmed = mobile.trim();
  if (!trimmed) return 'Enter a mobile number.';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return null;
  if (digits.length === 12 && digits.startsWith('91')) return null;
  if (digits.length === 11 && digits.startsWith('0')) return null;
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) return null;
  return 'Enter a valid mobile number, for example 9876543210.';
}

export type NewCustomerFields = {
  tradeName: string;
  contactName: string;
  mobile: string;
  serviceAreaId: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
};

/** Blocks save until the fields the salesman must provide are valid. Photo and GPS stay optional. */
export function newCustomerError(input: NewCustomerFields): string | null {
  if (!input.tradeName.trim()) return 'Enter the shop name.';
  if (!input.contactName.trim()) return 'Enter the contact name.';
  const mobileError = customerMobileError(input.mobile);
  if (mobileError) return mobileError;
  if (!input.serviceAreaId) return 'Select a service area before saving.';
  if (!input.addressLine.trim() || !input.city.trim() || !input.state.trim()) {
    return 'Enter the shop address.';
  }
  if (!/^[0-9]{6}$/.test(input.pinCode.trim())) return 'PIN code must be 6 digits.';
  return null;
}

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function shopPhotoFileError(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.has(file.type)) return 'Use a JPEG, PNG, or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'Photo must be 5 MB or smaller.';
  return null;
}
