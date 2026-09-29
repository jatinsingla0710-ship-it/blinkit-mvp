import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const FORBIDDEN = [
  /GroAurum/i,
  /customer\s+app\b/i,
  /app[- ]link/i,
  /\bactivation\b/i,
  /\binvite\b/i,
  /\binvitation\b/i,
];

function visibleSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
}

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return filesIn(full);
    return /\.(tsx|ts|css|html|json|js)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')
      ? [full]
      : [];
  });
}

describe('active Sales copy', () => {
  it('does not show GroAurum, a Customer App, activation, or invitations', () => {
    const targets = [
      ...filesIn(path.join(root, 'src/pages')),
      ...filesIn(path.join(root, 'src/components')),
      ...filesIn(path.join(root, 'src/layout')),
      ...filesIn(path.join(root, 'src/i18n')),
      path.join(root, 'index.html'),
      path.join(root, 'public/manifest.json'),
      path.join(root, 'public/sw.js'),
    ];
    const hits: string[] = [];
    for (const file of targets) {
      const text = visibleSource(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) hits.push(`${path.relative(root, file)} matches ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('names the product Salesaurum in install and shell metadata', () => {
    const manifest = readFileSync(path.join(root, 'public/manifest.json'), 'utf8');
    const index = readFileSync(path.join(root, 'index.html'), 'utf8');
    const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    expect(manifest).toContain('"name": "Salesaurum"');
    expect(manifest).toContain('"short_name": "Salesaurum"');
    expect(index).toContain('<title>Salesaurum</title>');
    expect(sw).toContain("title: 'Salesaurum'");
  });
});
