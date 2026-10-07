import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audienceForRole } from '@groaurum/auth';
import { STAFF_ROLE_TO_APP_ROLE } from '@groaurum/auth';
import { mapDbOrderStatusToFulfillment } from '@/data/order-helpers';
import {
  INTEGRATION_TRUSTED_SPINE,
  PHASE_26_DO_NOT_REBUILD,
  PHASE_26_INTEGRATION_FINDINGS,
  PHASE_26_LATER_FIXES,
  PHASE_26_TOP_RISKS,
  integrationFindingBySeam,
  integrationSeamsWithStatus,
} from './phase26-integration-audit';

const salesProviders = readFileSync(
  resolve(__dirname, '../../../sales-pwa/src/data/SalesDataProviders.tsx'),
  'utf8',
);
const liveAdminApi = readFileSync(
  resolve(__dirname, './live/LiveAdminApi.ts'),
  'utf8',
);

describe('Phase 26 Admin + Salesman + Delivery integration audit', () => {
  it('records one finding per integration seam', () => {
    expect(PHASE_26_INTEGRATION_FINDINGS).toHaveLength(8);
    expect(integrationSeamsWithStatus('BROKEN')).toEqual([]);
    expect(integrationFindingBySeam('orders_pipeline')?.status).toBe('EXISTS');
    expect(integrationFindingBySeam('customers_shops')?.status).toBe('PARTIAL');
    expect(PHASE_26_DO_NOT_REBUILD.length).toBeGreaterThan(0);
    expect(PHASE_26_TOP_RISKS.length).toBeGreaterThan(0);
    expect(PHASE_26_LATER_FIXES.some((f) => f.priority === 'P0')).toBe(true);
  });

  it('keeps live staff_role → AppRole → audience isolation', () => {
    expect(STAFF_ROLE_TO_APP_ROLE.ADMIN).toBe('super_admin');
    expect(STAFF_ROLE_TO_APP_ROLE.SALESMAN).toBe('salesman');
    expect(STAFF_ROLE_TO_APP_ROLE.DELIVERY).toBe('delivery_executive');
    expect(audienceForRole('super_admin')).toBe('admin_erp');
    expect(audienceForRole('salesman')).toBe('sales_pwa');
    expect(audienceForRole('delivery_executive')).toBe('delivery_pwa');
  });

  it('documents Admin fulfillment honesty gap for awaiting confirmation', () => {
    expect(mapDbOrderStatusToFulfillment('AWAITING_CUSTOMER_CONFIRMATION')).toBe(
      'CONFIRMED',
    );
    expect(mapDbOrderStatusToFulfillment('PROCESSING')).toBe('PACKING');
    expect(
      integrationFindingBySeam('orders_pipeline')?.summary,
    ).toMatch(/AWAITING_CUSTOMER_CONFIRMATION/);
  });

  it('keeps Sales catalogue realtime on products/skus/prices', () => {
    expect(salesProviders).toContain("entity: 'products'");
    expect(salesProviders).toContain("entity: 'sku_prices'");
    expect(salesProviders).toContain("['sales', 'orderable-skus']");
  });

  it('keeps Customer App link APIs without claiming Admin UI is wired', () => {
    expect(liveAdminApi).toContain('recordCustomerAppLinkSent');
    expect(liveAdminApi).toContain('sendCustomerInvitation');
    expect(integrationFindingBySeam('notifications_app_link')?.status).toBe(
      'PARTIAL',
    );
  });

  it('lists the trusted cross-app RPC spine that must not be rebuilt', () => {
    expect([...INTEGRATION_TRUSTED_SPINE]).toEqual([
      'place_assisted_order',
      'preview_assisted_order_lines',
      'admin_pack_order',
      'admin_schedule_and_assign_delivery',
      'delivery_record_cash_payment',
      'delivery_complete_stop',
      'admin_convert_order_to_sale',
      'try_auto_convert_order_to_sale',
    ]);
  });
});
