import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '@/providers/Providers';
import { validateEnv } from '@/lib/env';

/**
 * Root layout — single server component that hands off to the Providers
 * client boundary immediately.
 *
 * WHY ONLY ONE CLIENT IMPORT:
 *  Importing multiple 'use client' components (QueryProvider, AppProvider,
 *  RootErrorBoundary) directly in a server layout and composing them in JSX
 *  gives webpack multiple overlapping client boundaries to resolve. It cannot
 *  cleanly split the server chunk from the client chunks, producing a malformed
 *  app/layout.js that the browser times out loading (ChunkLoadError).
 *
 *  The fix: one <Providers> import = one clean server→client split point.
 *  All provider nesting (RootErrorBoundary → QueryProvider → AppProvider)
 *  lives inside src/providers/Providers.tsx, which is a single 'use client' file.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  // Server-only env validation — runs on every request, never on the client.
  validateEnv();

  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
