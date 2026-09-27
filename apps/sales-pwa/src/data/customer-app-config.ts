/**
 * Customer App URL from environment (Sales PWA).
 */
export type CustomerAppUrlResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export function resolveCustomerAppUrl(): CustomerAppUrlResult {
  const configured = import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined;
  if (configured?.trim()) {
    return { ok: true, url: configured.trim().replace(/\/$/, '') };
  }
  if (import.meta.env.DEV) {
    return { ok: true, url: 'http://127.0.0.1:8081' };
  }
  return {
    ok: false,
    message:
      'Customer app link is not configured (VITE_CUSTOMER_APP_URL). Ask your admin to set it before sending app links.',
  };
}
