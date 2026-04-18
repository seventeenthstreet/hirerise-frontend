/**
 * POST /api/resume/ats-score
 * Instant ATS scoring — no LLM, pure code.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { calculateATS }               from '@/lib/services/atsService';
import type { ResumeContent }         from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: { resumeData: ResumeContent; targetRole?: string } = await req.json();
    if (!body.resumeData) return NextResponse.json({ success: false, error: 'resumeData required' }, { status: 400 });

    const breakdown = calculateATS(body.resumeData, body.targetRole || body.resumeData.targetRole || '');
    return NextResponse.json({ success: true, data: breakdown });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message ?? 'Scoring failed' }, { status: 500 });
  }
}