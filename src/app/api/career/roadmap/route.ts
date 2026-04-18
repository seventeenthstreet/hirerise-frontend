/**
 * POST /api/career/roadmap
 *
 * Generates an Ava-powered, actionable career roadmap between two roles.
 * Uses 'fast' AI tier — target < 3 s.
 *
 * Input:
 *   currentRole  string     User's present role
 *   targetRole   string     Role they want to reach
 *   skillsGap    string[]   Missing core skills (from careerPathService)
 *   timeline     number     Estimated months to transition
 *
 * Output:
 *   { roadmap: string[], advice: string }
 *     roadmap — exactly 1-5 ordered, actionable steps (no generic advice)
 *     advice  — one sentence: Ava's single most important coaching call-out
 *
 * Validation:
 *   400  if currentRole or targetRole are missing / non-string
 *   400  if timeline is not a positive finite number
 *   401  Unauthorized / invalid token
 *   500  AI or internal failure
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { generateJSON }               from '@/lib/services/aiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoadmapResult {
  roadmap: string[];   // 1-5 steps, ordered, actionable
  advice:  string;     // 1 sentence coaching insight
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are Ava, a direct, no-nonsense career coach.
Generate a concrete action plan to help someone move from one role to another.

RULES — follow exactly:
1. Return between 1 and 5 steps. Never more than 5.
2. Every step must name a SPECIFIC action (e.g. "Complete the AWS Solutions Architect course on A Cloud Guru" — not "Learn cloud").
3. Every step must be achievable within the given timeline.
4. Reference the actual skills gap — do not repeat skills the person already has.
5. No generic filler ("network more", "update LinkedIn") unless it directly addresses the gap.
6. advice must be ONE sentence: the single most important thing they should do first.
7. Return ONLY valid JSON — no markdown, no explanation, no extra keys.`;

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(body: unknown): { field: string; message: string } | null {
  if (!body || typeof body !== 'object') {
    return { field: 'body', message: 'Request body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.currentRole !== 'string' || !b.currentRole.trim()) {
    return { field: 'currentRole', message: 'currentRole must be a non-empty string.' };
  }
  if (typeof b.targetRole !== 'string' || !b.targetRole.trim()) {
    return { field: 'targetRole', message: 'targetRole must be a non-empty string.' };
  }
  if (b.timeline !== undefined) {
    const t = b.timeline;
    if (typeof t !== 'number' || !isFinite(t) || t <= 0) {
      return { field: 'timeline', message: 'timeline must be a positive finite number (months).' };
    }
  }
  return null;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  currentRole: string,
  targetRole:  string,
  skillsGap:   string[],
  timeline:    number,
): string {
  const months   = Math.round(timeline);
  const timeStr  = months < 12
    ? `${months} month${months !== 1 ? 's' : ''}`
    : `${Math.round(months / 12 * 10) / 10} year${months >= 24 ? 's' : ''}`;

  const gapLine = skillsGap.length > 0
    ? `SKILLS TO ACQUIRE: ${skillsGap.slice(0, 6).join(', ')}`
    : 'SKILLS TO ACQUIRE: None identified — focus on visibility and depth.';

  return `CURRENT ROLE: ${currentRole}
TARGET ROLE: ${targetRole}
ESTIMATED TIMELINE: ${timeStr}
${gapLine}

Generate a specific, ordered action plan to make this transition in ${timeStr}.

Return JSON exactly:
{
  "roadmap": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "advice": "Single most important thing to do first."
}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const uid = await verifySupabaseToken(token);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }

  // Parse
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  // Validate
  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError.message, field: validationError.field },
      { status: 400 },
    );
  }

  const {
    currentRole,
    targetRole,
    skillsGap = [],
    timeline  = 24,
  } = body as {
    currentRole: string;
    targetRole:  string;
    skillsGap?:  string[];
    timeline?:   number;
  };

  try {
    const prompt = buildPrompt(
      currentRole.trim(),
      targetRole.trim(),
      Array.isArray(skillsGap) ? skillsGap.filter(s => typeof s === 'string') : [],
      timeline,
    );

    const raw = await generateJSON<RoadmapResult>(prompt, 'fast', 500, SYSTEM);

    // Sanitise — enforce max 5 steps, ensure strings only
    const roadmap = (Array.isArray(raw.roadmap) ? raw.roadmap : [])
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 5);

    const advice = typeof raw.advice === 'string' ? raw.advice.trim() : '';

    if (roadmap.length === 0) {
      return NextResponse.json(
        { success: false, error: 'AI returned no roadmap steps. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { roadmap, advice } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Roadmap generation failed.';
    console.error('[POST /api/career/roadmap]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}