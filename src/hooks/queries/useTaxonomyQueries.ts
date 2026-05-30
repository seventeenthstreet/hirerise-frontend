/**
 * src/hooks/queries/useTaxonomyQueries.ts
 *
 * TAXONOMY QUERY HOOKS
 * ─────────────────────
 * All six taxonomy read hooks:
 *   useCountries()
 *   useRegions(countryCode)
 *   useBoards(regionCode, countryCode)
 *   useStreams(boardCode, countryCode)
 *   useSubjects(streamId, includeIntegrated?)
 *   useLanguages(regionCode, countryCode)
 *
 * PATTERN:
 *  - Each hook fetches through the API repository (never Supabase directly).
 *  - enabled guards prevent cascading requests when upstream selection is absent.
 *  - staleTime / gcTime are taxonomy-category constants (30 min / 1 hr).
 *  - Retries use the RPC-aware academicRpcRetryPredicate.
 *  - Loading and error states are normalised into a consistent shape.
 *
 * ARCHITECTURE POSITION:
 *   API layer → [THIS FILE] → UI components
 */

import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  getCountries,
  getRegions,
  getBoards,
  getStreams,
  getSubjects,
  getLanguages,
} from '../../api/academicTaxonomyApi';
import { academicQueryKeys } from '../queryKeys/academicQueryKeys';
import { unwrapOrThrow, academicRpcRetryPredicate } from '../utils/rpcExecutor';
import {
  TAXONOMY_STALE_TIME,
  TAXONOMY_GC_TIME,
  TAXONOMY_REFETCH_OPTIONS,
  isQueryEnabled,
} from '../utils/hookHelpers';
import type {
  Country,
  Region,
  Board,
  Stream,
  Subject,
  Language,
} from '../types/taxonomy.types';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TAXONOMY QUERY OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

const TAXONOMY_QUERY_BASE = {
  staleTime:  TAXONOMY_STALE_TIME,
  gcTime:     TAXONOMY_GC_TIME,
  retry:      academicRpcRetryPredicate,
  ...TAXONOMY_REFETCH_OPTIONS,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISED RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTaxonomyQueryReturn<T> {
  data:      T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError:   boolean;
  error:     Error | null;
  /** True only when there is data AND no loading/error state. */
  isReady:   boolean;
}

function normaliseTaxonomyQuery<T>(
  result: UseQueryResult<T, Error>,
): UseTaxonomyQueryReturn<T> {
  return {
    data:       result.data,
    isLoading:  result.isLoading,
    isFetching: result.isFetching,
    isError:    result.isError,
    error:      result.error,
    isReady:    !result.isLoading && !result.isError && result.data !== undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useCountries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the list of all active countries.
 * Always enabled — no upstream dependency.
 * Cache: 30 min stale, 1 hr gc.
 */
export function useCountries(): UseTaxonomyQueryReturn<Country[]> {
  const result = useQuery<Country[], Error>({
    queryKey:  academicQueryKeys.countries(),
    queryFn:   async () => {
      const res = await getCountries();
      return unwrapOrThrow(res).countries;
    },
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// useRegions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches curriculum regions for a given country.
 * Disabled when countryCode is absent/empty.
 *
 * @param countryCode  ISO country code (e.g. 'IN')
 */
export function useRegions(
  countryCode: string | undefined | null,
): UseTaxonomyQueryReturn<Region[]> {
  const enabled = isQueryEnabled(countryCode);

  const result = useQuery<Region[], Error>({
    queryKey:  academicQueryKeys.regions(countryCode ?? ''),
    queryFn:   async () => {
      const res = await getRegions({ countryCode: countryCode! });
      return unwrapOrThrow(res).regions;
    },
    enabled,
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// useBoards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches academic boards for a region + country.
 * Disabled when either param is absent.
 *
 * @param regionCode   Region code (e.g. 'MH' for Maharashtra)
 * @param countryCode  ISO country code (e.g. 'IN')
 */
export function useBoards(
  regionCode:  string | undefined | null,
  countryCode: string | undefined | null,
): UseTaxonomyQueryReturn<Board[]> {
  const enabled = isQueryEnabled(regionCode, countryCode);

  const result = useQuery<Board[], Error>({
    queryKey:  academicQueryKeys.boards(regionCode ?? '', countryCode ?? ''),
    queryFn:   async () => {
      const res = await getBoards({
        regionCode:  regionCode!,
        countryCode: countryCode!,
      });
      return unwrapOrThrow(res).boards;
    },
    enabled,
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// useStreams
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches academic streams for a board + country.
 * Disabled when either param is absent.
 *
 * @param boardCode    Board code (e.g. 'CBSE')
 * @param countryCode  ISO country code (e.g. 'IN')
 */
export function useStreams(
  boardCode:   string | undefined | null,
  countryCode: string | undefined | null,
): UseTaxonomyQueryReturn<Stream[]> {
  const enabled = isQueryEnabled(boardCode, countryCode);

  const result = useQuery<Stream[], Error>({
    queryKey:  academicQueryKeys.streams(boardCode ?? '', countryCode ?? ''),
    queryFn:   async () => {
      const res = await getStreams({
        boardCode:   boardCode!,
        countryCode: countryCode!,
      });
      return unwrapOrThrow(res).streams;
    },
    enabled,
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// useSubjects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches available subjects for a stream (by stream UUID).
 * Disabled when streamId is absent.
 *
 * @param streamId          UUID of the stream (from the streams list)
 * @param includeIntegrated Whether to include cross-stream integrated subjects (default: true)
 */
export function useSubjects(
  streamId:           string | undefined | null,
  includeIntegrated?: boolean,
): UseTaxonomyQueryReturn<Subject[]> {
  const enabled     = isQueryEnabled(streamId);
  const integrated  = includeIntegrated ?? true;

  const result = useQuery<Subject[], Error>({
    queryKey:  academicQueryKeys.subjects(streamId ?? '', integrated),
    queryFn:   async () => {
      const res = await getSubjects({
        streamId:          streamId!,
        includeIntegrated: integrated,
      });
      return unwrapOrThrow(res).subjects;
    },
    enabled,
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// useLanguages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches available languages for a region + country.
 * Disabled when either param is absent.
 *
 * @param regionCode   Region code (e.g. 'MH')
 * @param countryCode  ISO country code (e.g. 'IN')
 */
export function useLanguages(
  regionCode:  string | undefined | null,
  countryCode: string | undefined | null,
): UseTaxonomyQueryReturn<Language[]> {
  const enabled = isQueryEnabled(regionCode, countryCode);

  const result = useQuery<Language[], Error>({
    queryKey:  academicQueryKeys.languages(regionCode ?? '', countryCode ?? ''),
    queryFn:   async () => {
      const res = await getLanguages({
        regionCode:  regionCode!,
        countryCode: countryCode!,
      });
      return unwrapOrThrow(res).languages;
    },
    enabled,
    ...TAXONOMY_QUERY_BASE,
  });

  return normaliseTaxonomyQuery(result);
}
