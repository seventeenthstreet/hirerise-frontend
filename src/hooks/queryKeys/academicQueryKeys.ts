/**
 * src/hooks/queryKeys/academicQueryKeys.ts
 *
 * CENTRALIZED QUERY KEY FACTORY — Academic Intelligence Platform (HARDENED)
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL React Query cache keys in the academic module.
 *
 * CHANGES FROM ORIGINAL (QK-01):
 *  The `subjects` key factory takes a `streamId` that is a Postgres UUID.
 *  Unlike the other taxonomy keys (country codes, board codes, region codes —
 *  all uppercased for deterministic serialization), UUIDs are already
 *  canonically lowercase by the RFC 4122 spec and Postgres convention.
 *  Applying `.toUpperCase()` to a UUID would break cache identity.
 *
 *  The original code left this as an undocumented implicit assumption.
 *  This version:
 *  1. Documents the UUID assumption explicitly with a JSDoc comment.
 *  2. Adds a DEV-mode runtime guard that warns if a non-UUID is passed,
 *     which would signal a caller passing the wrong value (e.g. stream_code
 *     instead of stream.id).
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
 *     NOTE: streamId is a UUID (lowercase, e.g. "a1b2c3d4-..."). Do NOT
 *     normalize to uppercase — it would change the key identity.
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
 *  ✅  Taxonomy string codes (countryCode, regionCode, boardCode, streamCode)
 *      are normalized to UPPERCASE for deterministic cache identity.
 *  ✅  streamId is a UUID — NOT normalized (UUIDs are lowercase by spec).
 *  ✅  Onboarding keys ARE user-scoped (student-specific state).
 *  ✅  Factory functions are module-level constants — not lambdas inside hook closures.
 *  ❌  No imports from API or hook layers.
 *  ❌  No business logic.
 *  ❌  No React imports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEV GUARD — UUID format validator
// ─────────────────────────────────────────────────────────────────────────────

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * In development, warns if a value that should be a UUID does not match the
 * UUID format. This catches callers who accidentally pass stream_code instead
 * of stream.id — a mistake that would silently produce an uncacheable key.
 *
 * No-ops in production (process.env.NODE_ENV !== 'development').
 */
function assertUuid(value: string, context: string): void {
  if (process.env.NODE_ENV === 'development' && value !== '' && !UUID_PATTERN.test(value)) {
    console.warn(
      `[academicQueryKeys] ${context}: expected a UUID but received "${value}". ` +
      'Ensure you are passing stream.id (UUID) not stream.stream_code.',
    );
  }
}

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

/**
 * Query key for subjects of a stream.
 *
 * @param streamId         UUID of the stream (e.g. "a1b2c3d4-...").
 *                         MUST be a UUID — NOT the stream_code string.
 *                         UUIDs are NOT uppercased (they are lowercase by spec).
 * @param includeIntegrated Whether to include integrated subjects (default: true).
 */
const subjects = (streamId: string, includeIntegrated: boolean = true) => {
  // QK-01: DEV-mode guard — ensure callers pass the UUID, not the code
  assertUuid(streamId, 'subjects(streamId)');
  return ['academic', 'taxonomy', 'subjects', streamId, includeIntegrated] as const;
};

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