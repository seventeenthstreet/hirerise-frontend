/**
 * @file src/hooks/mutations/index.ts
 * @description Barrel export for all mutation hooks.
 *
 * All consumers import from '@/hooks/mutations' — never from individual files.
 * This ensures import paths are stable if a file is renamed or split.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULES FOR ALL MUTATION HOOKS IN THIS FOLDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RETRY POLICY — every useMutation must declare retry explicitly:
 *   • Idempotent operations (PATCH, PUT, or POST that overwrites):
 *       retry: (failureCount, error) => shouldRetry(failureCount, error, N)
 *   • Non-idempotent operations (POST that creates a new resource):
 *       retry: false
 *   Never omit retry or rely on the QueryClient default — defaults can drift.
 *
 * SELECT RULE (for useQuery hooks in /hooks/):
 *   All `select` functions must be defined at module level as named functions.
 *   Inline arrow selectors are forbidden — they create a new reference on every
 *   render and break React Query's subscriber memoization, causing unnecessary
 *   re-renders across all consumers of the query.
 *
 *   ✅  select: selectMyData          (module-level named function)
 *   ❌  select: (data) => data.items  (inline — forbidden)
 */

export { useSubmitOnboardingStep } from './useSubmitOnboardingStep';
export type { SubmitOnboardingStepInput } from './useSubmitOnboardingStep';

export { useGenerateCareerReport } from './useGenerateCareerReport';

export { useUploadResume } from './useUploadResume';
export type { UploadResumeInput, UploadResumeResponse } from './useUploadResume';

export { useUpdateUser } from './useUpdateUser';
export type { UpdateUserInput, UpdateUserResponse } from './useUpdateUser';

export { useSetDirection } from './useSetDirection';
export type { SetDirectionInput, SetDirectionResponse, Direction } from './useSetDirection';

export { useResetDirection } from './useResetDirection';
export type { ResetDirectionResponse } from './useResetDirection';