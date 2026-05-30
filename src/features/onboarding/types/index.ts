/**
 * @file src/features/onboarding/types/index.ts
 *
 * PHASE 2 — ONBOARDING EXTRACTION: Type Ownership Consolidation
 *
 * This file is the SINGLE SOURCE OF TRUTH for all onboarding domain types.
 *
 * OWNERSHIP PRINCIPLE:
 *   Previously, onboarding types were split across three locations:
 *     - lib/api/onboarding.ts         (API response types)
 *     - lib/api/endpoints/onboarding.ts (CareerReportResponse + re-exports)
 *     - hooks/onboarding/*             (local hook types)
 *
 *   This fragmentation created:
 *     • import path ambiguity (two "onboarding" modules at the API layer)
 *     • coupling risk (endpoint module re-exporting canonical types creates
 *       a transitive chain: features/ → endpoints/ → lib/)
 *     • inconsistent imports across hooks (some from lib/api/onboarding,
 *       some from lib/api/endpoints/onboarding)
 *
 *   CONSOLIDATION: All onboarding domain types live here.
 *   The API layer files (lib/api/onboarding.ts, lib/api/endpoints/onboarding.ts)
 *   are kept intact for now — they re-export from this file via compatibility
 *   bridges to avoid breaking existing consumers.
 *
 * COMPATIBILITY:
 *   Existing imports from lib/api/onboarding and lib/api/endpoints/onboarding
 *   continue working unchanged — those files retain re-exports pointing here.
 *   Migration to '@/features/onboarding/types' can proceed incrementally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API RESPONSE TYPES — originally in lib/api/onboarding.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Status of a single onboarding step as returned by the backend. */
export type OnboardingStep = {
  stepId:    string;
  completed: boolean;
  skipped?:  boolean;
};

/** Response from GET /api/v1/onboarding/progress */
export type OnboardingProgressResponse = {
  currentStep:    string;
  completedSteps: string[];
  steps:          OnboardingStep[];
  isComplete:     boolean;
};

/**
 * Base shape returned by every step submission.
 * Stable across all step variants.
 */
export type BaseOnboardingResponse = {
  stepId:    string;
  completed: boolean;
};

/**
 * Response from POST /api/v1/onboarding/:stepId.
 *
 * `data` carries step-specific payload. Typed as `unknown` because each step
 * returns a different shape — callers that need typed access should narrow via
 * a step-specific wrapper or type guard.
 */
export type SubmitOnboardingStepResponse<T = unknown> = BaseOnboardingResponse & {
  data?: T;
};

/**
 * Response from POST /api/v1/onboarding/career-report.
 *
 * Generation is async. The response contains a job reference for polling, or
 * the completed report if synchronous generation is enabled for the user's tier.
 *
 * Previously local to lib/api/endpoints/onboarding.ts.
 */
export type CareerReportResponse = {
  /** Supabase Auth UUID of the user who generated the report. */
  userId: string;
  /** Onboarding step marker written to onboarding_progress. */
  step: 'career_report_generated';
  /** AI-generated career report content. */
  careerReport: {
    overallAssessment:    string;
    educationGaps:        string[];
    experienceGaps:       string[];
    skillRecommendations: string[];
    careerOpportunities:  string[];
    nextSteps:            string[];
    marketInsight:        string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOW TYPES — local step/flow orchestration types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal step shape required by the flow hook (useOnboardingFlow).
 * Full OnboardingStepDef satisfies this.
 */
export interface OnboardingFlowStep {
  id: string;
  isTerminal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION / VARIANT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The three learnable / workable directions supported by the platform. */
export type OnboardingDirection = 'education' | 'career' | 'market';

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION INPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Input type for the useSubmitOnboardingStep mutation. */
export interface SubmitOnboardingStepInput {
  /** The step identifier — maps to the :stepId route segment. */
  stepId: string;
  /**
   * Step-specific payload. Shape varies per step; the API layer types this
   * as Record<string, unknown> — callers pass whatever the step form produces.
   */
  data: Record<string, unknown>;
}

/** Input type for the useSetDirection / useDirection mutations. */
export interface SetDirectionInput {
  direction: OnboardingDirection;
}

/** Response type for the set-direction mutation. */
export interface SetDirectionResponse {
  /** Backend-provided redirect path — follow this, do not hard-code fallbacks. */
  redirectTo: string;
  userType:   string;
}

/** Response type for the reset-direction mutation. */
export interface ResetDirectionResponse {
  direction: null;
  resetAt:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION / RETURN TYPES — from hooks/onboarding/*
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingDirectionSwitchReturn {
  /**
   * Initiate a direction switch. Safe to call only before onboarding completion.
   * Rejects (no-op) if the user has already completed onboarding.
   */
  switchDirection: () => Promise<void>;
  /** True while the DELETE request + cache reset is in flight. */
  isSwitching:     boolean;
  /** Non-null if the switch failed (e.g. network error). */
  switchError:     string | null;
}