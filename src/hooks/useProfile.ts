/**
 * hooks/useProfile.ts — CANONICAL VERSION
 *
 * Fetches GET /api/v1/users/me via TanStack Query and hydrates the Zustand
 * store on success.
 *
 * AUTHORITY RELATIONSHIP:
 *   AuthProvider is the authoritative source for auth/routing state
 *   (isAuthenticated, role, onboardingCompleted). It fetches /users/me on
 *   every auth event and calls hydrateFromProfile() directly.
 *
 *   This hook is additive: it lets components that need fresh profile data
 *   (e.g. after a PATCH /users/me) re-fetch without triggering a full auth
 *   cycle. TanStack Query deduplicates concurrent requests sharing the same
 *   key, so there is no double-fetch when both are mounted simultaneously.
 *
 * ROUTING: Never read onboarding state from this hook for routing decisions.
 *   Always use useAuth() → user.onboardingCompleted for that.
 *
 * DUPLICATE SHIMS (safe to delete after import migration):
 *   src/features/profile/hooks/useProfile.ts  ← re-exports from here
 *
 * Find remaining consumers of the old path:
 *   grep -r "features/profile/hooks/useProfile\|features/profile/useProfile" src/
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { userService } from '@/services/userService';
import { useUserStore } from '@/lib/store/userStore';
import { useAuth } from '@/features/auth/components/AuthProvider';
import type { MeResponse } from '@/types/auth';

/** Stable query key — export so mutations can invalidate */
export const PROFILE_KEY = ['profile', 'me'] as const;

/**
 * useProfile()
 *
 * Fetches GET /api/v1/users/me and hydrates the Zustand store.
 * TanStack Query deduplicates calls — safe to call from multiple layouts.
 *
 * @returns TanStack Query result wrapping MeResponse
 */
export function useProfile() {
  const hydrateFromProfile          = useUserStore(s => s.hydrateFromProfile);
  const { user: authUser, isLoading: authLoading } = useAuth();

  // Track last hydrated userId to suppress false-positive mismatch warnings
  // during the initial loading window when authUser is still null.
  const lastHydratedId = useRef<string | null>(null);

  const query = useQuery<MeResponse>({
    queryKey:  PROFILE_KEY,
    queryFn:   () => userService.getMe(),
    staleTime: 5 * 60 * 1000, // 5 min — profile changes infrequently
    retry:     1,
    // Only fetch after auth has resolved to avoid racing AuthProvider's mount
    // probe and to prevent an unnecessary 401 on cold load.
    enabled:   !authLoading,
  });

  // Hydrate the global store whenever profile data changes.
  useEffect(() => {
    if (!query.data?.user) return;
    const profileUser = query.data.user;
    hydrateFromProfile(profileUser);
    lastHydratedId.current = profileUser.id ?? null;

    // ── Mismatch debug ──────────────────────────────────────────────────────
    // If AuthContext already has a matching user loaded and their onboarding
    // flags disagree with the fresh /users/me response, something is stale.
    // This is a read-only observation — hydrateFromProfile() above already
    // corrects the store.
    if (!authLoading && authUser && authUser.id === profileUser.id) {
      const authOnboarding =
        authUser.onboardingCompleted          === true ||
        (authUser as any).onboarding_completed === true;

      const profileOnboarding =
        profileUser.onboardingCompleted          === true ||
        (profileUser as any).onboarding_completed === true;

      if (authOnboarding !== profileOnboarding) {
        console.warn(
          '[useProfile] ⚠️  ONBOARDING MISMATCH — AuthContext vs /users/me.',
          {
            userId:          profileUser.id,
            authContext:     { onboardingCompleted: authOnboarding },
            profileEndpoint: { onboardingCompleted: profileOnboarding },
            note:            'AuthContext is authoritative for routing. Store corrected.',
          }
        );
      }
    }
  }, [query.data, hydrateFromProfile, authUser, authLoading]);

  return query;
}

/**
 * useUpdateProfile()
 *
 * Returns a function that PATCHes /users/me and invalidates the profile cache.
 * Kept alongside useProfile to avoid a separate import for a common pattern.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return async function updateProfile(updates: Record<string, unknown>) {
    const { apiFetch } = await import('@/services/apiClient');
    await apiFetch('/users/me', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updates),
    });
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
  };
}