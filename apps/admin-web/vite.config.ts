import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { groAurumMergedPublicEnvPlugin } from '@groaurum/config/vite/mergedPublicEnv';

const appDir = __dirname;

export default defineConfig({
  plugins: [groAurumMergedPublicEnvPlugin({ appDir }), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    // Workspace packages ship TypeScript source. Prebundling them freezes
    // named exports in node_modules/.vite/deps — after Roles Phase 1 added
    // buildRolePermissionMatrix, a stale @groaurum/auth prebundle made the
    // Settings lazy chunk fail to evaluate (white screen). Keep them excluded.
    exclude: [
      '@groaurum/auth',
      '@groaurum/ui',
      '@groaurum/validation',
      '@groaurum/data',
      '@groaurum/api',
      '@groaurum/api-client',
      '@groaurum/shared-types',
    ],
  },
});

