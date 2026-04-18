/**
 * POST /api/career/insights  — AVA v2 UPGRADED
 *
 * WHAT CHANGED:
 *   v1: System prompt said "Be encouraging, specific, and data-driven."
 *       Result: "Your ATS score is improving — keep it up! Consider improving
 *       your market alignment for better opportunities."  (useless)
 *
 *   v2: Prompt forces Ava to name the exact score, the exact dimension that is
 *       weakest, the exact skill missing, and a single concrete action.
 *       Generic phrases are explicitly banned from the output.
 *
 * Input:  { breakdown, history, applicationsCount, streak, skills, targetRole, topJobMatches }
 * Output: { insights: Insight[], weeklyMessage: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { generateJSON }               from '@/lib/services/aiService';
import type { CareerScoreBreakdown, CareerMetricSnapshot, GrowthInsight } from '@/lib/careerGrowth';

// ─── Banned phrases — injected into the system prompt ────────────────────────
// If Ava uses any of these the response is not grounded enough.
const BANNED_PHRASES = [
  'strong profile', 'good foundation', 'market alignment', 'broad skill set',
  'great progress', 'keep it up', 'on the right track', 'various opportunities',
  'leverage your experience', 'diverse background', 'exciting opportunities',
  'well-positioned', 'overall performance',
];

// ─── v2 System prompt ─────────────────────────────────────────────────────────
const SYSTEM = `You are Ava, a direct career advisor. You are reviewing this user's career score data.

RULES — no exceptions:
1. Every insight body must start with a specific number from the data (score, percentage, count, or days).
2. Every suggestion must name a specific skill, tool, or action — never a category.
3. "body" must be exactly 1-2 sentences. First sentence = the problem with its number. Second sentence = the fix with a specific resource or skill name.
4. "title" must be ≤ 7 words and must NOT be generic (no "Keep Going", "Good Work", "Stay Consistent").
5. BANNED PHRASES — never use: ${BANNED_PHRASES.join(', ')}.
6. If the score went up, say by exactly how much and what caused it.
7. If the score went down, say by exactly how much and what the specific risk is.
8. Return ONLY valid JSON — no markdown, no explanation.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

interface InsightsInput {
  breakdown:         CareerScoreBreakdown;
  history:           CareerMetricSnapshot[];
  applicationsCount: number;
  streak:            number;
  skills?:           string[];
  targetRole?:       string;
  topJobMatches?:    Array<{ role: string; matchScore: number; missingSkills: string[] }>;
}

function buildPrompt(input: InsightsInput): string {
  const { breakdown, history, applicationsCount, streak, skills = [], targetRole, topJobMatches = [] } = input;

  // Compute score delta
  const prev  = history.length >= 2 ? history[history.length - 2].composite : null;
  const delta = prev !== null ? breakdown.composite - prev : null;

  // Find weakest and strongest dimension
  const dims = [
    { name: 'ATS Score',      value: breakdown.ats,       label: 'ats' },
    { name: 'Job Match',      value: breakdown.jobMatch,  label: 'jobMatch' },
    { name: 'Interview Prep', value: breakdown.interview, label: 'interview' },
    { name: 'Activity',       value: breakdown.activity,  label: 'activity' },
  ];
  const sorted   = [...dims].sort((a, b) => a.value - b.value);
  const weakest  = sorted[0];
  const strongest = sorted[sorted.length - 1];

  // Top job match context
  const topMatch = topJobMatches[0];
  const topMatchLine = topMatch
    ? `Top job match: "${topMatch.role}" at ${topMatch.matchScore}% — missing skills: ${topMatch.missingSkills.slice(0, 3).join(', ') || 'none'}`
    : 'No job matches available.';

  // Skill context
  const skillLine = skills.length
    ? `User's current skills (${skills.length}): ${skills.slice(0, 8).join(', ')}`
    : 'No skills data available.';

  return `CAREER SCORE SNAPSHOT:
  Overall Score:   ${breakdown.composite}/100
  ATS Score:       ${breakdown.ats}/100
  Job Match:       ${breakdown.jobMatch}/100
  Interview Prep:  ${breakdown.interview}/100
  Activity Level:  ${breakdown.activity}/100

TREND:
  Score change this week: ${delta !== null ? (delta >= 0 ? `+${delta}` : `${delta}`) : 'no prior data'} pts
  Prior week score: ${prev ?? 'N/A'}/100
  Weakest dimension: ${weakest.name} at ${weakest.value}/100
  Strongest dimension: ${strongest.name} at ${strongest.value}/100

CONTEXT:
  Target role: ${targetRole ?? 'Not set'}
  Applications submitted: ${applicationsCount}
  Activity streak: ${streak} day${streak !== 1 ? 's' : ''}
  ${skillLine}
  ${topMatchLine}

Generate exactly 3 insights. Required mix:
  - 1 insight on the WEAKEST dimension (${weakest.name}: ${weakest.value}/100) — name the exact fix
  - 1 insight on score trend (${delta !== null ? (delta >= 0 ? `+${delta} up` : `${Math.abs(delta)} down`) : 'no trend data'})
  - 1 insight on the top job match or skill gap

Return JSON:
{
  "insights": [
    {
      "id": "ins_1",
      "type": "warning|suggestion|celebration|improvement",
      "icon": "single emoji",
      "title": "≤7 words, specific, NO generic phrases",
      "body": "Sentence 1: [number from data] + [specific problem]. Sentence 2: [specific named action/tool/skill]."
    }
  ],
  "weeklyMessage": "1 sentence. Must include the composite score (${breakdown.composite}/100) and one named action."
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: InsightsInput = await req.json();

    if (!body.breakdown) {
      return NextResponse.json({ success: false, error: 'breakdown is required' }, { status: 400 });
    }

    const prompt = buildPrompt(body);

    interface Raw { insights: GrowthInsight[]; weeklyMessage: string }
    const raw = await generateJSON<Raw>(prompt, 'fast', 900, SYSTEM);

    return NextResponse.json({
      success: true,
      data: {
        insights:      (raw.insights ?? []).slice(0, 3),
        weeklyMessage: raw.weeklyMessage ?? '',
      },
    });
  } catch (err: any) {
    console.error('[/api/career/insights POST]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}