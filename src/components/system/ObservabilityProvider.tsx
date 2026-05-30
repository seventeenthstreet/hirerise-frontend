

/**
 * @file src/components/system/ObservabilityProvider.tsx
 * @description Client-side observability bootstrap component.
 *
 * Mounts `initSilentErrorCapture()` exactly once per browser session.
 * Place this inside the root layout, wrapped around (or alongside) the
 * QueryProvider, so it is always active.
 *
 * This is a render-nothing component — it returns children unchanged.
 * All side effects are in the useEffect.
 *
 * USAGE in src/app/layout.tsx:
 *
 *   import { ObservabilityProvider } from '@/components/system/ObservabilityProvider';
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           <ObservabilityProvider>
 *             <QueryProvider>{children}</QueryProvider>
 *           </ObservabilityProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * ARCHITECTURE POSITION: System layer (above app, below everything else)
 *   [browser boot] → ObservabilityProvider → app tree
 */

import { useEffect, type ReactNode } from 'react';
import { initSilentErrorCapture } from '@/lib/observability/silentErrors';
import { createEvent } from '@/lib/observability/observability';
import { logEvent } from '@/lib/observability/logger';

interface ObservabilityProviderProps {
  children: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER OBSERVATION HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Installs window.__HIRERISE_LOG — the production telemetry hook consumed by
 * api-parser-observation.ts during the Phase 3 observation window.
 *
 * Called once per session from useEffect. The hook receives structured parser
 * observation events and routes them into the existing observability pipeline
 * (logEvent → pushEvent → consoleAdapter → registered external adapters).
 *
 * Event shape from api-parser-observation.ts:
 *   { level: 'info', type: 'parser_observation', branch, count, code, url }
 *
 * These events are distinguishable in monitoring by:
 *   - type === 'parser_observation'    (in the raw hook payload)
 *   - name === 'PARSER_BRANCH_HIT'     (in the ObservabilityEvent name field)
 *   - context.branch === 'legacy' | 'transitional' | 'malformed'
 *
 * SAFETY:
 *   - Never throws (try/catch wraps the entire implementation)
 *   - PII-safe: raw response bodies are excluded by api-parser-observation.ts
 *   - Idempotent: subsequent installs overwrite safely (same function)
 */
function installParserObservationHook(): void {
  try {
    (window as unknown as Record<string, unknown>).__HIRERISE_LOG = (
      event: unknown,
    ): void => {
      try {
        if (
          event === null ||
          typeof event !== 'object' ||
          (event as Record<string, unknown>).type !== 'parser_observation'
        ) {
          // Only handle parser observation events — ignore anything else.
          return;
        }

        const ev = event as Record<string, unknown>;

        // Route into the existing observability pipeline using ObservabilityEvent shape.
        // This makes parser observations appear in:
        //   - the in-memory ring buffer (window.__obs?.getEventBuffer())
        //   - the timeline devtools panel
        //   - any registered external adapters (Sentry, Datadog, etc.)
        logEvent(
          createEvent({
            type:  'system',
            name:  'PARSER_BRANCH_HIT',
            level: ev.level === 'warn' ? 'warn' : 'info',
            context: {
              // Searchable dimensions for monitoring queries:
              branch:  ev.branch,   // 'legacy' | 'transitional' | 'malformed'
              code:    ev.code,     // error code string or 'none'
              url:     ev.url,      // endpoint URL or 'unknown'
              count:   ev.count,    // cumulative hit count for this session
              // Omit raw response body — PII-safe by design.
            },
          }),
        );
      } catch {
        // Never surface — the hook must not affect the parse pipeline.
      }
    };
  } catch {
    // Never surface — hook installation must not crash the provider.
  }
}

export function ObservabilityProvider({ children }: ObservabilityProviderProps) {
  useEffect(() => {
    // Install window.onerror + unhandledrejection listeners.
    // Idempotent — safe to call more than once (won't re-register).
    initSilentErrorCapture();

    // Install window.__HIRERISE_LOG so production parser observations reach
    // monitoring. Must be called before any API requests fire (i.e., on mount,
    // before the app tree renders), so no observations are lost at session start.
    installParserObservationHook();

    // Emit a session-start system event so the timeline has an anchor point.
    logEvent(createEvent({
      type:    'system',
      name:    'SESSION_START',
      level:   'info',
      context: {
        url:       typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : 'unknown',
      },
    }));
  }, []); // Run once on mount — never re-run.

  // Render children without any wrapper element to avoid DOM pollution.
  return children;
}