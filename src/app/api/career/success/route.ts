/**
 * @file app/api/career/success/route.ts
 * @description POST /api/career/success
 *
 * Orchestrates the Career Success Predictor engine with market data and
 * Ava AI explanation. Does NOT touch existing ATS, salary, or job-match APIs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMarketTrends } from '@/lib/services/marketDataService';
import { getMissingSkills, getRoleSkills } from '@/lib/data/roleSkills';
import { generateJSON } from '@/lib/services/aiService';
import type { MarketTrends, RoleDemand } from '@/lib/services/marketDataService';

// ---------------------------------------------------------------------------
// Inlined types (avoids unresolved module dependencies on new service files
// until they are placed in src/lib/services/ — remove once files are in place)
// ---------------------------------------------------------------------------

type ConfidenceLevel = 'low' | 'medium' | 'high';

interface PredictionScoreBreakdown {
  skillMatch: number;
  atsFactor: number;
  experienceFit: number;
  marketDemand: number;
  interviewFactor: number;
}

interface CareerSuccessPrediction {
  probability: number;
  timelineMonths: number;
  missingSkills: string[];
  confidenceLevel: ConfidenceLevel;
  scoreBreakdown: PredictionScoreBreakdown;
}

interface AvaInsight {
  explanation: string;
  strengths: string[];
  improvements: string[];
}

// ---------------------------------------------------------------------------
// Inlined: predictCareerSuccess
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }

function computeSkillMatch(targetRole: string, userSkills: string[]): { skillMatch: number; missingCoreSkills: string[] } {
  try {
    const missing = getMissingSkills(targetRole, userSkills);
    const missingCore: string[] = missing.missingCore ?? [];
    const roleData = getRoleSkills(targetRole) as unknown as Record<string, unknown>;
    const totalCore: number = Array.isArray(roleData?.core)
      ? (roleData.core as string[]).length
      : Array.isArray(roleData?.coreSkills)
      ? (roleData.coreSkills as string[]).length
      : missingCore.length;
    if (totalCore === 0) return { skillMatch: 1.0, missingCoreSkills: [] };
    return { skillMatch: clamp(Math.max(0, totalCore - missingCore.length) / totalCore, 0, 1), missingCoreSkills: missingCore };
  } catch { return { skillMatch: 1.0, missingCoreSkills: [] }; }
}

function normaliseExperience(experience: number, targetRole: string): number {
  try {
    const rd = getRoleSkills(targetRole) as unknown as Record<string, unknown>;
    const min = typeof rd?.minExperienceYears === 'number' ? rd.minExperienceYears : null;
    return (min == null || min <= 0) ? 1.0 : clamp(experience / min, 0, 1);
  } catch { return 1.0; }
}

function predictCareerSuccess(input: {
  currentRole: string; targetRole: string; userSkills: string[];
  experience: number; atsScore: number; interviewScore: number; marketDemand: number;
}): CareerSuccessPrediction {
  const { targetRole, userSkills, experience, atsScore, interviewScore, marketDemand } = input;
  const { skillMatch, missingCoreSkills } = computeSkillMatch(targetRole, userSkills);
  const experienceFit = normaliseExperience(experience, targetRole);
  const atsFactor = clamp(atsScore, 0, 100) / 100;
  const interviewFactor = clamp(interviewScore, 0, 100) / 100;
  const md = clamp(marketDemand, 0, 1);
  const raw = skillMatch * 0.3 + atsFactor * 0.2 + experienceFit * 0.2 + md * 0.15 + interviewFactor * 0.15;
  const penalised = clamp(raw - missingCoreSkills.length * 0.075, 0, 1);
  const probability = Math.round(penalised * 1000) / 10;
  const confidenceLevel: ConfidenceLevel = probability >= 70 ? 'high' : probability >= 40 ? 'medium' : 'low';
  return { probability, timelineMonths: missingCoreSkills.length * 3, missingSkills: missingCoreSkills, confidenceLevel,
    scoreBreakdown: { skillMatch, atsFactor, experienceFit, marketDemand: md, interviewFactor } };
}

// ---------------------------------------------------------------------------
// Inlined: buildAvaExplanation
// ---------------------------------------------------------------------------

async function buildAvaExplanation(input: {
  probability: number; missingSkills: string[]; timelineMonths: number;
  marketDemand: number; targetRole: string; confidenceLevel: ConfidenceLevel;
  scoreBreakdown: PredictionScoreBreakdown;
}): Promise<AvaInsight> {
  const { probability, missingSkills, timelineMonths, marketDemand, targetRole, confidenceLevel, scoreBreakdown } = input;
  const demandLabel = marketDemand >= 0.75 ? 'very high' : marketDemand >= 0.5 ? 'moderate to high' : marketDemand >= 0.25 ? 'moderate' : 'low';
  const missingList = missingSkills.length > 0 ? missingSkills.join(', ') : 'none — the candidate appears fully qualified';
  const timelineLabel = timelineMonths === 0 ? 'ready now' : `approximately ${timelineMonths} month${timelineMonths === 1 ? '' : 's'}`;

  const prompt = `You are Ava, a career strategist AI. You speak directly, concisely, and with genuine insight.

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

RULES:
1. Return ONLY valid JSON — no prose, no markdown fences.
2. "explanation" must be 2–3 sentences. Reference actual probability, role, and market demand. No generic phrases.
3. "strengths" must be 2–4 items from score components ≥ 60%. Be specific.
4. "improvements" must be 2–4 items. Each names a specific missing skill or weak component with one concrete action.
5. Tone: direct, encouraging but honest, professional.

JSON SCHEMA: { "explanation": "string", "strengths": ["string"], "improvements": ["string"] }`;

  try {
    const raw = await generateJSON(prompt, 'capable', 400);
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const explanation = typeof obj.explanation === 'string' && obj.explanation.trim().length > 10
      ? obj.explanation.trim()
      : `Your probability of transitioning to ${targetRole} is ${probability.toFixed(1)}%.`;
    const strengths: string[] = Array.isArray(obj.strengths)
      ? obj.strengths.filter((s): s is string => typeof s === 'string').slice(0, 4) : [];
    const improvements: string[] = Array.isArray(obj.improvements)
      ? obj.improvements.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : missingSkills.slice(0, 3).map((s: string) => `Build hands-on experience in ${s} through a focused project or course.`);
    return { explanation, strengths, improvements };
  } catch {
    return {
      explanation: `Your probability of transitioning to ${targetRole} is ${probability.toFixed(1)}%.`,
      strengths: [],
      improvements: missingSkills.slice(0, 3).map((s: string) => `Develop proficiency in ${s}.`),
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  skills: string[];
  experience: number;
  atsScore: number;
  interviewScore: number;
}

interface SuccessRequestBody {
  currentRole: string;
  targetRole: string;
  userProfile: UserProfile;
}

interface SuccessResponseBody {
  probability: number;
  timelineMonths: number;
  missingSkills: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  explanation: string;
  strengths: string[];
  improvements: string[];
  marketDemand: number;
  scoreBreakdown: {
    skillMatch: number;
    atsFactor: number;
    experienceFit: number;
    marketDemand: number;
    interviewFactor: number;
  };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateBody(body: unknown): body is SuccessRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  if (typeof b.currentRole !== 'string' || !b.currentRole.trim()) return false;
  if (typeof b.targetRole !== 'string' || !b.targetRole.trim()) return false;
  if (!b.userProfile || typeof b.userProfile !== 'object') return false;

  const p = b.userProfile as Record<string, unknown>;
  if (!Array.isArray(p.skills)) return false;
  if (typeof p.experience !== 'number') return false;
  if (typeof p.atsScore !== 'number') return false;
  if (typeof p.interviewScore !== 'number') return false;

  return true;
}

// ---------------------------------------------------------------------------
// Market demand resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a 0–1 demand score for `targetRole` from market trend data.
 * Falls back to 0.5 (neutral) if the role is not found or fetch fails.
 */
async function resolveMarketDemand(
  currentRole: string,
  targetRole: string
): Promise<number> {
  try {
    const trends: MarketTrends = await getMarketTrends(currentRole);
    const entry = trends.topNextRoles?.find(
      (r: RoleDemand) => r.role.toLowerCase() === targetRole.toLowerCase()
    );
    // Support both field names defensively (matches aiCareerPathService pattern)
    const rd = entry as (RoleDemand & { score?: number; demandScore?: number }) | undefined;
    return rd?.score ?? rd?.demandScore ?? 0.5;
  } catch {
    return 0.5;
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
    return NextResponse.json(
      { error: 'Invalid JSON in request body.' },
      { status: 400 }
    );
  }

  // --- Validate ---
  if (!validateBody(body)) {
    return NextResponse.json(
      {
        error: 'Missing or invalid fields.',
        required: {
          currentRole: 'string',
          targetRole: 'string',
          'userProfile.skills': 'string[]',
          'userProfile.experience': 'number',
          'userProfile.atsScore': 'number (0–100)',
          'userProfile.interviewScore': 'number (0–100)',
        },
      },
      { status: 422 }
    );
  }

  const { currentRole, targetRole, userProfile } = body;
  const { skills, experience, atsScore, interviewScore } = userProfile;

  // --- Step 1: Fetch market demand (non-blocking race with timeout) ---
  const marketDemand = await resolveMarketDemand(currentRole, targetRole);

  // --- Step 2: Run the prediction engine (pure, synchronous) ---
  const prediction = predictCareerSuccess({
    currentRole,
    targetRole,
    userSkills: skills,
    experience,
    atsScore,
    interviewScore,
    marketDemand,
  });

  // --- Step 3: Generate Ava AI explanation (parallel-safe, non-blocking) ---
  let avaInsight: AvaInsight;
  try {
    avaInsight = await buildAvaExplanation({
      probability: prediction.probability,
      missingSkills: prediction.missingSkills,
      timelineMonths: prediction.timelineMonths,
      marketDemand,
      targetRole,
      confidenceLevel: prediction.confidenceLevel,
      scoreBreakdown: prediction.scoreBreakdown,
    });
  } catch {
    // Ava failure must never block the prediction result
    avaInsight = {
      explanation: `Your success probability for ${targetRole} is ${prediction.probability.toFixed(1)}%.`,
      strengths: [],
      improvements: prediction.missingSkills
        .slice(0, 3)
        .map((s: string) => `Develop proficiency in ${s}.`),
    };
  }

  // --- Step 4: Compose response ---
  const response: SuccessResponseBody = {
    probability: prediction.probability,
    timelineMonths: prediction.timelineMonths,
    missingSkills: prediction.missingSkills,
    confidenceLevel: prediction.confidenceLevel,
    explanation: avaInsight.explanation,
    strengths: avaInsight.strengths,
    improvements: avaInsight.improvements,
    marketDemand,
    scoreBreakdown: prediction.scoreBreakdown,
  };

  return NextResponse.json(response, { status: 200 });
}