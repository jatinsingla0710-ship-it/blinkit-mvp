/**
 * Edge-side provider config validation (Sprint 9.1).
 * Secrets via Deno.env only — never hardcode.
 */

export type EdgeProviderStatus = {
  appEnv: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type EdgeProviderOptions = {
  /** Payment functions require Razorpay outside development. */
  requireRazorpay?: boolean;
  /** Job edges require CRON_SECRET in production (always checked softly). */
  requireCron?: boolean;
};

export function assertEdgeProviderConfig(
  options: EdgeProviderOptions = {},
): EdgeProviderStatus {
  const { requireRazorpay = false, requireCron = true } = options;
  const appEnv = Deno.env.get('APP_ENV') ?? 'development';
  const errors: string[] = [];
  const warnings: string[] = [];

  const razorpayReady = Boolean(
    Deno.env.get('RAZORPAY_KEY_ID') &&
      Deno.env.get('RAZORPAY_KEY_SECRET') &&
      Deno.env.get('RAZORPAY_WEBHOOK_SECRET'),
  );
  const cronReady = Boolean(Deno.env.get('CRON_SECRET')?.trim());

  if (requireRazorpay) {
    if (appEnv !== 'development' && !razorpayReady) {
      errors.push('Razorpay KEY_ID/SECRET/WEBHOOK_SECRET required outside development');
    } else if (!razorpayReady) {
      warnings.push('Razorpay incomplete — stub/reject paths active');
    }
  }

  if (requireCron) {
    if (appEnv === 'production' && !cronReady) {
      errors.push('CRON_SECRET required in production');
    } else if (!cronReady) {
      warnings.push('CRON_SECRET unset — job edges will refuse invocations');
    }
  }

  for (const key of [
    'SMS_PROVIDER_API_KEY',
    'WHATSAPP_PROVIDER_API_KEY',
    'EMAIL_PROVIDER_API_KEY',
    'FCM_SERVER_KEY',
  ] as const) {
    if (!Deno.env.get(key)?.trim() && appEnv === 'production') {
      warnings.push(`${key} missing`);
    }
  }

  for (const w of warnings) console.warn(`[groaurum] ${w}`);
  if (errors.length) {
    throw new Error(`[groaurum] Provider configuration invalid: ${errors.join('; ')}`);
  }

  return { appEnv, ok: true, errors, warnings };
}
