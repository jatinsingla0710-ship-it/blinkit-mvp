/**
 * Client-side helpers for duplicate-mobile warnings during customer create.
 * Server still validates on insert; this is advisory for admin/salesman UX.
 */

export type CustomerMobileMatch = {
  shopId: string;
  shopName: string;
  ownerName: string;
  mobile: string;
  isActive: boolean;
};

/** Normalize Indian mobile numbers for comparison (10-digit or +91 prefix). */
export function normalizeMobileForLookup(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

export function isMobileLookupReady(raw: string): boolean {
  return normalizeMobileForLookup(raw) !== null;
}

export function formatDuplicateMobileWarning(
  matches: readonly CustomerMobileMatch[],
): string {
  if (matches.length === 0) return '';
  const names = matches
    .slice(0, 3)
    .map((m) => m.shopName)
    .join(', ');
  const suffix =
    matches.length > 3 ? ` and ${matches.length - 3} more` : '';
  return `This mobile number is already associated with: ${names}${suffix}. You can still create a new business if this owner has multiple shops.`;
}

export function formatEditMobileConflictWarning(
  matches: readonly CustomerMobileMatch[],
  currentShopId: string,
): string {
  const others = matches.filter((match) => match.shopId !== currentShopId);
  if (others.length === 0) return '';
  const names = others
    .slice(0, 3)
    .map((m) => m.shopName)
    .join(', ');
  const suffix = others.length > 3 ? ` and ${others.length - 3} more` : '';
  return `This mobile is already used by: ${names}${suffix}. Updating may cause confusion if it is the same person with multiple shops.`;
}
