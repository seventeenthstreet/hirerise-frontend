'use client';

/**
 * @file src/components/system/fallbacks/AppCrashFallback.tsx
 * @description Full-page fallback rendered when the root ErrorBoundary catches
 * an unrecoverable render error. Gives the user a way out without a blank screen.
 */

import type { FallbackInjectedProps } from '../ErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface AppCrashFallbackProps extends FallbackInjectedProps {
  /**
   * Optional retry callback (Refinement 6).
   * Distinct from onReset (boundary clear) — use this to trigger
   * data-layer recovery such as queryClient.invalidateQueries().
   * Injected manually at the usage site, never by ErrorBoundary.
   */
  onRetry?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-page crash screen.
 *
 * onReset, error, and isChunkError are injected automatically by ErrorBoundary
 * when this component is passed as the `fallback` prop.
 * onRetry is optional and must be supplied at the usage site when needed.
 */
export function AppCrashFallback({
  onReset,
  onRetry,
  error,
  isChunkError,
}: AppCrashFallbackProps) {
  function handleReload() {
    // Hard reload clears any in-memory state that caused the crash.
    window.location.reload();
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        minHeight:       '100vh',
        padding:         '2rem',
        textAlign:       'center',
        fontFamily:      'system-ui, sans-serif',
        backgroundColor: '#fafafa',
        color:           '#111',
      }}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}
      >
        ⚠️
      </div>

      {/* Heading */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Something went wrong
      </h1>

      {/* Refinement 5: chunk-specific copy */}
      <p style={{ fontSize: '0.9rem', color: '#555', maxWidth: '36ch', marginBottom: '1.5rem' }}>
        {isChunkError
          ? 'App update required or connection issue. Reloading the page usually fixes this.'
          : 'The application encountered an unexpected error. Your data is safe — reloading the page will restore normal functionality.'}
      </p>

      {/* Error detail (development only) */}
      {process.env.NODE_ENV !== 'production' && error && (
        <pre
          style={{
            fontSize:     '0.75rem',
            color:        '#b91c1c',
            background:   '#fef2f2',
            border:       '1px solid #fca5a5',
            borderRadius: '0.5rem',
            padding:      '0.75rem 1rem',
            maxWidth:     '60ch',
            overflowX:    'auto',
            textAlign:    'left',
            marginBottom: '1.5rem',
            whiteSpace:   'pre-wrap',
            wordBreak:    'break-word',
          }}
        >
          {error.message}
        </pre>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={handleReload}
          style={{
            padding:      '0.6rem 1.4rem',
            borderRadius: '0.5rem',
            border:       'none',
            background:   '#2563eb',
            color:        '#fff',
            fontSize:     '0.875rem',
            fontWeight:   600,
            cursor:       'pointer',
          }}
        >
          Reload page
        </button>

        {/* Soft reset — tries to remount the boundary without a full reload */}
        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding:      '0.6rem 1.4rem',
              borderRadius: '0.5rem',
              border:       '1px solid #d1d5db',
              background:   '#fff',
              color:        '#374151',
              fontSize:     '0.875rem',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Try again
          </button>
        )}

        {/* Refinement 6: optional data-layer retry */}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding:      '0.6rem 1.4rem',
              borderRadius: '0.5rem',
              border:       '1px solid #d1d5db',
              background:   '#fff',
              color:        '#374151',
              fontSize:     '0.875rem',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}