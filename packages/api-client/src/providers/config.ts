/**
 * Production provider configuration — env-only, never hardcode secrets.
 * Validates presence of required keys for the active APP_ENV.
 */

export type ProviderKind =
  | 'razorpay'
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'fcm';

export type AppRuntimeEnv = 'development' | 'staging' | 'production';

export type ProviderConfig = {
  appEnv: AppRuntimeEnv;
  razorpay: {
    keyId: string | null;
    keySecretConfigured: boolean;
    webhookSecretConfigured: boolean;
    ready: boolean;
  };
  sms: { apiKeyConfigured: boolean; ready: boolean };
  whatsapp: { apiKeyConfigured: boolean; ready: boolean };
  email: { apiKeyConfigured: boolean; ready: boolean };
  fcm: { serverKeyConfigured: boolean; ready: boolean };
  cronSecretConfigured: boolean;
  allowedOrigins: string[];
  warnings: string[];
  errors: string[];
};

export type EnvBag = Record<string, string | undefined>;

function read(env: EnvBag, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function parseEnv(raw: string | null): AppRuntimeEnv {
  if (raw === 'staging' || raw === 'production') return raw;
  return 'development';
}

/**
 * Parse and validate provider configuration from Vite / Expo / Deno / Node env bags.
 */
export function loadProviderConfig(env: EnvBag): ProviderConfig {
  const appEnv = parseEnv(
    read(env, 'APP_ENV', 'VITE_APP_ENV', 'EXPO_PUBLIC_APP_ENV', 'GROAURUM_APP_ENV'),
  );

  const razorpayKeyId = read(
    env,
    'RAZORPAY_KEY_ID',
    'VITE_RAZORPAY_KEY_ID',
    'EXPO_PUBLIC_RAZORPAY_KEY_ID',
  );
  const razorpaySecret = read(env, 'RAZORPAY_KEY_SECRET');
  const razorpayWebhook = read(env, 'RAZORPAY_WEBHOOK_SECRET');
  const smsKey = read(env, 'SMS_PROVIDER_API_KEY');
  const waKey = read(env, 'WHATSAPP_PROVIDER_API_KEY');
  const emailKey = read(env, 'EMAIL_PROVIDER_API_KEY');
  const fcmKey = read(env, 'FCM_SERVER_KEY');
  const cronSecret = read(env, 'CRON_SECRET');
  const originsRaw = read(env, 'ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS', 'VITE_ALLOWED_ORIGINS');

  const warnings: string[] = [];
  const errors: string[] = [];

  const razorpayReady = Boolean(razorpayKeyId && razorpaySecret && razorpayWebhook);
  if (appEnv !== 'development' && !razorpayReady) {
    errors.push('Razorpay KEY_ID, KEY_SECRET, and WEBHOOK_SECRET are required outside development');
  } else if (!razorpayReady) {
    warnings.push('Razorpay incomplete — online payments will use stub/unavailable mode');
  }

  if (appEnv === 'production') {
    if (!smsKey) warnings.push('SMS_PROVIDER_API_KEY missing — SMS OTP/notifications stubbed');
    if (!waKey) warnings.push('WHATSAPP_PROVIDER_API_KEY missing');
    if (!emailKey) warnings.push('EMAIL_PROVIDER_API_KEY missing');
    if (!fcmKey) warnings.push('FCM_SERVER_KEY missing — push stubbed');
    if (!cronSecret) {
      errors.push('CRON_SECRET is required in production for job edge protection');
    }
  } else if (!cronSecret) {
    warnings.push('CRON_SECRET unset — job edges will refuse invocations until configured');
  }

  // Public key may be exposed to browsers; secrets must never be.
  if (read(env, 'VITE_RAZORPAY_KEY_SECRET', 'EXPO_PUBLIC_RAZORPAY_KEY_SECRET')) {
    errors.push('Razorpay secret must not be exposed via VITE_/EXPO_PUBLIC_ variables');
  }
  if (read(env, 'VITE_CRON_SECRET', 'EXPO_PUBLIC_CRON_SECRET')) {
    errors.push('CRON_SECRET must not be exposed via VITE_/EXPO_PUBLIC_ variables');
  }

  return {
    appEnv,
    razorpay: {
      keyId: razorpayKeyId,
      keySecretConfigured: Boolean(razorpaySecret),
      webhookSecretConfigured: Boolean(razorpayWebhook),
      ready: razorpayReady,
    },
    sms: { apiKeyConfigured: Boolean(smsKey), ready: Boolean(smsKey) },
    whatsapp: { apiKeyConfigured: Boolean(waKey), ready: Boolean(waKey) },
    email: { apiKeyConfigured: Boolean(emailKey), ready: Boolean(emailKey) },
    fcm: { serverKeyConfigured: Boolean(fcmKey), ready: Boolean(fcmKey) },
    cronSecretConfigured: Boolean(cronSecret),
    allowedOrigins: originsRaw
      ? originsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    warnings,
    errors,
  };
}

/**
 * Throw when configuration is invalid for the current environment.
 * Call once at app/edge startup.
 */
export function assertProviderConfig(env: EnvBag): ProviderConfig {
  const config = loadProviderConfig(env);
  if (config.errors.length > 0) {
    throw new Error(
      `[groaurum] Provider configuration invalid:\n- ${config.errors.join('\n- ')}`,
    );
  }
  for (const warning of config.warnings) {
    console.warn(`[groaurum] ${warning}`);
  }
  return config;
}
