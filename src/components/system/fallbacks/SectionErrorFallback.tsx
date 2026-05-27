'use client';

/**
 * @file src/components/system/fallbacks/SectionErrorFallback.tsx
 * @description Mid-sized fallback for page sections — larger than a widget
 * but smaller than the full-page AppCrashFallback.
 *
 * Use this to isolate failures in:
 *  - Analytics chart sections
 *  - Multi-widget panels
 *  - Complex form sections
 */

import type { FallbackInjectedProps } from '../ErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface SectionErrorFallbackProps extends FallbackInjectedProps {
  /** Human-readable section name for context. */
  section?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section-level error state.
 *
 * onReset and error are injected automatically by ErrorBoundary.
 */
export function SectionErrorFallback({
  section = 'This section',
  onReset,
}: SectionErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-border bg-card p-8 shadow-sm text-center"
      style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
        ⚠️
      </div>

      <p className="text-sm font-semibold text-foreground mb-1">
        {section} could not be displayed
      </p>
      <p className="text-xs text-muted-foreground mb-4" style={{ maxWidth: '40ch' }}>
        An unexpected error occurred in this part of the page. Other sections are unaffected.
      </p>

      {onReset && (
        <button
          onClick={onReset}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        >
          Retry
        </button>
      )}
    </div>
  );
}