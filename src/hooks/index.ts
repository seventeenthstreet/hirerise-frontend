/**
 * src/hooks/index.ts
 *
 * HOOKS MODULE — PUBLIC SURFACE
 * ──────────────────────────────
 * Re-exports every public hook and type. Import from this barrel in UI.
 *
 * WHAT IS EXPORTED:
 *  - Taxonomy query hooks
 *  - Onboarding query hook
 *  - Onboarding mutation hooks
 *  - Query key factory (for typed setQueryData in tests / devtools)
 *  - Invalidation service factory (for logout / account-switch orchestration)
 *  - All domain types
 *
 * WHAT IS NOT EXPORTED:
 *  - Internal utilities (rpcExecutor, hookHelpers) — not for UI consumption
 *  - Supabase client — import from @/lib/supabase/client
 */

// ── Query Keys ─────────────────────────────────────────────────────────────
export { academicQueryKeys }        from './queryKeys/academicQueryKeys';
export type { AcademicQueryKey }    from './queryKeys/academicQueryKeys';

// ── Taxonomy Query Hooks ────────────────────────────────────────────────────
export {
  useCountries,
  useRegions,
  useBoards,
  useStreams,
  useSubjects,
  useLanguages,
} from './queries/useTaxonomyQueries';
export type { UseTaxonomyQueryReturn } from './queries/useTaxonomyQueries';

// ── Onboarding Query Hook ───────────────────────────────────────────────────
export { useStudentAcademicProfile }          from './queries/useStudentAcademicProfile';
export type { UseStudentAcademicProfileReturn } from './queries/useStudentAcademicProfile';

// ── Onboarding Mutation Hooks ───────────────────────────────────────────────
export {
  useSaveAcademicProfile,
  useSaveSubjects,
  useSaveLanguages,
  useCompleteOnboarding,
} from './mutations/useOnboardingMutations';

// ── Invalidation Service ────────────────────────────────────────────────────
export { createAcademicInvalidationService }  from './invalidation/academicInvalidationService';
export type { AcademicInvalidationService }   from './invalidation/academicInvalidationService';

// ── Domain Types ────────────────────────────────────────────────────────────
export type {
  // Taxonomy
  Country,
  Region,
  Board,
  Stream,
  Subject,
  Language,
  BoardType,
  SubjectCategory,
  LanguageType,
  GetCountriesResult,
  GetRegionsResult,
  GetBoardsResult,
  GetStreamsResult,
  GetSubjectsResult,
  GetLanguagesResult,
  GetRegionsParams,
  GetBoardsParams,
  GetStreamsParams,
  GetSubjectsParams,
  GetLanguagesParams,
} from './types/taxonomy.types';

export type {
  // Onboarding
  OnboardingStatus,
  StudentAcademicProfile,
  StudentSubjectEntry,
  StudentLanguageEntry,
  StudentFullProfile,
  CreateAcademicProfilePayload,
  SaveSubjectsPayload,
  SaveLanguagesPayload,
  CreateAcademicProfileResult,
  SaveSubjectsResult,
  SaveLanguagesResult,
  CompleteOnboardingResult,
} from './types/onboarding.types';

export type {
  // RPC infrastructure
  CorrelationId,
  RpcError,
  RpcResult,
  RpcEnvelope,
} from './types/rpcEnvelope.types';
