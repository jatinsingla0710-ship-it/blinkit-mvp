import path from 'node:path';
import { loadEnv, type Plugin } from 'vite';

export type GroAurumMergedPublicEnvOptions = {
  /** Absolute path to the Vite app directory (e.g. apps/admin-web). */
  appDir: string;
  /** Monorepo root; defaults to two levels above appDir. */
  rootDir?: string;
};

function promoteEnvValue(
  merged: Record<string, string>,
  define: Record<string, string>,
  viteKey: string,
  ...fallbackKeys: string[]
): void {
  if (merged[viteKey]?.trim()) return;
  for (const key of fallbackKeys) {
    const value = merged[key]?.trim();
    if (value) {
      define[`import.meta.env.${viteKey}`] = JSON.stringify(value);
      return;
    }
  }
}

/**
 * Merges monorepo root + app `.env*` files and promotes shared root keys
 * (SUPABASE_*, GROAURUM_*) into VITE_* for browser clients.
 *
 * Root `.env.local` often holds SUPABASE_URL / SUPABASE_ANON_KEY for scripts;
 * apps still need VITE_* at runtime — this bridge keeps one source of truth.
 */
export function groAurumMergedPublicEnvPlugin(
  options: GroAurumMergedPublicEnvOptions,
): Plugin {
  const appDir = options.appDir;
  const rootDir = options.rootDir ?? path.resolve(appDir, '../..');

  return {
    name: 'groaurum-merged-public-env',
    config(_config, { mode }) {
      const rootEnv = loadEnv(mode, rootDir, '');
      const appEnv = loadEnv(mode, appDir, '');
      const merged: Record<string, string> = { ...rootEnv, ...appEnv };

      const define: Record<string, string> = {};

      promoteEnvValue(
        merged,
        define,
        'VITE_SUPABASE_URL',
        'GROAURUM_SUPABASE_URL',
        'SUPABASE_URL',
      );
      promoteEnvValue(
        merged,
        define,
        'VITE_SUPABASE_ANON_KEY',
        'GROAURUM_SUPABASE_ANON_KEY',
        'SUPABASE_ANON_KEY',
      );
      promoteEnvValue(
        merged,
        define,
        'VITE_AUTH_PROVIDER',
        'GROAURUM_AUTH_PROVIDER',
      );
      promoteEnvValue(merged, define, 'VITE_APP_ENV', 'GROAURUM_APP_ENV');

      for (const [key, value] of Object.entries(merged)) {
        if (key.startsWith('GROAURUM_') && value.trim()) {
          define[`import.meta.env.${key}`] = JSON.stringify(value.trim());
        }
      }

      return {
        envPrefix: ['VITE_', 'GROAURUM_'],
        define: Object.keys(define).length > 0 ? define : undefined,
      };
    },
  };
}
