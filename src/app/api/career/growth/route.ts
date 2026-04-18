/**
 * POST /api/career/growth   — compute composite score, return breakdown
 * GET  /api/career/growth   — same but from GET (no body needed if scores passed as query)
 *
 * NOTE: Persistence is handled client-side (localStorage) to avoid requiring
 * Supabase credentials. The API is purely a computation endpoint — it applies
 * the weighted formula and returns the breakdown. The CareerGrowthWidget stores
 * snapshots in localStorage under 'career_growth_history'.
 *
 * When Supabase is available (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set),
 * the route also persists to the career_metrics table as a side-effect.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { computeCareerScore }         from '@/lib/careerGrowth';
import type { CareerScoreInput }      from '@/lib/careerGrowth';

// ─── Optional Supabase persist (non-fatal if not configured) ──────────────────
async function tryPersist(uid: string, breakdown: ReturnType<typeof computeCareerScore>) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // Supabase not configured — skip silently

    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key, { auth: { persistSession: false } });

    // Dedup: skip if same composite inserted in last hour
    const { data: recent } = await db
      .from('career_metrics')
      .select('composite, recorded_at')
      .eq('user_id', uid)
      .order('recorded_at', { ascending: false })
      .limit(1);

    const last = (recent as any)?.[0];
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    if (last && last.composite === breakdown.composite && last.recorded_at > oneHourAgo) return;

    await db.from('career_metrics').insert({
      user_id:         uid,
      composite:       breakdown.composite,
      ats_score:       breakdown.ats,
      job_match:       breakdown.jobMatch,
      interview_score: breakdown.interview,
      activity_score:  breakdown.activity,
    });
  } catch {
    // Non-fatal — never block the response for a persist failure
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: CareerScoreInput = await req.json();
    const breakdown = computeCareerScore(body);

    // Fire-and-forget persist — never awaited so it can't block or throw to client
    tryPersist(uid, breakdown);

    return NextResponse.json({ success: true, data: { breakdown } });
  } catch (err: any) {
    console.error('[/api/career/growth POST]', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    // Without Supabase, history is managed client-side
    return NextResponse.json({ success: true, data: { history: [], message: 'History stored client-side' } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}