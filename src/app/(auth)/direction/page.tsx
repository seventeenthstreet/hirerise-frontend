'use client';

/**
 * /app/direction/page.tsx — Direction Selection
 *
 * HARDENING CHANGES:
 *  1. PRE-RENDER GUARD: already-has-direction check fires synchronously —
 *     returns null immediately on redirect, no UI flicker.
 *  2. GLOBAL HYDRATION: uses useAppContext() — no extra /users/me fetch.
 *  3. QUOTA-AWARE BLOCKING: setDirection API call is gated by quota.isExhausted
 *     check BEFORE the call is made — prevents unnecessary 429s.
 *  4. ERROR NORMALIZATION: error display uses `?? 'fallback'` pattern.
 *  5. [HARDENING #3] QuotaExhaustedModal: quota exhaustion shows an overlay
 *     modal instead of replacing the page — users retain context.
 *  6. [HARDENING #4] Guard result memoization: the "already has direction"
 *     check is wrapped in useMemo so it only recomputes when user changes.
 *
 * Route map (unchanged from original):
 *   education  → /onboarding
 *   career     → /dashboard
 *   market     → /market-insights
 */

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useDirection } from '@/hooks/useDirection';
import { useQuota } from '@/hooks/useQuota';
import { DirectionSelector } from '@/components/direction/DirectionSelector';
import { QuotaBanner } from '@/components/common/QuotaBanner';
import { QuotaExhaustedModal } from '@/components/common/QuotaExhaustedModal';
import { getSupabaseClient } from '@/lib/supabase/client';

type Direction = 'education' | 'career' | 'market';

export default function DirectionPage() {
  const router = useRouter();

  // ── Global user (no extra fetch) ──────────────────────────────────────────
  const { user, isHydrated, refreshUser } = useAppContext();

  // ── guardReady latch ──────────────────────────────────────────────────────
  // PURPOSE: prevents the alreadyHasDirection guard from evaluating on the
  // FIRST render cycle after navigation arrives from a direction-switch flow.
  //
  // THE RACE WITHOUT THIS:
  //   1. useOnboardingDirectionSwitch / useResetDirection calls DELETE /me/direction
  //   2. refreshUser() is called → enqueues setUser({ user_type: null }) in React
  //      (React ENQUEUES the update but does NOT commit it synchronously)
  //   3. router.replace('/direction') fires immediately
  //   4. direction/page.tsx mounts — first render sees AppContext.user BEFORE
  //      React has committed the setUser(null) update, so user.user_type is
  //      still the OLD direction (e.g. 'professional')
  //   5. alreadyHasDirection = true → redirect fires → page bounces to '/'
  //      → app-entry re-evaluates the stale user → sends back to onboarding
  //      → navigation loop
  //
  // THE FIX:
  //   guardReady starts as false. A useEffect (runs after first commit) sets
  //   it to true. Because useEffect always runs AFTER React commits all pending
  //   state updates (including the enqueued setUser(null) from refreshUser()),
  //   the alreadyHasDirection check is only evaluated once the committed state
  //   is available. On first render (guardReady=false) we always show the
  //   spinner, giving React one commit cycle to flush the setUser update.
  //
  // STRICTMODE SAFETY:
  //   StrictMode runs effects twice (mount → cleanup → mount). guardReady
  //   resets to false on cleanup (via the returned setter false), so the
  //   second mount also starts with guardReady=false and gets the same safe
  //   first-render window. No duplicate redirects are possible because
  //   redirectingRef is also reset by the same cleanup.
  //
  // NORMAL FLOW (direct navigation, no direction-switch):
  //   If user already has a direction on first mount (e.g. bookmarked /direction
  //   after completing setup), guardReady becomes true on the first useEffect run
  //   and alreadyHasDirection fires correctly on the second render — same net
  //   behavior as before, just delayed one commit cycle (imperceptible).
  const [guardReady, setGuardReady] = useState(false);
  useEffect(() => {
    setGuardReady(true);
    return () => { setGuardReady(false); };
  }, []);

  // ── [HARDENING #4] Guard result memoization ───────────────────────────────
  // The "already has a direction" check is pure — memoize so it doesn't
  // recompute on every render cycle.
  // guardReady gates evaluation: on the first render cycle (before the first
  // useEffect commit), guardReady is false so alreadyHasDirection is always
  // false — preventing a premature redirect on stale pre-commit user state.
  const alreadyHasDirection = useMemo(
    () => guardReady && isHydrated && !!user?.user_type,
    [guardReady, user, isHydrated],
  );

  // ── PRE-RENDER GUARD — redirect via useEffect, never during render ────────
  // Calling router.replace() in the render body triggers React's
  // "setState on Router while rendering" error. useEffect defers the
  // navigation until after the commit phase — the correct React pattern.
  const redirectingRef = useRef(false);
  useEffect(() => {
    // Reset redirect latch when guard readiness resets (e.g. StrictMode cleanup).
    if (!guardReady) {
      redirectingRef.current = false;
      return;
    }
    if (alreadyHasDirection && !redirectingRef.current) {
      redirectingRef.current = true;
      router.replace('/');
    }
  }, [guardReady, alreadyHasDirection, router]);

  // Show spinner while hydrating, guard not ready, or while redirect is in flight
  if (!isHydrated || !guardReady || alreadyHasDirection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <DirectionContent user={user} refreshUser={refreshUser} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

import type { User } from '@/hooks/useUser';

function DirectionContent({ user, refreshUser }: { user: User | null; refreshUser: () => Promise<unknown> }) {
  const router = useRouter();

  const { setDirection, isLoading: submitting, error } = useDirection();

  // ── In-flight guard — prevents duplicate mutation from rapid clicks ────────
  // React StrictMode double-invokes effects but NOT event handlers, so this
  // guard primarily covers rapid double-clicks and accidental re-renders that
  // call onSelect while a mutation is already in flight.
  const mutationInFlightRef = useRef(false);

  // ── Quota ─────────────────────────────────────────────────────────────────
  // [HARDENING #3] onQuotaExhausted opens a modal rather than swapping page.
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [upgradeUrl,     setUpgradeUrl]     = useState<string | null>(null);

  const { quota } = useQuota(user, {
    onQuotaExhausted: (url) => {
      setUpgradeUrl(url ?? '/pricing');
      setQuotaModalOpen(true);
    },
  });

  // ── Handler — quota-aware, in-flight-guarded ──────────────────────────────
  const handleDirectionSelect = useCallback(async (direction: Direction) => {
    // ── IN-FLIGHT GUARD: reject concurrent calls ───────────────────────────
    // Prevents duplicate POST /users/me/direction from:
    //   • Rapid double-clicks before the button becomes disabled (isLoading
    //     is set asynchronously on the next render; a second click before that
    //     render commits will pass through the disabled check)
    //   • Any future caller of onSelect from a parent re-render
    if (mutationInFlightRef.current) return;

    // ── QUOTA GATE: block API call when exhausted ──────────────────────────
    if (quota?.isExhausted) {
      setUpgradeUrl(quota.upgradeUrl ?? '/pricing');
      setQuotaModalOpen(true); // [HARDENING #3] modal
      return;
    }

    mutationInFlightRef.current = true;
    try {
      const result = await setDirection(direction);

      // ── BUG FIX: Refresh AppContext user BEFORE navigating ─────────────────
      // AppContext.user is React state set by fetchUser() — separate from the
      // React Query cache. The destination page's requireDirection guard reads
      // user?.user_type from AppContext. If we navigate before AppContext updates,
      // user_type is still null and the guard bounces us back to /direction.
      //
      // refreshUser() calls fetchUser() which re-fetches /users/me and calls
      // setUser() synchronously — so by the time router.push() fires, the
      // AppContext user has the correct user_type from the backend.
      await refreshUser();

      if (result?.redirectTo) {
        router.push(result.redirectTo);
      } else {
        const fallbackMap: Record<Direction, string> = {
          education: '/education/onboarding', // routes to new student onboarding module
          career:    '/dashboard',
          market:    '/dashboard', // MVP: market direction redirects to dashboard
        };
        router.push(fallbackMap[direction]);
      }
    } catch (err: unknown) {
      const apiErr = err as { status?: number; quotaExhausted?: boolean; upgradeUrl?: string };
      if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
        setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
        setQuotaModalOpen(true); // [HARDENING #3] modal
      }
    } finally {
      mutationInFlightRef.current = false;
    }
  }, [setDirection, router, quota, refreshUser]);

  const handleLogout = useCallback(async () => {
    await getSupabaseClient().auth.signOut();
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center relative">
          <button
            type="button"
            onClick={handleLogout}
            className="absolute right-0 top-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Log out
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to HireRise
          </h1>
          <p className="mt-2 text-muted-foreground">
            Are you a student planning your future, or a professional looking to
            grow your career?
          </p>
        </header>

        {/* Soft quota warning */}
        <QuotaBanner quota={quota} upgradeUrl="/pricing" className="mb-6" />

        {/* Error from hook — normalised message.
            Suppressed for rate_limit / quota errors — the QuotaExhaustedModal
            already handles those with a dedicated overlay. Showing both the modal
            AND a generic "Too Many Requests" / "Unexpected server response" banner
            simultaneously is confusing UX. */}
        {error && !quotaModalOpen && error.category !== 'rate_limit' && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        )}

        <DirectionSelector
          onSelect={handleDirectionSelect}
          isSubmitting={submitting}
        />
      </div>

      {/* [HARDENING #3] Quota exhausted modal */}
      <QuotaExhaustedModal
        open={quotaModalOpen}
        upgradeUrl={upgradeUrl}
        onDismiss={() => setQuotaModalOpen(false)}
        message="Upgrade your plan to continue setting your career direction and accessing all HireRise features."
      />
    </div>
  );
}