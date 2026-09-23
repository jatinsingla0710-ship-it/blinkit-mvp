import type { ServiceAreaListItem } from './service-area-model';

export function isValidPinCode(pinCode: string): boolean {
  return /^[0-9]{6}$/.test(pinCode.trim());
}

/** Active service areas whose PIN_CODE rules include the entered PIN. */
export function findActiveServiceAreasForPin(
  pinCode: string,
  areas: readonly ServiceAreaListItem[],
): ServiceAreaListItem[] {
  const pin = pinCode.trim();
  if (!isValidPinCode(pin)) return [];
  return areas.filter(
    (area) => area.status === 'active' && area.pinCodes.includes(pin),
  );
}

export type PinLookupResult =
  | { status: 'incomplete' }
  | { status: 'invalid' }
  | { status: 'not_serviceable'; pinCode: string }
  | { status: 'multiple'; pinCode: string; areas: ServiceAreaListItem[] }
  | { status: 'matched'; pinCode: string; area: ServiceAreaListItem };

export function lookupPinServiceability(
  pinCode: string,
  areas: readonly ServiceAreaListItem[],
): PinLookupResult {
  const pin = pinCode.trim();
  if (pin.length === 0) return { status: 'incomplete' };
  if (pin.length < 6) return { status: 'incomplete' };
  if (!isValidPinCode(pin)) return { status: 'invalid' };

  const matches = findActiveServiceAreasForPin(pin, areas);
  if (matches.length === 0) {
    return { status: 'not_serviceable', pinCode: pin };
  }
  if (matches.length === 1) {
    return { status: 'matched', pinCode: pin, area: matches[0] };
  }
  return { status: 'multiple', pinCode: pin, areas: matches };
}

export function resolveServiceAreaIdForPin(
  pinCode: string,
  areas: readonly ServiceAreaListItem[],
  currentServiceAreaId: string,
): string {
  const lookup = lookupPinServiceability(pinCode, areas);
  if (lookup.status === 'matched') return lookup.area.id;
  if (lookup.status === 'multiple') {
    return lookup.areas.some((area) => area.id === currentServiceAreaId)
      ? currentServiceAreaId
      : '';
  }
  return '';
}

export function serviceAreaOptionsForPin(
  pinCode: string,
  areas: readonly ServiceAreaListItem[],
): readonly ServiceAreaListItem[] {
  const lookup = lookupPinServiceability(pinCode, areas);
  if (lookup.status === 'matched') return [lookup.area];
  if (lookup.status === 'multiple') return lookup.areas;
  if (lookup.status === 'not_serviceable') return [];
  return areas;
}

export function pinLookupMessage(result: PinLookupResult): string | null {
  switch (result.status) {
    case 'incomplete':
      return null;
    case 'invalid':
      return 'PIN code must be exactly 6 digits.';
    case 'not_serviceable':
      return 'PIN is not serviceable in any active service area.';
    case 'multiple':
      return 'Multiple service areas cover this PIN. Select the correct area.';
    case 'matched':
      return `Service area matched: ${result.area.name}`;
    default:
      return null;
  }
}
