/**
 * @file front/src/modules/student-onboarding/intelligence/types/index.ts
 *
 * TYPE OWNERSHIP — Cross-Domain Intelligence Layer (Phase 3D)
 * ────────────────────────────────────────────────────────────
 * Single source of truth for all intelligence-domain types in the frontend.
 *
 * THREE-TIER TYPE ARCHITECTURE:
 *   Tier 1 — DB Layer (Raw)     — exact DB column shapes, prefixed Db*
 *   Tier 2 — Domain Layer       — camelCase, normalized, crosses API → Hook boundary
 *   Tier 3 — Request/Response   — what hooks send and receive
 *
 * SCOPE:
 *   This module covers the DIAGNOSTIC/ADMIN interface only.
 *   No student-facing types. No recommendation types. No scoring types.
 *
 * ENUM SAFETY CONTRACT:
 *   All enum values MUST mirror:
 *   • backend constants/intelligence.js
 *   • SQL enum definitions in migration 20260525000001_cross_domain_intelligence_phase3d.sql
 *
 * DO NOT:
 *   - Add student-facing display types here
 *   - Add recommendation or career matching types
 *   - Import Supabase client here
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUM CONSTANTS
// Mirror of: SQL enums + backend constants/intelligence.js
// ─────────────────────────────────────────────────────────────────────────────

export const INTELLIGENCE_DOMAINS = [
  'academic',
  'activity',
  'cognitive',
  'cross_domain',
] as const;

export type IntelligenceDomain = (typeof INTELLIGENCE_DOMAINS)[number];

export const SIGNAL_CATEGORIES = [
  'reasoning',
  'creative',
  'social',
  'technical',
  'cognitive_style',
  'subject_affinity',
  'behavioral',
  'meta',
] as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  'explicit_response',
  'activity_record',
  'achievement_record',
  'subject_performance',
  'cross_domain_merge',
  'reflection_entry',
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const NORMALIZATION_STRATEGIES = [
  'weighted_average',
  'max_pooling',
  'min_pooling',
  'evidence_count',
] as const;

export type NormalizationStrategy = (typeof NORMALIZATION_STRATEGIES)[number];

export const CONTRADICTION_SEVERITY_LEVELS = [
  'none',
  'weak',
  'moderate',
  'strong',
] as const;

export type ContradictionSeverity = (typeof CONTRADICTION_SEVERITY_LEVELS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL SIGNAL KEYS
// Mirror of: backend constants/intelligence.js ALL_SIGNAL_KEYS
// Used for type-safe signal key references in diagnostic components.
// ─────────────────────────────────────────────────────────────────────────────

export const ACADEMIC_SIGNAL_KEYS = [
  'analytical_strength',
  'quantitative_reasoning',
  'language_affinity',
  'scientific_orientation',
  'social_science_interest',
] as const;

export const ACTIVITY_SIGNAL_KEYS = [
  'leadership',
  'technical_execution',
  'creative_expression',
  'collaboration',
  'persistence',
  'achievement_orientation',
] as const;

export const COGNITIVE_SIGNAL_KEYS = [
  'systems_thinking',
  'hands_on_learning',
  'structured_problem_solving',
  'exploratory_decision_making',
  'detail_orientation',
  'independent_working',
  'rapid_execution',
] as const;

export const CROSS_DOMAIN_SIGNAL_KEYS = [
  'stem_affinity',
  'communication_strength',
  'entrepreneurial_signal',
] as const;

export const ALL_SIGNAL_KEYS = [
  ...ACADEMIC_SIGNAL_KEYS,
  ...ACTIVITY_SIGNAL_KEYS,
  ...COGNITIVE_SIGNAL_KEYS,
  ...CROSS_DOMAIN_SIGNAL_KEYS,
] as const;

export type SignalKey = (typeof ALL_SIGNAL_KEYS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — DB LAYER (Raw)
// Exact mirror of Supabase table columns. Never used in hooks or UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Raw row from intelligence_signal_registry. */
export interface DbSignalRegistryRow {
  readonly id:                      string;
  readonly signal_key:              string;
  readonly taxonomy_version:        string;
  readonly category:                string;
  readonly primary_domain:          string;
  readonly compatible_domains:      string[];
  readonly normalization_strategy:  string;
  readonly aggregation_compatible:  boolean;
  readonly engine_compatible:       boolean;
  readonly longitudinal_trackable:  boolean;
  readonly display_name:            string;
  readonly description:             string | null;
  readonly signal_version:          string;
  readonly deprecated_at:           string | null;
  readonly created_at:              string;
  readonly updated_at:              string;
}

/** Raw row from student_signal_vectors. */
export interface DbStudentSignalVector {
  readonly id:                       string;
  readonly user_id:                  string;
  readonly aggregation_version:      string;
  readonly signal_weights:           Record<string, number>;
  readonly domain_vectors:           Record<string, Record<string, number>>;
  readonly evidence_summary:         Record<string, DbEvidenceSummaryEntry>;
  readonly confidence_data:          Record<string, DbConfidenceEntry>;
  readonly contradiction_metadata:   Record<string, DbContradictionEntry>;
  readonly pipeline_run_id:          string | null;
  readonly domains_included:         string[];
  readonly is_complete_vector:       boolean;
  readonly aggregated_at:            string;
  readonly created_at:               string;
  readonly updated_at:               string;
}

export interface DbEvidenceSummaryEntry {
  readonly count:        number;
  readonly domains:      string[];
  readonly last_updated: string;
}

export interface DbConfidenceEntry {
  readonly evidence_count:             number;
  readonly source_diversity:           number;
  readonly cross_domain_reinforcement: boolean;
  readonly composite_confidence:       null;
}

export interface DbContradictionEntry {
  readonly signal_a:    string;
  readonly signal_b:    string;
  readonly weight_a:    number;
  readonly weight_b:    number;
  readonly severity:    string;
  readonly resolved:    boolean;
  readonly detected_at: string;
}

/** Raw row from student_signal_evidence. */
export interface DbStudentSignalEvidence {
  readonly id:                      string;
  readonly user_id:                 string;
  readonly signal_key:              string;
  readonly source_type:             string;
  readonly source_domain:           string;
  readonly source_reference_id:     string;
  readonly source_reference_table:  string | null;
  readonly contribution_weight:     number;
  readonly raw_confidence:          number | null;
  readonly evidence_metadata:       Record<string, unknown>;
  readonly taxonomy_version:        string;
  readonly aggregation_version:     string;
  readonly recorded_at:             string;
}

/** Raw row from signal_confidence_models. */
export interface DbSignalConfidenceModel {
  readonly id:                          string;
  readonly user_id:                     string;
  readonly signal_key:                  string;
  readonly aggregation_version:         string;
  readonly evidence_count:              number;
  readonly source_diversity:            number;
  readonly cross_domain_reinforcement:  boolean;
  readonly contradiction_severity:      string;
  readonly composite_confidence:        null;
  readonly first_evidence_at:           string | null;
  readonly last_evidence_at:            string | null;
  readonly evidence_delta_30d:          number;
  readonly computed_at:                 string;
  readonly created_at:                  string;
  readonly updated_at:                  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — DOMAIN LAYER (Normalized, camelCase)
// Crosses the API → Hook boundary.
// ─────────────────────────────────────────────────────────────────────────────

/** Normalized signal registry entry. */
export interface SignalRegistryEntry {
  readonly signalKey:              SignalKey;
  readonly taxonomyVersion:        string;
  readonly category:               SignalCategory;
  readonly primaryDomain:          IntelligenceDomain;
  readonly compatibleDomains:      IntelligenceDomain[];
  readonly normalizationStrategy:  NormalizationStrategy;
  readonly aggregationCompatible:  boolean;
  readonly longitudinalTrackable:  boolean;
  readonly displayName:            string;
  readonly description:            string | null;
  readonly signalVersion:          string;
  readonly isDeprecated:           boolean;
}

/** Normalized cross-domain signal vector for a student. */
export interface StudentSignalVector {
  readonly aggregationVersion:     string;
  readonly signalWeights:          Partial<Record<SignalKey, number>>;
  readonly domainVectors:          {
    readonly academic:    Partial<Record<SignalKey, number>>;
    readonly activity:    Partial<Record<SignalKey, number>>;
    readonly cognitive:   Partial<Record<SignalKey, number>>;
    readonly cross_domain: Partial<Record<SignalKey, number>>;
  };
  readonly evidenceSummary:        Partial<Record<SignalKey, EvidenceSummary>>;
  readonly confidenceData:         Partial<Record<SignalKey, ConfidencePlaceholder>>;
  readonly contradictionMetadata:  Record<string, ContradictionEntry>;
  readonly pipelineRunId:          string | null;
  readonly domainsIncluded:        IntelligenceDomain[];
  readonly isCompleteVector:       boolean;
  readonly aggregatedAt:           string;
  readonly updatedAt:              string;
}

export interface EvidenceSummary {
  readonly count:       number;
  readonly domains:     IntelligenceDomain[];
  readonly lastUpdated: string;
}

/** Confidence placeholder — composite_confidence is always null in Phase 3D. */
export interface ConfidencePlaceholder {
  readonly evidenceCount:             number;
  readonly sourceDiversity:           number;
  readonly crossDomainReinforcement:  boolean;
  readonly compositeConfidence:       null;
}

export interface ContradictionEntry {
  readonly signalA:    SignalKey;
  readonly signalB:    SignalKey;
  readonly weightA:    number;
  readonly weightB:    number;
  readonly severity:   ContradictionSeverity;
  readonly resolved:   boolean;
  readonly detectedAt: string;
}

/** Normalized signal evidence record. */
export interface SignalEvidenceRecord {
  readonly id:                   string;
  readonly signalKey:            SignalKey;
  readonly sourceType:           EvidenceSourceType;
  readonly sourceDomain:         IntelligenceDomain;
  readonly sourceReferenceId:    string;
  readonly sourceReferenceTable: string | null;
  readonly contributionWeight:   number;
  readonly rawConfidence:        number | null;
  readonly evidenceMetadata:     Record<string, unknown>;
  readonly taxonomyVersion:      string;
  readonly aggregationVersion:   string;
  readonly recordedAt:           string;
}

/** Normalized confidence model for a single signal. */
export interface SignalConfidenceModel {
  readonly signalKey:                 SignalKey;
  readonly aggregationVersion:        string;
  readonly evidenceCount:             number;
  readonly sourceDiversity:           number;
  readonly crossDomainReinforcement:  boolean;
  readonly contradictionSeverity:     ContradictionSeverity;
  readonly compositeConfidence:       null;
  readonly firstEvidenceAt:           string | null;
  readonly lastEvidenceAt:            string | null;
  readonly evidenceDelta30d:          number;
  readonly computedAt:                string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — REQUEST / RESPONSE MODELS
// What hooks receive (response) and what they pass as args (request).
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /intelligence/registry ────────────────────────────────────────────────

export interface GetSignalRegistryResponse {
  readonly ok:       boolean;
  readonly registry: DbSignalRegistryRow[];
  readonly count:    number;
}

// ── GET /intelligence/student/:userId/vector ──────────────────────────────────

export interface GetStudentVectorResponse {
  readonly ok:     boolean;
  readonly vector: DbStudentSignalVector;
}

// ── GET /intelligence/student/:userId/confidence ─────────────────────────────

export interface GetStudentConfidenceResponse {
  readonly ok:     boolean;
  readonly models: DbSignalConfidenceModel[];
  readonly count:  number;
}

// ── GET /intelligence/student/:userId/evidence/:signalKey ────────────────────

export interface GetSignalEvidenceResponse {
  readonly ok:         boolean;
  readonly signal_key: string;
  readonly evidence:   DbStudentSignalEvidence[];
  readonly count:      number;
}

// ── POST /intelligence/student/:userId/trigger ────────────────────────────────

export interface TriggerPipelineInput {
  readonly dry_run?: boolean;
}

export interface TriggerPipelineResponse {
  readonly ok:               boolean;
  readonly pipeline_run_id:  string;
  readonly dry_run:          boolean;
  readonly evidence_inserted: number;
  readonly vector_id:        string | null;
  readonly confidence_rows:  number;
  readonly signal_count:     number;
  readonly domains_included: string[];
  readonly is_complete:      boolean;
  readonly contradictions:   number;
  readonly preview?:         {
    readonly signal_weights:         Record<string, number>;
    readonly contradiction_metadata: Record<string, unknown>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export const IntelligenceErrorCode = {
  REGISTRY_FETCH_FAILED:    'INTELLIGENCE_REGISTRY_FETCH_FAILED',
  VECTOR_FETCH_FAILED:      'INTELLIGENCE_VECTOR_FETCH_FAILED',
  VECTOR_NOT_FOUND:         'INTELLIGENCE_VECTOR_NOT_FOUND',
  CONFIDENCE_FETCH_FAILED:  'INTELLIGENCE_CONFIDENCE_FETCH_FAILED',
  EVIDENCE_FETCH_FAILED:    'INTELLIGENCE_EVIDENCE_FETCH_FAILED',
  PIPELINE_TRIGGER_FAILED:  'INTELLIGENCE_PIPELINE_TRIGGER_FAILED',
  UNAUTHORIZED:             'INTELLIGENCE_UNAUTHORIZED',
} as const;

export type IntelligenceErrorCode =
  (typeof IntelligenceErrorCode)[keyof typeof IntelligenceErrorCode];
