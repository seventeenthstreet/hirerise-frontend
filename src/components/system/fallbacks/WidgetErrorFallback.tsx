'use client';

/**
 * @file src/components/system/fallbacks/WidgetErrorFallback.tsx
 * @description Compact fallback for dashboard widgets and small isolated UI blocks.
 * Replaces the widget in-place when an uncaught render error occurs.
 */

import { useState, useEffect, useRef } from 'react';
import type { FallbackInjectedProps } from '../ErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetErrorFallbackProps extends FallbackInjectedProps {
  /** Widget title to display in the fallback card. */
  title?: string;
  /** Whether to show a retry button. Defaults to true. */
  showRetry?: boolean;
  /**
   * Optional retry callback.
   * Use to trigger data-layer recovery, e.g. queryClient.invalidateQueries().
   * When provided, fires AFTER onReset so the boundary clears first.
   * Not injected by ErrorBoundary — supply at the usage site.
   */
  onRetry?: () => void;
  /**
   * Micro-upgrade 1: Query-aware retry re-enable signal.
   * Pass queryClient.isFetching({ queryKey }) from the parent.
   * When provided, the retry button re-enables as soon as the active fetch
   * settles (count reaches 0) rather than after a fixed timeout.
   * When omitted, the button stays disabled until the component unmounts
   * (i.e. the boundary resets and the widget re-mounts), which is safe
   * because onReset clears the boundary — the fallback won't be visible
   * once the retry succeeds anyway.
   */
  isFetching?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compact widget-level error state.
 *
 * Designed to occupy the same card footprint as the widget it replaces,
 * so the dashboard grid layout stays intact when a single widget crashes.
 *
 * onReset and error are injected automatically by ErrorBoundary.
 * onRetry and isFetching are optional and must be supplied at the usage site.
 */
export function WidgetErrorFallback({
  title     = 'Widget',
  showRetry = true,
  onReset,
  onRetry,
  isFetching,
  errorId,
  traceId,
}: WidgetErrorFallbackProps) {
  // Micro-upgrade 1: track in-flight retry to prevent double-clicks.
  // Disabled on click; re-enabled when isFetching transitions false→true→false
  // (i.e. the query cycle completes). When isFetching is not provided, stays
  // disabled until the boundary resets naturally (fallback unmounts on success).
  const [isRetrying, setIsRetrying] = useState(false);

  // Micro-tweak 5: track cumulative retry attempts for future use —
  // retry throttling, flaky-endpoint analytics, or debug tooling.
  // Does NOT affect any UI rendering today.
  const [retryCount, setRetryCount] = useState(0);

  // Final polish 1: track mount status so the async isFetching effect never
  // calls setState on an already-unmounted instance. Avoids the React warning
  // 'Can't perform a React state update on an unmounted component' in edge
  // cases where the parent removes the fallback mid-fetch (e.g. fast navigations
  // or StrictMode double-invoke in development).
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Micro-tweak 1: split guards so each early-exit is explicit and readable.
  // Final polish 1: additionally guard with isMountedRef before calling setState.
  useEffect(() => {
    if (!isRetrying) return;              // haven't initiated a retry yet
    if (isFetching === undefined) return; // parent hasn't wired up query state

    // Re-enable once the active fetch settles — only if still mounted.
    if (!isFetching && isMountedRef.current) {
      setIsRetrying(false);
    }
  }, [isRetrying, isFetching]);

  // Guardrail 3: dev-only warning when isFetching is not wired up during a
  // retry. Fires at most once per retry cycle — isRetrying gates it.
  // Stripped by minifiers in production builds; zero runtime cost in prod.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // (safe: this is a module-level constant branch, never conditional at runtime)
    if (isRetrying && isFetching === undefined) {
      console.warn(
        '[WidgetErrorFallback] isFetching is undefined during retry — ' +
        'pass queryClient.isFetching({ queryKey }) > 0 from the parent ' +
        'so the retry button re-enables accurately when the fetch settles.',
      );
    }
  }

  // Micro-tweak 2: reset isRetrying on unmount. Works alongside isMountedRef:
  // this eagerly resets the state value; isMountedRef guards the async path.
  useEffect(() => {
    return () => { setIsRetrying(false); };
  }, []);

  function handleRetry() {
    if (isRetrying) return;
    // Final polish 4 (soft cap — not enforced yet):
    // if (retryCount >= 5) return;
    setRetryCount(prev => prev + 1); // micro-tweak 5: track attempt
    setIsRetrying(true);
    // Clear boundary first, then trigger data-layer recovery.
    onReset?.();
    onRetry?.();
  }

  // Micro-upgrade 4: only show the button when there is something to call.
  // Prevents a dead button state when both callbacks are absent.
  const canRetry = Boolean(onReset || onRetry);

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm"
      style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      // Guardrail 4: expose errorId as a DOM attribute so QA / e2e tests and
      // screenshot-based debugging can correlate a visible widget failure with
      // the corresponding [ErrorBoundary] console log entry. No visual impact.
      {...(errorId !== undefined ? { 'data-error-id': errorId } : {})}
      // Phase 3.5 — DOM Correlation: data-trace-id lets devtools + e2e tests
      // identify which user action flow led to this widget failure.
      {...(traceId !== undefined ? { 'data-trace-id': traceId } : {})}
    >
      <p className="text-sm font-semibold text-destructive mb-1">
        {title} failed to load
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        An unexpected error occurred. The rest of the page is unaffected.
      </p>

      {showRetry && canRetry && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="self-start rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
        >
          {isRetrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}