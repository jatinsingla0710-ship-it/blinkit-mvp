/**
 * Customer Expo public configuration.
 *
 * EXPO_PUBLIC_* values are embedded in the client bundle. Only the Supabase
 * API URL and anon/publishable key belong here — never service-role keys,
 * database URLs, or passwords.
 *
 * Adapter mode must be set explicitly:
 *   EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock|supabase
 */
import Constants from 'expo-constants';
import {
  parseCustomerDataAdapterMode,
  parsePublicSupabaseConfig,
  type CustomerDataAdapterMode,
  type PublicSupabaseConfig,
} from '@groaurum/api-client';

type Extra = {
  customerDataAdapter?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function readExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' ? value : undefined;
}

export function getCustomerDataAdapterMode(): CustomerDataAdapterMode {
  const fromEnv = readEnv('EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER');
  const fromExtra = readExtra().customerDataAdapter;
  return parseCustomerDataAdapterMode(fromEnv ?? fromExtra ?? 'mock');
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  return parsePublicSupabaseConfig({
    url: readEnv('EXPO_PUBLIC_SUPABASE_URL') ?? readExtra().supabaseUrl,
    anonKey: readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? readExtra().supabaseAnonKey,
  });
}

export function isSupabaseAdapterMode(): boolean {
  return getCustomerDataAdapterMode() === 'supabase';
}

export function isMockAdapterMode(): boolean {
  return getCustomerDataAdapterMode() === 'mock';
}
