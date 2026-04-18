// types/careerHealth.ts
// TypeScript types for GET /api/v1/career-health response.
// All scored fields are nullable — only computed after resume is uploaded + processed.
//
// PHASE-4 UPDATE:
//   Added AiJobStatus for async job polling (GET /api/v1/ai-jobs/:jobId).
//   Added async fields to CareerHealthResponse for 202 flow.

export type GapPriority = 'critical' | 'high' | 'medium' | 'low';
export type DemandTrend = 'rising' | 'stable' | 'falling';

export interface SkillGapItem {
  skillName:   string;
  category:    string;
  yourLevel:   number | null; // 0-100, null if skill not detected in resume
  marketLevel: number;        // 0-100
  gap:         number;        // marketLevel - yourLevel (positive = you're behind)
  priority:    GapPriority;
}

export interface SalaryBenchmark {
  currency:     string;        // e.g. 'USD'
  yourEstimate: number | null;
  marketMedian: number;
  marketP25:    number;
  marketP75:    number;
  percentile:   number | null; // where user sits 0-100
}

export interface DemandMetric {
  skillName:   string;
  demandScore: number;        // 0-100
  trend:       DemandTrend;
  jobPostings: number;
}

// ─── Async job types (Phase 4) ────────────────────────────────────────────────

/** Job status document returned by GET /api/v1/ai-jobs/:jobId */
export interface AiJobStatus {
  jobId:         string;
  operationType: string;
  /** Lifecycle: pending → processing → completed | failed */
  status:        'pending' | 'processing' | 'completed' | 'failed';
  /** Populated when status === 'completed' */
  result:        CareerHealthResponse | null;
  /** Populated when status === 'failed' */
  error:         { code: string; message: string } | null;
  createdAt:     string;  // ISO 8601
  completedAt:   string | null;
}

// ─── Opportunity score ────────────────────────────────────────────────────────

/**
 * Portfolio-level opportunity score from GET /career-opportunities/score.
 * Aggregates the user's personalised radar signals into a single 0–100 number.
 */
export interface OpportunityScoreBreakdownItem {
  role:              string;
  opportunity_score: number;
  match_score:       number;
  rank:              number;
  growth_trend?:     string | null;
  skills_you_have?:  string[];
}

export interface OpportunityScoreResult {
  /** 0–100 composite portfolio score. Null if no signals available yet. */
  opportunity_score:  number | null;
  level:              'low' | 'moderate' | 'high' | null;
  signals_evaluated:  number;
  top_opportunity:    string | null;
  /** Top-3 signals driving the score, for tooltip / drill-down. */
  breakdown:          OpportunityScoreBreakdownItem[];
  message?:           string;
}

// ─── Automation risk ──────────────────────────────────────────────────────────

/**
 * Deterministic automation-risk assessment derived from the CHI dimension
 * scores already stored on the snapshot. No extra API call required.
 */
export interface AutomationRisk {
  /** 0–100, higher = more at risk. Clamped to [5, 95]. */
  score:          number;
  /** Human-readable severity band. */
  level:          'low' | 'moderate' | 'high';
  /** One-sentence actionable recommendation. */
  recommendation: string;
  /** Underlying dimension scores used in the calculation. */
  factors: {
    skillVelocity:   number;
    marketAlignment: number;
    experienceDepth: number;
  };
}

// ─── Career health response ───────────────────────────────────────────────────

export interface CareerHealthResponse {
  chiScore:        number | null;  // 0-100 overall Career Health Index
  skillGaps:       SkillGapItem[];
  salaryBenchmark: SalaryBenchmark | null;
  demandMetrics:   DemandMetric[];
  lastCalculated:  string | null;  // ISO 8601
  isReady:         boolean;        // false until resume processed

  /**
   * Deterministic automation-risk assessment.
   * Derived from CHI dimension scores — populated whenever a CHI snapshot
   * exists (isReady: true). Null before first CHI calculation.
   */
  automationRisk?: AutomationRisk | null;

  // ── AI-detected profession fields (from CV content, not keyword guessing) ──
  // Populated after CHI calculation. Use these to drive career path suggestions
  // so an Accountant gets accounting paths and a Doctor gets medical paths.
  detectedProfession?: string | null;  // e.g. 'Accountant', 'Software Engineer', 'Doctor'
  currentJobTitle?:    string | null;  // e.g. 'Senior Accountant', 'MBBS Resident'
  topSkills?:          string[] | null; // skills extracted directly from CV — available immediately

  // ── Phase-4 async job fields ─────────────────────────────────────────
  jobId?:   string;
  status?:  'pending' | 'processing' | 'completed' | 'failed';
  pollUrl?: string;
}