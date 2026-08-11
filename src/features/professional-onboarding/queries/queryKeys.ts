/**
 * @file src/features/professional-onboarding/queries/queryKeys.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Query key factory for the Professional Guided Builder feature.
 *
 * OWNERSHIP / REUSE DECISION:
 *   `GET /api/v1/onboarding/progress` is the SAME endpoint already used by
 *   the generic onboarding flow (see hooks/useOnboarding.ts,
 *   lib/api/endpoints/onboarding.ts#onboardingApi.getProgress). Rather than
 *   mint a second, competing cache entry for identical server state, this
 *   module reuses the existing, user-scoped key
 *   `onboardingQueryKeys.progress(userId)` from
 *   '@/features/onboarding/queries'. This guarantees that a save made via
 *   the Guided Builder and a read made via any other onboarding surface
 *   invalidate/observe the same cache entry — no drift, no duplicate fetches.
 *
 *   `GET /api/v1/onboarding/guided/profile` is a genuinely different
 *   resource (the canonical Professional Profile, not step progress), so it
 *   gets its own leaf key here, nested under the shared `['onboarding']`
 *   root so that a full onboarding cache reset (`onboardingQueryKeys.all()`)
 *   still busts it via prefix matching.
 */

import { onboardingQueryKeys } from '@/features/onboarding/queries';

export const professionalOnboardingQueryKeys = {
  /**
   * Reused, not redefined — see the ownership note above. Exposed here so
   * Guided Builder hooks have a single, local import surface
   * (`professionalOnboardingQueryKeys.*`) without needing to reach into two
   * different feature modules for closely related keys.
   */
  progress: (userId: string) => onboardingQueryKeys.progress(userId),

  /**
   * The canonical Professional Profile for a specific user, as returned by
   * `GET /api/v1/onboarding/guided/profile`. User-scoped for the same
   * account-switch-safety reason documented in
   * features/onboarding/queries/queryKeys.ts.
   */
  guidedProfile: (userId: string) => ['onboarding', 'guided-profile', userId] as const,
} as const;

export type ProfessionalOnboardingQueryKey =
  | ReturnType<typeof professionalOnboardingQueryKeys.progress>
  | ReturnType<typeof professionalOnboardingQueryKeys.guidedProfile>;
