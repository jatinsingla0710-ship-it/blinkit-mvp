#!/usr/bin/env node
/**
 * Verifies Docker and local Supabase are available before database proof runs.
 * Exits non-zero with actionable messages when prerequisites are missing.
 */
import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const LOCAL_DB_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const LOCAL_DB_PORT = 54422;
const LOCAL_API_PORT = 54421;

function fail(message) {
  console.error(`\n[db-prerequisites] ${message}\n`);
  process.exit(1);
}

function hasDocker() {
  try {
    execSync('docker version', { stdio: 'pipe' });
    return true;
  } catch {
    const windowsDocker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
    try {
      execSync(`"${windowsDocker}" version`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

function parseSupabaseStatus() {
  try {
    const raw = execSync('pnpm exec supabase status -o json', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) {
      return null;
    }
    return JSON.parse(raw.slice(jsonStart));
  } catch {
    return null;
  }
}

function assertSafeDatabaseUrl(urlString) {
  if (!urlString) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(urlString.replace(/^postgresql:/, 'postgres:'));
  } catch {
    fail(`SUPABASE_DB_URL is not a valid URL: ${urlString}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'postgres:' && !urlString.startsWith('postgresql://')) {
    fail(`SUPABASE_DB_URL must use postgresql:// (got ${parsed.protocol})`);
  }

  if (host.includes('supabase.co') || host.includes('pooler.supabase.com')) {
    fail(
      'SUPABASE_DB_URL points at a remote Supabase host. Database tests only run against local Supabase (127.0.0.1:54422).',
    );
  }

  if (!LOCAL_DB_HOSTS.has(host)) {
    fail(
      `SUPABASE_DB_URL host "${host}" is not local. Set GROAURUM_DB_TEST_ALLOWED=true only when targeting local Supabase.`,
    );
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  if (port !== LOCAL_DB_PORT) {
    fail(
      `SUPABASE_DB_URL port ${port} is not the expected local Supabase port ${LOCAL_DB_PORT}.`,
    );
  }
}

function probePort(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  process.env.GROAURUM_DB_TEST_ALLOWED ??= 'true';

  if (process.env.GROAURUM_DB_TEST_ALLOWED !== 'true') {
    fail(
      'Set GROAURUM_DB_TEST_ALLOWED=true to run database integration tests against local Supabase.',
    );
  }

  assertSafeDatabaseUrl(process.env.SUPABASE_DB_URL);

  if (!hasDocker()) {
    fail(
      'Docker (or a compatible container runtime) is required for local Supabase but was not found.\n' +
        'Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/\n' +
        'Then run: pnpm db:start',
    );
  }

  const apiUp = await probePort(LOCAL_API_PORT);
  const dbUp = await probePort(LOCAL_DB_PORT);

  if (!apiUp || !dbUp) {
    fail(
      'Local Supabase is not running on 127.0.0.1:54421 / :54422.\n' +
        'Start it with: pnpm db:start\n' +
        'Apply migrations with: pnpm db:reset',
    );
  }

  const status = parseSupabaseStatus();
  if (!status?.DB_URL?.includes('127.0.0.1')) {
    fail('supabase status did not report a local database URL. Run `pnpm db:start` and retry.');
  }

  console.log('[db-prerequisites] Local Supabase stack is reachable.');
}

main();
