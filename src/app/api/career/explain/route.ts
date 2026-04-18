/**
 * POST /api/career/explain
 *
 * Generates Ava's 2-sentence explanation for one or more career path steps.
 * Designed for on-demand use when paths have already been generated but need
 * richer explanations — for example, when re-rendering with fresher market data.
 *
 * In the normal flow, explanations are embedded directly in
 * generateDynamicCareerPath() output. This route exists for:
 *   - Re-generating explanations for static SimulatedPathStep[] results
 *   - Regenerating after market data is refreshed
 *   - Client-side "refresh explanation" UX without a full re-simulation
 *
 * Uses the 'fast' AI tier — target < 2 s per call.
 * Falls back to buildDeterministicExplanation() if any path's AI call fails,
 * so the response always contains a complete set of explanations.
 *
 * Input (JSON body):
 *   currentRole   string         — User's present role
 *   userSkills    string[]       — Skills the user holds
 *   experience    number         — Years of experience
 *   paths         PathInput[]    — The paths needing explanations
 *
 * PathInput:
 *   role           string
 *   marketDemand   number        — 0–1 demand score from marketDataService
 *   skillsGap      string[]      — Missing core skills
 *   timelineMonths number
 *   pathType       'vertical' | 'lateral' | 'unknown'
 *   scoreBreakdown { demand, skillMatch, experienceFit }
 *
 * Output (JSON body):
 *   {
 *     success: true,
 *     data: {
 *       explanations: Array<{ role: string; explanation: string }>
 *     }
 *   }
 *
 * Errors:
 *   400  MISSING_FIELDS  — required fields absent
 *   400  INVALID_PATHS   — paths is not an array or items are malformed
 *   401  Unauthorized / Invalid token
 *   500  Internal error  (deterministic fallback used per-path — not surfaced as 500)
 */

import { NextRequest, NextResponse }     from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { generateJSON }                   from '@/lib/services/aiService';
import {
  buildDeterministicExplanation,
  type ScoreBreakdown,
}                                         from '@/lib/services/aiCareerPathService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PathExplainInput {
  role:           string;
  marketDemand:   number;
  skillsGap:      string[];
  timelineMonths: number;
  pathType:       'vertical' | 'lateral' | 'unknown';
  scoreBreakdown: ScoreBreakdown;
}

export interface ExplanationResult {
  role:        string;
  explanation: string;
}

// ─── Ava system prompt ────────────────────────────────────────────────────────

const SYSTEM = `You are Ava, a direct, human career coach.
For each career path provided, write exactly 2 sentences explaining why this role is recommended for this specific candidate.

SENTENCE 1: Market demand — mention the actual demand score and what it means in plain language.
SENTENCE 2: Candidate fit — reference their skill match percentage and growth potential (vertical promotion or lateral pivot).

RULES:
- Max 2 sentences per path. No more.
- Be specific. Use the numbers provided. Do not be vague or generic.
- Write in second person ("Your skills...", "This role shows...").
- Encouraging but honest tone. Never hype.
- Return ONLY valid JSON — no markdown, no explanation, no extra keys.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildExplainPrompt(
  currentRole:  string,
  userSkills:   string[],
  experience:   number,
  paths:        PathExplainInput[],
): string {
  const pathLines = paths.map((p, i) => {
    const demandPct    = Math.round(p.marketDemand * 100);
    const skillPct     = Math.round(p.scoreBreakdown.skillMatch * 100);
    const expFitPct    = Math.round(p.scoreBreakdown.experienceFit * 100);
    const gapSummary   = p.skillsGap.length > 0
      ? p.skillsGap.slice(0, 3).join(', ')
      : 'no critical gaps';

    return [
      `Path ${i + 1}: "${p.role}"`,
      `  Market demand: ${demandPct}%`,
      `  Skill match:   ${skillPct}% (gaps: ${gapSummary})`,
      `  Exp fit:       ${expFitPct}%`,
      `  Timeline:      ${p.timelineMonths} months`,
      `  Type:          ${p.pathType === 'vertical' ? 'Vertical promotion' : 'Lateral pivot'}`,
    ].join('\n');
  }).join('\n\n');

  const skillSummary = userSkills.length > 0
    ? userSkills.slice(0, 6).join(', ')
    : 'not listed';

  return `CANDIDATE:
- Current role: ${currentRole}
- Experience:   ${experience} year${experience !== 1 ? 's' : ''}
- Key skills:   ${skillSummary}

PATHS TO EXPLAIN:
${pathLines}

Return a JSON object with exactly one key "explanations" — an array of objects:
{
  "explanations": [
    { "role": "Exact Role Title", "explanation": "Sentence 1. Sentence 2." },
    ...
  ]
}

One entry per path, in the same order. Exactly 2 sentences each. No extra keys.`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(body: unknown): { field: string; message: string } | null {
  if (!body || typeof body !== 'object') {
    return { field: 'body', message: 'Request body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.currentRole !== 'string' || !b.currentRole.trim()) {
    return { field: 'currentRole', message: 'currentRole must be a non-empty string.' };
  }
  if (!Array.isArray(b.userSkills)) {
    return { field: 'userSkills', message: 'userSkills must be an array.' };
  }
  if (typeof b.experience !== 'number' || !isFinite(b.experience) || b.experience < 0) {
    return { field: 'experience', message: 'experience must be a finite number ≥ 0.' };
  }
  if (!Array.isArray(b.paths) || b.paths.length === 0) {
    return { field: 'paths', message: 'paths must be a non-empty array.' };
  }
  if (b.paths.length > 10) {
    return { field: 'paths', message: 'paths array must not exceed 10 items.' };
  }

  for (let i = 0; i < (b.paths as unknown[]).length; i++) {
    const p = (b.paths as unknown[])[i];
    if (!p || typeof p !== 'object') {
      return { field: `paths[${i}]`, message: `paths[${i}] must be an object.` };
    }
    const pObj = p as Record<string, unknown>;
    if (typeof pObj.role !== 'string' || !pObj.role.trim()) {
      return { field: `paths[${i}].role`, message: `paths[${i}].role must be a non-empty string.` };
    }
  }

  return null;
}

// ─── Sanitise one AI explanation ──────────────────────────────────────────────

/**
 * Returns the AI explanation if it's valid (2+ sentences, ≥ 30 chars).
 * Otherwise returns null so the caller falls back to deterministic builder.
 */
function sanitiseExplanation(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length < 30) return null;
  const trimmed   = raw.trim();
  // Must contain at least one sentence-ending punctuation
  if (!/[.!?]/.test(trimmed)) return null;
  return trimmed;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const uid = await verifySupabaseToken(token);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError.message, field: validationError.field },
      { status: 400 },
    );
  }

  const {
    currentRole,
    userSkills,
    experience,
    paths,
  } = body as {
    currentRole: string;
    userSkills:  string[];
    experience:  number;
    paths:       PathExplainInput[];
  };

  // ── Build prompt and call LLM ─────────────────────────────────────────────
  try {
    const prompt = buildExplainPrompt(
      currentRole.trim(),
      userSkills.filter((s: unknown) => typeof s === 'string'),
      experience,
      paths,
    );

    interface RawExplainResponse {
      explanations: Array<{ role: unknown; explanation: unknown }>;
    }

    const raw = await generateJSON<RawExplainResponse>(prompt, 'fast', 800, SYSTEM);

    // ── Merge AI results with deterministic fallbacks ──────────────────────
    // AI returns an array ordered by path — zip against input paths.
    // If the AI result is missing, malformed, or too short → deterministic.
    const aiResults = Array.isArray(raw.explanations) ? raw.explanations : [];

    const explanations: ExplanationResult[] = paths.map((p, i) => {
      const aiEntry      = aiResults[i];
      const aiText       = aiEntry ? sanitiseExplanation(aiEntry.explanation) : null;

      const explanation  = aiText ?? buildDeterministicExplanation(
        p.role,
        userSkills,
        experience,
        p.scoreBreakdown,
        p.pathType,
        p.timelineMonths,
      );

      return { role: p.role, explanation };
    });

    console.log(
      `[POST /api/career/explain] ✓ Generated ${explanations.length} explanation(s) for "${currentRole}"`,
    );

    return NextResponse.json({ success: true, data: { explanations } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Explanation generation failed.';
    console.error('[POST /api/career/explain]', message);

    // ── Total AI failure → return deterministic explanations for all paths ──
    // This keeps the API contract: callers always get a full set of explanations.
    const explanations: ExplanationResult[] = paths.map(p => ({
      role: p.role,
      explanation: buildDeterministicExplanation(
        p.role,
        userSkills,
        experience,
        p.scoreBreakdown ?? { demand: 0.5, skillMatch: 0.5, experienceFit: 1 },
        p.pathType ?? 'vertical',
        p.timelineMonths ?? 12,
      ),
    }));

    // Return 200 with deterministic fallback — not a 500.
    // Callers don't need to handle the error; they just get explanations.
    return NextResponse.json({
      success:  true,
      data:     { explanations },
      warning:  'AI unavailable — explanations generated deterministically.',
    });
  }
}