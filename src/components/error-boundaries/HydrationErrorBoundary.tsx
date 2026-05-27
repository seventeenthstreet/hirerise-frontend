'use client';
/**
 * @file src/components/error-boundaries/HydrationErrorBoundary.tsx
 *
 * PHASES 7, 9 — Graceful Degraded States + Sentry Error Monitoring Prep
 *
 * PURPOSE
 * ───────
 * Prevents blank screens and infinite spinners by catching:
 *   1. React render errors (class ErrorBoundary)
 *   2. Hydration timeout (HydrationTimeoutScreen — triggered by AppContext)
 *   3. Backend unavailable (BackendUnavailableScreen)
 *
 * PHASE 7 — DEGRADED STATES
 * ─────────────────────────
 * HydrationErrorBoundary catches render panics and shows a recoverable
 * fallback with a "Retry" button. The retry calls window.location.reload()
 * so the entire hydration state machine starts fresh.
 *
 * HydrationTimeoutScreen: shown when the isHydrated gate never resolves
 * within HYDRATION_UI_TIMEOUT_MS. The AppProvider fires a custom DOM event
 * 'hirerise:hydration:timeout' when this threshold is exceeded, which is
 * caught by the root layout and renders this screen.
 *
 * BackendUnavailableScreen: shown when the health check returns non-ok or
 * when fetchUser receives a 503/502 and all retries are exhausted.
 *
 * PHASE 9 — SENTRY PREPARATION
 * ─────────────────────────────
 * All caught errors are normalised into a SentryErrorPayload shape that
 * is ready for Sentry.captureException() — passed through the registered
 * observability adapters rather than called directly. When Sentry is added:
 *
 *   import * as Sentry from '@sentry/nextjs';
 *   import { registerAdapter } from '@/lib/observability/logger';
 *   registerAdapter((ev) => {
 *     if (ev.type === 'error') {
 *       Sentry.captureException(new Error(ev.name), {
 *         extra: ev.context,
 *         tags:  { requestId: ev.context?.requestId as string },
 *       });
 *     }
 *   });
 *
 * No Sentry package is imported here — the integration is pure adapter
 * registration in the app boot sequence.
 */

import React, { Component, type ReactNode } from 'react';
import { logEvent, createEvent, emitErrorBoundaryEvent } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — HYDRATION TIMEOUT SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-screen fallback shown when hydration hangs beyond the UI timeout.
 * Presented by the root layout when the 'hirerise:hydration:timeout' DOM event
 * fires. Recoverable via page reload.
 */
export function HydrationTimeoutScreen({ onRetry }: { onRetry?: () => void }) {
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
        color:           '#1a1a2e',
        background:      '#f8f9fa',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏱</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Taking longer than expected
      </h1>
      <p style={{ color: '#6b7280', maxWidth: '380px', marginBottom: '2rem', lineHeight: 1.6 }}>
        We're having trouble loading your session. This is usually a temporary blip.
      </p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        style={{
          background:   '#6366f1',
          color:        '#fff',
          border:       'none',
          borderRadius: '8px',
          padding:      '0.75rem 2rem',
          fontSize:     '1rem',
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        Retry
      </button>
      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
        If this keeps happening, try refreshing the page.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — BACKEND UNAVAILABLE SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export function BackendUnavailableScreen({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100vh',
        padding:        '2rem',
        textAlign:      'center',
        fontFamily:     'system-ui, sans-serif',
        color:          '#1a1a2e',
        background:     '#f8f9fa',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔌</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Service temporarily unavailable
      </h1>
      <p style={{ color: '#6b7280', maxWidth: '380px', marginBottom: '2rem', lineHeight: 1.6 }}>
        HireRise is currently unreachable. Our team has been notified.
        Please try again in a moment.
      </p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        style={{
          background:   '#6366f1',
          color:        '#fff',
          border:       'none',
          borderRadius: '8px',
          padding:      '0.75rem 2rem',
          fontSize:     '1rem',
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9 — NORMALISED ERROR PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised payload shape ready for Sentry / Datadog / custom ingest.
 * Populated in componentDidCatch and forwarded through registerAdapter().
 */
export interface NormalisedErrorPayload {
  /** Unique incident ID (Date.now()). */
  errorId:      number;
  /** Component boundary that caught the error. */
  boundary:     string;
  /** Error name (e.g. TypeError). */
  errorName:    string;
  /** Error message. */
  errorMessage: string;
  /** React component stack. */
  componentStack?: string;
  /** Request/hydration ID if captured. */
  requestId?:   string;
  /** ISO-8601 timestamp. */
  timestamp:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7+9 — HYDRATION ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

interface HydrationErrorBoundaryProps {
  children:     ReactNode;
  boundaryName?: string;
  fallback?:    ReactNode;
}

interface HydrationErrorBoundaryState {
  hasError:  boolean;
  errorId?:  number;
  payload?:  NormalisedErrorPayload;
}

export class HydrationErrorBoundary extends Component<
  HydrationErrorBoundaryProps,
  HydrationErrorBoundaryState
> {
  static displayName = 'HydrationErrorBoundary';

  constructor(props: HydrationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<HydrationErrorBoundaryState> {
    return { hasError: true, errorId: Date.now() };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const { errorId } = this.state;
    const { boundaryName = 'HydrationErrorBoundary' } = this.props;

    // Phase 9 — normalised payload (Sentry-ready)
    const payload: NormalisedErrorPayload = {
      errorId:       errorId ?? Date.now(),
      boundary:      boundaryName,
      errorName:     error.name,
      errorMessage:  error.message,
      componentStack: info.componentStack ?? undefined,
      timestamp:     new Date().toISOString(),
    };

    this.setState({ payload });

    // Phase 9 — forward through observability adapter chain
    // When Sentry is added, registerAdapter() picks this up automatically.
    try {
      emitErrorBoundaryEvent(
        error,
        errorId ?? Date.now(),
        JSON.stringify({
          boundary: boundaryName,
          componentStack: info.componentStack,
        })
      );
    } catch { /* never surface */ }

    // Phase 1 — structured log
    try {
      logEvent(createEvent({
        type:    'error',
        name:    'REACT_RENDER_ERROR',
        level:   'error',
        context: {
          boundary:     boundaryName,
          errorName:    error.name,
          errorMessage: error.message,
          errorId:      errorId,
        },
      }));
    } catch { /* never surface */ }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorId: undefined, payload: undefined });
  };

  override render(): ReactNode {
    const { hasError, errorId } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) return children;

    if (fallback) return fallback;

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '100vh',
          padding:        '2rem',
          textAlign:      'center',
          fontFamily:     'system-ui, sans-serif',
          color:          '#1a1a2e',
          background:     '#f8f9fa',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#6b7280', maxWidth: '380px', marginBottom: '2rem', lineHeight: 1.6 }}>
          An unexpected error occurred. You can try refreshing, or click Retry to
          re-render the page component.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={this.handleRetry}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '0.75rem 2rem',
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent', color: '#6366f1',
              border: '2px solid #6366f1', borderRadius: '8px',
              padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && errorId && (
          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
            Error ID: {errorId}
          </p>
        )}
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — BOOTSTRAP RETRY HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI timeout threshold — after this many ms with isHydrated=false, the
 * HydrationTimeoutScreen is rendered.
 *
 * USAGE in root layout:
 *
 *   useHydrationTimeoutGuard({ isHydrated, onTimeout: () => setShowTimeout(true) });
 *
 * Keep this threshold generous: 15 s covers slow cold starts.
 * warmAppEntry (3 s) + fetchUser (10 s max) = 13 s worst case.
 */
export const HYDRATION_UI_TIMEOUT_MS = 15_000;

/**
 * React hook that fires onTimeout if isHydrated stays false for longer
 * than HYDRATION_UI_TIMEOUT_MS. Clears on hydration success.
 *
 * Place in root layout or any component that wraps the loading spinner.
 */
export function useHydrationTimeoutGuard({
  isHydrated,
  onTimeout,
}: {
  isHydrated: boolean;
  onTimeout:  () => void;
}): void {
  React.useEffect(() => {
    if (isHydrated) return;

    const id = setTimeout(() => {
      onTimeout();
      try {
        logEvent(createEvent({
          type:    'system',
          name:    'HYDRATION_UI_TIMEOUT',
          level:   'warn',
          context: { thresholdMs: HYDRATION_UI_TIMEOUT_MS },
        }));
      } catch { /* never surface */ }
    }, HYDRATION_UI_TIMEOUT_MS);

    return () => clearTimeout(id);
  }, [isHydrated, onTimeout]);
}