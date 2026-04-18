/**
 * POST /api/resume/generate
 * Runs the full 7-step AI pipeline.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { runGeneratePipeline }        from '@/lib/services/resumePipeline';
import type { UserProfileInput }      from '@/lib/services/resumePipeline';
import type { TemplateId }            from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: { profileData?: UserProfileInput; templateId?: TemplateId } = await req.json();
    if (!body.profileData) return NextResponse.json({ success: false, error: 'profileData required' }, { status: 400 });

    const result = await runGeneratePipeline(body.profileData, uid, body.templateId ?? 'modern');

    return NextResponse.json({
      success: true,
      data: {
        resumeId:  result.resumeId,
        resume:    result.resume,
        atsScore:  result.ats.overall,
        breakdown: result.ats,
        steps:     result.steps,
      },
    });
  } catch (err: any) {
    console.error('[/api/resume/generate]', err.message);
    if (err.message?.includes('API key') || err.message?.includes('provider')) {
      return NextResponse.json({ success: false, error: 'AI service not configured. Add at least one AI API key to .env.local' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: err.message ?? 'Generation failed' }, { status: 500 });
  }
}