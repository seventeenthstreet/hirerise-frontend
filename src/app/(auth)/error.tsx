'use client';

import { useEffect } from 'react';
import { captureError, SUBSYSTEMS } from '@/lib/monitoring';

/**
 * (auth)/error.tsx — Auth-scoped error recovery UI.
 *
 * Next.js App Router renders this when an unhandled error is thrown
 * inside any (auth) route segment.
 *
 * Requirements met:
 *  - Graceful recovery UI scoped to auth routes.
 *  - Retry button calls reset() to re-render the segment.
 *  - Minimal implementation — no over-engineering.
 *
 * NOTE: This does NOT replace the root ErrorBoundary in app/layout.tsx.
 * The root boundary catches catastrophic provider failures.
 * This boundary catches route-level render errors within (auth).
 *
 * Phase 3A Step 5 — Silent failure prevention:
 * Added captureError() so route-level crashes are surfaced to monitoring.
 * Previously this boundary was completely silent — errors appeared in the
 * console but were never sent to the monitoring layer, making auth-route
 * crashes invisible in production observability.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 3A Step 5: Surface auth-route errors to monitoring.
    // Previously only console.error — now also captured for production observability.
    console.error('[AuthError]', error);
    captureError(error, {
      subsystem: SUBSYSTEMS.APP_CONTEXT,
      action:    'auth_route_error',
      metadata:  { digest: error.digest },
      severity:  'error',
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            {error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
        </div>

        <button
          onClick={reset}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}