/**
 * POST /api/resume/save
 * Saves resume to Supabase with ATS score.
 */
import { NextRequest, NextResponse }        from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { persistResume }                     from '@/lib/services/resumePipeline';
import { calculateATS }                      from '@/lib/services/atsService';
import type { ResumeContent, TemplateId, ResumeCustomization } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:    ResumeContent;
      targetRole?:   string;
      templateId?:   TemplateId;
      customization?: ResumeCustomization;
      resumeId?:     string | null;
    } = await req.json();

    if (!body.resumeData) return NextResponse.json({ success: false, error: 'resumeData required' }, { status: 400 });

    const targetRole = body.targetRole || body.resumeData.targetRole || '';
    const ats        = calculateATS(body.resumeData, targetRole);
    const savedId    = await persistResume(
      uid, body.resumeData, ats, targetRole,
      body.templateId ?? 'modern', body.customization ?? null, body.resumeId,
    );

    return NextResponse.json({
      success: true,
      data: { resumeId: savedId, atsScore: ats.overall, savedAt: new Date().toISOString() },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message ?? 'Save failed' }, { status: 500 });
  }
}