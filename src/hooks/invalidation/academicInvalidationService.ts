/**
 * src/hooks/invalidation/academicInvalidationService.ts
 *
 * ACADEMIC INVALIDATION SERVICE
 * ───────────────────────────────
 * The ONLY place in the frontend that calls queryClient.invalidateQueries
 * or queryClient.removeQueries for the academic module.
 *
 * GOVERNANCE RULE:
 *  ❌ Components NEVER call invalidateQueries directly.
 *  ❌ Mutation onSuccess callbacks NEVER call invalidateQueries directly.
 *  ✅ Mutations call methods on this service from their onSuccess handler.
 *  ✅ This service is the single authoritative source for what to invalidate
 *     after each mutation.
 *
 * DESIGN RATIONALE:
 *  Centralising invalidation here means:
 *  1. Adding a new query key that should be invalidated after "save subjects"
 *     requires a one-line change in ONE place, not hunting across hook files.
 *  2. Telemetry events for cache invalidation are emitted consistently.
 *  3. Cross-cutting invalidation (e.g. invalidate both profile AND subjects
 *     after completing onboarding) is composed here, not scattered.
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
// FACTORY — creates an invalidation service bound to a QueryClient instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an invalidation service bound to the provided QueryClient.
 * Call this inside a mutation's onSuccess handler:
 *
 * @example
 *   const invalidate = createAcademicInvalidationService(queryClient);
 *   // ...inside useSaveSubjects onSuccess:
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
   * Invalidates the entire onboarding state for a user.
   * Called after completeAcademicOnboarding — the full profile, subjects,
   * and languages are all potentially refreshed by the backend.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function afterCompleteOnboarding(userId: string): Promise<void> {
    const id = generateCorrelationId();
    academicTelemetry.cacheInvalidate(
      'onboarding:all',
      'completeAcademicOnboarding',
      id,
    );
    await queryClient.invalidateQueries({
      queryKey: academicQueryKeys.onboarding(),
    });
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
