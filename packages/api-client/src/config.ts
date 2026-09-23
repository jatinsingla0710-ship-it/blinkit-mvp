export const CUSTOMER_DATA_ADAPTER_MODES = ['mock', 'supabase'] as const;
export type CustomerDataAdapterMode = (typeof CUSTOMER_DATA_ADAPTER_MODES)[number];

export function parseCustomerDataAdapterMode(
  value: string | undefined | null,
): CustomerDataAdapterMode {
  const normalized = (value ?? 'mock').trim().toLowerCase();
  if (normalized === 'mock' || normalized === 'supabase') {
    return normalized;
  }
  throw new Error(
    `Invalid customer data adapter mode "${value}". Expected one of: ${CUSTOMER_DATA_ADAPTER_MODES.join(', ')}`,
  );
}

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

export type EnvBag = Record<string, string | boolean | undefined>;

function readEnvString(env: EnvBag, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = env[key];
    const value = typeof raw === 'string' ? raw : undefined;
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Resolve public Supabase URL + anon key from Vite / Expo / GroAurum env bags.
 * Browser code must never read SUPABASE_SERVICE_ROLE_KEY or server-only secrets.
 */
export function resolvePublicSupabaseConfigFromEnv(
  env: EnvBag,
): PublicSupabaseConfig {
  return parsePublicSupabaseConfig({
    url: readEnvString(
      env,
      'VITE_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_URL',
      'GROAURUM_SUPABASE_URL',
    ),
    anonKey: readEnvString(
      env,
      'VITE_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'GROAURUM_SUPABASE_ANON_KEY',
    ),
  });
}

/**
 * Validates public Supabase client config for Expo / browser use.
 * Never accepts service-role keys or database connection strings.
 */
export function parsePublicSupabaseConfig(input: {
  url: string | undefined | null;
  anonKey: string | undefined | null;
}): PublicSupabaseConfig {
  const url = (input.url ?? '').trim();
  const anonKey = (input.anonKey ?? '').trim();

  if (!url) {
    throw new Error(
      'Missing Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL (local example: http://127.0.0.1:54421).',
    );
  }
  if (!anonKey) {
    throw new Error(
      'Missing Supabase anon/publishable key. Set EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Supabase URL: ${url}`);
  }

  // Reject accidental DB connection strings / secrets in the public client path.
  if (
    parsed.protocol === 'postgresql:' ||
    parsed.protocol === 'postgres:' ||
    url.includes('postgresql://') ||
    url.includes('postgres://')
  ) {
    throw new Error(
      'Database connection strings must not be used in the Expo public client. Use the Supabase API URL only.',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Supabase URL must be http(s): ${url}`);
  }

  if (
    anonKey.includes('service_role') ||
    anonKey.toLowerCase().includes('service-role')
  ) {
    throw new Error(
      'Service-role keys are forbidden in the customer app. Use the anon/publishable key only.',
    );
  }

  return { url, anonKey };
}
