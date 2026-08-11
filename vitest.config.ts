/**
 * vitest.config.ts
 *
 * WP-ADMIN-04F-09 — introduces frontend test infrastructure for the first
 * time in this repo (audited: no test runner previously existed here).
 *
 * Deliberately a separate file from vite.config.ts rather than merging a
 * `test` block into it — vite.config.ts's own header note ("delete .js if
 * it exists alongside this .ts file, Vite picks .js and silently ignores
 * .ts") signals that file is treated as fragile/order-sensitive; adding a
 * new concern to it risks exactly that kind of silent breakage. This file
 * duplicates only the two things tests need from it (the `@` alias, the
 * React plugin) rather than importing/extending it, since vite.config.ts
 * also loads server-proxy env vars that are meaningless under Vitest.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    // No `globals: true` — every test file imports describe/it/expect/vi
    // explicitly from 'vitest', matching this repo's existing convention
    // of explicit imports over ambient globals (see e.g. lib/api/core's
    // barrel-export-only rule).
  },
});
