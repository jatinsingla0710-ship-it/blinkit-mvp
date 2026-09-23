/** Warehouse module view-model — matches public.operational_locations. */

export type WarehouseStatus = 'active' | 'inactive';

export type WarehouseListItem = {
  id: string;
  name: string;
  city: string;
  state: string;
  pinCode: string;
  addressLine: string;
  status: WarehouseStatus;
};
