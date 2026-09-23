import type { ServiceAreaListItem } from '@/data/service-area-model';
import type { SalesmanListRow } from '@/data/salesmen-types';
import type { DeliveryStaffOption } from '@/data/orders-types';

export function activeServiceAreas(
  areas: readonly ServiceAreaListItem[],
): ServiceAreaListItem[] {
  return areas.filter((area) => area.status === 'active');
}

export function activeSalesmen(
  rows: readonly SalesmanListRow[],
): SalesmanListRow[] {
  return rows.filter((row) => row.status === 'active');
}

export function activeDeliveryStaff(
  staff: readonly DeliveryStaffOption[],
): DeliveryStaffOption[] {
  return staff.filter((member) => member.id.length > 0);
}

/** True when the entered PIN is listed on the selected service area. */
export function pinBelongsToServiceArea(
  area: Pick<ServiceAreaListItem, 'pinCodes'> | null | undefined,
  pinCode: string,
): boolean {
  const pin = pinCode.trim();
  if (!area || !/^[0-9]{6}$/.test(pin)) return false;
  return area.pinCodes.includes(pin);
}
