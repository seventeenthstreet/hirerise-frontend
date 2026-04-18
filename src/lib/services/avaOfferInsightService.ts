/**
 * @file avaOfferInsightService.ts
 * @description Generates Ava AI insights for a job offer probability prediction.
 *
 * Ava acts as a career strategist: she explains the user's offer chances,
 * gives specific improvements, and recommends a practical strategy — all
 * grounded in the real prediction data passed in.
 *
 * Pure async service — no UI, no side-effects beyond the LLM call.
 */

import { generateJSON } from '@/lib/services/aiService';

// ---------------------------------------------------------------------------
// Public types (inlined — no cross-service import dependencies)
// ---------------------------------------------------------------------------

/** Confidence band for an offer prediction. */
export type OfferConfidenceLevel = 'low' | 'medium' | 'high';

/** Structured Ava response for an offer prediction. */
export interface AvaOfferInsight {
  /**
   * Short, direct explanation of the offer probability (≤2 lines).
   * References real numbers — no generic career advice.
   */
  explanation: string;

  /**
   * 2–4 specific, actionable improvements the candidate can make
   * to increase their offer probability before the next application.
   */
  improvements: string[];

  /**
   * 2–4 practical strategy items (e.g. apply to more roles, target a
   * stepping-stone role, negotiate timing, improve interview prep).
   */
  strategy: string[];
}

/** All inputs Ava needs to build a grounded offer insight. */
export interface AvaOfferInsightInput {
  /** Final offer probability (0–100). */
  probability: number;
  /** Confidence band for the prediction. */
  confidenceLevel: OfferConfidenceLevel;
  /** Risk factors identified by the predictor engine. */
  riskFactors: string[];
  /** Job match score (0–100). */
  jobMatchScore: number;
  /** Interview performance score (0–100). */
  interviewScore: number;
  /** ATS screening score (0–100). */
  atsScore: number;
  /** Role the user is applying for. */
  targetRole: string;
  /** Market competition level (0–1). */
  marketCompetition: number;
}

// ---------------------------------------------------------------------------
// Internal: prompt builder
// ---------------------------------------------------------------------------

function buildAvaOfferPrompt(input: AvaOfferInsightInput): string {
  const {
    probability,
    confidenceLevel,
    riskFactors,
    jobMatchScore,
    interviewScore,
    atsScore,
    targetRole,
    marketCompetition,
  } = input;

  const competitionLabel =
    marketCompetition >= 0.75 ? 'highly competitive' :
    marketCompetition >= 0.5  ? 'moderately competitive' :
    marketCompetition >= 0.25 ? 'low competition' : 'very low competition';

  const riskList =
    riskFactors.length > 0
      ? riskFactors.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
      : '  None identified — strong application.';

  return `You are Ava, a career strategist AI. You are direct, specific, and practical.

OFFER PREDICTION DATA:
- Target role: ${targetRole}
- Offer probability: ${probability.toFixed(1)}%
- Confidence level: ${confidenceLevel}
- Job match score: ${jobMatchScore.toFixed(0)}/100
- ATS score: ${atsScore.toFixed(0)}/100
- Interview score: ${interviewScore.toFixed(0)}/100
- Market competition: ${competitionLabel} (${(marketCompetition * 100).toFixed(0)}%)

IDENTIFIED RISK FACTORS:
${riskList}

RULES:
1. Return ONLY valid JSON — no prose, no markdown fences, no preamble.
2. "explanation" must be 1–2 sentences MAX. Reference the actual probability and the single biggest risk. No generic phrases like "keep working hard".
3. "improvements" must be 2–4 items. Each must be a concrete action tied to a specific weak signal above (ATS, interview, job match, or a named risk factor). Not vague.
4. "strategy" must be 2–4 items. Practical next steps: e.g. "Apply to 3 more roles in parallel to hedge", "Target a mid-level role as a stepping stone", "Request interview feedback before reapplying". Not generic advice.
5. If probability > 75: tone is affirming but still gives 1–2 sharpening tips.
6. If probability < 50: tone is honest, not discouraging — focus on the highest-leverage fixes.
7. Never repeat the same idea across improvements and strategy.

JSON SCHEMA:
{
  "explanation": "string (1–2 sentences)",
  "improvements": ["string", "string"],
  "strategy": ["string", "string"]
}`;
}

// ---------------------------------------------------------------------------
// Internal: response normaliser
// ---------------------------------------------------------------------------

function normaliseAvaOfferResponse(
  raw: unknown,
  input: AvaOfferInsightInput
): AvaOfferInsight {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // explanation
  const explanation =
    typeof obj.explanation === 'string' && obj.explanation.trim().length > 10
      ? obj.explanation.trim()
      : buildFallbackExplanation(input);

  // improvements
  const improvements: string[] =
    Array.isArray(obj.improvements)
      ? obj.improvements
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 4)
      : buildFallbackImprovements(input);

  // strategy
  const strategy: string[] =
    Array.isArray(obj.strategy)
      ? obj.strategy
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 4)
      : buildFallbackStrategy(input);

  return { explanation, improvements, strategy };
}

// ---------------------------------------------------------------------------
// Internal: deterministic fallbacks
// ---------------------------------------------------------------------------

function buildFallbackExplanation(input: AvaOfferInsightInput): string {
  const { probability, targetRole, riskFactors } = input;
  const topRisk =
    riskFactors.length > 0
      ? ` The biggest blocker is: ${riskFactors[0].split('—')[0].trim()}.`
      : '';
  return `Your current offer probability for ${targetRole} is ${probability.toFixed(1)}%.${topRisk}`;
}

function buildFallbackImprovements(input: AvaOfferInsightInput): string[] {
  const items: string[] = [];
  if (input.atsScore < 60) {
    items.push(
      `Your ATS score is ${input.atsScore.toFixed(0)}/100 — rewrite your CV headline and skills section to mirror the exact keywords in this job description.`
    );
  }
  if (input.interviewScore < 60) {
    items.push(
      `Your interview score is ${input.interviewScore.toFixed(0)}/100 — practise 3 role-specific STAR stories covering leadership, problem-solving, and cross-team collaboration.`
    );
  }
  if (input.jobMatchScore < 60) {
    items.push(
      `Your job match score is ${input.jobMatchScore.toFixed(0)}/100 — address the top 2–3 skill gaps in the job description before reapplying.`
    );
  }
  if (items.length === 0) {
    items.push(`Strengthen the weakest scoring factor to push past the ${input.probability.toFixed(0)}% mark.`);
  }
  return items.slice(0, 4);
}

function buildFallbackStrategy(input: AvaOfferInsightInput): string[] {
  const items: string[] = [];
  if (input.probability < 50) {
    items.push(`Target 2–3 stepping-stone roles where your job match score would exceed 75% before reapplying to this one.`);
  }
  if (input.marketCompetition > 0.6) {
    items.push(`Apply to at least 4–5 parallel roles — high competition means you need volume to improve offer odds.`);
  }
  if (input.interviewScore < 65) {
    items.push(`Schedule a mock interview this week — interview performance carries a 25% weight in your offer score.`);
  }
  if (items.length < 2) {
    items.push(`Follow up with the hiring manager 5–7 days after your interview to reinforce your interest and stay top of mind.`);
  }
  return items.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Calls the LLM (Ava persona) and returns structured offer insight.
 *
 * Uses the `'capable'` model tier with a tight token budget (350) to keep
 * latency minimal — Ava's output is intentionally concise.
 *
 * Never throws to the caller — LLM failures produce deterministic fallback output.
 *
 * @param input - Offer prediction data to ground Ava's response.
 * @returns A validated {@link AvaOfferInsight}.
 */
export async function buildAvaOfferInsight(
  input: AvaOfferInsightInput
): Promise<AvaOfferInsight> {
  const prompt = buildAvaOfferPrompt(input);

  try {
    const raw = await generateJSON(prompt, 'capable', 350);
    return normaliseAvaOfferResponse(raw, input);
  } catch {
    return {
      explanation:  buildFallbackExplanation(input),
      improvements: buildFallbackImprovements(input),
      strategy:     buildFallbackStrategy(input),
    };
  }
}