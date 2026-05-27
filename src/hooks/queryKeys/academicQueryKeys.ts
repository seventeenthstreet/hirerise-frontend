/**
 * src/hooks/queryKeys/academicQueryKeys.ts
 *
 * CENTRALIZED QUERY KEY FACTORY — Academic Intelligence Platform
 * ──────────────────────────────────────────────────────────────
 * Single source of truth for ALL React Query cache keys in the academic module.
 *
 * ARCHITECTURE POSITION:
 *   [THIS FILE] → imported by hooks/queries/* and hooks/mutations/*
 *   [THIS FILE] → imported by hooks/invalidation/academicInvalidationService.ts
 *   Never imported by components or pages.
 *
 * KEY HIERARCHY (prefix-match invalidation graph):
 *
 *   ['academic']
 *     ↳ Root — nukes ALL academic cache entries across all users
 *
 *   ['academic', 'taxonomy']
 *     ↳ All taxonomy data (countries/regions/boards/streams/subjects/languages)
 *
 *   ['academic', 'taxonomy', 'countries']
 *     ↳ Country list (global — not user-scoped, taxonomy is static)
 *
 *   ['academic', 'taxonomy', 'regions', countryCode]
 *     ↳ Regions for a country
 *
 *   ['academic', 'taxonomy', 'boards', regionCode, countryCode]
 *     ↳ Boards for a region+country
 *
 *   ['academic', 'taxonomy', 'streams', boardCode, countryCode]
 *     ↳ Streams for a board+country
 *
 *   ['academic', 'taxonomy', 'subjects', streamId, includeIntegrated]
 *     ↳ Subjects for a stream
 *
 *   ['academic', 'taxonomy', 'languages', regionCode, countryCode]
 *     ↳ Languages for a region+country
 *
 *   ['academic', 'onboarding']
 *     ↳ All onboarding data — invalidate entire onboarding cache for any user
 *
 *   ['academic', 'onboarding', 'profile', userId]
 *     ↳ Full profile aggregate (profile + subjects + languages)
 *
 *   ['academic', 'onboarding', 'subjects', userId]
 *     ↳ Subject selections for a user
 *
 *   ['academic', 'onboarding', 'languages', userId]
 *     ↳ Language selections for a user
 *
 * DESIGN RULES:
 *  ✅  All keys are `as const` tuples — no magic strings in hooks.
 *  ✅  Taxonomy keys are NOT user-scoped (taxonomy is shared, read-only reference data).
 *  ✅  Onboarding keys ARE user-scoped (student-specific state).
 *  ✅  Factory functions are module-level constants — not lambdas inside hook closures.
 *  ❌  No imports from API or hook layers.
 *  ❌  No business logic.
 *  ❌  No React imports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

const root = () => ['academic'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TAXONOMY KEYS — not user-scoped (reference data, shared across all users)
// ─────────────────────────────────────────────────────────────────────────────

const taxonomyRoot = () => ['academic', 'taxonomy'] as const;

const countries = () => ['academic', 'taxonomy', 'countries'] as const;

const regions = (countryCode: string) =>
  ['academic', 'taxonomy', 'regions', countryCode.toUpperCase()] as const;

const boards = (regionCode: string, countryCode: string) =>
  [
    'academic',
    'taxonomy',
    'boards',
    regionCode.toUpperCase(),
    countryCode.toUpperCase(),
  ] as const;

const streams = (boardCode: string, countryCode: string) =>
  [
    'academic',
    'taxonomy',
    'streams',
    boardCode.toUpperCase(),
    countryCode.toUpperCase(),
  ] as const;

const subjects = (streamId: string, includeIntegrated: boolean = true) =>
  ['academic', 'taxonomy', 'subjects', streamId, includeIntegrated] as const;

const languages = (regionCode: string, countryCode: string) =>
  [
    'academic',
    'taxonomy',
    'languages',
    regionCode.toUpperCase(),
    countryCode.toUpperCase(),
  ] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING KEYS — user-scoped (student-specific mutable state)
// ─────────────────────────────────────────────────────────────────────────────

const onboardingRoot = () => ['academic', 'onboarding'] as const;

const studentProfile = (userId: string) =>
  ['academic', 'onboarding', 'profile', userId] as const;

const studentSubjects = (userId: string) =>
  ['academic', 'onboarding', 'subjects', userId] as const;

const studentLanguages = (userId: string) =>
  ['academic', 'onboarding', 'languages', userId] as const;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED FACTORY — single import point for all consumers
// ─────────────────────────────────────────────────────────────────────────────

export const academicQueryKeys = {
  // Root
  all:          root,

  // Taxonomy root (invalidates all taxonomy at once)
  taxonomy:     taxonomyRoot,

  // Leaf taxonomy keys
  countries,
  regions,
  boards,
  streams,
  subjects,
  languages,

  // Onboarding root (invalidates all onboarding for all users)
  onboarding:   onboardingRoot,

  // Leaf onboarding keys (user-scoped)
  studentProfile,
  studentSubjects,
  studentLanguages,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED TYPES — for typed setQueryData / getQueryData
// ─────────────────────────────────────────────────────────────────────────────

export type AcademicQueryKey =
  | ReturnType<typeof root>
  | ReturnType<typeof taxonomyRoot>
  | ReturnType<typeof countries>
  | ReturnType<typeof regions>
  | ReturnType<typeof boards>
  | ReturnType<typeof streams>
  | ReturnType<typeof subjects>
  | ReturnType<typeof languages>
  | ReturnType<typeof onboardingRoot>
  | ReturnType<typeof studentProfile>
  | ReturnType<typeof studentSubjects>
  | ReturnType<typeof studentLanguages>;
