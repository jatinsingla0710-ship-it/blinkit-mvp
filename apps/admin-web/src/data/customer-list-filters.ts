import type { CustomerListRow } from '@/data/customers-types';

export type CustomerListStatusFilter = 'all' | 'active' | 'inactive';

export function filterCustomerRows(
  rows: readonly CustomerListRow[],
  search: string,
  status: CustomerListStatusFilter,
): CustomerListRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status === 'active' && row.status !== 'active') return false;
    if (status === 'inactive' && row.status !== 'inactive') return false;
    if (!q) return true;
    const haystack = [
      row.shopName,
      row.ownerName,
      row.phoneLabel,
      row.areaLabel,
      row.salesmanName,
    ]
      .join(' ')
      .toLowerCase();
    const digits = q.replace(/\D/g, '');
    const phoneDigits = row.phoneLabel.replace(/\D/g, '');
    return (
      haystack.includes(q) ||
      (digits.length >= 4 && phoneDigits.includes(digits))
    );
  });
}
