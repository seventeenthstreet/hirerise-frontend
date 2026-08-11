/**
 * @file src/test/msw/server.ts
 * @description Shared MSW server for Vitest (Node environment via jsdom).
 * Started/reset/stopped by src/test/setup.ts.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
