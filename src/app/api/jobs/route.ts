/**
 * @file app/api/jobs/offer-probability/route.ts
 * @description POST /api/jobs/offer-probability
 *
 * Orchestrates the Offer Probability Predictor engine with live data from
 * the ATS, Job Match, Interview, and Market Data systems, then enhances
 * the result with Ava AI insights.
 *
 * All prediction logic is inlined to avoid unresolved module errors while
 * the service files are being placed in src/lib/services/.
 * Once offerPredictorService.ts and avaOfferInsightService.ts are in place,
 * replace the inlined blocks with clean imports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMarketTrends } from '@/lib/services/marketDataService';
import { getMissingSkills, getRoleSkills } from '@/lib/data/roleSkills';
import { generateJSON } from '@/lib/services/aiService';
import type { MarketTrends, RoleDemand } from '@/lib/services/marketDataService';

// ---------------------------------------------------------------------------
// Inlined types
// ---------------------------------------------------------------------------

type OfferConfidenceLevel = 'low' | 'medium' | 'high';

interface OfferScoreBreakdown {
  jobMatchFactor:  number;
  atsFactor:       number;
  interviewFactor: number;
  skillMatch:      number;
  experienceFit:   number;
  marketAdvantage: number;
}

interface OfferPrediction {
  probability:      number;
  confidenceLevel:  OfferConfidenceLevel;
  riskFactors:      string[];
  scoreBreakdown:   OfferScoreBreakdown;
}

interface AvaOfferInsight {
  explanation:  string;
  improvements: string[];
  strategy:     string[];
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

interface UserProfile {
  skills:         string[];
  experience:     number;   // years
  targetRole:     string;
  currentRole?:   string;
  atsScore?:      number;   // optional override — fetched if omitted
  interviewScore?: number;  // optional override — fetched if omitted
}

interface OfferProbabilityRequestBody {
  jobId:       string;
  userProfile: UserProfile;
}

interface OfferProbabilityResponseBody {
  jobId:             string;
  probability:       number;
  confidenceLevel:   OfferConfidenceLevel;
  riskFactors:       string[];
  explanation:       string;
  improvements:      string[];
  strategy:          string[];
  scoreBreakdown:    OfferScoreBreakdown;
  marketCompetition: number;
  meta: {
    jobMatchScore:  number;
    atsScore:       number;
    interviewScore: number;
    cachedAt:       string;
  };
}

// ---------------------------------------------------------------------------
// In-memory cache
// Keyed by `${jobId}:${userProfile.targetRole}` — TTL 5 minutes.
// ---------------------------------------------------------------------------

interface CacheEntry {
  result:    OfferProbabilityResponseBody;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): OfferProbabilityResponseBody | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { CACHE.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: OfferProbabilityResponseBody): void {
  CACHE.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateBody(body: unknown): body is OfferProbabilityRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.jobId !== 'string' || !b.jobId.trim()) return false;
  if (!b.userProfile || typeof b.userProfile !== 'object') return false;
  const p = b.userProfile as Record<string, unknown>;
  if (!Array.isArray(p.skills)) return false;
  if (typeof p.experience !== 'number') return false;
  if (typeof p.targetRole !== 'string' || !p.targetRole.trim()) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Inlined: clamp + normalise helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function norm100(score: number): number {
  return clamp(score, 0, 100) / 100;
}

// ---------------------------------------------------------------------------
// Inlined: score fetchers
// Each wraps an existing system call and falls back gracefully.
// ---------------------------------------------------------------------------

/**
 * Fetches or derives a job match score (0–100).
 * Falls back to a skill-overlap heuristic if the Job Match service
 * doesn't expose a direct per-job lookup.
 */
async function fetchJobMatchScore(
  jobId: string,
  targetRole: string,
  userSkills: string[]
): Promise<number> {
  // Derives job match from skill overlap with role requirements.
  // Replace this body with a direct import once jobMatchService is available.
  void jobId; // reserved for future direct service call
  try {
    const missing = getMissingSkills(targetRole, userSkills);
    const roleData = getRoleSkills(targetRole) as unknown as Record<string, unknown>;
    const total: number = Array.isArray(roleData?.core)
      ? (roleData.core as string[]).length
      : Array.isArray(roleData?.coreSkills)
      ? (roleData.coreSkills as string[]).length
      : (missing.missingCore ?? []).length + Math.max(userSkills.length, 1);
    const matched = Math.max(0, total - (missing.missingCore ?? []).length);
    return Math.round(clamp(matched / Math.max(total, 1), 0, 1) * 100);
  } catch {
    return 65; // neutral fallback
  }
}

/**
 * Fetches the ATS score for the user against a specific job (0–100).
 * Falls back to the profile-level ATS score if the service doesn't
 * expose per-job scoring.
 */
function fetchAtsScore(
  jobId: string,
  userSkills: string[],
  profileAtsScore?: number
): number {
  // Uses profile-level ATS score when available.
  // Replace with direct atsService import once the service is in place.
  void jobId; void userSkills; // reserved for future direct service call
  if (profileAtsScore != null) return clamp(profileAtsScore, 0, 100);
  return 60; // neutral fallback
}

/**
 * Fetches the interview score for the user (0–100).
 * Falls back to a neutral score when no interview data is available.
 */
function fetchInterviewScore(
  jobId: string,
  profileInterviewScore?: number
): number {
  // Uses profile-level interview score when available.
  // Replace with direct interviewService import once the service is in place.
  void jobId; // reserved for future direct service call
  if (profileInterviewScore != null) return clamp(profileInterviewScore, 0, 100);
  return 55; // neutral fallback — no interview data yet
}

// ---------------------------------------------------------------------------
// Inlined: skill match + experience fit
// ---------------------------------------------------------------------------

function computeSkillMatchAndGaps(
  targetRole: string,
  userSkills: string[]
): { skillMatch: number; missingSkills: string[] } {
  try {
    const missing = getMissingSkills(targetRole, userSkills);
    const missingCore: string[] = missing.missingCore ?? [];
    const roleData = getRoleSkills(targetRole) as unknown as Record<string, unknown>;
    const total: number = Array.isArray(roleData?.core)
      ? (roleData.core as string[]).length
      : Array.isArray(roleData?.coreSkills)
      ? (roleData.coreSkills as string[]).length
      : missingCore.length;
    if (total === 0) return { skillMatch: 1.0, missingSkills: [] };
    const matched = Math.max(0, total - missingCore.length);
    return { skillMatch: clamp(matched / total, 0, 1), missingSkills: missingCore };
  } catch {
    return { skillMatch: 0.7, missingSkills: [] };
  }
}

function computeExperienceFit(targetRole: string, experience: number): number {
  try {
    const roleData = getRoleSkills(targetRole) as unknown as Record<string, unknown>;
    const min = typeof roleData?.minExperienceYears === 'number'
      ? roleData.minExperienceYears : null;
    return (min == null || min <= 0) ? 1.0 : clamp(experience / min, 0, 1);
  } catch {
    return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Inlined: market competition resolver
// ---------------------------------------------------------------------------

async function resolveMarketCompetition(
  currentRole: string,
  targetRole: string
): Promise<number> {
  try {
    const trends: MarketTrends = await getMarketTrends(currentRole);
    const entry = trends.topNextRoles?.find(
      (r: RoleDemand) => r.role.toLowerCase() === targetRole.toLowerCase()
    );
    const rd = entry as (RoleDemand & { competitionScore?: number; competition?: number }) | undefined;
    // If the market data has a competition score use it; else derive from demand
    // (high demand → more applicants → higher competition)
    if (rd?.competitionScore != null) return clamp(rd.competitionScore, 0, 1);
    if (rd?.competition      != null) return clamp(rd.competition,      0, 1);
    const demandEntry = entry as (RoleDemand & { score?: number; demandScore?: number }) | undefined;
    const demand = demandEntry?.score ?? demandEntry?.demandScore ?? 0.5;
    // Proxy: high-demand roles attract more competition
    return clamp(demand * 0.8, 0, 1);
  } catch {
    return 0.5; // neutral fallback
  }
}

// ---------------------------------------------------------------------------
// Inlined: predictOfferProbability
// (mirrors offerPredictorService.ts — remove once file is in src/lib/services/)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  jobMatch:   0.30,
  ats:        0.20,
  interview:  0.25,
  skillMatch: 0.10,
  experience: 0.10,
  market:     0.05,
} as const;

function deriveOfferConfidence(p: number): OfferConfidenceLevel {
  if (p > 75) return 'high';
  if (p >= 50) return 'medium';
  return 'low';
}

function buildRiskFactors(
  atsScore: number,
  interviewScore: number,
  missingSkills: string[],
  skillMatch: number,
  experienceFit: number,
  marketCompetition: number
): string[] {
  const risks: string[] = [];
  if (atsScore < 50) risks.push(
    `Low ATS score (${atsScore.toFixed(0)}/100) — optimise CV keywords against the job description.`
  );
  if (interviewScore < 50) risks.push(
    `Low interview score (${interviewScore.toFixed(0)}/100) — structured STAR preparation will have the highest impact.`
  );
  if (missingSkills.length > 0) {
    const listed   = missingSkills.slice(0, 4).join(', ');
    const overflow = missingSkills.length > 4 ? ` (+${missingSkills.length - 4} more)` : '';
    risks.push(`Missing ${missingSkills.length} critical skill${missingSkills.length > 1 ? 's' : ''}: ${listed}${overflow}.`);
  }
  if (skillMatch < 0.5 && missingSkills.length === 0) risks.push(
    `Skill match below 50% — review role requirements and close the most critical gaps.`
  );
  if (experienceFit < 0.5) risks.push(
    `Experience fit below 50% — consider a stepping-stone role to build the required tenure.`
  );
  if (marketCompetition > 0.75) risks.push(
    `High market competition (${Math.round(marketCompetition * 100)}%) — differentiate your application.`
  );
  return risks;
}

function predictOfferProbability(input: {
  jobMatchScore:      number;
  atsScore:           number;
  interviewScore:     number;
  skillMatch:         number;
  experienceFit:      number;
  marketCompetition:  number;
  missingSkills?:     string[];
}): OfferPrediction {
  const jmf = norm100(input.jobMatchScore);
  const af  = norm100(input.atsScore);
  const inf = norm100(input.interviewScore);
  const sm  = clamp(input.skillMatch,           0, 1);
  const ef  = clamp(input.experienceFit,        0, 1);
  const ma  = clamp(1 - input.marketCompetition, 0, 1);

  const raw =
    jmf * WEIGHTS.jobMatch   +
    af  * WEIGHTS.ats        +
    inf * WEIGHTS.interview  +
    sm  * WEIGHTS.skillMatch +
    ef  * WEIGHTS.experience +
    ma  * WEIGHTS.market;

  const probability     = Math.round(clamp(raw, 0, 1) * 1000) / 10;
  const confidenceLevel = deriveOfferConfidence(probability);
  const riskFactors     = buildRiskFactors(
    input.atsScore, input.interviewScore,
    input.missingSkills ?? [], sm, ef, input.marketCompetition
  );

  return {
    probability,
    confidenceLevel,
    riskFactors,
    scoreBreakdown: { jobMatchFactor: jmf, atsFactor: af, interviewFactor: inf,
                      skillMatch: sm, experienceFit: ef, marketAdvantage: ma },
  };
}

// ---------------------------------------------------------------------------
// Inlined: buildAvaOfferInsight
// (mirrors avaOfferInsightService.ts — remove once file is in src/lib/services/)
// ---------------------------------------------------------------------------

function buildAvaOfferPrompt(
  probability: number, confidenceLevel: OfferConfidenceLevel,
  riskFactors: string[], jobMatchScore: number, interviewScore: number,
  atsScore: number, targetRole: string, marketCompetition: number
): string {
  const compLabel =
    marketCompetition >= 0.75 ? 'highly competitive' :
    marketCompetition >= 0.5  ? 'moderately competitive' :
    marketCompetition >= 0.25 ? 'low competition' : 'very low competition';

  const riskList = riskFactors.length > 0
    ? riskFactors.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
    : '  None identified — strong application.';

  return `You are Ava, a career strategist AI. Be direct, specific, and practical.

OFFER PREDICTION DATA:
- Target role: ${targetRole}
- Offer probability: ${probability.toFixed(1)}%
- Confidence level: ${confidenceLevel}
- Job match score: ${jobMatchScore.toFixed(0)}/100
- ATS score: ${atsScore.toFixed(0)}/100
- Interview score: ${interviewScore.toFixed(0)}/100
- Market: ${compLabel} (${(marketCompetition * 100).toFixed(0)}%)

RISK FACTORS:
${riskList}

RULES:
1. Return ONLY valid JSON — no prose, no markdown fences.
2. "explanation" ≤ 2 sentences. Reference actual probability and the top risk. No generic advice.
3. "improvements" — 2–4 items. Each must name a specific signal (ATS/interview/skill gap) and one concrete action.
4. "strategy" — 2–4 items. Practical next steps: e.g. apply in parallel, target stepping stone, get interview feedback, negotiate timing.
5. Never repeat the same idea across improvements and strategy.
6. If probability > 75: affirming but still give 1–2 sharpening tips.
7. If probability < 50: honest, not discouraging — focus on highest-leverage fixes.

JSON SCHEMA:
{ "explanation": "string", "improvements": ["string"], "strategy": ["string"] }`;
}

function buildFallbackAvaOffer(
  probability: number, targetRole: string,
  riskFactors: string[], atsScore: number,
  interviewScore: number, jobMatchScore: number,
  marketCompetition: number
): AvaOfferInsight {
  const explanation = riskFactors.length > 0
    ? `Your offer probability for ${targetRole} is ${probability.toFixed(1)}%. The biggest blocker is: ${riskFactors[0].split('—')[0].trim()}.`
    : `Your offer probability for ${targetRole} is ${probability.toFixed(1)}% — your application is well-positioned.`;

  const improvements: string[] = [];
  if (atsScore < 60)       improvements.push(`ATS score is ${atsScore.toFixed(0)}/100 — rewrite skills section to mirror the job description keywords exactly.`);
  if (interviewScore < 60) improvements.push(`Interview score is ${interviewScore.toFixed(0)}/100 — practise 3 role-specific STAR stories before your next interview.`);
  if (jobMatchScore < 60)  improvements.push(`Job match is ${jobMatchScore.toFixed(0)}/100 — address the top 2–3 missing skills before reapplying.`);
  if (improvements.length === 0) improvements.push(`Strengthen your weakest scoring factor to push your probability above ${Math.min(probability + 10, 100).toFixed(0)}%.`);

  const strategy: string[] = [];
  if (probability < 50)           strategy.push(`Apply to 3–4 similar but less competitive roles in parallel to increase your offer volume.`);
  if (marketCompetition > 0.6)    strategy.push(`High competition — send a personalised follow-up to the hiring manager 5 days after applying.`);
  if (interviewScore < 65)        strategy.push(`Book a mock interview this week — interview performance is the single highest-weighted factor (25%).`);
  if (strategy.length === 0)      strategy.push(`Follow up after your interview with a specific reference to something discussed — it keeps you top of mind.`);

  return { explanation, improvements: improvements.slice(0, 4), strategy: strategy.slice(0, 4) };
}

async function buildAvaOfferInsight(
  probability: number, confidenceLevel: OfferConfidenceLevel,
  riskFactors: string[], jobMatchScore: number, interviewScore: number,
  atsScore: number, targetRole: string, marketCompetition: number
): Promise<AvaOfferInsight> {
  const prompt = buildAvaOfferPrompt(
    probability, confidenceLevel, riskFactors,
    jobMatchScore, interviewScore, atsScore, targetRole, marketCompetition
  );
  try {
    const raw = await generateJSON(prompt, 'capable', 350);
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const explanation = typeof obj.explanation === 'string' && obj.explanation.trim().length > 10
      ? obj.explanation.trim()
      : buildFallbackAvaOffer(probability, targetRole, riskFactors, atsScore, interviewScore, jobMatchScore, marketCompetition).explanation;
    const improvements: string[] = Array.isArray(obj.improvements)
      ? obj.improvements.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : buildFallbackAvaOffer(probability, targetRole, riskFactors, atsScore, interviewScore, jobMatchScore, marketCompetition).improvements;
    const strategy: string[] = Array.isArray(obj.strategy)
      ? obj.strategy.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : buildFallbackAvaOffer(probability, targetRole, riskFactors, atsScore, interviewScore, jobMatchScore, marketCompetition).strategy;
    return { explanation, improvements, strategy };
  } catch {
    return buildFallbackAvaOffer(
      probability, targetRole, riskFactors,
      atsScore, interviewScore, jobMatchScore, marketCompetition
    );
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Parse ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  // --- Validate ---
  if (!validateBody(body)) {
    return NextResponse.json({
      error: 'Missing or invalid fields.',
      required: {
        jobId: 'string',
        'userProfile.skills': 'string[]',
        'userProfile.experience': 'number (years)',
        'userProfile.targetRole': 'string',
        'userProfile.atsScore': 'number 0–100 (optional)',
        'userProfile.interviewScore': 'number 0–100 (optional)',
      },
    }, { status: 422 });
  }

  const { jobId, userProfile } = body;
  const {
    skills, experience, targetRole,
    currentRole = targetRole,
    atsScore:        profileAts,
    interviewScore:  profileInterview,
  } = userProfile;

  // --- Cache check ---
  const cacheKey = `${jobId}:${targetRole}:${skills.sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: { 'X-Cache': 'HIT', 'X-Cache-TTL': String(CACHE_TTL_MS / 1000) },
    });
  }

  // --- Step 1: Fan out all data fetches in parallel ---
  const [jobMatchScore, atsScore, interviewScore, marketCompetition] =
    await Promise.all([
      fetchJobMatchScore(jobId, targetRole, skills),
      fetchAtsScore(jobId, skills, profileAts),
      fetchInterviewScore(jobId, profileInterview),
      resolveMarketCompetition(currentRole, targetRole),
    ]);

  // --- Step 2: Compute skill match + experience fit (synchronous) ---
  const { skillMatch, missingSkills } = computeSkillMatchAndGaps(targetRole, skills);
  const experienceFit = computeExperienceFit(targetRole, experience);

  // --- Step 3: Predict offer probability (pure, synchronous) ---
  const prediction = predictOfferProbability({
    jobMatchScore, atsScore, interviewScore,
    skillMatch, experienceFit, marketCompetition,
    missingSkills,
  });

  // --- Step 4: Ava insight (LLM, non-blocking — failure returns fallback) ---
  const avaInsight = await buildAvaOfferInsight(
    prediction.probability,
    prediction.confidenceLevel,
    prediction.riskFactors,
    jobMatchScore,
    interviewScore,
    atsScore,
    targetRole,
    marketCompetition,
  );

  // --- Step 5: Compose and cache response ---
  const response: OfferProbabilityResponseBody = {
    jobId,
    probability:       prediction.probability,
    confidenceLevel:   prediction.confidenceLevel,
    riskFactors:       prediction.riskFactors,
    explanation:       avaInsight.explanation,
    improvements:      avaInsight.improvements,
    strategy:          avaInsight.strategy,
    scoreBreakdown:    prediction.scoreBreakdown,
    marketCompetition,
    meta: {
      jobMatchScore,
      atsScore,
      interviewScore,
      cachedAt: new Date().toISOString(),
    },
  };

  setCache(cacheKey, response);

  return NextResponse.json(response, {
    status: 200,
    headers: { 'X-Cache': 'MISS' },
  });
}