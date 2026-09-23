import type {
  SalesmanBrowseState,
  SalesmanListRow,
} from '@/data/salesmen-types';
import type {
  DeliveryBrowseState,
  DeliveryRouteListRow,
} from '@/data/delivery-types';

export const EMPTY_SALESMAN_BROWSE: SalesmanBrowseState = {
  query: '',
  status: 'all',
  sort: 'name_az',
  page: 1,
  pageSize: 5,
};

export const EMPTY_DELIVERY_BROWSE: DeliveryBrowseState = {
  query: '',
  status: 'all',
  sort: 'updated_desc',
  page: 1,
  pageSize: 5,
};

export const EMPTY_SET_PRICE_DRAFT = {
  basisPrice: '',
  priceBasis: 'per_kg' as const,
};

export function browseSalesmen(
  rows: readonly SalesmanListRow[],
  state: SalesmanBrowseState,
): { rows: SalesmanListRow[]; total: number; pageCount: number } {
  const q = state.query.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.territory.toLowerCase().includes(q)
    );
  });

  next = [...next].sort((a, b) => {
    switch (state.sort) {
      case 'orders_desc':
        return b.ordersThisMonth - a.ordersThisMonth || a.name.localeCompare(b.name);
      case 'customers_desc':
        return (
          b.assignedCustomers - a.assignedCustomers ||
          a.name.localeCompare(b.name)
        );
      case 'updated_desc':
        return b.updatedAtLabel.localeCompare(a.updatedAtLabel);
      case 'name_az':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const total = next.length;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;
  return {
    rows: next.slice(start, start + state.pageSize),
    total,
    pageCount,
  };
}

export function browseDeliveryRoutes(
  rows: readonly DeliveryRouteListRow[],
  state: DeliveryBrowseState,
): { rows: DeliveryRouteListRow[]; total: number; pageCount: number } {
  const q = state.query.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (!q) return true;
    return (
      row.routeCode.toLowerCase().includes(q) ||
      row.driverName.toLowerCase().includes(q) ||
      row.vehicleLabel.toLowerCase().includes(q) ||
      row.deliveryArea.toLowerCase().includes(q)
    );
  });

  next = [...next].sort((a, b) => {
    switch (state.sort) {
      case 'orders_desc':
        return (
          b.ordersAssigned - a.ordersAssigned ||
          a.routeCode.localeCompare(b.routeCode)
        );
      case 'cod_desc':
        return b.codAmountLabel.localeCompare(a.codAmountLabel);
      case 'updated_desc':
        return b.updatedAtLabel.localeCompare(a.updatedAtLabel);
      case 'route_az':
      default:
        return a.routeCode.localeCompare(b.routeCode);
    }
  });

  const total = next.length;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;
  return {
    rows: next.slice(start, start + state.pageSize),
    total,
    pageCount,
  };
}
