import type { WarehouseListItem } from '@/data/warehouse-model';

/** Mock-mode warehouses — layout only; writes require the Supabase adapter. */
export const WAREHOUSE_LIST_FIXTURE: WarehouseListItem[] = [
  {
    id: 'a3000000-0000-4000-8000-000000000001',
    name: 'GroAurum Warehouse 1',
    city: 'New Delhi',
    state: 'Delhi',
    pinCode: '110074',
    addressLine: 'Warehouse Complex, Sector 37',
    status: 'active',
  },
];
