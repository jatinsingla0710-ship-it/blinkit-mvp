/**
 * Populate .env.local files from `supabase status -o env`.
 * Does not print secret values — only lengths / file update status.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = execSync('pnpm exec supabase status -o env', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const status = {};
for (const line of out.split(/\r?\n/)) {
  const m = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  status[m[1]] = v;
}

const anon = status.ANON_KEY;
const service = status.SERVICE_ROLE_KEY;
const apiUrl = status.API_URL || 'http://127.0.0.1:54421';

if (!anon || !service) {
  console.error('FAIL: ANON_KEY / SERVICE_ROLE_KEY missing from supabase status');
  process.exit(1);
}

function replaceInFile(file, replacements) {
  if (!existsSync(file)) {
    console.log(`SKIP missing ${file}`);
    return;
  }
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of Object.entries(replacements)) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    writeFileSync(file, text, 'utf8');
    console.log(`UPDATED ${file}`);
  } else {
    console.log(`UNCHANGED ${file}`);
  }
}

const anonRepls = {
  '<FILL_SUPABASE_ANON_KEY>': anon,
  '<FILL_SUPABASE_URL>': apiUrl,
};

const serviceRepls = {
  ...anonRepls,
  '<FILL_SERVICE_ROLE_KEY>': service,
  '<FILL_SUPABASE_SERVICE_ROLE_KEY>': service,
};

const root = process.cwd();
replaceInFile(resolve(root, '.env.local'), serviceRepls);
replaceInFile(resolve(root, '.env.test.local'), serviceRepls);
replaceInFile(resolve(root, 'apps/admin-web/.env.local'), anonRepls);
replaceInFile(resolve(root, 'apps/sales-pwa/.env.local'), anonRepls);
replaceInFile(resolve(root, 'apps/delivery-pwa/.env.local'), anonRepls);
replaceInFile(resolve(root, 'apps/customer/.env.local'), anonRepls);
replaceInFile(resolve(root, 'supabase/.env.local'), serviceRepls);

console.log(`API_URL_present=${Boolean(apiUrl)}`);
console.log(`ANON_KEY_len=${anon.length}`);
console.log(`SERVICE_ROLE_KEY_len=${service.length}`);
console.log('Done. Secrets written; values not printed.');
