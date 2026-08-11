/**
 * src/providers/AppProviders.tsx
 *
 * HireRise — Provider Composition Layer
 *
 * BOOTSTRAP FIX (critical):
 *   AppProvider from context/AppContext.tsx was never mounted in this tree.
 *   Every page that calls useAppContext() (AppEntryPage, useUser, useAppEntry,
 *   all guards) was throwing:
 *     "useAppContext must be used within <AppProvider>"
 *   because the context value was always null.
 *
 *   Fix: AppProvider is now mounted as the innermost wrapper around RouterProvider,
 *   so every route and its components have AppContext available.
 *
 * Provider ordering (outermost → innermost):
 *   AppErrorBoundary   — catches render-time crashes in any child
 *     ThemeProvider    — design tokens, dark-mode (placeholder)
 *       QueryProvider  — React Query client + devtools
 *         AppProvider  — Supabase auth, user hydration, session tracking ← ADDED
 *           RouterProvider — React Router (guards now read from AppProvider)
 *             ToastProvider — notifications
 *
 * AUTH WIRING:
 *   AppProvider's useEffect calls setTokenProvider() and setRefreshHandler()
 *   from api/client.ts so the Axios client never imports Supabase directly.
 *
 * EXTENDING:
 *   Add new providers inside this file only — never wrap inside pages or
 *   feature components. This keeps the provider tree flat and auditable.
 */

import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { QueryProvider } from '../providers/QueryProvider';
import { setQueryClientErrorHandler } from '../providers/QueryProvider.client';
import { AppProvider } from '../context/AppContext';
import { router } from '../routes';
import { setTokenProvider, setRefreshHandler, isApiError } from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error:    Error | null;
}

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME PROVIDER PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────────

function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST / NOTIFICATION PROVIDER PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────────

function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

const toast = {
  error:   (msg: string) => console.error('[Toast]', msg),
  warning: (msg: string) => console.warn('[Toast]', msg),
  info:    (msg: string) => console.info('[Toast]', msg),
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY ERROR → NOTIFICATION BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

function QueryErrorBridge(): null {
  useEffect(() => {
    setQueryClientErrorHandler((error: unknown) => {
      if (!isApiError(error)) return;

      if (error.isTokenExpired) {
        toast.info('Your session has expired. Please sign in again.');
        return;
      }
      if (error.isPaymentRequired) {
        toast.warning('This feature requires a paid plan. Upgrade to continue.');
        return;
      }
      if (error.isRateLimited) {
        const wait = error.meta.retryAfter ?? 60;
        toast.warning(`Too many requests. Please wait ${wait}s before trying again.`);
        return;
      }
      if (error.statusCode >= 500) {
        toast.error('A server error occurred. Please try again shortly.');
      }
    });
  }, []);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY AUTH WIRING (AppProviders-level)
//
// These setTokenProvider / setRefreshHandler calls existed in the old stub
// AuthProvider. Moved here to maintain the api/client.ts wiring contract.
// AppProvider (context/AppContext.tsx) owns the real Supabase session; this
// block only ensures the Axios interceptor has a fallback token getter until
// AppProvider's useEffect has run.
// ─────────────────────────────────────────────────────────────────────────────

function ApiClientBridge(): null {
  useEffect(() => {
    setTokenProvider(() => null);       // AppProvider will overwrite this immediately
    setRefreshHandler(async () => null); // AppProvider will overwrite this immediately
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// APP PROVIDERS — ROOT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

export function AppProviders(): React.JSX.Element {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          {/*
           * QueryErrorBridge must be inside QueryProvider to call
           * setQueryClientErrorHandler with the mounted query client.
           */}
          <QueryErrorBridge />
          <ApiClientBridge />
          {/*
           * BOOTSTRAP FIX: AppProvider mounts here — INSIDE QueryProvider so
           * AppContext can call queryClient.cancelQueries / removeQueries on
           * SIGNED_OUT, and OUTSIDE RouterProvider so every route tree node
           * has AppContext available via useAppContext().
           *
           * Before this fix, AppProvider was never in the tree at all.
           * AppEntryPage (and every guard / hook that calls useAppContext())
           * was throwing "useAppContext must be used within <AppProvider>"
           * the moment any component rendered.
           */}
          <AppProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </AppProvider>
        </QueryProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
