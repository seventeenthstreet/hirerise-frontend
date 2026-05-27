/**
 * src/hooks/invalidation/academicInvalidationService.ts
 *
 * ACADEMIC INVALIDATION SERVICE (HARDENED — Phase 3 Verification Pass)
 * ──────────────────────────────────────────────────────────────────────
 * The ONLY place in the frontend that calls queryClient.invalidateQueries
 * or queryClient.removeQueries for the academic module.
 *
 * CHANGES FROM ORIGINAL (IV-01):
 *  `afterCompleteOnboarding` previously called:
 *
 *    queryClient.invalidateQueries({ queryKey: academicQueryKeys.onboarding() })
 *
 *  `academicQueryKeys.onboarding()` returns `['academic', 'onboarding']` — a
 *  prefix-match that hits ALL onboarding keys for ALL users in the cache.
 *  In a single-user browser client this is functionally harmless today, but:
 *
 *  1. It is semantically incorrect — the intent is to invalidate the current
 *     user's data, not every user who ever used this QueryClient instance.
 *  2. It is not safe for service worker / multi-account scenarios that may
 *     surface in Phase 4+.
 *  3. It breaks the pattern established by every other `after*` method, which
 *     are explicitly user-scoped.
 *
 *  Fixed: `afterCompleteOnboarding(userId)` now invalidates the three leaf
 *  keys for that specific user, matching the same pattern as `afterSaveSubjects`
 *  and `afterSaveLanguages`.
 *
 * GOVERNANCE RULE:
 *  ❌ Components NEVER call invalidateQueries directly.
 *  ❌ Mutation onSuccess/onSettled callbacks NEVER call invalidateQueries directly.
 *  ✅ Mutations call methods on this service from their onSettled handler.
 *  ✅ This service is the single authoritative source for what to invalidate
 *     after each mutation.
 *
 * TELEMETRY:
 *  Every invalidation emits a 'academic.cache.invalidate' event with the
 *  scope and triggering mutation name for latency/observability dashboards.
 */

import type { QueryClient } from '@tanstack/react-query';
import { academicQueryKeys }   from '../queryKeys/academicQueryKeys';
import { academicTelemetry }   from '../../telemetry/academicTelemetry';
import { generateCorrelationId } from '../types/rpcEnvelope.types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPED INVALIDATION CONTRACTS
// Documents what each mutation is expected to invalidate.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes the cache scope invalidated by each named mutation.
 * Used as documentation contract — enforce via code review, not runtime.
 */
export type InvalidationContract = {
  afterCreateProfile:      'onboarding:profile';
  afterSaveSubjects:       'onboarding:subjects+profile';
  afterSaveLanguages:      'onboarding:languages+profile';
  afterCompleteOnboarding: 'onboarding:profile+subjects+languages';
  invalidateTaxonomy:      'taxonomy:all';
  invalidateSubjectsForStream: `taxonomy:subjects:${string}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY — creates an invalidation service bound to a QueryClient instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an invalidation service bound to the provided QueryClient.
 * Call this inside a mutation's onSettled handler:
 *
 * @example
 *   const invalidate = createAcademicInvalidationService(queryClient);
 *   // ...inside useSaveSubjects onSettled:
 *   await invalidate.afterSaveSubjects(userId);
 */
export function createAcademicInvalidationService(queryClient: QueryClient) {
  // ─── TAXONOMY INVALIDATIONS ───────────────────────────────────────────────

  /**
   * Invalidates ALL taxonomy cache entries (countries, regions, boards,
   * streams, subjects, languages). Use only for admin-triggered taxonomy
   * refreshes — not for regular student flow.
   */
  async function invalidateTaxonomy(triggeredBy: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate('taxonomy:all', triggeredBy, id);
    await queryClient.invalidateQueries({
      queryKey: academicQueryKeys.taxonomy(),
    });
  }

  /**
   * Invalidates subjects for a specific stream.
   * Use when taxonomy governance updates a stream's subject list.
   */
  async function invalidateSubjectsForStream(
    streamId:     string,
    triggeredBy:  string,
  ): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate(`taxonomy:subjects:${streamId}`, triggeredBy, id);
    // Invalidate all subject entries for this stream (both includeIntegrated values)
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.subjects(streamId, true),
      }),
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.subjects(streamId, false),
      }),
    ]);
  }

  // ─── ONBOARDING INVALIDATIONS ─────────────────────────────────────────────

  /**
   * Invalidates the student's full profile.
   * Called after createAcademicProfile — re-fetches profile from server.
   */
  async function afterCreateProfile(userId: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate('onboarding:profile', 'createAcademicProfile', id);
    await queryClient.invalidateQueries({
      queryKey: academicQueryKeys.studentProfile(userId),
    });
  }

  /**
   * Invalidates the student's subject cache + full profile.
   * Called after saveStudentSubjects — both the dedicated subjects key
   * and the full profile aggregate are now stale.
   */
  async function afterSaveSubjects(userId: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate(
      'onboarding:subjects+profile',
      'saveStudentSubjects',
      id,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentSubjects(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      }),
    ]);
  }

  /**
   * Invalidates the student's language cache + full profile.
   * Called after saveStudentLanguages.
   */
  async function afterSaveLanguages(userId: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate(
      'onboarding:languages+profile',
      'saveStudentLanguages',
      id,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentLanguages(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      }),
    ]);
  }

  /**
   * Invalidates all three onboarding leaf keys for the given user.
   * Called after completeAcademicOnboarding — the full profile, subjects,
   * and languages are all potentially refreshed by the backend completion step.
   *
   * IV-01 FIX: Invalidates the three explicit user-scoped leaf keys rather than
   * the root `['academic', 'onboarding']` prefix, which would hit all users.
   * This is user-scoped and deterministic — safe for multi-account scenarios.
   */
  async function afterCompleteOnboarding(userId: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate(
      'onboarding:profile+subjects+languages',
      'completeAcademicOnboarding',
      id,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentSubjects(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: academicQueryKeys.studentLanguages(userId),
      }),
    ]);
  }

  /**
   * Removes all cached onboarding data for a user.
   * Use on logout / account switch — do NOT use in normal flows.
   */
  function clearOnboardingCache(userId: string): void {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate('onboarding:purge', 'logout', id);
    queryClient.removeQueries({
      queryKey: academicQueryKeys.studentProfile(userId),
    });
    queryClient.removeQueries({
      queryKey: academicQueryKeys.studentSubjects(userId),
    });
    queryClient.removeQueries({
      queryKey: academicQueryKeys.studentLanguages(userId),
    });
  }

  /**
   * Removes ALL academic cache entries (taxonomy + onboarding).
   * Use only for full reset scenarios (e.g. dev tooling, account reprovisioning).
   */
  function clearAllAcademicCache(): void {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate('academic:all', 'fullReset', id);
    queryClient.removeQueries({ queryKey: academicQueryKeys.all() });
  }

  // ─── PUBLIC SURFACE ───────────────────────────────────────────────────────

  return {
    // Taxonomy
    invalidateTaxonomy,
    invalidateSubjectsForStream,
    // Onboarding — per-mutation
    afterCreateProfile,
    afterSaveSubjects,
    afterSaveLanguages,
    afterCompleteOnboarding,
    // Cleanup
    clearOnboardingCache,
    clearAllAcademicCache,
  };
}

export type AcademicInvalidationService = ReturnType<
  typeof createAcademicInvalidationService
>;
