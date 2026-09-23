import type { AppRole } from './roles';

/**
 * Named permissions — module and capability level.
 * Modules declare allowed roles; helpers check role ∩ permission.
 *
 * Orders H3 note (not a redesign): AppRole `orders:manage` gates Admin UI
 * mutations, but live Supabase order/delivery RPCs and RLS still require
 * `public.is_admin()` (profile staff role ADMIN). An operations_manager with
 * `orders:manage` will see Cancel / Convert / Pack buttons and still fail
 * RPCs unless their profile has ADMIN. Align AppRole ↔ is_admin() in a later
 * RBAC phase — do not invent half-admin RLS here.
 */

export const PERMISSIONS = [
  'dashboard:view',
  'orders:view',
  'orders:manage',
  'customers:view',
  'customers:manage',
  'products:view',
  'products:manage',
  'pricing:view',
  'pricing:manage',
  'inventory:view',
  'inventory:manage',
  'salesmen:view',
  'salesmen:manage',
  'delivery:view',
  'delivery:manage',
  'payments:view',
  'payments:manage',
  'reports:view',
  'settings:view',
  'settings:manage',
  'catalogue:view',
  'catalogue:order',
  'field:visits',
  'field:assist_order',
  'route:execute',
  'route:collect_cod',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Admin ERP modules that declare RBAC. */
export const ADMIN_MODULES = [
  'dashboard',
  'orders',
  'customers',
  'products',
  'categories',
  'pricing',
  'inventory',
  'salesmen',
  'delivery',
  'payments',
  'service_areas',
  'warehouses',
  'reports',
  'settings',
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

const ALL_ADMIN: AppRole[] = [
  'super_admin',
  'operations_manager',
  'warehouse_manager',
  'sales_manager',
  'delivery_manager',
  'read_only',
];

const OPS_HEAVY: AppRole[] = [
  'super_admin',
  'operations_manager',
  'read_only',
];

/** Every admin module declares allowed roles. */
export const MODULE_ALLOWED_ROLES: Record<AdminModule, readonly AppRole[]> = {
  dashboard: ALL_ADMIN,
  orders: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'sales_manager',
    'delivery_manager',
    'read_only',
  ],
  customers: [
    'super_admin',
    'operations_manager',
    'sales_manager',
    'read_only',
  ],
  products: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'read_only',
  ],
  categories: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'read_only',
  ],
  pricing: [
    'super_admin',
    'operations_manager',
    'sales_manager',
    'read_only',
  ],
  inventory: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'read_only',
  ],
  salesmen: [
    'super_admin',
    'operations_manager',
    'sales_manager',
    'read_only',
  ],
  delivery: [
    'super_admin',
    'operations_manager',
    'delivery_manager',
    'warehouse_manager',
    'read_only',
  ],
  payments: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'sales_manager',
    'delivery_manager',
    'read_only',
  ],
  service_areas: OPS_HEAVY,
  warehouses: [
    'super_admin',
    'operations_manager',
    'warehouse_manager',
    'read_only',
  ],
  reports: ALL_ADMIN,
  settings: ['super_admin'],
};

/** Default permission grants per role (production-ready defaults). */
export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  operations_manager: [
    'dashboard:view',
    'orders:view',
    'orders:manage',
    'customers:view',
    'customers:manage',
    'products:view',
    'pricing:view',
    'inventory:view',
    'salesmen:view',
    'delivery:view',
    'delivery:manage',
    'payments:view',
    'payments:manage',
    'reports:view',
    'settings:view',
  ],
  warehouse_manager: [
    'dashboard:view',
    'orders:view',
    'products:view',
    'inventory:view',
    'inventory:manage',
    'delivery:view',
    'payments:view',
    'reports:view',
  ],
  sales_manager: [
    'dashboard:view',
    'orders:view',
    'customers:view',
    'customers:manage',
    'pricing:view',
    'salesmen:view',
    'salesmen:manage',
    'payments:view',
    'reports:view',
  ],
  delivery_manager: [
    'dashboard:view',
    'orders:view',
    'delivery:view',
    'delivery:manage',
    'payments:view',
    'payments:manage',
    'inventory:view',
    'reports:view',
  ],
  salesman: [
    'catalogue:view',
    'catalogue:order',
    'customers:view',
    'customers:manage',
    'field:visits',
    'field:assist_order',
    'orders:view',
  ],
  delivery_executive: [
    'route:execute',
    'route:collect_cod',
    'orders:view',
    'delivery:view',
  ],
  retail_customer: ['catalogue:view', 'catalogue:order', 'orders:view'],
  read_only: [
    'dashboard:view',
    'orders:view',
    'customers:view',
    'products:view',
    'pricing:view',
    'inventory:view',
    'salesmen:view',
    'delivery:view',
    'payments:view',
    'reports:view',
  ],
};
