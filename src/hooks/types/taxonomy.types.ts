/**
 * src/hooks/types/taxonomy.types.ts
 *
 * ACADEMIC TAXONOMY — DOMAIN TYPES
 * ─────────────────────────────────
 * Typed shapes for every entity returned by the taxonomy RPCs.
 * These types are the contract between the API layer and the hooks layer.
 *
 * GOVERNANCE:
 *  ❌ No Supabase imports.
 *  ❌ No React imports.
 *  ❌ No business logic.
 *  ✅ Types only — additive-safe for future fields.
 *
 * ADDITIVE COMPATIBILITY:
 *  All object types use optional fields for non-essential properties so future
 *  backend additions do not break existing compiled frontends.
 */

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface Country {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean;
  lifecycle_status?: string;
}

export interface GetCountriesResult {
  countries: Country[];
}

// ─────────────────────────────────────────────────────────────────────────────
// REGION
// ─────────────────────────────────────────────────────────────────────────────

export interface Region {
  id: string;
  region_code: string;
  region_name: string;
  lifecycle_status?: string;
}

export interface GetRegionsResult {
  country_code: string;
  regions: Region[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD
// ─────────────────────────────────────────────────────────────────────────────

export type BoardType =
  | 'national'
  | 'state'
  | 'international'
  | 'open'
  | string; // additive-safe

export interface Board {
  id: string;
  board_code: string;
  board_name: string;
  board_type: BoardType;
  is_primary: boolean;
  lifecycle_status?: string;
}

export interface GetBoardsResult {
  region_code: string;
  boards: Board[];
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAM
// ─────────────────────────────────────────────────────────────────────────────

export interface Stream {
  id: string;
  stream_code: string;
  stream_name: string;
  applicable_from_class?: number;
  applicable_to_class?: number;
}

export interface GetStreamsResult {
  board_code: string;
  country_code: string;
  streams: Stream[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT
// ─────────────────────────────────────────────────────────────────────────────

export type SubjectCategory =
  | 'core'
  | 'elective'
  | 'language'
  | 'integrated'
  | string; // additive-safe

export interface Subject {
  id: string;
  subject_code: string;
  subject_name: string;
  category: SubjectCategory;
  is_mandatory?: boolean;
  applicable_classes?: number[];
}

export interface GetSubjectsResult {
  stream_id: string;
  subjects: Subject[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE
// ─────────────────────────────────────────────────────────────────────────────

export type LanguageType =
  | 'official'
  | 'regional'
  | 'classical'
  | 'foreign'
  | string; // additive-safe

export interface Language {
  id: string;
  language_code: string;
  language_name: string;
  language_type?: LanguageType;
  is_active: boolean;
}

export interface GetLanguagesResult {
  region_code: string;
  country_code: string;
  languages: Language[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TAXONOMY QUERY PARAMS — strongly typed
// ─────────────────────────────────────────────────────────────────────────────

export interface GetRegionsParams {
  countryCode: string;
}

export interface GetBoardsParams {
  regionCode: string;
  countryCode: string;
}

export interface GetStreamsParams {
  boardCode: string;
  countryCode: string;
}

export interface GetSubjectsParams {
  /** UUID of the stream (not the stream_code) */
  streamId: string;
  includeIntegrated?: boolean;
}

export interface GetLanguagesParams {
  regionCode: string;
  countryCode: string;
}
