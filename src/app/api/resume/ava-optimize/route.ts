/**
 * POST /api/resume/ava-optimize
 *
 * Runs a single holistic Ava AI pass over the entire resume, guided by
 * the full ATS breakdown. Recalculates the real ATS score after improvement
 * and persists the result to Supabase.
 */

import { NextRequest, NextResponse }                                    from 'next/server';
import { verifySupabaseToken }                                           from '@/lib/auth';
import { runAvaOptimizePipeline }                                        from '@/lib/resumePipeline';
import type { ResumeContent, AtsBreakdown, TemplateId, ResumeCustomization } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:    ResumeContent;
      targetRole?:   string;
      atsBreakdown:  AtsBreakdown;
      resumeId?:     string | null;
      templateId?:   TemplateId;
      customization?: ResumeCustomization | null;
    } = await req.json();

    if (!body.resumeData)   return NextResponse.json({ success: false, error: 'resumeData required' },   { status: 400 });
    if (!body.atsBreakdown) return NextResponse.json({ success: false, error: 'atsBreakdown required' }, { status: 400 });

    const targetRole = body.targetRole || body.resumeData.targetRole || '';

    const result = await runAvaOptimizePipeline(
      body.resumeData,
      targetRole,
      body.atsBreakdown,
      uid,
      body.resumeId ?? null,
      body.templateId ?? 'modern',
    );

    return NextResponse.json({
      success: true,
      data: {
        improvedResume:         result.improvedResume,
        improvementsSummary:    result.improvementsSummary,
        estimatedScoreIncrease: result.estimatedScoreIncrease,
        actualScoreIncrease:    result.actualScoreIncrease,
        atsScore:               result.ats.overall,
        breakdown:              result.ats,
      },
    });

  } catch (err: any) {
    console.error('[/api/resume/ava-optimize]', err.message);
    return NextResponse.json({
      success: false,
      error: 'Ava optimization failed. Please try again.',
    }, { status: 500 });
  }
}