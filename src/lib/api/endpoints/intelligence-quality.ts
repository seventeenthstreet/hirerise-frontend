/**
 * @file src/lib/api/endpoints/intelligence-quality.ts
 *
 * API endpoint definitions for Phase 4A intelligence quality system.
 *
 * Exposes:
 *   intelligenceQualityApi.getReport()
 *   intelligenceQualityApi.getCoverage()
 *   intelligenceQualityApi.getStability()
 *   intelligenceQualityApi.getDrift()
 *   intelligenceQualityApi.getExplainability()
 *
 * Architecture position:
 *   core (apiRequest) → client (apiClient) → [this file] → hooks → UI
 *
 * RULES:
 *   - No try/catch — errors are ApiClientError; they propagate to React Query.
 *   - No parsing logic — all parsing is in core/api-parser.ts.
 *   - No business logic, state, or UI concerns.
 */

import { apiClient } from '@/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CoverageLevel   = 'HIGH' | 'MEDIUM' | 'LOW';
export type ReliabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type StabilityLevel  = 'HIGH' | 'EMERGING' | 'UNSTABLE';
export type TrendDirection  = 'RISING' | 'STABLE' | 'DECLINING';
export type DriftLevel      = 'None' | 'Minor' | 'Moderate' | 'Significant';

export interface CoverageFactors {
  traitBreadth:         number;
  stageCompleteness:    number;
  sampleAdequacy:       number;
  questionDiversity:    number;
  contradictionPenalty: number;
  sparsityPenalty:      number;
  adaptiveBonus:        number;
}

export interface TraitGap {
  trait:       string;
  reason:      'not_assessed' | 'insufficient_samples';
  sampleCount?: number;
}

export interface SignalCoverageProfile {
  id:             string;
  coverageScore:  number;
  coverageLevel:  CoverageLevel;
  factors:        CoverageFactors | null;
  traitGaps:      TraitGap[] | null;
  coverageNotes:  string[] | null;
  engineVersion:  string;
  evaluatedAt:    string;
}

export interface SignalReliabilityProfile {
  traitKey:         string;
  rawScore:         number;
  reliabilityScore: number;
  reliabilityLevel: ReliabilityLevel;
  sampleCount:      number | null;
}

export interface ReliabilitySummary {
  averageReliabilityScore: number;
  overallReliabilityLevel: ReliabilityLevel;
  highReliabilityCount:    number;
  mediumReliabilityCount:  number;
  lowReliabilityCount:     number;
  unreliableTraits:        Array<{ traitKey: string; reliabilityScore: number }>;
}

export interface ClusterStabilityProfile {
  clusterId:       string;
  clusterLabel:    string;
  stabilityScore:  number;
  stabilityLevel:  StabilityLevel;
  stabilityLabel:  string;
  trendDirection:  TrendDirection;
  appearanceCount: number;
  averageScore:    number;
  lastScore:       number;
  firstSeenAt:     string | null;
  lastSeenAt:      string | null;
}

export interface ClusterDriftEvent {
  driftScore:    number;
  driftLevel:    DriftLevel;
  clusterSwapped: boolean;
  previousPrimaryClusterId: string | null;
  previousPrimaryLabel:     string | null;
  currentPrimaryClusterId:  string | null;
  currentPrimaryLabel:      string | null;
  currentAssessedAt:        string | null;
}

export interface CoverageExplanation {
  headline: string;
  score:    number;
  level:    CoverageLevel;
  detail:   string;
  notes:    string[];
}

export interface StabilityExplanation {
  headline:       string;
  level:          StabilityLevel;
  detail:         string;
  trendDirection: TrendDirection;
}

export interface StabilityProfileWithExplanation {
  clusterId:    string;
  clusterLabel: string;
  explanation:  StabilityExplanation;
}

export interface DriftExplanation {
  headline:       string;
  level:          DriftLevel;
  detail:         string;
  possibleCauses: string[];
}

/** Shape of GET /api/v1/intelligence-quality/report */
export interface QualityReportResponse {
  coverage:    SignalCoverageProfile;
  reliability: SignalReliabilityProfile[];
  stability:   ClusterStabilityProfile[];
  drift:       ClusterDriftEvent | null;
}

/** Shape of GET /api/v1/intelligence-quality/coverage */
export interface CoverageProfileResponse {
  coverage:    SignalCoverageProfile;
  explanation: CoverageExplanation;
}

/** Shape of GET /api/v1/intelligence-quality/stability */
export interface StabilityProfilesResponse {
  stabilityProfiles: StabilityProfileWithExplanation[];
}

/** Shape of GET /api/v1/intelligence-quality/drift */
export interface DriftHistoryResponse {
  latestDrift:     ClusterDriftEvent | null;
  driftHistory:    ClusterDriftEvent[];
  driftExplanation: DriftExplanation | null;
}

/** Shape of GET /api/v1/intelligence-quality/explainability */
export interface ExplainabilityResponse {
  available:   boolean;
  message?:    string;
  coverage?:   CoverageExplanation;
  reliability?: { headline: string; score: number; level: ReliabilityLevel; detail: string; unreliableTraitSummary: string | null };
  stability?:  StabilityProfileWithExplanation[];
  drift?:      DriftExplanation | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API ENDPOINT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const intelligenceQualityApi = {
  /**
   * Full intelligence quality report.
   * Primary endpoint for the quality dashboard widget.
   */
  getReport: (): Promise<QualityReportResponse> =>
    apiClient<QualityReportResponse>({
      url:    '/api/v1/intelligence-quality/report',
      method: 'GET',
    }),

  /**
   * Signal coverage profile with explanation.
   */
  getCoverage: (): Promise<CoverageProfileResponse> =>
    apiClient<CoverageProfileResponse>({
      url:    '/api/v1/intelligence-quality/coverage',
      method: 'GET',
    }),

  /**
   * All cluster stability profiles with explanations.
   */
  getStability: (): Promise<StabilityProfilesResponse> =>
    apiClient<StabilityProfilesResponse>({
      url:    '/api/v1/intelligence-quality/stability',
      method: 'GET',
    }),

  /**
   * Latest drift event + drift history.
   */
  getDrift: (): Promise<DriftHistoryResponse> =>
    apiClient<DriftHistoryResponse>({
      url:    '/api/v1/intelligence-quality/drift',
      method: 'GET',
    }),

  /**
   * All human-readable quality narratives.
   * Primary endpoint for the explainability panel.
   */
  getExplainability: (): Promise<ExplainabilityResponse> =>
    apiClient<ExplainabilityResponse>({
      url:    '/api/v1/intelligence-quality/explainability',
      method: 'GET',
    }),
} as const;
