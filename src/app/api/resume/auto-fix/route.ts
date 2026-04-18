/**
 * POST /api/resume/auto-fix
 *
 * Speed-optimised one-click resume fix.
 * Target: < 5 s end-to-end.
 *
 * Strategy vs /ava-optimize:
 *   - Uses 'fast' model tier (Groq/Gemini-flash vs capable)
 *   - Tighter token budget (2 000 vs 3 500)
 *   - Focused prompt: bullets + keywords only (no full structural rewrite)
 *   - Session cache: Map keyed by sha256(uid+resumeId+atsOverall)
 *     → identical inputs return instantly without hitting the LLM
 *
 * Input:  { resumeData, targetRole, atsData, resumeId? }
 * Output: { fixed, atsAfter, atsBefore, diff, improvementsSummary, scoreIncrease, cached }
 *   fixed               — improved ResumeContent
 *   atsAfter            — recalculated AtsBreakdown (authoritative, code-based)
 *   atsBefore           — original breakdown for comparison
 *   diff                — per-experience bullet diffs + added keywords
 *   improvementsSummary — string[] of human-readable changes
 *   scoreIncrease       — atsAfter.overall - atsBefore.overall
 *   cached              — true when result came from session cache
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { calculateATS }               from '@/lib/services/atsService';
import { generateJSON }               from '@/lib/services/aiService';
import { persistResume }              from '@/lib/services/resumePipeline';
import type { ResumeContent, AtsBreakdown, TemplateId } from '@/lib/supabase';

// ─── Session cache (process-scoped, resets on deploy) ─────────────────────────
// Key = uid + resumeId + atsOverall score. Good enough for "per session" —
// same user fixing the same resume version gets an instant response.
interface CacheEntry {
  result: AutoFixResult;
  at:     number; // Date.now()
}
const SESSION_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes

function cacheKey(uid: string, resumeId: string | null | undefined, atsOverall: number): string {
  return `${uid}:${resumeId ?? 'none'}:${atsOverall}`;
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────
interface BulletDiff {
  expId:    string;
  jobTitle: string;
  before:   string[];
  after:    string[];
  changed:  boolean[];  // parallel to `after` — true when that bullet was rewritten
}

interface AutoFixDiff {
  bullets:        BulletDiff[];
  summaryChanged: boolean;
  keywordsAdded:  string[];  // skills that appear in fixed but not original
}

export interface AutoFixResult {
  fixed:               ResumeContent;
  atsAfter:            AtsBreakdown;
  atsBefore:           AtsBreakdown;
  diff:                AutoFixDiff;
  improvementsSummary: string[];
  scoreIncrease:       number;
  cached:              boolean;
}

function computeDiff(before: ResumeContent, after: ResumeContent, atsBefore: AtsBreakdown): AutoFixDiff {
  // Bullet diffs
  const bullets: BulletDiff[] = before.experience.map(expBefore => {
    const expAfter = after.experience.find(e => e.id === expBefore.id);
    const afterBullets = expAfter?.bullets ?? expBefore.bullets;
    return {
      expId:    expBefore.id,
      jobTitle: expBefore.jobTitle,
      before:   expBefore.bullets,
      after:    afterBullets,
      changed:  afterBullets.map((b, i) => b !== (expBefore.bullets[i] ?? '')),
    };
  });

  // Keywords added (new items in skills array)
  const beforeSkillsSet = new Set(before.skills.map(s => s.toLowerCase()));
  const keywordsAdded   = after.skills.filter(s => !beforeSkillsSet.has(s.toLowerCase()));

  // Summary changed
  const summaryChanged = after.summary.trim() !== before.summary.trim();

  return { bullets, summaryChanged, keywordsAdded };
}

// ─── AI prompt ────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Ava, an expert resume optimizer and ATS specialist.
Your task is to auto-fix a resume to improve its ATS score fast.

FOCUS AREAS (in priority order):
1. Rewrite weak bullet points with strong action verbs + one measurable result per bullet
2. Inject missing keywords naturally into bullets, summary, and skills list
3. Strengthen the professional summary (3-4 sentences max)

STRICT RULES:
- Do NOT fabricate experience, companies, dates, or degrees
- Do NOT invent metrics — use realistic language like "significantly improved" if no numbers exist
- Do NOT add irrelevant keywords
- Preserve all personalInfo fields exactly as-is
- Keep bullets concise: 1-2 lines each
- Return ONLY valid JSON — no markdown, no explanation`;

async function runAutoFix(
  resumeData: ResumeContent,
  targetRole: string,
  atsData:    AtsBreakdown,
): Promise<{ fixed: ResumeContent; improvementsSummary: string[] }> {
  const missingKw = atsData.missingKeywords.slice(0, 6).join(', ') || 'none';

  const userPrompt = `TARGET ROLE: ${targetRole || 'Not specified'}

CURRENT ATS SCORE: ${atsData.overall}/100
WEAKEST DIMENSIONS:
${[
  `  Keyword Match: ${atsData.keywordMatch}%${atsData.keywordMatch < 65 ? ' ⚠' : ''}`,
  `  Content Strength: ${atsData.contentStrength}%${atsData.contentStrength < 65 ? ' ⚠' : ''}`,
  `  Skills Relevance: ${atsData.skillsRelevance}%${atsData.skillsRelevance < 65 ? ' ⚠' : ''}`,
].join('\n')}
MISSING KEYWORDS (add naturally, do NOT stuff): ${missingKw}

RESUME TO FIX:
${JSON.stringify(resumeData, null, 2)}

Return JSON:
{
  "fixed": { ...same structure, personalInfo UNCHANGED },
  "improvementsSummary": ["change 1", "change 2", "change 3"]
}`;

  interface RawResult { fixed: ResumeContent; improvementsSummary: string[] }
  const raw = await generateJSON<RawResult>(userPrompt, 'fast', 2000, SYSTEM_PROMPT);

  // Safety: always restore personalInfo from original
  const fixed: ResumeContent = {
    ...raw.fixed,
    personalInfo: resumeData.personalInfo,
    targetRole:   resumeData.targetRole || targetRole,
  };

  return { fixed, improvementsSummary: Array.isArray(raw.improvementsSummary) ? raw.improvementsSummary : [] };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' },  { status: 401 });

    const body: {
      resumeData:  ResumeContent;
      targetRole?: string;
      atsData?:    AtsBreakdown;
      resumeId?:   string | null;
      templateId?: TemplateId;
    } = await req.json();

    if (!body.resumeData) {
      return NextResponse.json({ success: false, error: 'resumeData is required' }, { status: 400 });
    }

    const targetRole = body.targetRole || body.resumeData.targetRole || '';

    // Compute or use provided ATS baseline
    const atsBefore: AtsBreakdown = body.atsData ?? calculateATS(body.resumeData, targetRole);

    // ── Cache check ───────────────────────────────────────────────────────────
    const key = cacheKey(uid, body.resumeId, atsBefore.overall);
    const now = Date.now();

    // Evict expired entries (simple GC — only on request)
    for (const [k, v] of SESSION_CACHE) {
      if (now - v.at > CACHE_TTL_MS) SESSION_CACHE.delete(k);
    }

    const cached = SESSION_CACHE.get(key);
    if (cached) {
      return NextResponse.json({ success: true, data: { ...cached.result, cached: true } });
    }

    // ── AI fix ────────────────────────────────────────────────────────────────
    const { fixed, improvementsSummary } = await runAutoFix(body.resumeData, targetRole, atsBefore);

    // ── Recalculate ATS (authoritative) ───────────────────────────────────────
    const atsAfter = calculateATS(fixed, targetRole);

    // ── Diff ─────────────────────────────────────────────────────────────────
    const diff = computeDiff(body.resumeData, fixed, atsBefore);

    const scoreIncrease = Math.max(0, atsAfter.overall - atsBefore.overall);

    const result: AutoFixResult = {
      fixed,
      atsAfter,
      atsBefore,
      diff,
      improvementsSummary,
      scoreIncrease,
      cached: false,
    };

    // ── Persist (non-fatal) ───────────────────────────────────────────────────
    persistResume(uid, fixed, atsAfter, targetRole, body.templateId ?? 'modern', null, body.resumeId)
      .catch(() => {/* non-fatal */});

    // ── Store in cache ────────────────────────────────────────────────────────
    SESSION_CACHE.set(key, { result, at: now });

    return NextResponse.json({ success: true, data: result });

  } catch (err: any) {
    console.error('[/api/resume/auto-fix]', err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Auto-fix failed' },
      { status: 500 },
    );
  }
}