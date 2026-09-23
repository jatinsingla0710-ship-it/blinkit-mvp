import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool, type PoolClient } from 'pg';
import type { DbTestConfig } from './env';

let pool: Pool | null = null;
let config: DbTestConfig | null = null;
let serviceClient: SupabaseClient | null = null;

export function getDbTestConfig(): DbTestConfig {
  if (!config) {
    throw new Error('Database test config not initialized. globalSetup may have failed.');
  }
  return config;
}

export function setDbTestConfig(next: DbTestConfig): void {
  config = next;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getDbTestConfig().dbUrl });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const { supabaseUrl, serviceRoleKey } = getDbTestConfig();
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serviceClient;
}

export async function withTrusted<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL groaurum.trusted_server_action = 'true'`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withUserClient<T>(
  accessToken: string,
  fn: (client: SupabaseClient) => Promise<T>,
  options?: { refreshToken?: string },
): Promise<T> {
  const { supabaseUrl, anonKey } = getDbTestConfig();
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (options?.refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: options.refreshToken,
    });
    if (error) {
      throw error;
    }
  }
  return fn(client);
}

export async function queryScalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T;
}
