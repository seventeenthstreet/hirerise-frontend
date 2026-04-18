/**
 * @file avaCareerInsightService.ts
 * @description Generates Ava AI career insights for a success prediction result.
 *
 * Ava is a career strategist persona. She produces a concise explanation,
 * a list of the user's strengths, and specific actionable improvements —
 * all grounded in the concrete prediction data passed to her.
 *
 * Pure async service — no UI, no side-effects beyond the LLM call.
 * Reuses generateJSON from aiService.
 */

import { generateJSON } from '@/lib/services/aiService';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PredictionScoreBreakdown {
  skillMatch: number;
  atsFactor: number;
  experienceFit: number;
  marketDemand: number;
  interviewFactor: number;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** All inputs Ava needs to build a grounded, non-generic explanation. */
export interface AvaInsightInput {
  /** Final success probability (0–100). */
  probability: number;
  /** Core skills the user still needs to acquire. */
  missingSkills: string[];
  /** Estimated months to close all gaps. */
  timelineMonths: number;
  /** Market demand for the target role (0–1). */
  marketDemand: number;
  /** The role the user is targeting. */
  targetRole: string;
  /** Confidence band for the overall prediction. */
  confidenceLevel: ConfidenceLevel;
  /** Weighted score components for richer context. */
  scoreBreakdown: PredictionScoreBreakdown;
}

/** Structured Ava response. */
export interface AvaInsight {
  /**
   * Short, direct explanation of the probability (2–3 lines max).
   * References the user's actual data — no generic career advice.
   */
  explanation: string;
  /** 2–4 concrete strengths inferred from the score breakdown. */
  strengths: string[];
  /** 2–4 specific, actionable improvements tied to missing skills / score gaps. */
  improvements: string[];
}

// ---------------------------------------------------------------------------
// Internal: prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the Ava system + user prompt from structured prediction data.
 * Embedding real numbers directly into the prompt forces the LLM to reason
 * about this user's data rather than producing generic career platitudes.
 */
function buildAvaPrompt(input: AvaInsightInput): string {
  const {
    probability,
    missingSkills,
    timelineMonths,
    marketDemand,
    targetRole,
    confidenceLevel,
    scoreBreakdown,
  } = input;

  const demandLabel =
    marketDemand >= 0.75 ? 'very high' :
    marketDemand >= 0.5  ? 'moderate to high' :
    marketDemand >= 0.25 ? 'moderate' : 'low';

  const missingList =
    missingSkills.length > 0
      ? missingSkills.join(', ')
      : 'none — the candidate appears fully qualified';

  const timelineLabel =
    timelineMonths === 0
      ? 'ready now'
      : `approximately ${timelineMonths} month${timelineMonths === 1 ? '' : 's'}`;

  return `You are Ava, a career strategist AI. You speak directly, concisely, and with genuine insight.

PREDICTION DATA:
- Target role: ${targetRole}
- Success probability: ${probability.toFixed(1)}%
- Confidence level: ${confidenceLevel}
- Missing skills: ${missingList}
- Estimated readiness timeline: ${timelineLabel}
- Market demand for this role: ${demandLabel} (${(marketDemand * 100).toFixed(0)}%)
- Score breakdown:
  • Skill match:      ${(scoreBreakdown.skillMatch * 100).toFixed(0)}%
  • ATS factor:       ${(scoreBreakdown.atsFactor * 100).toFixed(0)}%
  • Experience fit:   ${(scoreBreakdown.experienceFit * 100).toFixed(0)}%
  • Interview factor: ${(scoreBreakdown.interviewFactor * 100).toFixed(0)}%
  • Market demand:    ${(scoreBreakdown.marketDemand * 100).toFixed(0)}%

RULES:
1. Return ONLY valid JSON — no prose, no markdown fences, no preamble.
2. "explanation" must be 2–3 sentences maximum. Reference the actual probability, role, and market demand. Do NOT use generic phrases like "hard work pays off" or "believe in yourself".
3. "strengths" must be 2–4 items derived from score components that are ≥ 60%. Be specific — name the component and say why it matters for ${targetRole}.
4. "improvements" must be 2–4 items. Each must name a specific missing skill (from the list above) or a weak score component, and give ONE concrete action to address it. No vague advice.
5. If missingSkills is empty, improvements should focus on score components below 70%.
6. Tone: direct, encouraging but honest, professional.

JSON SCHEMA:
{
  "explanation": "string (2–3 sentences)",
  "strengths": ["string", "..."],
  "improvements": ["string", "..."]
}`;
}

// ---------------------------------------------------------------------------
// Internal: response validator / normaliser
// ---------------------------------------------------------------------------

/**
 * Validates and normalises the raw LLM JSON output into a clean AvaInsight.
 * Falls back gracefully for each field rather than throwing.
 */
function normaliseAvaResponse(
  raw: unknown,
  input: AvaInsightInput
): AvaInsight {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const explanation =
    typeof obj.explanation === 'string' && obj.explanation.trim().length > 10
      ? obj.explanation.trim()
      : `Your probability of transitioning to ${input.targetRole} is ${input.probability.toFixed(1)}%. ` +
        (input.missingSkills.length > 0
          ? `Closing the gaps in ${input.missingSkills.slice(0, 2).join(' and ')} will have the biggest impact.`
          : 'Your profile is well-aligned with this role.');

  const strengths: string[] = Array.isArray(obj.strengths)
    ? obj.strengths
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 4)
    : buildFallbackStrengths(input.scoreBreakdown, input.targetRole);

  const improvements: string[] = Array.isArray(obj.improvements)
    ? obj.improvements
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 4)
    : buildFallbackImprovements(input.missingSkills, input.scoreBreakdown);

  return { explanation, strengths, improvements };
}

/**
 * Generates basic strength bullets from score breakdown when the LLM fails.
 */
function buildFallbackStrengths(
  breakdown: PredictionScoreBreakdown,
  targetRole: string
): string[] {
  const strengths: string[] = [];
  if (breakdown.skillMatch >= 0.6)
    strengths.push(`Strong skill alignment with ${targetRole} requirements (${(breakdown.skillMatch * 100).toFixed(0)}% match).`);
  if (breakdown.atsFactor >= 0.6)
    strengths.push(`Competitive ATS profile (${(breakdown.atsFactor * 100).toFixed(0)}%) — your CV is likely to pass automated screening.`);
  if (breakdown.experienceFit >= 0.6)
    strengths.push(`Experience level meets or exceeds the role minimum (${(breakdown.experienceFit * 100).toFixed(0)}% fit).`);
  if (breakdown.interviewFactor >= 0.6)
    strengths.push(`Above-average interview performance (${(breakdown.interviewFactor * 100).toFixed(0)}%) gives you an edge over similarly-skilled candidates.`);
  return strengths.length > 0 ? strengths : [`Your overall profile is competitive for ${targetRole}.`];
}

/**
 * Generates basic improvement bullets from missing skills when the LLM fails.
 */
function buildFallbackImprovements(
  missingSkills: string[],
  breakdown: PredictionScoreBreakdown
): string[] {
  const improvements: string[] = missingSkills
    .slice(0, 3)
    .map((skill) => `Build hands-on experience in ${skill} through a focused project or course.`);

  if (improvements.length < 2 && breakdown.atsFactor < 0.6) {
    improvements.push('Optimise your CV keywords to improve ATS screening pass rate.');
  }
  if (improvements.length < 2 && breakdown.interviewFactor < 0.6) {
    improvements.push('Practice structured behavioural interviews (STAR format) to improve your interview score.');
  }

  return improvements.length > 0
    ? improvements
    : ['Continue building domain-specific experience to strengthen your candidacy.'];
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Calls the LLM (Ava persona) and returns a structured career insight.
 *
 * Uses the `'capable'` model tier with a tight token budget (400) to keep
 * latency low — Ava's output is intentionally concise.
 *
 * Validates and normalises the LLM response; never throws to the caller.
 *
 * @param input - Prediction data to ground Ava's response.
 * @returns A validated {@link AvaInsight} with explanation, strengths, and improvements.
 */
export async function buildAvaExplanation(input: AvaInsightInput): Promise<AvaInsight> {
  const prompt = buildAvaPrompt(input);

  const raw = await generateJSON(prompt, 'capable', 400);
  return normaliseAvaResponse(raw, input);
}