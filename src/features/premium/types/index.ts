/**
 * @file src/features/premium/types/index.ts
 * @description Domain types for the WP-13B Premium Match feature.
 *
 * These types mirror the backend API contract exactly.
 * No UI concerns — pure data shapes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIER
// ─────────────────────────────────────────────────────────────────────────────

export type MatchTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';

// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE PROFILE  (not returned by API — internal to backend)
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateProfile {
  candidateId:    string;
  resumeId:       string;
  skills:         string[];
  experienceYears: number;
  education:      string | null;
  educationLevel: number | null;
  targetRole:     string | null;
  targetRoleId:   string | null;
  careerLevel:    'entry' | 'mid' | 'senior' | 'lead';
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchBreakdown {
  skills:       number;
  experience:   number;
  education:    number;
  marketDemand: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL GAP
// ─────────────────────────────────────────────────────────────────────────────

export interface MissingSkill {
  skill_name:            string;
  skill_category:        string;
  difficulty_level:      number;
  priority:              'high_priority' | 'medium_priority' | 'low_priority';
  estimatedWeeksToLearn: number;
  demand_score?:         number;
  importance_weight?:    number;
}

export interface SkillGap {
  missingSkills: MissingSkill[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplanationPayload {
  reasons: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

export type InsightType = 'skill_gap' | 'market_signal' | 'experience_gap';

export interface PremiumInsight {
  type:        InsightType;
  title:       string;
  description: string;
  priority:    number;
  meta?:       Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH RESULT  (API response .data shape)
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchResult {
  analysisId:       string;
  resumeId:         string;
  matchScore:       number;
  tier:             MatchTier;
  breakdown:        MatchBreakdown;
  skillGap:         SkillGap;
  explanation:      ExplanationPayload;
  insights:         PremiumInsight[];
  engine:           string;
  cacheHit:         boolean;
  aiModelVersion?:  string;
  latencyMs?:       number;
  creditsRemaining?: number;
  scoredAt:         string;
}
