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
    port: 5175,
    strictPort: true,
  },
  optimizeDeps: {
    // Workspace packages change often — prebundling api-client caused stale
    // DeliveryService shapes (e.g. missing recordCashPayment at runtime).
    include: ['@groaurum/ui', '@groaurum/auth'],
    exclude: ['@groaurum/api-client'],
  },
});
