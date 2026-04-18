/**
 * POST /api/salary/predict
 *
 * Predicts personalised salary range from resume data.
 * Pure computation — no DB, no Supabase.
 * Target: < 400ms (no AI call). AI insights are optional via ?insights=1.
 *
 * Input:
 *   resumeData    — ResumeContent
 *   targetRole?   — override (defaults to resumeData.targetRole)
 *   location?     — LocationTier (default: 'metro')
 *   currentSalary? — LPA (user's current salary for gap calculation)
 *   includeAvaInsights? — boolean (triggers a fast AI call for narrative insights)
 *
 * Output:
 *   prediction    — SalaryPrediction
 *   avaInsights?  — string[] (if includeAvaInsights=true)
 */
import { NextRequest, NextResponse }    from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { calculateATS }                  from '@/lib/services/atsService';
import { generateJSON }                  from '@/lib/services/aiService';
import {
  predictSalary, buildStaticInsights, resolveRole,
  type LocationTier, type SalaryPrediction,
} from '@/lib/salaryData';
import type { ResumeContent }            from '@/lib/supabase';

// ─── Types exported for frontend ─────────────────────────────────────────────
export type { SalaryPrediction, SalaryInsight, SimulatorScenario } from '@/lib/salaryData';

// ─── Ava insight system prompt ────────────────────────────────────────────────
const AVA_SYSTEM = `You are Ava, a career coach specialising in salary negotiation.
Give concise, specific, data-backed insights. Reference actual numbers from the data.
Return ONLY valid JSON — no markdown, no explanation.`;

async function generateAvaInsights(pred: SalaryPrediction, currentSalary: number | null): Promise<string[]> {
  const prompt = `ROLE: ${pred.role}
PREDICTED SALARY: ₹${pred.predicted.median.toFixed(1)}L median (₹${pred.predicted.min.toFixed(1)}L - ₹${pred.predicted.max.toFixed(1)}L)
MARKET MEDIAN: ₹${pred.market.median.toFixed(1)}L
GAP: ₹${pred.gap.toFixed(1)}L (${pred.gapPercent > 0 ? '+' : ''}${pred.gapPercent}% vs market)
${currentSalary ? `CURRENT SALARY: ₹${currentSalary}L` : ''}
EXPERIENCE: ${pred.experienceYears} years
ATS FACTOR: ${(pred.factors.atsFactor * 100 - 88).toFixed(0)}% above baseline
SKILLS MATCH: ${Math.round((pred.factors.skillsFactor - 0.85) / 0.35 * 100)}% of role keywords matched

Generate 3 actionable, specific salary improvement insights.

Return JSON:
{ "insights": ["insight 1", "insight 2", "insight 3"] }`;

  const raw = await generateJSON<{ insights: string[] }>(prompt, 'fast', 400, AVA_SYSTEM);
  return Array.isArray(raw.insights) ? raw.insights.slice(0, 3) : [];
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:          ResumeContent;
      targetRole?:         string;
      location?:           LocationTier;
      currentSalary?:      number | null;
      includeAvaInsights?: boolean;
    } = await req.json();

    if (!body.resumeData) {
      return NextResponse.json({ success: false, error: 'resumeData is required' }, { status: 400 });
    }

    const { resumeData } = body;
    const targetRole     = body.targetRole || resumeData.targetRole || '';
    const location       = body.location ?? 'metro';

    if (!targetRole) {
      return NextResponse.json({ success: false, error: 'targetRole is required' }, { status: 400 });
    }

    // Estimate experience from resume date ranges
    const periods     = resumeData.experience.map(e => e.period).join(' ');
    const years       = (periods.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number).sort((a, b) => a - b);
    const expYears    = years.length >= 2 ? years[years.length - 1] - years[0]
                      : resumeData.experience.length * 2;

    // ATS score (fast — pure code)
    const ats         = calculateATS(resumeData, targetRole);

    const prediction  = predictSalary({
      targetRole,
      location,
      experienceYears: Math.max(0, expYears),
      resumeSkills:    resumeData.skills,
      atsScore:        ats.overall,
      currentSalary:   body.currentSalary ?? null,
    });

    const staticInsights = buildStaticInsights(prediction);

    // Ava AI insights — optional, non-blocking
    let avaInsights: string[] = [];
    if (body.includeAvaInsights) {
      try {
        avaInsights = await generateAvaInsights(prediction, body.currentSalary ?? null);
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      data: {
        prediction,
        staticInsights,
        avaInsights,
        atsUsed:    ats.overall,
        expYearsUsed: Math.max(0, expYears),
      },
    });

  } catch (err: any) {
    console.error('[/api/salary/predict]', err.message);
    return NextResponse.json({ success: false, error: err.message ?? 'Prediction failed' }, { status: 500 });
  }
}