'use client';

/**
 * @file src/providers/Providers.tsx
 * @description Single client boundary that wraps all client-side providers.
 *
 * WHY THIS FILE EXISTS:
 *  layout.tsx is a Server Component. When a server component imports multiple
 *  'use client' components (QueryProvider, AppProvider, RootErrorBoundary) and
 *  composes them in JSX, webpack cannot cleanly split the server chunk from the
 *  client chunks — each nested client import creates a separate boundary that
 *  the bundler struggles to resolve, producing a malformed app/layout.js chunk
 *  that the browser times out loading (ChunkLoadError).
 *
 *  The fix: consolidate ALL client providers into one 'use client' file so the
 *  server layout has a single opaque client boundary to hand off to. Webpack
 *  sees one clean split point instead of three overlapping ones.
 *
 * LAYER ORDER (outermost → innermost):
 *  RootErrorBoundary      → crash guard (must be outermost to catch provider errors)
 *  QueryProvider          → React Query cache
 *  ObservabilityProvider  → telemetry bootstrap (parser hook + error capture)
 *  AppProvider            → global user/session context (consumes React Query)
 *
 * PHASE 1 CHANGE — ObservabilityProvider added:
 *  ObservabilityProvider was defined in components/system/ObservabilityProvider.tsx
 *  but was NEVER MOUNTED in the application tree. As a result:
 *    - window.onerror and unhandledrejection capture was not registered
 *    - window.__HIRERISE_LOG (parser observation hook) was never installed
 *    - SESSION_START observability event was never emitted
 *
 *  Placement rationale (between QueryProvider and AppProvider):
 *    - Must be inside QueryProvider: ObservabilityProvider uses useEffect,
 *      which requires being inside a 'use client' boundary (already satisfied
 *      by this file), and its logEvent/pushEvent calls are synchronous and do
 *      not need the QueryClient.
 *    - Must be before AppProvider: AppProvider's hydration boot sequence
 *      (app-entry + /users/me) fires API requests immediately on mount. The
 *      parser observation hook (window.__HIRERISE_LOG) must be installed before
 *      any API responses are parsed so no observations are lost at session start.
 *    - Sibling position (not inside AppProvider): ObservabilityProvider has no
 *      dependency on auth state. Keeping it outside AppProvider means it is
 *      always active even if AppProvider crashes — preserving error observability
 *      during provider-level failures, which is exactly when you need it most.
 *
 *  StrictMode safety: ObservabilityProvider's useEffect has an empty dependency
 *  array (runs once on mount). initSilentErrorCapture() and installParserHook()
 *  are both idempotent — safe to call twice under StrictMode double-invoke.
 */

import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AppProvider } from '@/context/AppContext';
import { RootErrorBoundary } from '@/components/system/RootErrorBoundary';
import { ObservabilityProvider } from '@/components/system/ObservabilityProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <RootErrorBoundary>
      <QueryProvider>
        {/*
          ObservabilityProvider installs:
           - window.onerror + unhandledrejection capture (initSilentErrorCapture)
           - window.__HIRERISE_LOG (parser observation telemetry hook)
           - SESSION_START event emission

          Must mount before AppProvider so the parser hook is in place before
          the first API requests fire during the AppProvider boot sequence.
          useEffect is safe here — idempotent, no provider context needed.
        */}
        <ObservabilityProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </ObservabilityProvider>
      </QueryProvider>
    </RootErrorBoundary>
  );
}