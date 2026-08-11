/**
 * @file src/test/setup.ts
 * @description Global Vitest setup, loaded via vitest.config.ts's
 * `test.setupFiles`. WP-ADMIN-04F-09 — first test setup file in this repo.
 *
 * Responsibilities:
 *  - Extend `expect` with jest-dom matchers (toBeInTheDocument, etc.)
 *  - Start/reset/stop the shared MSW server around every test file, so
 *    tests never hit a live API (per WP-ADMIN-04F-09's explicit "mock API
 *    responses; do not call live APIs" requirement) and one test's handler
 *    overrides never leak into the next.
 */

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { resetAdminUserAccountStatus } from './msw/handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // WP-ADMIN-COMP-04 — Enable/Disable Account mock state is mutated by
  // tests that exercise the confirm-dialog flow; reset it alongside the
  // handlers themselves so no test leaks account status into the next.
  resetAdminUserAccountStatus();
});
afterAll(() => server.close());

// Without `test.globals: true` in vitest.config.ts, @testing-library/react's
// own auto-cleanup registration (which detects a global `afterEach`) never
// fires, so unmounted trees from a previous test in the same file would
// otherwise stay in the DOM and cause "found multiple elements" failures
// in the next test. Registering it explicitly here, once, for every file.
afterEach(() => cleanup());
