import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_DB_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const LOCAL_DB_PORT = 54422;

export type DbTestConfig = {
  dbUrl: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

type SupabaseStatusJson = {
  API_URL?: string;
  DB_URL?: string;
  ANON_KEY?: string;
  SERVICE_ROLE_KEY?: string;
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../..');
}

function readSupabaseStatus(): SupabaseStatusJson {
  try {
    const raw = execSync('pnpm exec supabase status -o json', {
      cwd: repoRoot(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON in supabase status output');
    }
    return JSON.parse(raw.slice(jsonStart)) as SupabaseStatusJson;
  } catch {
    throw new Error(
      'Could not read `supabase status`. Start local Supabase with `pnpm db:start` and apply migrations with `pnpm db:reset`.',
    );
  }
}

function assertSafeDatabaseUrl(urlString: string): void {
  const parsed = new URL(urlString.replace(/^postgresql:/, 'postgres:'));
  const host = parsed.hostname.toLowerCase();

  if (host.includes('supabase.co') || host.includes('pooler.supabase.com')) {
    throw new Error(
      `Refusing database tests against remote host "${host}". Use local Supabase only.`,
    );
  }

  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(
      `Refusing database tests against non-local host "${host}". Expected 127.0.0.1 or localhost.`,
    );
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  if (port !== LOCAL_DB_PORT) {
    throw new Error(
      `Refusing database tests against port ${port}. Expected local Supabase port ${LOCAL_DB_PORT}.`,
    );
  }
}

export function loadDbTestConfig(): DbTestConfig {
  if (process.env.GROAURUM_DB_TEST_ALLOWED !== 'true') {
    throw new Error(
      'Database integration tests require GROAURUM_DB_TEST_ALLOWED=true. ' +
        'This guard prevents accidental runs against production.',
    );
  }

  const status = readSupabaseStatus();
  const dbUrl =
    process.env.SUPABASE_DB_URL ??
    status.DB_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54422/postgres';
  const supabaseUrl = process.env.SUPABASE_URL ?? status.API_URL ?? 'http://127.0.0.1:54421';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? status.ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? status.SERVICE_ROLE_KEY;

  assertSafeDatabaseUrl(dbUrl);

  if (!anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase anon/service keys. Run `pnpm db:start` or set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
    throw new Error(`Refusing Supabase API URL "${supabaseUrl}". Use local Supabase only.`);
  }

  return { dbUrl, supabaseUrl, anonKey, serviceRoleKey };
}

export function isPgError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}
