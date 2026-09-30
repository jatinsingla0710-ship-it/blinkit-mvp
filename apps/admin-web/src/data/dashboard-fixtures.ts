import type { DashboardSnapshot } from './dashboard-types';

/** Re-export Phase 1 nav so mock fixtures stay aligned with live IA. */
export { SIDEBAR_NAV, SIDEBAR_NAV_GROUPS } from './nav';

/** Empty dashboard snapshot for mock adapter — no fabricated business metrics. */
export const DASHBOARD_FIXTURE: DashboardSnapshot = {
  generatedAtLabel: 'Mock mode · connect Supabase for live data',
  executiveKpis: [
    {
      id: 'monthly_revenue',
      label: 'Monthly Revenue',
      value: '₹—',
      hint: 'Converted sales this month',
      href: '/sales',
    },
    {
      id: 'pending_orders',
      label: 'Pending Orders',
      value: '—',
      hint: 'Processing · packing · dispatch',
      href: '/orders?preset=pending',
    },
    {
      id: 'manager_collections_pending',
      label: 'Payment to Receive from Managers',
      value: '—',
      hint: 'No pending manager handovers',
      href: '/payments?tab=settlements&focus=with_manager',
    },
    {
      id: 'in_transit',
      label: 'In Transit',
      value: '—',
      hint: '0 / 0 Delivered · Remaining 0',
      href: '/delivery?focus=in_transit',
    },
    {
      id: 'pending_to_receive',
      label: 'Payment Yet to Receive',
      value: '—',
      hint: 'Customer unpaid on out-for-delivery orders',
      href: '/payments?tab=all&focus=ofd_unpaid',
    },
    {
      id: 'driver_collections_pending',
      label: 'Delivery Collections Pending',
      value: '—',
      hint: 'Cash with drivers · Online ₹0',
      href: '/payments?tab=settlements&focus=with_driver',
    },
  ],
  operations: [
    { id: 'new_today', label: 'New Orders Today', count: 0, href: '/orders' },
    { id: 'pending', label: 'Pending Orders', count: 0, href: '/orders' },
    { id: 'packed', label: 'Orders Packed', count: 0, href: '/orders' },
    { id: 'out_for_delivery', label: 'Out for Delivery', count: 0, href: '/orders' },
    { id: 'delivered_today', label: 'Delivered Today', count: 0, href: '/orders' },
  ],
  attentionAlerts: [],
  quickActions: [
    {
      id: 'add_product',
      label: 'Add Product',
      description: 'Create a new catalogue product',
      href: '/products',
    },
    {
      id: 'update_price',
      label: 'Update Price',
      description: 'Schedule or change SKU trade price',
      href: '/pricing',
    },
    {
      id: 'add_customer',
      label: 'Add Customer',
      description: 'Onboard a new retailer',
      href: '/customers',
    },
    {
      id: 'create_route',
      label: 'Create Delivery Trip',
      description: 'Assign orders to a delivery boy',
      href: '/delivery',
    },
  ],
  recentActivity: [],
};
