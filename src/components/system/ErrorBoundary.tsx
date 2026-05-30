

/**
 * @file src/components/system/ErrorBoundary.tsx
 * @description Generic React error boundary for crash isolation.
 *
 * Catches rendering and lifecycle errors in child component trees.
 * Does NOT catch: async errors (Promise rejections, setTimeout), event handler
 * errors, or server-side errors. Those are handled at the hook layer via
 * React Query's isError + onError callbacks.
 *
 * Usage:
 *   <ErrorBoundary fallback={<WidgetErrorFallback />}>
 *     <SomeWidget />
 *   </ErrorBoundary>
 *
 * With resetKey (auto-resets when key changes):
 *   <ErrorBoundary resetKey={activeTab} fallback={<SectionErrorFallback />}>
 *     <TabContent />
 *   </ErrorBoundary>
 *
 * With functional fallback:
 *   <ErrorBoundary fallback={({ error, resetError }) => (
 *     <WidgetErrorFallback onReset={resetError} />
 *   )}>
 *     <SomeWidget />
 *   </ErrorBoundary>
 *
 * Architecture position: System layer (wraps UI layer)
 *   API → Hooks → [ErrorBoundary] → UI → Pages
 */

import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

// Phase 3.5 — Observability Layer (additive, non-breaking)
import { emitErrorBoundaryEvent } from '@/lib/observability/errorBoundaryIntegration';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Shape passed to functional fallbacks. */
export interface FallbackRenderProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  /**
   * UI to render when an error is caught.
   *
   * Accepts either:
   *  - A ReactNode (existing behaviour — cloneElement injects onReset + error)
   *  - A render function: ({ error, resetError }) => ReactNode
   */
  fallback: ReactNode | ((props: FallbackRenderProps) => ReactNode);
  /** Optional callback for external error reporting. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Optional context label for log output.
   * Helps identify which boundary caught the error in multi-boundary dashboards.
   * @example <ErrorBoundary context="SkillsPriorityWidget" ...>
   */
  context?: string;
  /**
   * When this value changes the boundary automatically resets.
   * Useful for route changes, tab switches, or any context shift where
   * a stale error state should not persist.
   */
  resetKey?: string | number;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Micro-upgrade 5: timestamp set when the error is first caught.
   *  Passed to fallback components for future observability correlation. */
  errorId: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Basic error classifier — kept intentionally minimal.
 * Extend only when a new error class requires a distinct UX response.
 */
function classifyError(error: Error) {
  const isChunkError = error?.message?.includes('Loading chunk');
  return { isChunkError };
}

/**
 * Guardrail 2: Centralise error-message extraction so the logging path
 * handles non-standard throws (plain strings, numbers, null) without
 * repeating the `|| String(err)` fallback inline.
 *
 * Typed as `unknown` so it is safe to call when the caught value has not
 * yet been narrowed to `Error` (e.g. if this is reused outside class components).
 */
function getErrorMessage(err: unknown): string {
  return (err as Error | null)?.message || String(err);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorId: Date.now() };
  }

  // ── Refinement 1: Reset on key change ──────────────────────────────────────
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetKey !== undefined &&
      this.props.resetKey !== prevProps.resetKey
    ) {
      this.reset();
    }
  }

  // ── Refinement 4: Structured error logging ─────────────────────────────────
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', {
      errorId:        this.state.errorId,
      timestamp:      new Date().toISOString(),
      context:        this.props.context ?? 'unknown',
      name:           error?.name ||
                        (error && typeof error === 'object' ? 'Error' : typeof error),
      message:        getErrorMessage(error),
      componentStack: info.componentStack,
      error,
    });
    this.props.onError?.(error, info);

    // Phase 3.5 — Observability Layer (additive, does not change existing behaviour)
    emitErrorBoundaryEvent(
      error,
      this.state.errorId,
      this.props.context,
      undefined,
      info,
    );
  }

  /** Clears the error state so the child tree gets another render attempt. */
  reset(): void {
    this.setState({ hasError: false, error: null, errorId: null });
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback } = this.props;
    const { error, errorId } = this.state;

    const { isChunkError } = classifyError(error!);

    try {
      if (typeof fallback === 'function') {
        return (fallback as (props: FallbackRenderProps) => ReactNode)({
          error: error!,
          resetError: this.reset,
        });
      }

      if (React.isValidElement(fallback)) {
        return React.cloneElement(fallback as React.ReactElement<FallbackInjectedProps>, {
          onReset: this.reset,
          error:   error ?? undefined,
          isChunkError,
          errorId: errorId ?? undefined,
        });
      }

      return fallback;
    } catch {
      return (
        <div role="alert" style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
          Something went wrong.
        </div>
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INJECTED PROP TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FallbackInjectedProps {
  onReset?: () => void;
  error?: Error;
  isChunkError?: boolean;
  errorId?: number;
  traceId?: string;
}