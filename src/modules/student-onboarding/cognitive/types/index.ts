/**
 * @file front/src/modules/student-onboarding/cognitive/types/index.ts
 *
 * TYPE OWNERSHIP — Cognitive & Processing Intelligence (Phase 3C)
 * ──────────────────────────────────────────────────────────────────
 * Single source of truth for all cognitive-domain types in the frontend module.
 *
 * THREE-TIER TYPE ARCHITECTURE:
 *   Tier 1 — DB Layer (Raw)   — exact DB column shapes, prefixed Db*
 *   Tier 2 — Domain Layer     — camelCase, normalized, API → Hook boundary
 *   Tier 3 — Request/Response — what hooks send and receive over the wire
 *
 * ENUM SAFETY CONTRACT:
 *   All enum values MUST mirror:
 *   • backend constants/cognitive.js
 *   • SQL enums in migration 20260524000001_student_cognitive_phase3c.sql
 *
 * DO NOT:
 *   - Import Supabase client here
 *   - Add UI component state types here
 *   - Add recommendation, scoring, or prediction types here
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUM CONSTANTS
// Mirror of: backend constants/cognitive.js + SQL enums
// ─────────────────────────────────────────────────────────────────────────────

export const COGNITIVE_DOMAINS = [
  'problem_solving',
  'learning_preference',
  'decision_making',
  'execution_pattern',
  'information_processing',
] as const;

export type CognitiveDomain = (typeof COGNITIVE_DOMAINS)[number];

export const COGNITIVE_DOMAIN_LABELS: Record<CognitiveDomain, string> = {
  problem_solving:        'Problem-Solving Style',
  learning_preference:    'Learning Style',
  decision_making:        'Decision-Making Style',
  execution_pattern:      'Work & Execution Style',
  information_processing: 'Information Processing',
};

export const COGNITIVE_DOMAIN_ICONS: Record<CognitiveDomain, string> = {
  problem_solving:        '🧩',
  learning_preference:    '📖',
  decision_making:        '⚖️',
  execution_pattern:      '⚡',
  information_processing: '🗂️',
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — DB LAYER (Raw)
// Exact column names from the DB. Never used directly in hooks or UI.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbCognitiveTaxonomyRow {
  readonly id:            string;
  readonly domain:        string;
  readonly display_name:  string;
  readonly description:   string | null;
  readonly display_order: number;
  readonly cognitive_questions: DbCognitiveQuestionRow[];
}

export interface DbCognitiveQuestionRow {
  readonly id:            string;
  readonly question_key:  string;
  readonly question_text: string;
  readonly hint_text:     string | null;
  readonly allows_multi:  boolean;
  readonly is_required:   boolean;
  readonly display_order: number;
  readonly cognitive_options: DbCognitiveOptionRow[];
}

export interface DbCognitiveOptionRow {
  readonly id:             string;
  readonly option_key:     string;
  readonly option_text:    string;
  readonly signal_weights: Record<string, number>; // never exposed to UI
  readonly display_order:  number;
}

export interface DbCognitiveResponse {
  readonly id:                   string;
  readonly user_id:              string;
  readonly question_id:          string;
  readonly selected_option_keys: string[];
  readonly is_partial:           boolean;
  readonly response_metadata:    Record<string, unknown>;
  readonly created_at:           string;
  readonly updated_at:           string;
}

export interface DbCognitiveSignals {
  readonly id:             string;
  readonly user_id:        string;
  readonly signal_tags:    string[];
  readonly signal_weights: Record<string, number>;
  readonly domain_vectors: Record<string, unknown>;
  readonly response_count: number;
  readonly is_partial:     boolean;
  readonly engine_version: string | null;
  readonly extracted_at:   string | null;
  readonly metadata:       Record<string, unknown>;
  readonly created_at:     string;
  readonly updated_at:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — DOMAIN LAYER (Normalized, camelCase)
// ─────────────────────────────────────────────────────────────────────────────

/** A single answer option for a question. signal_weights intentionally omitted. */
export interface CognitiveOption {
  readonly optionKey:    string;
  readonly optionText:   string;
  readonly displayOrder: number;
}

/** A single scenario-based question with its options. */
export interface CognitiveQuestion {
  readonly id:           string;
  readonly questionKey:  string;
  readonly questionText: string;
  readonly hintText:     string | null;
  readonly allowsMulti:  boolean;
  readonly isRequired:   boolean;
  readonly displayOrder: number;
  readonly options:      CognitiveOption[];
}

/** A cognitive domain group with all its questions. */
export interface CognitiveDomainGroup {
  readonly domain:       CognitiveDomain;
  readonly displayName:  string;
  readonly description:  string | null;
  readonly displayOrder: number;
  readonly questions:    CognitiveQuestion[];
}

/** Normalized student response for a single question. */
export interface CognitiveResponse {
  readonly id:                 string;
  readonly questionId:         string;
  readonly selectedOptionKeys: string[];
  readonly isPartial:          boolean;
  readonly updatedAt:          string;
}

/** Signal quality summary — returned by GET and all mutations. */
export interface CognitiveSignalQuality {
  readonly totalResponses:   number;
  readonly requiredAnswered: number;
  readonly requiredTotal:    number;
  readonly isSufficient:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — REQUEST / RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /step/cognitive ───────────────────────────────────────────────────────

export interface GetCognitiveStepResponse {
  readonly ok:            boolean;
  readonly taxonomy:      DbCognitiveTaxonomyRow[];
  readonly responses:     DbCognitiveResponse[];
  readonly signals:       DbCognitiveSignals | null;
  readonly signal_quality: {
    readonly total_responses:   number;
    readonly required_answered: number;
    readonly required_total:    number;
    readonly is_sufficient:     boolean;
  };
}

// ── POST /step/cognitive/response ─────────────────────────────────────────────

export interface SaveResponseInput {
  readonly questionId:         string;
  readonly selectedOptionKeys: string[];
  readonly isPartial?:         boolean;
}

export interface SaveResponseResponse {
  readonly ok:            boolean;
  readonly response:      DbCognitiveResponse;
  readonly signal_quality: GetCognitiveStepResponse['signal_quality'];
}

// ── POST /step/cognitive/responses/batch ──────────────────────────────────────

export interface BatchSaveResponsesInput {
  readonly responses: Array<{
    readonly questionId:         string;
    readonly selectedOptionKeys: string[];
  }>;
}

export interface BatchSaveResponsesResponse {
  readonly ok:            boolean;
  readonly responses:     DbCognitiveResponse[];
  readonly signal_quality: GetCognitiveStepResponse['signal_quality'];
}

// ── POST /step/cognitive/commit ───────────────────────────────────────────────
// Note: no session/next_step fields — session advancement is handled by
// page.tsx → useUpdateOnboardingStep after onComplete() is called.

export interface CommitCognitiveResponse {
  readonly ok:            boolean;
  readonly signals:       DbCognitiveSignals;
  readonly signal_quality: GetCognitiveStepResponse['signal_quality'];
}

// ─────────────────────────────────────────────────────────────────────────────
// UI STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** questionId → selected option keys. UI-only ephemeral state. */
export type CognitiveSelectionMap = Record<string, string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const CognitiveErrorCode = {
  FETCH_FAILED:           'COGNITIVE_FETCH_FAILED',
  SAVE_RESPONSE_FAILED:   'COGNITIVE_SAVE_RESPONSE_FAILED',
  BATCH_SAVE_FAILED:      'COGNITIVE_BATCH_SAVE_FAILED',
  COMMIT_FAILED:          'COGNITIVE_COMMIT_FAILED',
  INSUFFICIENT_SIGNAL:    'COGNITIVE_INSUFFICIENT_SIGNAL',
  QUESTION_NOT_FOUND:     'COGNITIVE_QUESTION_NOT_FOUND',
  INVALID_OPTION:         'COGNITIVE_INVALID_OPTION',
  MULTI_SELECT_VIOLATION: 'COGNITIVE_MULTI_SELECT_VIOLATION',
} as const;

export type CognitiveErrorCode = (typeof CognitiveErrorCode)[keyof typeof CognitiveErrorCode];
