/**
 * Phase 26 — Admin + Salesman + Delivery Integration Audit (durable findings).
 * Evidence-based classifications. Does not rebuild working RPC spines.
 */

export type IntegrationStatus =
  | 'EXISTS'
  | 'PARTIAL'
  | 'BROKEN'
  | 'MISSING'
  | 'DEAD';

export type IntegrationSeamId =
  | 'auth_roles'
  | 'catalogue_sync'
  | 'customers_shops'
  | 'orders_pipeline'
  | 'inventory_sale_convert'
  | 'cod_custody'
  | 'notifications_app_link'
  | 'shared_contracts';

export type IntegrationFinding = {
  seam: IntegrationSeamId;
  status: IntegrationStatus;
  summary: string;
  evidence: readonly string[];
};

/** Trusted cross-app RPC / transition spine — do not rebuild. */
export const INTEGRATION_TRUSTED_SPINE = [
  'place_assisted_order',
  'preview_assisted_order_lines',
  'admin_pack_order',
  'admin_schedule_and_assign_delivery',
  'delivery_record_cash_payment',
  'delivery_complete_stop',
  'admin_convert_order_to_sale',
  'try_auto_convert_order_to_sale',
] as const;

export const PHASE_26_INTEGRATION_FINDINGS: readonly IntegrationFinding[] = [
  {
    seam: 'auth_roles',
    status: 'EXISTS',
    summary:
      'Live staff_role maps to AppRole; each app gates on audience. Multi-role profiles use roles[0] as primary (PARTIAL risk).',
    evidence: [
      'packages/auth/src/staff-role-map.ts',
      'packages/auth/src/roles.ts',
      'apps/admin-web/src/auth/guards.tsx',
      'apps/sales-pwa/src/auth/guards.tsx',
      'apps/delivery-pwa/src/auth/guards.tsx',
    ],
  },
  {
    seam: 'catalogue_sync',
    status: 'EXISTS',
    summary:
      'Salesman reads live catalogue/prices; realtime invalidates orderable-skus. Browse may omit tier display until preview/place (PARTIAL).',
    evidence: [
      'packages/api-client/src/adapters/supabase/salesman.ts',
      'apps/sales-pwa/src/data/SalesDataProviders.tsx',
      'packages/api-client/src/catalogue/effective-price.ts',
    ],
  },
  {
    seam: 'customers_shops',
    status: 'PARTIAL',
    summary:
      'Create/assign works Admin↔Salesman. Customer App link RPCs exist but Admin UI callers are missing; Sales intentionally hides invite copy.',
    evidence: [
      'apps/sales-pwa/src/pages/CreateCustomerPage.tsx',
      'apps/admin-web/src/data/live/LiveAdminApi.ts',
      'apps/sales-pwa/src/lib/visible-copy.test.ts',
    ],
  },
  {
    seam: 'orders_pipeline',
    status: 'EXISTS',
    summary:
      'Salesman place → Admin pack/assign → Delivery execute is RPC-backed. Admin maps AWAITING_CUSTOMER_CONFIRMATION→CONFIRMED (PARTIAL honesty).',
    evidence: [
      'packages/api-client/src/adapters/supabase/salesman.ts',
      'apps/admin-web/src/data/live/LiveAdminApi.ts',
      'packages/api-client/src/adapters/supabase/delivery.ts',
      'apps/admin-web/src/data/order-helpers.ts',
    ],
  },
  {
    seam: 'inventory_sale_convert',
    status: 'EXISTS',
    summary:
      'Reserve on Admin advance; consume on sale convert / auto-convert after deliver+PAID. Assisted place does not reserve.',
    evidence: [
      'supabase/migrations/20260903120000_fulfill_sale_consume_inventory.sql',
      'supabase/migrations/20260831220000_fix_delivery_complete_stop_sale_isolation.sql',
    ],
  },
  {
    seam: 'cod_custody',
    status: 'EXISTS',
    summary:
      'Delivery cash → custody WITH_DRIVER → Admin settle / manager-owner handoff is wired.',
    evidence: [
      'packages/api-client/src/adapters/supabase/delivery.ts',
      'apps/admin-web/src/data/live/deliveryH5Api.ts',
    ],
  },
  {
    seam: 'notifications_app_link',
    status: 'PARTIAL',
    summary:
      'Outbox/enqueue + honesty labels exist; providers often stub. App-link share UI missing on Admin.',
    evidence: [
      'packages/api-client/src/contracts/notification.ts',
      'apps/admin-web/src/data/delivery-h5-honesty.ts',
      'packages/shared-types/src/customer-app-link.ts',
    ],
  },
  {
    seam: 'shared_contracts',
    status: 'PARTIAL',
    summary:
      'shared-types + api-client contracts exist; Admin VMs (PACKING vs PROCESSING) and adapter-only services still drift.',
    evidence: [
      'packages/shared-types/src/policies/order-transitions.ts',
      'apps/admin-web/src/data/orders-types.ts',
    ],
  },
] as const;

export const PHASE_26_DO_NOT_REBUILD = [
  'STAFF_ROLE_TO_APP_ROLE + audience ProtectedRoute / RoleGuard',
  'Trusted RPC spine (place → pack → deliver → COD → convert)',
  'Sales catalogue realtime invalidation',
  'COD custody state machine',
  'Inventory consume-on-sale-convert',
  'Sales intentional Customer App copy firewall',
] as const;

export const PHASE_26_TOP_RISKS = [
  'Multi-role profiles.roles[0] picks the wrong app audience',
  'Customer App link API without Admin share UI',
  'Admin fulfillment VM collapses awaiting-approval into CONFIRMED',
  'Browse trade price may differ from tiered order price until preview',
  'Notification outbox without live SMS/WhatsApp providers',
  'PACKING vs PROCESSING vocabulary split across Admin vs DB',
] as const;

export const PHASE_26_LATER_FIXES = [
  {
    priority: 'P0' as const,
    fix: 'Canonical primary role (or forbid multi-staff roles) when provisioning',
  },
  {
    priority: 'P0' as const,
    fix: 'Surface AWAITING_CUSTOMER_CONFIRMATION distinctly in Admin (stop mapping to CONFIRMED)',
  },
  {
    priority: 'P1' as const,
    fix: 'Wire Admin Share Customer App link → WhatsApp helper + record_customer_app_link_sent',
  },
  {
    priority: 'P1' as const,
    fix: 'Quarantine or finish dead invite paths (ShopService.createInvitation / unused senders)',
  },
  {
    priority: 'P2' as const,
    fix: 'Sales browse: show effective/tier price or “from ₹X”; realtime sku_price_tiers',
  },
  {
    priority: 'P2' as const,
    fix: 'Align Admin WholesaleFulfillmentStatus with shared OrderStatus mapper source of truth',
  },
] as const;

export function integrationFindingBySeam(
  seam: IntegrationSeamId,
): IntegrationFinding | undefined {
  return PHASE_26_INTEGRATION_FINDINGS.find((f) => f.seam === seam);
}

export function integrationSeamsWithStatus(
  status: IntegrationStatus,
): IntegrationSeamId[] {
  return PHASE_26_INTEGRATION_FINDINGS.filter((f) => f.status === status).map(
    (f) => f.seam,
  );
}
