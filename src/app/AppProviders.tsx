/**
 * src/app/AppProviders.tsx
 *
 * HireRise — Provider Composition Layer
 *
 * Single mount point for all application-level providers.
 * Ordering is intentional — each layer depends on the layers below it:
 *
 *   ErrorBoundary          ← catches render errors in any child
 *     ThemeProvider        ← design tokens, dark-mode
 *       QueryProvider      ← React Query client + devtools
 *         AuthProvider     ← Supabase session, injects token into ApiClient
 *           RouterProvider ← React Router (reads auth state for guards)
 *             ToastProvider← notifications (reads auth errors from QueryProvider)
 *
 * Wiring:
 *   AuthProvider calls setTokenProvider() and setRefreshHandler() from
 *   api/client.ts so the Axios client never imports Supabase directly.
 *
 *   AuthProvider calls setQueryClientErrorHandler() so plan/auth errors
 *   surfaced by React Query are routed to the notification system.
 *
 * Extending:
 *   Add new providers inside this file only — never wrap inside pages or
 *   feature components. This keeps the provider tree flat and auditable.
 */

import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { QueryProvider, setQueryClientErrorHandler } from '../providers/QueryProvider';
import { router } from '../routes';
import { setTokenProvider, setRefreshHandler, isApiError } from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// Catches render-time crashes. Replace fallback with branded error page.
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError:   boolean;
  error:      Error | null;
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
    // Wire to your observability service (e.g. Sentry, Datadog RUM)
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      // Replace with your branded crash screen
      return (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>Please refresh the page. If the issue persists, contact support.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME PROVIDER PLACEHOLDER
// Swap in your actual theme implementation (Tailwind dark mode, MUI theme,
// Radix themes, CSS custom properties) here without touching any other layer.
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
}

function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  // Example: read user preference from localStorage, apply to <html>
  // const isDark = useMediaQuery('(prefers-color-scheme: dark)');
  // useEffect(() => { document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); }, [isDark]);
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST / NOTIFICATION PROVIDER PLACEHOLDER
// Replace with your actual notification system (sonner, react-hot-toast, etc.)
// ─────────────────────────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: React.ReactNode;
}

function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  // Example: <Toaster richColors position="top-right" />
  return <>{children}</>;
}

// Global toast emitter — replace with your actual toast function
const toast = {
  error:   (msg: string) => console.error('[Toast]', msg),
  warning: (msg: string) => console.warn('[Toast]', msg),
  info:    (msg: string) => console.info('[Toast]', msg),
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PROVIDER PLACEHOLDER
//
// Responsibilities (implement here when Supabase auth is wired):
//   1. Initialise Supabase client
//   2. Call setTokenProvider(() => supabase.auth.getSession().then(s => s?.access_token))
//   3. Call setRefreshHandler(() => supabase.auth.refreshSession().then(s => s.data.session?.access_token))
//   4. Subscribe to onAuthStateChange and invalidate queryClient on sign-out
//   5. Expose session/user via React context (AuthContext)
//
// Example skeleton (uncomment and complete):
//
//   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//
//   function AuthProvider({ children }) {
//     const [session, setSession] = useState(null);
//     const [loading, setLoading] = useState(true);
//
//     useEffect(() => {
//       supabase.auth.getSession().then(({ data }) => {
//         setSession(data.session);
//         setLoading(false);
//       });
//       const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
//         setSession(session);
//         if (!session) queryClient.clear(); // invalidate all cached data on sign-out
//       });
//       setTokenProvider(async () => {
//         const { data } = await supabase.auth.getSession();
//         return data.session?.access_token ?? null;
//       });
//       setRefreshHandler(async () => {
//         const { data } = await supabase.auth.refreshSession();
//         return data.session?.access_token ?? null;
//       });
//       return () => subscription.unsubscribe();
//     }, []);
//
//     if (loading) return <FullPageSpinner />;
//     return <AuthContext.Provider value={{ session, user: session?.user ?? null }}>{children}</AuthContext.Provider>;
//   }
// ─────────────────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  useEffect(() => {
    // ── Placeholder wiring (replace with real Supabase session) ─────────────
    setTokenProvider(() => {
      // Return the Supabase access token here
      return null;
    });

    setRefreshHandler(async () => {
      // Call supabase.auth.refreshSession() and return the new token
      return null;
    });
  }, []);

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY ERROR → NOTIFICATION BRIDGE
// Wires React Query's global error handler to the toast/notification system
// and handles structural auth errors (token expiry, plan gates).
// ─────────────────────────────────────────────────────────────────────────────

function QueryErrorBridge(): null {
  useEffect(() => {
    setQueryClientErrorHandler((error) => {
      if (!isApiError(error)) return;

      if (error.isTokenExpired) {
        // AuthProvider should handle sign-out; surface a soft prompt
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
// APP PROVIDERS — ROOT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

export function AppProviders(): React.JSX.Element {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          {/* Bridge must be inside QueryProvider to call setQueryClientErrorHandler */}
          <QueryErrorBridge />
          <AuthProvider>
            <ToastProvider>
              {/*
               * RouterProvider is the innermost provider because:
               *   - Route guards (AuthGuard, AdminGuard) read from AuthProvider context
               *   - Page components read from QueryProvider via hooks
               *   - Toast notifications are available everywhere in the tree
               */}
              <RouterProvider router={router} />
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
