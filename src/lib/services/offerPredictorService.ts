/**
 * @file offerPredictorService.ts
 * @description Offer Probability Predictor engine.
 *
 * Combines job match, ATS, interview, skill match, experience fit, and market
 * competition signals into a single deterministic offer probability score.
 *
 * Pure functions only — no UI, no API, no side-effects.
 * Designed to consume outputs already produced by the ATS, Job Match, and
 * Interview systems — does NOT re-implement their logic.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Confidence band derived from the final probability score. */
export type OfferConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * All inputs required to run an offer probability prediction.
 *
 * Scores that represent percentages (jobMatchScore, atsScore, interviewScore)
 * are accepted on a 0–100 scale and normalised internally.
 * Ratios (skillMatch, experienceFit, marketCompetition) are accepted on a 0–1
 * scale and used directly after clamping.
 */
export interface PredictOfferProbabilityInput {
  /**
   * Overall job match score from the Job Match system.
   * Scale: 0–100.
   */
  jobMatchScore: number;

  /**
   * ATS (Applicant Tracking System) screening score.
   * Scale: 0–100.
   */
  atsScore: number;

  /**
   * Interview performance score.
   * Scale: 0–100.
   */
  interviewScore: number;

  /**
   * Proportion of role's required skills the candidate already has.
   * Scale: 0–1.
   */
  skillMatch: number;

  /**
   * How well the candidate's experience fits the role's minimum requirement.
   * Scale: 0–1.
   */
  experienceFit: number;

  /**
   * How competitive the market is for this role (higher = more competition).
   * Scale: 0–1. Used as (1 − marketCompetition) in the formula.
   */
  marketCompetition: number;

  /**
   * Optional list of skills the candidate is missing for the target role.
   * When provided, missing skills that are flagged as critical drive a risk factor.
   */
  missingSkills?: string[];

  /**
   * Optional threshold below which an ATS score is considered a risk.
   * Defaults to 50.
   */
  atsRiskThreshold?: number;

  /**
   * Optional threshold below which an interview score is considered a risk.
   * Defaults to 50.
   */
  interviewRiskThreshold?: number;
}

/** Weighted factor breakdown for transparency and debugging. */
export interface OfferScoreBreakdown {
  /** jobMatchScore / 100, clamped to 0–1. */
  jobMatchFactor: number;
  /** atsScore / 100, clamped to 0–1. */
  atsFactor: number;
  /** interviewScore / 100, clamped to 0–1. */
  interviewFactor: number;
  /** skillMatch, clamped to 0–1. */
  skillMatch: number;
  /** experienceFit, clamped to 0–1. */
  experienceFit: number;
  /** (1 − marketCompetition), clamped to 0–1. */
  marketAdvantage: number;
}

/** Full prediction result returned by {@link predictOfferProbability}. */
export interface OfferPrediction {
  /**
   * Estimated offer probability as a percentage (0–100).
   * Rounded to one decimal place.
   */
  probability: number;

  /**
   * Confidence band:
   * - `high`   → probability > 75
   * - `medium` → probability 50–75
   * - `low`    → probability < 50
   */
  confidenceLevel: OfferConfidenceLevel;

  /**
   * List of identified risk factors that could reduce offer probability.
   * Empty when no significant risks are detected.
   */
  riskFactors: string[];

  /** Weighted factor breakdown for UI display or debugging. */
  scoreBreakdown: OfferScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Weights must sum exactly to 1.0.
 *
 * jobMatch    0.30  — primary signal from the Job Match system
 * ats         0.20  — ATS screening pass quality
 * interview   0.25  — strongest single human-evaluated signal
 * skillMatch  0.10  — overlap with role requirements
 * experience  0.10  — seniority fit
 * market      0.05  — external competition advantage (lower competition = better)
 */
const WEIGHTS = {
  jobMatch:   0.30,
  ats:        0.20,
  interview:  0.25,
  skillMatch: 0.10,
  experience: 0.10,
  market:     0.05,
} as const;

/** Default score thresholds below which a factor is flagged as a risk. */
const DEFAULTS = {
  atsRiskThreshold:         50,
  interviewRiskThreshold:   50,
  lowSkillMatchThreshold:   0.5,
  lowExperienceThreshold:   0.5,
  highCompetitionThreshold: 0.75,
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalises a 0–100 score to a 0–1 factor, clamping out-of-range inputs.
 */
function normaliseCentScore(score: number): number {
  return clamp(score, 0, 100) / 100;
}

/**
 * Derives an {@link OfferConfidenceLevel} from a probability percentage.
 *
 * Thresholds per spec:
 * - > 75  → `high`
 * - 50–75 → `medium`
 * - < 50  → `low`
 */
function deriveConfidenceLevel(probability: number): OfferConfidenceLevel {
  if (probability > 75) return 'high';
  if (probability >= 50) return 'medium';
  return 'low';
}

/**
 * Identifies risk factors from normalised input signals.
 * Each returned string is a plain-English description suitable for direct
 * display in UI or downstream AI prompts.
 */
function identifyRiskFactors(
  input: PredictOfferProbabilityInput,
  breakdown: OfferScoreBreakdown
): string[] {
  const risks: string[] = [];

  const atsThreshold       = input.atsRiskThreshold       ?? DEFAULTS.atsRiskThreshold;
  const interviewThreshold = input.interviewRiskThreshold ?? DEFAULTS.interviewRiskThreshold;

  // --- ATS risk ---
  if (input.atsScore < atsThreshold) {
    risks.push(
      `Low ATS score (${input.atsScore.toFixed(0)}/100) — your CV may not be passing automated ` +
      `screening. Optimise keywords against the job description.`
    );
  }

  // --- Interview risk ---
  if (input.interviewScore < interviewThreshold) {
    risks.push(
      `Low interview score (${input.interviewScore.toFixed(0)}/100) — interview performance is ` +
      `the single highest-weighted factor. Structured preparation (STAR format) will have the greatest impact.`
    );
  }

  // --- Missing critical skills ---
  const missingSkills = input.missingSkills ?? [];
  if (missingSkills.length > 0) {
    const listed   = missingSkills.slice(0, 4).join(', ');
    const overflow = missingSkills.length > 4 ? ` (+${missingSkills.length - 4} more)` : '';
    risks.push(
      `Missing ${missingSkills.length} critical skill${missingSkills.length > 1 ? 's' : ''}: ` +
      `${listed}${overflow}. Each gap directly reduces your probability.`
    );
  }

  // --- Low skill match (no explicit missing skills list provided) ---
  if (breakdown.skillMatch < DEFAULTS.lowSkillMatchThreshold && missingSkills.length === 0) {
    risks.push(
      `Skill match is below 50% — you may be missing several role requirements. ` +
      `Review the job description and close the most critical gaps first.`
    );
  }

  // --- Low experience fit ---
  if (breakdown.experienceFit < DEFAULTS.lowExperienceThreshold) {
    risks.push(
      `Experience fit is below 50% — you may not yet meet the role's minimum experience ` +
      `requirement. Consider targeting a stepping-stone role first.`
    );
  }

  // --- High market competition ---
  if (input.marketCompetition > DEFAULTS.highCompetitionThreshold) {
    risks.push(
      `High market competition (${Math.round(input.marketCompetition * 100)}% saturation) — ` +
      `more candidates are competing for this role. Focus on differentiating your application.`
    );
  }

  return risks;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Predicts the probability of receiving a job offer for a given application.
 *
 * ### Scoring formula
 * ```
 * probability =
 *   jobMatchFactor  * 0.30
 * + atsFactor       * 0.20
 * + interviewFactor * 0.25
 * + skillMatch      * 0.10
 * + experienceFit   * 0.10
 * + (1 − marketCompetition) * 0.05
 * ```
 * Result is expressed as 0–100, rounded to 1 decimal place.
 *
 * @param input - All factors needed for the prediction.
 * @returns An {@link OfferPrediction} with probability, confidence, risk factors,
 *   and the intermediate score breakdown.
 *
 * @example
 * ```ts
 * const result = predictOfferProbability({
 *   jobMatchScore:     82,
 *   atsScore:          74,
 *   interviewScore:    68,
 *   skillMatch:        0.78,
 *   experienceFit:     0.90,
 *   marketCompetition: 0.60,
 *   missingSkills:     ['Kubernetes'],
 * });
 * // result.probability      → e.g. 73.6
 * // result.confidenceLevel  → 'medium'
 * // result.riskFactors      → ['Missing critical skill: Kubernetes...']
 * ```
 */
export function predictOfferProbability(
  input: PredictOfferProbabilityInput
): OfferPrediction {
  // ------------------------------------------------------------------
  // Normalise all inputs to 0–1
  // ------------------------------------------------------------------
  const jobMatchFactor  = normaliseCentScore(input.jobMatchScore);
  const atsFactor       = normaliseCentScore(input.atsScore);
  const interviewFactor = normaliseCentScore(input.interviewScore);
  const skillMatch      = clamp(input.skillMatch,            0, 1);
  const experienceFit   = clamp(input.experienceFit,         0, 1);
  const marketAdvantage = clamp(1 - input.marketCompetition, 0, 1);

  const breakdown: OfferScoreBreakdown = {
    jobMatchFactor,
    atsFactor,
    interviewFactor,
    skillMatch,
    experienceFit,
    marketAdvantage,
  };

  // ------------------------------------------------------------------
  // Weighted probability (0–1 space)
  // ------------------------------------------------------------------
  const rawScore =
    jobMatchFactor  * WEIGHTS.jobMatch   +
    atsFactor       * WEIGHTS.ats        +
    interviewFactor * WEIGHTS.interview  +
    skillMatch      * WEIGHTS.skillMatch +
    experienceFit   * WEIGHTS.experience +
    marketAdvantage * WEIGHTS.market;

  // Convert to 0–100, rounded to 1 d.p.
  const probability = Math.round(clamp(rawScore, 0, 1) * 1000) / 10;

  // ------------------------------------------------------------------
  // Confidence level & risk factors
  // ------------------------------------------------------------------
  const confidenceLevel = deriveConfidenceLevel(probability);
  const riskFactors     = identifyRiskFactors(input, breakdown);

  return {
    probability,
    confidenceLevel,
    riskFactors,
    scoreBreakdown: breakdown,
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Returns the single highest-impact improvement the candidate can make,
 * derived from the weakest weighted factor in the breakdown.
 *
 * Useful for surfacing a focused CTA in UI or AI-generated advice.
 */
export function getTopImprovementFactor(
  breakdown: OfferScoreBreakdown
): { factor: string; currentScore: number; weightedImpact: number } {
  const candidates = [
    { factor: 'Interview Performance', score: breakdown.interviewFactor,  weight: WEIGHTS.interview  },
    { factor: 'Job Match Score',       score: breakdown.jobMatchFactor,   weight: WEIGHTS.jobMatch   },
    { factor: 'ATS Score',             score: breakdown.atsFactor,        weight: WEIGHTS.ats        },
    { factor: 'Skill Match',           score: breakdown.skillMatch,       weight: WEIGHTS.skillMatch },
    { factor: 'Experience Fit',        score: breakdown.experienceFit,    weight: WEIGHTS.experience },
    { factor: 'Market Advantage',      score: breakdown.marketAdvantage,  weight: WEIGHTS.market     },
  ];

  // Rank by potential gain = weight × (1 − current score)
  const top = candidates
    .map((f) => ({ ...f, potentialGain: f.weight * (1 - f.score) }))
    .sort((a, b) => b.potentialGain - a.potentialGain)[0];

  return {
    factor:         top.factor,
    currentScore:   Math.round(top.score * 100),
    weightedImpact: Math.round(top.potentialGain * 100),
  };
}

/**
 * Returns a plain-English summary of the prediction result.
 *
 * @example
 * "Strong application (78.2%) — you have a high chance of receiving an offer."
 * "Competitive application (61.0%) — address key risk factors to improve your odds."
 * "Weak application (38.5%) — significant gaps remain before this role is within reach."
 */
export function summariseOfferPrediction(prediction: OfferPrediction): string {
  const pct = `${prediction.probability.toFixed(1)}%`;
  switch (prediction.confidenceLevel) {
    case 'high':
      return `Strong application (${pct}) — you have a high chance of receiving an offer.`;
    case 'medium':
      return `Competitive application (${pct}) — address key risk factors to improve your odds.`;
    case 'low':
      return `Weak application (${pct}) — significant gaps remain before this role is within reach.`;
  }
}

/**
 * Returns `true` when the prediction carries no identified risk factors.
 */
export function isCleanApplication(prediction: OfferPrediction): boolean {
  return prediction.riskFactors.length === 0;
}