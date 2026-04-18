/**
 * POST /api/resume/improve
 * Targeted improvement: summary | bullets | keywords | full
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { runImprovePipeline }         from '@/lib/services/resumePipeline';
import type { ImproveTarget }         from '@/lib/services/resumePipeline';
import type { ResumeContent, TemplateId } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData: ResumeContent; targetRole: string;
      target: ImproveTarget; resumeId?: string | null; templateId?: TemplateId;
    } = await req.json();

    if (!body.resumeData || !body.target?.type) {
      return NextResponse.json({ success: false, error: 'resumeData and target.type required' }, { status: 400 });
    }

    const result = await runImprovePipeline(
      body.resumeData,
      body.targetRole || body.resumeData.targetRole || '',
      body.target, uid, body.resumeId, body.templateId ?? 'modern',
    );

    return NextResponse.json({
      success: true,
      data: { resume: result.resume, atsScore: result.ats.overall, breakdown: result.ats, changeSummary: result.changeSummary },
    });
  } catch (err: any) {
    console.error('[/api/resume/improve]', err.message);
    return NextResponse.json({ success: false, error: err.message ?? 'Improvement failed' }, { status: 500 });
  }
}