#!/usr/bin/env node
/**
 * Apply Sprint 4 seed against local Supabase.
 * Usage: node scripts/seed-sprint4.mjs
 * Requires: pnpm db:start (and migrations applied via db:reset).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedFile = resolve(root, 'supabase/seed/sprint4_seed.sql');
const configFile = resolve(root, 'supabase/config.toml');
const config = readFileSync(configFile, 'utf8');
const projectId = config.match(/^project_id\s*=\s*"([A-Za-z0-9_.-]+)"\s*$/m)?.[1];

if (!projectId) {
  console.error(`Could not read a valid project_id from ${configFile}.`);
  process.exit(1);
}

console.log('Applying Sprint 4 seed to local database...');
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    `supabase_db_${projectId}`,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-f',
    '-',
  ],
  {
    cwd: root,
    input: readFileSync(seedFile),
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: false,
  },
);

process.exit(result.status ?? 1);
