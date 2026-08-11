/**
 * vite.config.ts
 *
 * NOTE: Delete vite.config.js if it exists alongside this file.
 * When both .ts and .js configs exist, Vite picks .js and silently
 * ignores .ts — your define/proxy settings never apply.
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE_URL ?? 'http://localhost:3001';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Polyfill process.env.NODE_ENV for files written for Next.js/webpack
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'production' ? 'production' : 'development'
      ),
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target:       apiTarget,
          changeOrigin: true,
          secure:       false,
        },
      },
    },
  };
});