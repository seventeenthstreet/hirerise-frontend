'use client';

/**
 * features/auth/components/AuthProvider.tsx
 *
 * FIXES IN THIS VERSION:
 *
 *   1. EXPLICIT SESSION PROBE ON MOUNT
 *      onAuthStateChange alone is not enough — on a cold page load after a
 *      hard refresh, Supabase sometimes fires INITIAL_SESSION with a null
 *      user even when a valid cookie exists (timing race with SSR hydration).
 *      We now call getSession() explicitly in a mount effect and run
 *      fetchBackendUser() if a session is found, independently of the
 *      onAuthStateChange event. This eliminates the "spinner stuck on refresh"
 *      failure mode.
 *
 *   2. EVENT FILTER — TOKEN_REFRESHED SKIPS BACKEND FETCH
 *      Previously fetchBackendUser() was called for every non-null event,
 *      including TOKEN_REFRESHED (fires every ~55 minutes) and USER_UPDATED.
 *      This was causing unnecessary /users/me calls and occasional flashes.
 *      Now only INITIAL_SESSION and SIGNED_IN trigger a backend fetch.
 *      TOKEN_REFRESHED and USER_UPDATED are ignored (session is already live).
 *      SIGNED_OUT always clears state.
 *
 *   3. SIGN-OUT CLEARS STORAGE FIRST
 *      reset() (Zustand) is called before supabaseSignOut() so there is no
 *      window where stale persisted state is readable after auth is cleared.
 *      sessionStorage and localStorage keys owned by this app are also wiped.
 *
 *   4. RE-LOGIN GETS A FRESH BACKEND FETCH
 *      SIGNED_IN always triggers fetchBackendUser(), regardless of whether
 *      state already has a user. This ensures that logging in as a different
 *      user (or re-logging after logout in the same tab) always loads fresh
 *      profile data and never serves stale cache.
 *
 *   5. MOUNT GUARD — isLoading ALWAYS RESOLVES
 *      If both the mount-time getSession() and the onAuthStateChange listener
 *      find no session, isLoading is set to false via the mount effect so the
 *      app never hangs on the spinner. Previously the spinner could get stuck
 *      if onAuthStateChange never fired (edge case on some mobile browsers).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getAuthClient, onAuthStateChange, signOut as supabaseSignOut } from '@/lib/auth';
import { adminService } from '@/services/adminService';
import { useUserStore } from '@/lib/store/userStore';
import type { AuthState, BackendUser, MeResponse, UserRole, UserTier } from '@/types/auth';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

// Events that should trigger a fresh /users/me fetch
const FETCH_EVENTS = new Set(['INITIAL_SESSION', 'SIGNED_IN']);

interface AuthContextValue extends AuthState {
  signOut:            () => Promise<void>;
  refreshUser:        () => Promise<void>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  user:            null,
  role:            null,
  plan:            'free',
  isAuthenticated: false,
  isAdmin:         false,
  isMasterAdmin:   false,
  isContributor:   false,
  isLoading:       true,
};

const FETCH_TIMEOUT_MS = 10_000;

function deriveRole(user: BackendUser): UserRole {
  return (user.role ?? 'user') as UserRole;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`fetchBackendUser timed out after ${ms}ms`)), ms)
    ),
  ]);
}


// ── Profile sync ─────────────────────────────────────────────────────────────
// Upserts the authenticated Supabase user into the `profiles` table.
// Called fire-and-forget after a successful /users/me fetch.
// Failures are logged but never thrown — this must never affect the auth flow.

function syncProfile(authUser: SupabaseUser): void {
  // supabase.from().upsert() returns a PostgrestFilterBuilder (PromiseLike),
  // not a native Promise — it has .then() but NOT .catch().
  // Wrapping in Promise.resolve() promotes it to a full Promise so .catch() is available.
  Promise.resolve(
    supabase
      .from('profiles')
      .upsert(
        {
          id:         authUser.id,
          email:      authUser.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  )
    .then(({ error }) => {
      if (error) {
        console.warn('[AuthProvider] ⚠️ Profile sync failed (non-fatal):', error.message);
      } else {
        console.log('[AuthProvider] ✅ Profile synced:', authUser.id);
      }
    })
    .catch((err: unknown) => {
      console.warn('[AuthProvider] ⚠️ Profile sync threw (non-fatal):', err);
    });
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const mountedRef        = useRef(true);
  // Prevent concurrent backend fetches (e.g. mount probe + INITIAL_SESSION racing)
  const fetchingRef       = useRef(false);

  const hydrateFromProfile = useUserStore(s => s.hydrateFromProfile);
  const resetUserStore     = useUserStore(s => s.reset);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Core: fetch /users/me and populate context ─────────────────────────────

  const fetchBackendUser = useCallback(async (): Promise<void> => {
    // Deduplicate concurrent calls
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const me: MeResponse = await withTimeout(
        adminService.getMe(),
        FETCH_TIMEOUT_MS,
      );
      const user = me.user;

      const role          = deriveRole(user);
      const plan          = (user.tier ?? 'free') as UserTier;
      const isMasterAdmin = role === 'MASTER_ADMIN';
      const isAdmin       = isMasterAdmin || role === 'admin' || role === 'super_admin';
      const isContributor = role === 'contributor';

      if (!mountedRef.current) return;

      setState({
        user,
        role,
        plan,
        isAuthenticated: true,
        isAdmin,
        isMasterAdmin,
        isContributor,
        isLoading: false,
      });

      // Hydrate Zustand with server-verified profile data
      hydrateFromProfile(user);

      console.log('[AuthProvider] ✅ USER loaded:', user?.id, '| ROLE:', role, '| onboarding:', user?.onboardingCompleted);

      // Sync auth user → profiles table (fire-and-forget, never blocks auth flow).
      // getAuthClient().auth.getSession() reads from the in-memory cache —
      // no extra network request in the happy path.
      getAuthClient().auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          syncProfile(data.session.user);
        }
      }).catch(() => { /* non-fatal — session read failure does not affect auth */ });

    } catch (err: unknown) {
      if (!mountedRef.current) return;

      const status =
        (err as { status?: number })?.status ??
        (err as { statusCode?: number })?.statusCode ??
        0;

      if (status === 401 || status === 403) {
        // Token genuinely rejected — clear everything
        console.warn('[AuthProvider] ❌ Token rejected (401/403) — signing out.', err);
        await supabaseSignOut();
        resetUserStore();
      } else {
        // All other errors (500, network, timeout) are handled: state is reset
        // to unauthenticated so the user lands on the login page cleanly.
        // Use console.warn NOT console.error — Next.js dev overlay intercepts
        // console.error and shows the red crash screen even for caught errors.
        console.warn('[AuthProvider] ⚠️ Transient error fetching /users/me (status=' + status + '):', err);
      }

      setState({ ...INITIAL_STATE, isLoading: false });
    } finally {
      fetchingRef.current = false;
    }
  }, [hydrateFromProfile, resetUserStore]);

  // ── Mount effect: probe for an existing session immediately ───────────────
  // This handles hard refreshes where onAuthStateChange fires late or not at
  // all before the component needs to render routing decisions.

  useEffect(() => {
    let cancelled = false;

    async function probeSession() {
      try {
        const { data } = await getAuthClient().auth.getSession();
        if (cancelled) return;

        if (data.session?.user) {
          console.log('[AuthProvider] 🔍 Mount probe: session found for', data.session.user.id);
          await fetchBackendUser();
        } else {
          // No session — resolve loading so the app renders (login page, etc.)
          if (mountedRef.current) {
            setState({ ...INITIAL_STATE, isLoading: false });
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Mount probe failed:', err);
        if (!cancelled && mountedRef.current) {
          setState({ ...INITIAL_STATE, isLoading: false });
        }
      }
    }

    probeSession();
    return () => { cancelled = true; };
  // fetchBackendUser is stable (useCallback with stable deps) — safe to include
  }, [fetchBackendUser]);

  // ── Auth state change listener ────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (
      supabaseUser: SupabaseUser | null,
      _session: Session | null,
      event: string,
    ) => {
      console.log('[AuthProvider] AUTH EVENT:', event, '| user:', supabaseUser?.id ?? 'null');

      if (event === 'SIGNED_OUT' || !supabaseUser) {
        if (mountedRef.current) {
          setState({ ...INITIAL_STATE, isLoading: false });
          resetUserStore();
        }
        return;
      }

      // Only fetch backend profile on events that indicate a new/fresh session.
      // TOKEN_REFRESHED and USER_UPDATED do not need a /users/me call — the
      // existing profile in context is still valid.
      if (FETCH_EVENTS.has(event)) {
        await fetchBackendUser();
      }
    });

    return unsubscribe;
  }, [fetchBackendUser, resetUserStore]);

  // ── Sign out ──────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    // 1. Clear Zustand store FIRST — eliminates stale-read window
    resetUserStore();

    // 2. Clear app-owned storage keys
    try {
      // Zustand store (sessionStorage primary, localStorage defensive)
      sessionStorage.removeItem('hirerise-user');
      localStorage.removeItem('hirerise-user');
      // Intent gateway cache — must clear so next user in same tab
      // is not silently redirected to previous user's direction.
      localStorage.removeItem('hirerise_user_direction');
    } catch {
      // Private browsing mode may throw — ignore
    }

    // 3. Clear Supabase session
    await supabaseSignOut();

    // 4. Update React state
    if (mountedRef.current) {
      setState({ ...INITIAL_STATE, isLoading: false });
    }
  }, [resetUserStore]);

  // ── Refresh (force re-fetch from server) ──────────────────────────────────

  const refreshUser = useCallback(async () => {
    fetchingRef.current = false; // reset dedup so a manual refresh always fires
    await fetchBackendUser();
  }, [fetchBackendUser]);

  // ── Optimistic onboarding completion (avoids extra /users/me round-trip) ──

  const completeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      user: prev.user
        ? { ...prev.user, onboardingCompleted: true, onboarding_completed: true }
        : prev.user,
    }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    signOut:            handleSignOut,
    refreshUser,
    completeOnboarding,
  };

  // Loading guard — never render children until session is resolved.
  // This prevents route guards and auth-dependent components from firing
  // against stale null state on first load.
  if (state.isLoading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex h-screen items-center justify-center bg-[#07090f]">
          <div className="w-6 h-6 border-2 border-[#3c72f8] border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}