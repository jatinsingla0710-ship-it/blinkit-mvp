import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Vercel SPA fallback', () => {
  it('rewrites unknown paths to index.html so refresh does not 404', () => {
    const config = JSON.parse(
      readFileSync(path.join(root, 'vercel.json'), 'utf8'),
    ) as {
      rewrites?: { source: string; destination: string }[];
    };
    expect(config.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });
});
