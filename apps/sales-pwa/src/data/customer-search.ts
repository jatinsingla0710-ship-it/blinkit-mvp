import type { SalesmanRetailer } from '@groaurum/api-client';

/** Shop name, contact, mobile, and area. Shared by the customer list and order shop picker. */
export function filterRetailers(
  retailers: readonly SalesmanRetailer[],
  search: string,
): SalesmanRetailer[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...retailers];
  return retailers.filter((r) =>
    [
      r.tradeName,
      r.legalName,
      r.primaryContactName,
      r.areaLabel,
      r.city,
      r.pinCode,
      r.primaryContactMobile,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}
