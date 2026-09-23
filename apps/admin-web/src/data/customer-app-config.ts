/**
 * Customer App URL from environment (Admin web).
 */
export function getCustomerAppUrl(): string {
  const configured = import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined;
  if (configured?.trim()) {
    return configured.trim().replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8081';
  }
  return '';
}
