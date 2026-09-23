import type { AppAudience } from './roles';

/**
 * Logical destinations for navigation guards.
 * Apps map these to real URLs / deep links when deploying.
 */
export const APP_DESTINATION_PATHS: Record<AppAudience, string> = {
  admin_erp: '/',
  customer_app: '/customer',
  sales_pwa: '/sales',
  delivery_pwa: '/delivery',
};

export function destinationPathForAudience(audience: AppAudience): string {
  return APP_DESTINATION_PATHS[audience];
}
