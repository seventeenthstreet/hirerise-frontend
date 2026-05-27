/**
 * src/api/academicTaxonomyApi.ts
 *
 * ACADEMIC TAXONOMY — API REPOSITORY
 * ────────────────────────────────────
 * The ONLY file in the frontend where Supabase RPC calls for taxonomy data
 * are made. Every function returns a typed RpcResult<T> — no throws at this
 * layer; hooks unwrap via `unwrapOrThrow`.
 *
 * LIVE RPCs (Phase 1A):
 *  - fn_get_countries()                                — countries_master
 *  - fn_get_regions_for_country(p_country_code)       — curriculum_regions
 *  - fn_get_boards_for_region(p_region_code, p_country_code)
 *  - fn_get_streams_for_board(p_board_code, p_country_code)
 *  - fn_get_subjects_for_stream(p_stream_id, p_include_integrated)
 *  - fn_get_languages_for_region(p_region_code, p_country_code)
 *
 * ARCHITECTURE POSITION:
 *   [THIS FILE] ← only Supabase RPC calls live here
 *   hooks/queries/* ← import from here, never call Supabase directly
 *
 * GOVERNANCE:
 *  ❌ No React imports.
 *  ❌ No React Query imports.
 *  ❌ No business logic.
 *  ✅ All calls go through executeRpc (telemetry + correlation IDs).
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { executeRpc } from '../hooks/utils/rpcExecutor';
import type { RpcResult } from '../hooks/types/rpcEnvelope.types';
import type {
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
} from '../hooks/types/taxonomy.types';

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the list of all active countries from countries_master.
 *
 * RPC: fn_get_countries()
 * Returns: { success, countries: [{id, country_code, country_name, is_active}] }
 */
export async function getCountries(): Promise<RpcResult<GetCountriesResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetCountriesResult>(client, 'fn_get_countries');
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active curriculum regions for a country.
 *
 * RPC: fn_get_regions_for_country(p_country_code)
 * Returns: { success, country_code, regions: [{id, region_code, region_name, ...}] }
 */
export async function getRegions(
  params: GetRegionsParams,
): Promise<RpcResult<GetRegionsResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetRegionsResult>(
    client,
    'fn_get_regions_for_country',
    { p_country_code: params.countryCode.toUpperCase() },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active boards for a region + country.
 *
 * RPC: fn_get_boards_for_region(p_region_code, p_country_code)
 * Returns: { success, region_code, boards: [{id, board_code, board_name, board_type, is_primary, ...}] }
 */
export async function getBoards(
  params: GetBoardsParams,
): Promise<RpcResult<GetBoardsResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetBoardsResult>(
    client,
    'fn_get_boards_for_region',
    {
      p_region_code:  params.regionCode.toUpperCase(),
      p_country_code: params.countryCode.toUpperCase(),
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active academic streams for a board + country.
 *
 * RPC: fn_get_streams_for_board(p_board_code, p_country_code)
 * Returns: { success, board_code, country_code, streams: [{id, stream_code, stream_name, ...}] }
 */
export async function getStreams(
  params: GetStreamsParams,
): Promise<RpcResult<GetStreamsResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetStreamsResult>(
    client,
    'fn_get_streams_for_board',
    {
      p_board_code:   params.boardCode.toUpperCase(),
      p_country_code: params.countryCode.toUpperCase(),
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active subjects for a stream (by stream UUID).
 *
 * RPC: fn_get_subjects_for_stream(p_stream_id, p_include_integrated)
 * Returns: { success, stream_id, subjects: [{id, subject_code, subject_name, category, ...}] }
 */
export async function getSubjects(
  params: GetSubjectsParams,
): Promise<RpcResult<GetSubjectsResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetSubjectsResult>(
    client,
    'fn_get_subjects_for_stream',
    {
      p_stream_id:          params.streamId,
      p_include_integrated: params.includeIntegrated ?? true,
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active languages for a region + country.
 *
 * RPC: fn_get_languages_for_region(p_region_code, p_country_code)
 * Returns: { success, region_code, country_code, languages: [{id, language_code, language_name, ...}] }
 */
export async function getLanguages(
  params: GetLanguagesParams,
): Promise<RpcResult<GetLanguagesResult>> {
  const client = getSupabaseClient();
  return executeRpc<GetLanguagesResult>(
    client,
    'fn_get_languages_for_region',
    {
      p_region_code:  params.regionCode.toUpperCase(),
      p_country_code: params.countryCode.toUpperCase(),
    },
  );
}
