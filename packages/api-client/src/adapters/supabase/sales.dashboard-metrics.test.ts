import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const migrationsDir = join(root, 'supabase/migrations');
const originalMigration = join(
  migrationsDir,
  '20260901120000_admin_sales_dashboard_metrics.sql',
);
const fixMigration = join(
  migrationsDir,
  '20260901130000_fix_sales_dashboard_lpad.sql',
);

/** Extract each lpad(...) call, handling nested parentheses. */
export function extractLpadCalls(sql: string): string[] {
  const calls: string[] = [];
  const re = /\blpad\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    calls.push(sql.slice(match.index, i));
  }
  return calls;
}

/** PostgreSQL lpad(text, ...) — first argument must be cast to text. */
export function assertLpadFirstArgIsText(call: string): void {
  expect(call).toMatch(/^lpad\s*\(/i);
  const inner = call.replace(/^lpad\s*\(/i, '').replace(/\)\s*$/, '');
  const firstArg = inner.split(',')[0]?.trim() ?? '';
  expect(
    firstArg.endsWith('::text') || /::text\s*$/i.test(firstArg),
    `LPAD first argument must end with ::text, got: ${firstArg}`,
  ).toBe(true);
}

describe('admin_sales_dashboard_metrics migration', () => {
  const sql = readFileSync(originalMigration, 'utf8');

  it('defines dashboard RPC excluding REFUNDED sales', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_sales_dashboard_metrics\(/,
    );
    expect(sql).toMatch(/<> public\._sales_valid_filter\(\)/);
    expect(sql).toMatch(/REFUNDED/);
  });

  it('uses April financial year bounds helper', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\._fy_bounds\(/);
    expect(sql).toMatch(/p_fy_start_month int DEFAULT 4/);
  });
});

describe('20260901130000_fix_sales_dashboard_lpad corrective migration', () => {
  const sql = readFileSync(fixMigration, 'utf8');

  it('exists and replaces both affected functions', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\._fy_bounds\(/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_sales_dashboard_metrics\(/,
    );
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.admin_sales_dashboard_metrics/);
  });

  it('fixes admin_sales_dashboard_metrics prev FY label LPAD', () => {
    expect(sql).toMatch(
      /lpad\(\(\(extract\(year from v_prev_fy_start\)::int \+ 1\) % 100\)::text,\s*2,\s*'0'\)/,
    );
    expect(sql).not.toMatch(
      /lpad\(\(extract\(year from v_prev_fy_start\)::int \+ 1\) % 100,\s*2,\s*'0'\)/,
    );
  });

  it('all LPAD calls in fix migration use ::text first argument', () => {
    for (const call of extractLpadCalls(sql)) {
      assertLpadFirstArgIsText(call);
    }
  });
});

describe('all supabase migrations: LPAD first argument must be text', () => {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  it('scans every migration file for valid LPAD usage', () => {
    const violations: string[] = [];
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      for (const call of extractLpadCalls(sql)) {
        const inner = call.replace(/^lpad\s*\(/i, '').replace(/\)\s*$/, '');
        const firstArg = inner.split(',')[0]?.trim() ?? '';
        if (!firstArg.endsWith('::text')) {
          violations.push(`${file}: ${call}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
